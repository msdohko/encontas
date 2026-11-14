/**
 * App encontas: modelo de dados e regras de negócio (vanilla JS, roda no navegador e no Node)
 *
 * FIRESTORE
 * ─────────────────────────────────────────────────────────────────────
 * usuarios/{uid}                      { nome, email, foto, casaId }
 * convites/{codigo}                   { casaId, criadoPor, expiraEm }
 * casas/{casaId}                      { nome, dono, membros[], membrosInfo{}, inicioControle: '2026-11' }
 *   categorias/{id}                   { nome, cor, ordem }
 *   formas/{id}                       { nome, tipo, diaVencimento, limite|null, ativo }      ← "onde desconta"
 *   fontes/{id}                       ← fontes de renda (Etapa 3)
 *     { nome, pessoa, tipo: 'fixa'|'variavel'|'eventual', valor, dia, inicio, fim, ativo }
 *       fixa      = mesmo valor todo mês (vale)            → conta sozinha, sem perguntar
 *       variavel  = muda todo mês (salário)                → previsto = média dos últimos 3; o app pergunta o valor real
 *       eventual  = sem data nem valor (vendas, Pedacinho) → só conta o que for lançado
 *   entradas/{id}                     { fonteId, valor, data, ref: '2026-09'|null, competencia, quinzena, pessoa }
 *       ref = mês de pagamento a que se refere (salário de 30/09 → ref '2026-09')
 *   recorrentes/{id}                  ← contas fixas E assinaturas
 *     { nome, valor, valorVariavel, diaVencimento, formaId, categoriaId, inicio, fim,
 *       assinatura: bool, ciclo: 'mensal'|'anual', mesRenovacao: 1..12, pessoa, ultimaRevisao }
 *   compras/{id}                      { nome, valorTotal, parcelas, formaId, categoriaId, primeiraData, pessoa, criadoPor }
 *   lancamentos/{id}                  ← tudo que sai, quinzena a quinzena (ids determinísticos: sem duplicar)
 *     { descricao, valor, data, dataOriginal, competencia, quinzena, status: 'pendente'|'pago', pagoEm,
 *       confirmado (contas de valor variável), origem: { tipo, id, parcela, de }, formaId, categoriaId, pessoa, historico[] }
 */

// ── Datas e quinzenas ────────────────────────────────────────────────
export const pad = n => String(n).padStart(2, '0');
export const ultimoDia = (ano, mes) => new Date(ano, mes, 0).getDate(); // mes 1..12

/** Dia 1–14 → 1ª quinzena · dia 15–31 → 2ª quinzena */
export const quinzenaDe = dataISO => (Number(dataISO.slice(8, 10)) < 15 ? 1 : 2);
export const competenciaDe = dataISO => dataISO.slice(0, 7);

/** Mesma data N meses depois (N pode ser negativo), respeitando meses curtos */
export function somarMeses(dataISO, n, diaFixo) {
  const [a0, m0, d] = dataISO.split('-').map(Number);
  const t = a0 * 12 + (m0 - 1) + n, a = Math.floor(t / 12), m = (t % 12) + 1;
  const dia = Math.min(diaFixo ?? d ?? 1, ultimoDia(a, m));
  return `${a}-${pad(m)}-${pad(dia)}`;
}
export const somarMesesComp = (comp, n) => somarMeses(comp + '-01', n).slice(0, 7);
export const dataNoMes = (comp, dia) => { const [a, m] = comp.split('-').map(Number); return `${comp}-${pad(Math.min(dia, ultimoDia(a, m)))}`; };

// ── Dinheiro (centavos para não errar arredondamento) ────────────────
export const cent = v => Math.round(v * 100);
export const reais = c => c / 100;
export function dividirParcelas(valorTotal, n) {
  const total = cent(valorTotal), base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => reais(i === n - 1 ? total - base * (n - 1) : base));
}

// ── Saídas: geradores de lançamentos ─────────────────────────────────
const novoLanc = (base, data) => ({
  ...base, data, dataOriginal: data, competencia: competenciaDe(data), quinzena: quinzenaDe(data),
  status: 'pendente', pagoEm: null, historico: [],
});

/** Compra → parcelas. Parcela 1 em primeiraData; as seguintes no dia de vencimento da forma. */
export function gerarParcelas(compra, forma) {
  return dividirParcelas(compra.valorTotal, compra.parcelas).map((valor, i) => novoLanc({
    id: `${compra.id}_${i + 1}`,
    descricao: compra.parcelas > 1 ? `${compra.nome} (${i + 1}/${compra.parcelas})` : compra.nome,
    valor, formaId: compra.formaId, categoriaId: compra.categoriaId ?? null, pessoa: compra.pessoa ?? null,
    criadoPor: compra.criadoPor ?? null, origem: { tipo: 'compra', id: compra.id, parcela: i + 1, de: compra.parcelas },
  }, somarMeses(compra.primeiraData, i, i === 0 || !temFatura(forma) ? undefined : forma.diaVencimento)));
}

/** Meses em que uma conta fixa/assinatura cobra, de `de` até `ate` */
export function mesesDaRecorrente(rec, de, ate) {
  const out = [], fim = rec.fim && rec.fim < ate ? rec.fim : ate;
  for (let c = rec.inicio > de ? rec.inicio : de; c <= fim; c = somarMesesComp(c, 1)) {
    if (rec.ciclo === 'anual' && Number(c.slice(5, 7)) !== Number(rec.mesRenovacao || rec.inicio.slice(5, 7))) continue;
    out.push(c);
  }
  return out;
}

