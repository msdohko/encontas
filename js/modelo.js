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
  }, somarMeses(compra.primeiraData, i, i === 0 ? undefined : forma?.diaVencimento)));
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
export function estimativaFonte(fonte, entradas) {
  if (fonte.tipo === 'fixa') return fonte.valor || 0;
  if (fonte.tipo === 'eventual') return 0;
  const ult = entradas.filter(e => e.fonteId === fonte.id).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);
  if (!ult.length) return fonte.valor || 0;
  return reais(Math.round(ult.reduce((s, e) => s + cent(e.valor), 0) / ult.length));
}

/**
 * Todo dinheiro que entra nas competências pedidas: entradas lançadas + previsões das fontes.
 * Cada item: { fonteId, valor, competencia, quinzena, data, ref, previsto, aConfirmar }
 */
export function receitasNoPeriodo(fontes, entradas, comps) {
  const alvo = new Set(comps);
  const out = entradas.filter(e => alvo.has(e.competencia)).map(e => ({ ...e, previsto: false, aConfirmar: false }));
  for (const f of fontes) {
    if (f.ativo === false || f.tipo === 'eventual' || !f.dia) continue;
    const meses = new Set(comps.flatMap(c => [somarMesesComp(c, -1), c]));
    for (const ref of meses) {
      if ((f.inicio && ref < f.inicio) || (f.fim && ref > f.fim)) continue;
      const data = dataNoMes(ref, f.dia), dest = destinoEntrada(data);
      if (!alvo.has(dest.competencia) || entradas.some(e => e.fonteId === f.id && e.ref === ref)) continue;
      out.push({ fonteId: f.id, ref, data, ...dest, valor: estimativaFonte(f, entradas), pessoa: f.pessoa,
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
export function pagar(l, { pagoPor, data, valorPago }, quem, emISO) {
  const mudou = valorPago != null && cent(valorPago) !== cent(l.valor);
  return comEvento({ ...l, status: 'pago', pagoEm: data, pagoPor, confirmado: true,
    ...(mudou ? { valor: valorPago, valorOriginal: l.valorOriginal ?? l.valor } : {}) },
  evento('pagou', quem, emISO, { pagoPor, data, ...(mudou ? { valorDe: l.valor, valorPara: valorPago } : {}) }));
}
export const desfazerPagamento = (l, quem, emISO) =>
  comEvento({ ...l, status: 'pendente', pagoEm: null, pagoPor: null }, evento('desfez', quem, emISO, { pagoPor: l.pagoPor || null }));

export const marcarPago = (l, dataISO) => ({ ...l, status: 'pago', pagoEm: dataISO }); // usado só nos dados de exemplo

// ── Painel de quinzenas (saldo carregando de uma quinzena para a outra) ──
export function painelQuinzenas(receitas, lancamentos, comps, saldoInicial = 0) {
  let acumulado = cent(saldoInicial);
  return comps.flatMap(comp => [1, 2].map(q => {
    const rs = receitas.filter(r => r.competencia === comp && r.quinzena === q);
    const receita = rs.reduce((s, r) => s + cent(r.valor), 0);
    const itens = lancamentos.filter(l => l.competencia === comp && l.quinzena === q);
    const gastos = itens.reduce((s, l) => s + cent(l.valor), 0);
    const pago = itens.filter(l => l.status === 'pago').reduce((s, l) => s + cent(l.valor), 0);
    acumulado += receita - gastos;
    return { comp, quinzena: q, receita: reais(receita), temPrevisao: rs.some(r => r.previsto),
      gastos: reais(gastos), aPagar: reais(gastos - pago), saldo: reais(receita - gastos), acumulado: reais(acumulado) };
  }));
}

/** Quanto falta pagar de parcelamentos por forma, e limite livre dos cartões */
export function resumoFormas(formas, lancamentos) {
  return formas.map(f => {
    const pend = lancamentos.filter(l => l.formaId === f.id && l.status === 'pendente' && l.origem?.tipo === 'compra')
      .reduce((s, l) => s + cent(l.valor), 0);
    return { forma: f.nome, falta: reais(pend), limiteLivre: f.limite != null ? reais(cent(f.limite) - pend) : null };
  });
}

// ── Assinaturas ──────────────────────────────────────────────────────
export const custoMensal = a => (a.ciclo === 'anual' ? a.valor / 12 : a.valor);
export const assinaturaAtiva = (a, comp) => a.ativo !== false && a.inicio <= comp && (!a.fim || a.fim >= comp);
/** Revisão "ainda usa?" vence a cada 90 dias */
export const precisaRevisar = (a, hojeISO) => !a.ultimaRevisao || (new Date(hojeISO) - new Date(a.ultimaRevisao)) / 864e5 >= 90;