export function lancamentoDaRecorrente(rec, comp) {
  return novoLanc({
    id: `${rec.id}_${comp}`, descricao: rec.nome, valor: rec.valor, formaId: rec.formaId ?? null,
    categoriaId: rec.categoriaId ?? null, pessoa: rec.pessoa ?? null, criadoPor: null,
    confirmado: !rec.valorVariavel, origem: { tipo: rec.assinatura ? 'assinatura' : 'recorrente', id: rec.id },
  }, dataNoMes(comp, rec.diaVencimento));
}

export const gerarRecorrentes = (rec, ate) => mesesDaRecorrente(rec, rec.inicio, ate).map(c => lancamentoDaRecorrente(rec, c));

/**
 * Sincroniza os lançamentos de uma conta fixa/assinatura com o cadastro dela, de `desde` até `ate`:
 * cria os que faltam, atualiza os pendentes (valor, data, forma…) e apaga os que passaram do fim.
 * Lançamentos já pagos nunca são alterados. Retorna { criar:[], atualizar:[], apagar:[ids] }.
 */
export function sincronizarRecorrente(rec, lancamentos, desde, ate) {
  const meus = lancamentos.filter(l => l.origem?.id === rec.id);
  const esperados = new Set(rec.ativo === false ? [] : mesesDaRecorrente(rec, rec.inicio, ate).filter(c => c >= desde));
  const r = { criar: [], atualizar: [], apagar: [] };
  for (const l of meus) {
    if (l.status === 'pago' || l.competencia < desde) continue;
    const comp = l.id.slice(-7);
    if (!esperados.has(comp)) { r.apagar.push(l.id); continue; }
    const novo = lancamentoDaRecorrente(rec, comp);
    const valor = rec.valorVariavel && l.confirmado ? l.valor : novo.valor; // não desfaz valor já confirmado
    const data = foiAdiado(l) ? l.data : novo.data;                         // não desfaz adiamento
    r.atualizar.push({ ...l, descricao: novo.descricao, valor, formaId: novo.formaId, categoriaId: novo.categoriaId,
      pessoa: novo.pessoa, data, competencia: competenciaDe(data), quinzena: quinzenaDe(data), origem: novo.origem });
  }
  const existentes = new Set(meus.map(l => l.id));
  for (const c of esperados) if (!existentes.has(`${rec.id}_${c}`)) r.criar.push(lancamentoDaRecorrente(rec, c));
  return r;
}

// ── Entradas: fontes de renda ────────────────────────────────────────
/** Para qual quinzena vai um dinheiro que entra: dia 25+ → 1ª do mês seguinte · 15–24 → 2ª · 1–14 → 1ª */
export function destinoEntrada(dataISO) {
  const d = Number(dataISO.slice(8, 10));
  if (d >= 25) return { competencia: somarMesesComp(dataISO.slice(0, 7), 1), quinzena: 1 };
  return { competencia: dataISO.slice(0, 7), quinzena: d < 15 ? 1 : 2 };
}

/** Valor previsto de uma fonte: fixa = valor; variável = média dos últimos 3 recebidos (ou o valor estimado) */
export function estimativaFonte(fonte, entradas, ref = null) {
  if (fonte.tipo === 'fixa') return valorFixoEm(fonte, ref);
  if (fonte.tipo === 'eventual') return 0;
  const ult = entradas.filter(e => e.fonteId === fonte.id).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);
  if (!ult.length) return fonte.valor || 0;
  return reais(Math.round(ult.reduce((s, e) => s + cent(e.valor), 0) / ult.length));
}

/** Valor de uma fonte fixa num mês: reajustes guardam o valor antigo em historicoValor [{ ate: 'AAAA-MM', valor }] */
export function valorFixoEm(fonte, ref) {
  if (ref) for (const h of [...(fonte.historicoValor || [])].sort((a, b) => a.ate.localeCompare(b.ate))) if (ref <= h.ate) return h.valor;
  return fonte.valor || 0;
}

/**
 * Todo dinheiro que entra nas competências pedidas: entradas lançadas + previsões das fontes.
 * Cada item: { fonteId, valor, competencia, quinzena, data, ref, previsto, aConfirmar }
 */
export function receitasNoPeriodo(fontes, entradas, comps) {
  const alvo = new Set(comps);
  // entrada prevista (13º, férias, PLR…): entra na conta pelo valor estimado (ou 0 se "a definir") até ser confirmada
  const out = entradas.filter(e => alvo.has(e.competencia)).map(e => e.prevista
    ? { ...e, valor: e.valor ?? 0, semValor: e.valor == null, previsto: true, aConfirmar: true }
    : { ...e, previsto: false, aConfirmar: false });
  for (const f of fontes) {
    if (f.ativo === false || f.tipo === 'eventual' || !f.dia) continue;
    const meses = new Set(comps.flatMap(c => [somarMesesComp(c, -1), c]));
    for (const ref of meses) {
      if ((f.inicio && ref < f.inicio) || (f.fim && ref > f.fim)) continue;
      // o dinheiro cai no dia útil (ex.: dia 15 no domingo → sexta 13), mas continua pagando a quinzena do dia combinado
      const nominal = dataNoMes(ref, f.dia), dest = destinoEntrada(nominal), data = diaUtil(nominal, f.ajusteDiaUtil || 'antes');
      if (!alvo.has(dest.competencia) || entradas.some(e => e.fonteId === f.id && e.ref === ref)) continue;
      out.push({ fonteId: f.id, ref, data, ...dest, valor: estimativaFonte(f, entradas, ref), pessoa: f.pessoa,
        previsto: f.tipo === 'variavel', aConfirmar: f.tipo === 'variavel' });
    }
  }
  return out;
}

// ── Status e cores ───────────────────────────────────────────────────
export function situacao(l, hojeISO) {
  if (l.status === 'pago') return 'pago';
  if (l.data < hojeISO) return 'atrasado';
  return (new Date(l.data) - new Date(hojeISO)) / 864e5 <= 3 ? 'vence-logo' : 'pendente';
}

// ── Ações ────────────────────────────────────────────────────────────
/** Entrada de histórico: quem fez o quê e quando (uid, nome, em = data/hora ISO) */
export const evento = (acao, quem, emISO, extra = {}) => ({ acao, uid: quem.uid, nome: quem.nome, em: emISO, ...extra });
export const comEvento = (l, ev) => ({ ...l, historico: [...(l.historico || []), ev] });
export const foiAdiado = l => (l.historico || []).some(h => h.acao === 'adiou' || (!h.acao && h.para));

/** Adiar ou renegociar: muda a data (e a quinzena); com novoValor vira renegociação */
export function adiar(l, novaData, motivo, quem, emISO, novoValor) {
  const reneg = novoValor != null && cent(novoValor) !== cent(l.valor);
  return comEvento({ ...l, data: novaData, competencia: competenciaDe(novaData), quinzena: quinzenaDe(novaData),
    ...(reneg ? { valor: novoValor, valorOriginal: l.valorOriginal ?? l.valor } : {}) },
  evento('adiou', quem, emISO, { de: l.data, para: novaData, motivo: motivo || null, ...(reneg ? { valorDe: l.valor, valorPara: novoValor } : {}) }));
}

/** Pagar: guarda quem pagou, quando e quanto (com juros/desconto, o valor muda e o original fica guardado) */
export function pagar(l, { pagoPor, data, valorPago, pagoCom = null }, quem, emISO) {
  const mudou = valorPago != null && cent(valorPago) !== cent(l.valor);
  return comEvento({ ...l, status: 'pago', pagoEm: data, pagoPor, pagoCom, confirmado: true,
    ...(mudou ? { valor: valorPago, valorOriginal: l.valorOriginal ?? l.valor } : {}) },
  evento('pagou', quem, emISO, { pagoPor, data, ...(pagoCom ? { pagoCom } : {}), ...(mudou ? { valorDe: l.valor, valorPara: valorPago } : {}) }));
}
export const desfazerPagamento = (l, quem, emISO) =>
  comEvento({ ...l, status: 'pendente', pagoEm: null, pagoPor: null, pagoCom: null }, evento('desfez', quem, emISO, { pagoPor: l.pagoPor || null }));

export const marcarPago = (l, dataISO) => ({ ...l, status: 'pago', pagoEm: dataISO }); // usado só nos dados de exemplo

/** Pago com dinheiro de fora das quinzenas (abono, PLR, férias, reserva…): não pesa no saldo da quinzena */
export const pagoComExtra = l => l.status === 'pago' && !!l.pagoCom;
export const DE_ONDE_EXTRA = ['Abono', 'PLR', 'Férias', '13º', 'Reserva', 'Outro'];

// ── Painel de quinzenas (saldo carregando de uma quinzena para a outra) ──
export function painelQuinzenas(receitas, lancamentos, comps, saldoInicial = 0) {
  let acumulado = cent(saldoInicial);
  return comps.flatMap(comp => [1, 2].map(q => {
    const rs = receitas.filter(r => r.competencia === comp && r.quinzena === q);
    const receita = rs.reduce((s, r) => s + cent(r.valor), 0);
    const doMes = lancamentos.filter(l => l.competencia === comp && l.quinzena === q);
    const itens = doMes.filter(l => !pagoComExtra(l));
    const extras = doMes.filter(pagoComExtra).reduce((s, l) => s + cent(l.valor), 0);
    const gastos = itens.reduce((s, l) => s + cent(l.valor), 0);
    const pago = itens.filter(l => l.status === 'pago').reduce((s, l) => s + cent(l.valor), 0);
    acumulado += receita - gastos;
    return { comp, quinzena: q, receita: reais(receita), temPrevisao: rs.some(r => r.previsto),
      gastos: reais(gastos), extras: reais(extras), aPagar: reais(gastos - pago), saldo: reais(receita - gastos), acumulado: reais(acumulado) };
  }));
}

/** Quanto falta pagar por forma (cartões: faturas pendentes; demais: parcelas), e limite livre. Passe a lista de doCaixa. */
export function resumoFormas(formas, lancamentos) {
  return formas.map(f => {
    const pend = lancamentos.filter(l => l.formaId === f.id && l.status === 'pendente' && (temFatura(f) ? ehFatura(l) : l.origem?.tipo === 'compra'))
      .reduce((s, l) => s + cent(l.valor), 0);
    return { forma: f.nome, falta: reais(pend), limiteLivre: f.limite != null ? reais(cent(f.limite) - pend) : null };
  });
}

// ── Assinaturas ──────────────────────────────────────────────────────
export const custoMensal = a => (a.ciclo === 'anual' ? a.valor / 12 : a.valor);
export const assinaturaAtiva = (a, comp) => a.ativo !== false && a.inicio <= comp && (!a.fim || a.fim >= comp);
/** Revisão "ainda usa?" vence a cada 90 dias */
export const precisaRevisar = (a, hojeISO) => !a.ultimaRevisao || (new Date(hojeISO) - new Date(a.ultimaRevisao)) / 864e5 >= 90;

// ── Parcelamentos (Etapa 5) ──────────────────────────────────────────
export const parcelasDa = (compraId, lancamentos) =>
  lancamentos.filter(l => l.origem?.tipo === 'compra' && l.origem.id === compraId).sort((a, b) => a.origem.parcela - b.origem.parcela);

/** Resumo de uma compra: pagas, falta, próxima parcela, quando termina */
export function resumoCompra(compra, lancamentos) {
  const ps = parcelasDa(compra.id, lancamentos), pend = ps.filter(l => l.status !== 'pago');
  const pago = ps.filter(l => l.status === 'pago').reduce((s, l) => s + cent(l.valor), 0);
  const falta = pend.reduce((s, l) => s + cent(l.valor), 0);
  const ordem = [...pend].sort((a, b) => a.data.localeCompare(b.data));
  return { parcelas: ps, total: ps.length, pagas: ps.length - pend.length, pago: reais(pago), falta: reais(falta),
    proxima: ordem[0] || null, termina: ps.length ? [...ps].sort((a, b) => b.data.localeCompare(a.data))[0].data : null, quitada: !pend.length };
}

const rotuloParcela = (nome, i, n) => (n > 1 ? `${nome} (${i}/${n})` : nome);

/**
 * Editar compra: nome, categoria, pessoa e forma valem para todas as parcelas; mudar a forma leva as parcelas
 * pendentes para o dia de vencimento dela. Mudar valor total ou nº de parcelas refaz SÓ as pendentes:
 * o que falta (novo total − já pago) é dividido nas parcelas que sobram. Pagas nunca mudam de valor.
 * Retorna { compra, salvar: [lançamentos], apagar: [ids] }.
 */
export function editarCompra(compra, lancamentos, mud, forma, quem, emISO) {
  const novo = { ...compra, ...mud };
  const ps = parcelasDa(compra.id, lancamentos), pagas = ps.filter(l => l.status === 'pago');
  const n = novo.parcelas, salvar = [], apagar = [];
  if (n < Math.max(1, pagas.length)) throw new Error(`Já existem ${pagas.length} parcelas pagas.`);
  const valorPago = pagas.reduce((s, l) => s + cent(l.valor), 0);
  const restante = cent(novo.valorTotal) - valorPago;
  const nPend = n - pagas.length;
  if (nPend > 0 && restante <= 0) throw new Error('O novo total é menor do que o que já foi pago.');
  const refazer = cent(novo.valorTotal) !== cent(compra.valorTotal) || n !== compra.parcelas;
  const ev = evento('editou', quem, emISO, refazer ? { valorDe: compra.valorTotal, valorPara: novo.valorTotal, parcelasDe: compra.parcelas, parcelasPara: n } : {});

  // parcelas pagas: só atualiza rótulo/categoria/pessoa
  pagas.forEach(l => salvar.push({ ...l, descricao: rotuloParcela(novo.nome, l.origem.parcela, n), categoriaId: novo.categoriaId ?? null,
    pessoa: novo.pessoa ?? null, origem: { ...l.origem, de: n } }));
  // parcelas pendentes: refeitas a partir do calendário da compra (mantém adiamentos quando o nº não muda)
  const valores = nPend > 0 ? dividirParcelas(reais(restante), nPend) : [];
  const numsPagas = new Set(pagas.map(l => l.origem.parcela));
  const nums = []; for (let k = 1; nums.length < nPend; k++) if (!numsPagas.has(k)) nums.push(k);
  const antigas = Object.fromEntries(ps.filter(l => l.status !== 'pago').map(l => [l.origem.parcela, l]));
  nums.forEach((k, i) => {
    const velha = antigas[k];
    let data = somarMeses(novo.primeiraData, k - 1, k === 1 || !temFatura(forma) ? undefined : forma.diaVencimento);
    if (velha && foiAdiado(velha) && !refazer && novo.formaId === compra.formaId) data = velha.data;
    const base = velha || { id: `${compra.id}_${k}`, dataOriginal: data, status: 'pendente', pagoEm: null, historico: [] };
    salvar.push(comEvento({ ...base, id: `${compra.id}_${k}`, descricao: rotuloParcela(novo.nome, k, n), valor: refazer ? valores[i] : (velha?.valor ?? valores[i]),
      data, competencia: competenciaDe(data), quinzena: quinzenaDe(data), formaId: novo.formaId, categoriaId: novo.categoriaId ?? null,
      pessoa: novo.pessoa ?? null, origem: { tipo: 'compra', id: compra.id, parcela: k, de: n } }, ev));
  });
  const manter = new Set(salvar.map(l => l.id));
  ps.forEach(l => { if (!manter.has(l.id)) apagar.push(l.id); });
  return { compra: novo, salvar, apagar };
}

/**
 * Quitar antes: paga TODAS as parcelas pendentes de uma vez, na data informada, pelo valor combinado
 * (com desconto). O dinheiro sai da quinzena do pagamento e as quinzenas futuras ficam livres.
 */
export function anteciparCompra(compra, lancamentos, { valorPago, data, pagoPor, ids, valores, pagoCom = null }, quem, emISO) {
  // valores: { idDaParcela: valorPago } quando cada parcela teve um desconto diferente
  // ids: só as parcelas escolhidas (ex.: antecipar as de jan, fev e mar do carro); sem ids, todas as que faltam
  const pend = parcelasDa(compra.id, lancamentos).filter(l => l.status !== 'pago' && (!ids || ids.includes(l.id)));
  if (!pend.length) throw new Error('Essa compra já está quitada.');
  const totalPend = pend.reduce((s, l) => s + cent(l.valor), 0), alvo = cent(valorPago ?? reais(totalPend));
  let usado = 0;
  return pend.map((l, i) => {
    const parte = valores?.[l.id] != null ? cent(valores[l.id])
      : i === pend.length - 1 ? alvo - usado : Math.round(alvo * cent(l.valor) / totalPend);
    usado += parte;
    return comEvento({ ...l, valorOriginal: l.valorOriginal ?? l.valor, valor: reais(parte), data, competencia: competenciaDe(data),
      quinzena: quinzenaDe(data), status: 'pago', pagoEm: data, pagoPor, pagoCom, confirmado: true },
    evento('antecipou', quem, emISO, { de: l.data, para: data, valorDe: l.valor, valorPara: reais(parte), pagoPor, ...(pagoCom ? { pagoCom } : {}) }));
  });
}

// ── Dia a dia e vale mercado (Etapa 6) ───────────────────────────────
/** Benefício (vale mercado/alimentação): tem saldo próprio e não sai do caixa das quinzenas */
export const ehBeneficio = f => f?.tipo === 'beneficio';
/** Empréstimo/consignado descontado direto no salário: aparece em Dívidas, mas não pesa nas quinzenas (o salário já cai menor) */
export const noSalario = f => !!f?.descontaNoSalario && ['consignado', 'emprestimo'].includes(f?.tipo);
/** Pago na hora: dinheiro, Pix/débito e benefício, à vista, com data de hoje ou antes */
export const pagaNaHora = (f, parcelas, data, hoje) => parcelas === 1 && data <= hoje && ['pix', 'dinheiro', 'debito', 'beneficio'].includes(f?.tipo);
// ── Faturas de cartão ────────────────────────────────────────────────
/** Formas que têm fatura mensal: o que se paga é a FATURA; as compras nelas são só o detalhe */
export const temFatura = f => f?.tipo === 'cartao' || f?.tipo === 'crediario';
export const idFatura = (formaId, comp) => `fatura_${formaId}_${comp}`;
export const ehFatura = l => l?.origem?.tipo === 'fatura';

/**
 * Faturas do cartão, mês a mês. Se o valor foi informado (lançamento de fatura salvo), vale ele.
 * Se não, o app estima pela soma das compras/parcelas daquele mês naquele cartão (estimada: true).
 * Retorna [{ fatura, detalhes }].
 */
/** Compra que já estava somada no valor informado da fatura (planilha ou marcada no Lançar) */
export const naBase = l => !!l.naBase || (l.historico || []).some(h => h.acao === 'importou');

/**
 * Para qual fatura vai uma compra feita em `dataCompra` no cartão: a próxima fatura cujo fechamento seja
 * DEPOIS da compra. Sem dia de fechamento cadastrado, considera 7 dias antes do vencimento.
 */
/** Fatura com valor vindo da planilha: assinaturas e contas fixas nesse cartão já estavam somadas nela */
export const faturaDaPlanilha = f => (f?.historico || []).some(h => h.acao === 'importou');
/** Esta compra/assinatura já está dentro do valor informado desta fatura? */
export const jaNaFatura = (fatura, l) => naBase(l) || (faturaDaPlanilha(fatura) && ['recorrente', 'assinatura'].includes(l.origem?.tipo));

export function vencimentoDaCompra(forma, dataCompra) {
  for (let i = 0; i < 3; i++) {
    const venc = dataNoMes(somarMesesComp(dataCompra.slice(0, 7), i), forma.diaVencimento || 15);
    let fecha;
    if (forma.diaFechamento) {
      const compF = forma.diaFechamento < (forma.diaVencimento || 15) ? venc.slice(0, 7) : somarMesesComp(venc.slice(0, 7), -1);
      fecha = dataNoMes(compF, forma.diaFechamento);
    } else fecha = new Date(new Date(venc + 'T12:00:00').getTime() - 7 * 864e5).toISOString().slice(0, 10);
    if (fecha > dataCompra) return venc;
  }
  return dataNoMes(somarMesesComp(dataCompra.slice(0, 7), 1), forma.diaVencimento || 15);
}

export function faturas(lancamentos, formas) {
  const cartoes = Object.fromEntries(formas.filter(temFatura).map(f => [f.id, f]));
  const grupos = new Map();
  const grupo = (formaId, comp) => {
    const k = idFatura(formaId, comp);
    if (!grupos.has(k)) grupos.set(k, { formaId, comp, salva: null, detalhes: [] });
    return grupos.get(k);
  };
  for (const l of lancamentos) {
    if (!cartoes[l.formaId]) continue;
    if (ehFatura(l)) grupo(l.formaId, l.competencia).salva = l;
    else grupo(l.formaId, l.competencia).detalhes.push(l);
  }
  // Antes da primeira fatura informada de um cartão não se estima nada: são meses anteriores ao controle no app
  const primeira = {};
  for (const g of grupos.values()) if (g.salva && (!primeira[g.formaId] || g.comp < primeira[g.formaId])) primeira[g.formaId] = g.comp;
  return [...grupos.values()].filter(g => g.salva || !primeira[g.formaId] || g.comp > primeira[g.formaId]).map(g => {
    const f = cartoes[g.formaId];
    if (g.salva) {
      // valor informado + compras lançadas depois (que não estavam na conta), até o valor real ser confirmado
      if (g.salva.valorFinal) return { fatura: g.salva, detalhes: g.detalhes };
      const base = g.salva.valorInformado ?? g.salva.valor;
      const novas = g.detalhes.filter(l => !jaNaFatura(g.salva, l)).reduce((t, l) => t + cent(l.valor), 0);
      return { detalhes: g.detalhes, fatura: { ...g.salva, valorInformado: base, valor: reais(cent(base) + novas), somaNovas: reais(novas) } };
    }
    const soma = g.detalhes.reduce((t, l) => t + cent(l.valor), 0);
    const data = dataNoMes(g.comp, f.diaVencimento || 15);
    const todasPagas = g.detalhes.length && g.detalhes.every(l => l.status === 'pago');
    return { detalhes: g.detalhes, fatura: {
      id: idFatura(g.formaId, g.comp), descricao: `Fatura ${f.nome}`, valor: reais(soma), estimada: true, confirmado: false,
      valorInformado: reais(g.detalhes.filter(naBase).reduce((t, l) => t + cent(l.valor), 0)),
      data, dataOriginal: data, competencia: g.comp, quinzena: quinzenaDe(data), formaId: g.formaId, categoriaId: 'cartoes',
      status: todasPagas ? 'pago' : 'pendente', pagoEm: todasPagas ? data : null, historico: [],
      origem: { tipo: 'fatura', formaId: g.formaId } } };
  });
}

/**
 * Só o que sai do caixa (salário/vale): tira o que foi pago com benefício (vale mercado) e troca as
 * compras feitas em cartão pela fatura do mês (informada ou estimada).
 */
export function doCaixa(lancamentos, formas) {
  const ben = new Set(formas.filter(f => ehBeneficio(f) || noSalario(f)).map(f => f.id));
  const cart = new Set(formas.filter(temFatura).map(f => f.id));
  const resto = lancamentos.filter(l => !ben.has(l.formaId) && !cart.has(l.formaId));
  return cart.size ? [...resto, ...faturas(lancamentos, formas).map(x => x.fatura)] : resto;
}

/** Para a tela de Dívidas: o que sai do caixa + parcelas descontadas no salário */
export function paraDividas(lancamentos, formas) {
  const sal = new Set(formas.filter(noSalario).map(f => f.id));
  return [...doCaixa(lancamentos, formas), ...lancamentos.filter(l => sal.has(l.formaId))];
}
/** Parcelas descontadas no salário cuja data já chegou: dão baixa sozinhas (o desconto já aconteceu na folha) */
export function baixasNoSalario(lancamentos, formas, hojeISO, emISO) {
  const sal = new Set(formas.filter(noSalario).map(f => f.id));
  return lancamentos.filter(l => sal.has(l.formaId) && l.status === 'pendente' && l.data <= hojeISO)
    .map(l => comEvento({ ...l, status: 'pago', pagoEm: l.data, pagoPor: 'Desconto no salário', confirmado: true },
      evento('pagou', { uid: 'encontas', nome: 'encontas' }, emISO, { pagoPor: 'Desconto no salário', data: l.data })));
}

// ── Renovação do benefício (vale mercado) ────────────────────────────
const diaSemana = iso => new Date(iso + 'T12:00:00').getDay(); // 0 = domingo, 6 = sábado
/** Dia em que o benefício renova no mês: dia fixo; caindo em sábado/domingo, volta para a sexta anterior */
/** Fim de semana: 'antes' = sexta anterior, 'depois' = segunda seguinte, 'nenhum' = no dia mesmo */
export function diaUtil(d, modo = 'antes') {
  if (modo === 'nenhum') return d;
  const passo = modo === 'depois' ? 1 : -1;
  while ([0, 6].includes(diaSemana(d))) d = new Date(new Date(d + 'T12:00:00').getTime() + passo * 864e5).toISOString().slice(0, 10);
  return d;
}
export function dataCredito(forma, comp) {
  return diaUtil(dataNoMes(comp, forma.diaCredito || 1), forma.ajusteDiaUtil || 'antes');
}
/** Período do benefício: de uma renovação até a véspera da próxima. `ref`: data (período que a contém) ou mês (período que começa nele). */
export function periodoBeneficio(forma, ref) {
  let ini;
  if (ref.length === 7) ini = dataCredito(forma, ref);
  else { ini = dataCredito(forma, ref.slice(0, 7)); if (ini > ref) ini = dataCredito(forma, somarMesesComp(ref.slice(0, 7), -1)); }
  const prox = dataCredito(forma, somarMesesComp(ini.slice(0, 7), 1));
  return { inicio: ini, proxima: prox };
}
/** Saldo do benefício no período: crédito − gastos feitos entre a renovação e a próxima */
export function saldoBeneficio(forma, lancamentos, ref) {
  const { inicio, proxima } = periodoBeneficio(forma, ref);
  const gastos = lancamentos.filter(l => l.formaId === forma.id && l.data >= inicio && l.data < proxima);
  const usado = gastos.reduce((s, l) => s + cent(l.valor), 0);
  return { credito: forma.saldoMensal || 0, usado: reais(usado), saldo: reais(cent(forma.saldoMensal || 0) - usado), gastos, inicio, proxima };
}
/** Gastos do dia a dia: compras à vista lançadas no app, pagas em dinheiro, Pix, débito ou vale */
export function gastosDiaADia(compras, lancamentos, comp, formas = []) {
  const ids = new Set(compras.filter(c => c.parcelas === 1 && !c.importado).map(c => c.id));
  const naHora = new Set(formas.filter(f => ['pix', 'dinheiro', 'debito', 'beneficio'].includes(f.tipo)).map(f => f.id));
  return lancamentos.filter(l => l.origem?.tipo === 'compra' && ids.has(l.origem.id) && l.data.slice(0, 7) === comp && naHora.has(l.formaId));
}

/** Lançamentos de fatura com o valor informado (ex.: da planilha), de `desde` em diante */
export function faturasInformadas(valores, formas, desde) {
  const porId = Object.fromEntries(formas.map(f => [f.id, f]));
  const out = [];
  for (const [fid, meses] of Object.entries(valores)) {
    const f = porId[fid]; if (!f || fid.startsWith('_')) continue;
    for (const [comp, valor] of Object.entries(meses)) {
      if (comp < desde) continue;
      const data = dataNoMes(comp, f.diaVencimento || 15);
      out.push({ id: idFatura(fid, comp), descricao: `Fatura ${f.nome}`, valor, data, dataOriginal: data, competencia: comp,
        quinzena: quinzenaDe(data), formaId: fid, categoriaId: 'cartoes', status: 'pendente', pagoEm: null, confirmado: true, valorInformado: valor,
        historico: [], origem: { tipo: 'fatura', formaId: fid } });
    }
  }
  return out;
}

/**
 * Divide o desconto de uma antecipação entre as parcelas pelos DIAS adiantados de cada uma
 * (quanto mais longe o vencimento, maior o desconto), como o banco faz. Retorna { id: valorPago }.
 */
export function distribuirDesconto(parcelas, totalPago, dataPagamento) {
  const cheio = parcelas.reduce((t, p) => t + cent(p.valor), 0), desconto = cheio - cent(totalPago);
  const dias = p => Math.max(0, Math.round((new Date(p.data + 'T12:00:00') - new Date(dataPagamento + 'T12:00:00')) / 864e5));
  let pesos = parcelas.map(dias), soma = pesos.reduce((a, b) => a + b, 0);
  if (!soma) { pesos = parcelas.map(p => cent(p.valor)); soma = cheio; }
  const out = {}; let usado = 0;
  parcelas.forEach((p, i) => {
    const d = i === parcelas.length - 1 ? desconto - usado : Math.round(desconto * pesos[i] / soma);
    usado += d; out[p.id] = reais(cent(p.valor) - d);
  });
  return out;
}

// ── Relatórios (Etapa 8) ─────────────────────────────────────────────
/**
 * Gastos do mês "abertos": o que sai do caixa, mas cada fatura de cartão é trocada pelas compras dela
 * (para ver categoria de verdade); o que a fatura tem além das compras lançadas vira "sem detalhe".
 */
export function gastosDetalhados(lancamentos, formas, comp) {
  const caixa = doCaixa(lancamentos, formas).filter(l => l.competencia === comp);
  const fats = faturas(lancamentos, formas);
  const out = [];
  for (const l of caixa) {
    if (!ehFatura(l)) { out.push(l); continue; }
    const det = fats.find(x => x.fatura.id === l.id)?.detalhes || [];
    out.push(...det);
    const resto = cent(l.valor) - det.reduce((t, d) => t + cent(d.valor), 0);
    if (resto > 0) out.push({ ...l, id: l.id + '_resto', descricao: `${l.descricao} (sem detalhe)`, valor: reais(resto), semDetalhe: true });
  }
  return out;
}

/** Soma por chave, do maior para o menor: [[chave, total], …] */
export function somarPor(itens, chave) {
  const g = new Map();
  for (const l of itens) { const k = chave(l) ?? '—'; g.set(k, (g.get(k) || 0) + cent(l.valor)); }
  return [...g.entries()].map(([k, v]) => [k, reais(v)]).sort((a, b) => b[1] - a[1]);
}

// ── Simulador de compra e plano de quitação (Etapa 9) ───────────────
/** Parcelas de uma compra que ainda não existe (para simular o efeito nas quinzenas) */
export function parcelasSimuladas({ valorTotal, parcelas, formaId, data, nome = 'Simulação' }, forma) {
  const primeiraData = temFatura(forma) ? vencimentoDaCompra(forma, data) : data;
  return gerarParcelas({ id: 'simulacao', nome, valorTotal, parcelas, formaId, primeiraData }, forma);
}

/** Compras parceladas com parcelas em aberto: o que dá para atacar com dinheiro extra */
export function dividasAtivas(compras, lancamentos) {
  return compras.map(c => {
    const r = resumoCompra(c, lancamentos);
    if (r.quitada || !r.total) return null;
    const pend = r.parcelas.filter(l => l.status !== 'pago').sort((a, b) => a.data.localeCompare(b.data));
    return { compra: c, falta: r.falta, parcela: pend[0].valor, restantes: pend.length, proxima: pend[0].data, termina: pend.at(-1).data, pendentes: pend };
  }).filter(Boolean);
}

/**
 * Plano de quitação com um dinheiro extra. Critérios:
 *  - 'alivio': primeiro as que terminam mais rápido (menos parcelas faltando) → libera dinheiro do mês mais cedo
 *  - 'menor':  primeiro as de menor saldo (bola de neve)
 * Quita inteira quando o dinheiro dá; senão antecipa parcelas (as últimas: termina antes).
 */
export function planoQuitacao(dividas, extra = 0, criterio = 'alivio') {
  const ordem = [...dividas].sort(criterio === 'menor'
    ? (a, b) => a.falta - b.falta || a.restantes - b.restantes
    : (a, b) => a.restantes - b.restantes || a.falta - b.falta);
  let sobra = cent(extra), alivio = 0;
  const passos = ordem.map(d => {
    if (sobra <= 0) return { ...d, acao: null };
    if (sobra >= cent(d.falta)) { sobra -= cent(d.falta); if (d.restantes > 1) alivio += cent(d.parcela); return { ...d, acao: 'quita', usa: d.falta }; }
    const ultimas = [...d.pendentes].reverse();
    let n = 0, usa = 0;
    while (n < ultimas.length - 1 && usa + cent(ultimas[n].valor) <= sobra) usa += cent(ultimas[n++].valor);
    if (!n) return { ...d, acao: null };
    sobra -= usa;
    return { ...d, acao: 'antecipa', n, usa: reais(usa), novoFim: d.pendentes[d.pendentes.length - 1 - n].data };
  });
  return { passos, sobra: reais(sobra), alivioMensal: reais(alivio) };
}

/** Quanto vai em parcelas de compras em cada mês (para ver quando o aperto alivia) */
export function parcelasPorMes(dividas, deComp, meses = 12) {
  const out = [];
  for (let i = 0; i < meses; i++) {
    const c = somarMesesComp(deComp, i);
    out.push({ comp: c, valor: reais(dividas.reduce((t, d) => t + d.pendentes.filter(l => l.competencia === c).reduce((s, l) => s + cent(l.valor), 0), 0)) });
  }
  return out;
}

// ── Alertas (Etapa 10): usados no sininho do app e nas notificações do celular ──
const diasEntre = (de, ate) => Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 864e5);
const brlTxt = v => 'R$ ' + (Math.round(v * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const listaTxt = ls => ls.slice(0, 4).map(l => `${l.descricao} ${brlTxt(l.valor)}`).join(', ') + (ls.length > 4 ? ` e mais ${ls.length - 4}` : '');
const MESES_TXT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Lista de alertas do dia. Cada um: { id, nivel: 'ruim'|'atencao'|'info', titulo, texto, link, push }
 * `push`: entra na notificação do celular (os demais só aparecem dentro do app).
 * dados: { lancamentos, formas, fontes, entradas, recorrentes, casa }
 */
export function alertas(d, hoje, { diasAntes = 1 } = {}) {
  const out = [], comp = hoje.slice(0, 7);
  const abertas = doCaixa(d.lancamentos, d.formas).filter(l => l.status === 'pendente');
  const atrasadas = abertas.filter(l => l.data < hoje).sort((a, b) => a.data.localeCompare(b.data));
  if (atrasadas.length) out.push({ id: 'atrasadas', nivel: 'ruim', push: true, link: '#/inicio',
    titulo: `${atrasadas.length} conta${atrasadas.length > 1 ? 's' : ''} atrasada${atrasadas.length > 1 ? 's' : ''}`, texto: listaTxt(atrasadas) });
  for (let n = 0; n <= Math.max(0, diasAntes); n++) {
    const vencem = abertas.filter(l => diasEntre(hoje, l.data) === n);
    if (!vencem.length) continue;
    const total = vencem.reduce((t, l) => t + cent(l.valor), 0);
    out.push({ id: `vence-${n}`, nivel: n === 0 ? 'ruim' : 'atencao', push: true, link: '#/quinzenas',
      titulo: `${n === 0 ? 'Vence hoje' : n === 1 ? 'Vence amanhã' : `Vence em ${n} dias`}: ${brlTxt(reais(total))}`, texto: listaTxt(vencem) });
  }
  const confirmar = abertas.filter(l => l.confirmado === false && l.data >= hoje && diasEntre(hoje, l.data) <= 5);
  if (confirmar.length) out.push({ id: 'confirmar', nivel: 'atencao', push: true, link: '#/inicio',
    titulo: 'Confira o valor que chegou', texto: `${confirmar.map(l => l.descricao).join(', ')} ainda ${confirmar.length > 1 ? 'estão' : 'está'} com valor estimado.` });

  const receitas = receitasNoPeriodo(d.fontes || [], d.entradas || [], [somarMesesComp(comp, -1), comp, somarMesesComp(comp, 1)]);
  const caiu = receitas.filter(r => r.aConfirmar && !r.semValor && r.data <= hoje && diasEntre(r.data, hoje) <= 10);
  for (const r of caiu) {
    const nome = r.descricao || (d.fontes || []).find(f => f.id === r.fonteId)?.nome || 'Entrada';
    out.push({ id: `caiu-${r.id || r.fonteId + r.data}`, nivel: 'atencao', push: true, link: '#/inicio',
      titulo: `${nome} caiu?`, texto: `Estava previsto para ${r.data.slice(8, 10)}/${r.data.slice(5, 7)}. Confirme o valor real no app.` });
  }
  const definir = (d.entradas || []).filter(e => e.prevista && e.valor == null && e.data >= hoje && diasEntre(hoje, e.data) <= 15);
  for (const e of definir) out.push({ id: `definir-${e.id}`, nivel: 'info', push: false, link: '#/inicio',
    titulo: `${e.descricao || 'Entrada prevista'}: valor a definir`, texto: `Prevista para ${e.data.slice(8, 10)}/${e.data.slice(5, 7)}. Coloque o valor quando souber.` });

  for (const f of (d.formas || []).filter(ehBeneficio)) {
    for (const c of [comp, somarMesesComp(comp, 1)]) {
      const dc = dataCredito(f, c), n = diasEntre(hoje, dc);
      if (n === 0 || n === 1) out.push({ id: `vale-${f.id}`, nivel: 'info', push: n === 0, link: '#/diaadia',
        titulo: n === 0 ? `${f.nome} renovou hoje` : `${f.nome} renova amanhã`, texto: `Saldo novo de ${brlTxt(f.saldoMensal || 0)}.` });
    }
  }

  // quinzena atual e a próxima no vermelho (só no app, para não repetir todo dia no celular)
  const ini = d.casa?.inicioControle && d.casa.inicioControle < comp ? d.casa.inicioControle : comp;
  const comps = []; for (let c = ini; c <= somarMesesComp(comp, 1); c = somarMesesComp(c, 1)) comps.push(c);
  const painel = painelQuinzenas(receitasNoPeriodo(d.fontes || [], d.entradas || [], comps), doCaixa(d.lancamentos, d.formas), comps);
  const qAtual = quinzenaDe(hoje), i = painel.findIndex(p => p.comp === comp && p.quinzena === qAtual);
  for (const p of painel.slice(i, i + 2)) if (p && p.saldo < 0) out.push({ id: `quinzena-${p.comp}-${p.quinzena}`, nivel: 'atencao', push: false, link: '#/quinzenas',
    titulo: `${p.quinzena}ª quinzena de ${MESES_TXT[Number(p.comp.slice(5, 7)) - 1]} no vermelho`, texto: `Faltam ${brlTxt(-p.saldo)} para fechar as contas dela.` });

  const revisar = (d.recorrentes || []).filter(r => r.assinatura && assinaturaAtiva(r, comp) && precisaRevisar(r, hoje));
  if (revisar.length) out.push({ id: 'assinaturas', nivel: 'info', push: false, link: '#/assinaturas',
    titulo: `${revisar.length} assinatura${revisar.length > 1 ? 's' : ''} para revisar`, texto: 'Vocês ainda usam? Confirme ou cancele.' });
  return out;
}

/** Texto da notificação do celular a partir dos alertas com push */
export function textoNotificacao(lista) {
  const p = lista.filter(a => a.push);
  if (!p.length) return null;
  return { titulo: p[0].titulo, corpo: [p[0].texto, ...p.slice(1).map(a => a.titulo)].join(' · '), link: p[0].link, total: p.length };
}
