// Ações do usuário → operações de gravação (valem para demo e Firebase).
// Toda ação deixa rastro: no histórico do próprio lançamento e no feed de Atividade da casa.
import * as M from './modelo.js';
import { aplicar, novoId } from './store.js';

const horizonte = ctx => M.somarMesesComp(ctx.hoje.slice(0, 7), 12);
const agora = () => new Date().toISOString();
export const quem = ctx => ({ uid: ctx.usuario.uid, nome: (ctx.usuario.nome || '').split(' ')[0] });

/** Linha do feed de Atividade */
function atividade(ctx, acao, alvo, extra = {}) {
  return { set: 'atividades', dados: { id: novoId(), em: agora(), ...quem(ctx), acao,
    colecao: alvo.colecao, alvoId: alvo.id, descricao: alvo.descricao, valor: alvo.valor ?? null, ...extra } };
}

// ── Lançar ───────────────────────────────────────────────────────────
export async function lancarCompra(ctx, { nome, valorTotal, parcelas, formaId, categoriaId, data, pessoa, jaNaFatura, jaPagas = 0 }) {
  const forma = ctx.dados.formas.find(f => f.id === formaId), em = agora();
  // cartão: `data` é a data da compra; a 1ª parcela vai para a fatura certa pelo fechamento
  const cartao = M.temFatura(forma), primeiraData = cartao ? M.vencimentoDaCompra(forma, data) : data;
  const compra = { id: novoId(), nome, valorTotal, parcelas, formaId, categoriaId, primeiraData, ...(cartao ? { dataCompra: data } : {}), pessoa,
    criadoPor: ctx.usuario.uid, criadoPorNome: quem(ctx).nome, criadoEm: em };
  const naHora = !cartao && M.pagaNaHora(forma, parcelas, data, ctx.hoje);
  const lancs = M.gerarParcelas(compra, forma).map(l => M.comEvento(l, M.evento('lancou', quem(ctx), em)))
    .map(l => naHora ? { ...l, status: 'pago', pagoEm: data, pagoPor: pessoa || quem(ctx).nome, confirmado: true } : l)
    .map(l => jaNaFatura ? { ...l, naBase: true } : l)
    // financiamento em andamento: as primeiras N ficam pagas nas próprias datas
    .map(l => l.origem.parcela <= jaPagas ? { ...l, status: 'pago', pagoEm: l.data, pagoPor: pessoa || quem(ctx).nome, confirmado: true, pagaAntes: true } : l);
  await aplicar(ctx.dados, [{ set: 'compras', dados: compra }, ...lancs.map(l => ({ set: 'lancamentos', dados: l })),
    atividade(ctx, 'lancou', { colecao: 'compras', id: compra.id, descricao: nome, valor: valorTotal }, { parcelas })]);
  return lancs;
}

export async function lancarEntrada(ctx, { fonteId, valor, data, descricao, ref }) {
  const fonte = ctx.dados.fontes.find(f => f.id === fonteId);
  const e = { id: ref ? `${fonteId}_${ref}` : novoId(), fonteId, valor, data, ref: ref ?? null, descricao: descricao || null,
    pessoa: fonte?.pessoa ?? null, ...M.destinoEntrada(data), criadoPor: ctx.usuario.uid, criadoPorNome: quem(ctx).nome, criadoEm: agora() };
  await aplicar(ctx.dados, [{ set: 'entradas', dados: e },
    atividade(ctx, ref ? 'confirmou-entrada' : 'entrada', { colecao: 'entradas', id: e.id, descricao: descricao || fonte?.nome, valor })]);
  return e;
}

// ── Mexer num lançamento ─────────────────────────────────────────────
const achar = (ctx, id) => (id.startsWith('fatura_') && M.doCaixa(ctx.dados.lancamentos, ctx.dados.formas).find(x => x.id === id))
  || ctx.dados.lancamentos.find(x => x.id === id);
const salvarLanc = (ctx, l, acao, extra) => aplicar(ctx.dados, [{ set: 'lancamentos', dados: l },
  atividade(ctx, acao, { colecao: 'lancamentos', id: l.id, descricao: l.descricao, valor: l.valor }, extra)]);

/** Conta de valor variável (luz…): confirma o valor que chegou */
export async function confirmarValor(ctx, id, valor) {
  const l = achar(ctx, id);
  const novo = M.comEvento({ ...l, valor, confirmado: true, estimada: false, ...(M.ehFatura(l) ? { valorFinal: true } : {}) }, M.evento('confirmou', quem(ctx), agora(), { valorDe: l.valor, valorPara: valor }));
  await salvarLanc(ctx, novo, 'confirmou', { valorDe: l.valor });
}

/** Ao pagar (ou desfazer) uma fatura, as compras dela acompanham, para o progresso dos parcelamentos */
function detalhesDaFatura(ctx, fatura) {
  return M.faturas(ctx.dados.lancamentos, ctx.dados.formas).find(x => x.fatura.id === fatura.id)?.detalhes || [];
}

export async function pagar(ctx, id, { pagoPor, data, valorPago } = {}) {
  const l = achar(ctx, id);
  let novo = M.pagar(l, { pagoPor: pagoPor || quem(ctx).nome, data: data || ctx.hoje, valorPago }, quem(ctx), agora());
  if (M.ehFatura(l)) novo = { ...novo, valorFinal: true, estimada: false };
  const extra = M.ehFatura(l) ? detalhesDaFatura(ctx, l).filter(x => x.status !== 'pago')
    .map(x => ({ set: 'lancamentos', dados: { ...x, status: 'pago', pagoEm: novo.pagoEm, pagoPor: novo.pagoPor, pagoNaFatura: true } })) : [];
  await aplicar(ctx.dados, [{ set: 'lancamentos', dados: novo }, ...extra,
    atividade(ctx, 'pagou', { colecao: 'lancamentos', id: novo.id, descricao: novo.descricao, valor: novo.valor }, { pagoPor: novo.pagoPor })]);
  return novo;
}

export async function desfazerPagamento(ctx, id) {
  const l = achar(ctx, id), novo = M.desfazerPagamento(l, quem(ctx), agora());
  const extra = M.ehFatura(l) ? detalhesDaFatura(ctx, l).filter(x => x.pagoNaFatura)
    .map(x => ({ set: 'lancamentos', dados: { ...x, status: 'pendente', pagoEm: null, pagoPor: null, pagoNaFatura: false } })) : [];
  await aplicar(ctx.dados, [{ set: 'lancamentos', dados: novo }, ...extra,
    atividade(ctx, 'desfez', { colecao: 'lancamentos', id: novo.id, descricao: novo.descricao, valor: novo.valor })]);
  return novo;
}

export async function adiar(ctx, id, { novaData, motivo, novoValor }) {
  const l = achar(ctx, id);
  let novo = M.adiar(l, novaData, motivo, quem(ctx), agora(), novoValor);
  if (M.ehFatura(l) && novoValor != null) novo = { ...novo, valorFinal: true, estimada: false };
  await salvarLanc(ctx, novo, novo.valor !== l.valor ? 'renegociou' : 'adiou', { de: l.data, para: novaData, motivo: motivo || null });
  return novo;
}

/** Excluir um gasto lançado errado (só compras à vista; parcelamentos chegam na Etapa 5) */
export async function excluirLancamento(ctx, id) {
  const l = achar(ctx, id);
  const ops = [{ apagar: 'lancamentos', id }];
  if (l.origem?.tipo === 'compra' && l.origem.de === 1) ops.push({ apagar: 'compras', id: l.origem.id });
  ops.push(atividade(ctx, 'excluiu', { colecao: 'lancamentos', id, descricao: l.descricao, valor: l.valor }));
  await aplicar(ctx.dados, ops);
}

// ── Contas fixas e assinaturas ───────────────────────────────────────
/** Salva e acerta os lançamentos futuros (cria, atualiza, apaga). Pagos nunca mudam. */
export async function salvarRecorrente(ctx, rec, acao) {
  const novo = !rec.id;
  rec.id ??= novoId();
  if (novo) Object.assign(rec, { criadoPor: ctx.usuario.uid, criadoPorNome: quem(ctx).nome, criadoEm: agora() });
  const s = M.sincronizarRecorrente(rec, ctx.dados.lancamentos, ctx.hoje.slice(0, 7), horizonte(ctx));
  await aplicar(ctx.dados, [
    { set: 'recorrentes', dados: rec },
    ...[...s.criar, ...s.atualizar].map(l => ({ set: 'lancamentos', dados: l })),
    ...s.apagar.map(id => ({ apagar: 'lancamentos', id })),
    atividade(ctx, acao || (novo ? 'cadastrou' : 'alterou'), { colecao: 'recorrentes', id: rec.id, descricao: rec.nome, valor: rec.valor },
      { assinatura: !!rec.assinatura }),
  ]);
  return rec;
}

export async function excluirRecorrente(ctx, rec) {
  const desde = ctx.hoje.slice(0, 7);
  const futuros = ctx.dados.lancamentos.filter(l => l.origem?.id === rec.id && l.status !== 'pago' && l.competencia >= desde);
  await aplicar(ctx.dados, [{ apagar: 'recorrentes', id: rec.id }, ...futuros.map(l => ({ apagar: 'lancamentos', id: l.id })),
    atividade(ctx, 'excluiu', { colecao: 'recorrentes', id: rec.id, descricao: rec.nome, valor: rec.valor })]);
}

export const revisarAssinatura = (ctx, a) => salvarRecorrente(ctx, { ...a, ultimaRevisao: ctx.hoje }, 'revisou');
export const cancelarAssinatura = (ctx, a) => salvarRecorrente(ctx, { ...a, fim: ctx.hoje.slice(0, 7), ultimaRevisao: ctx.hoje }, 'cancelou');

// ── Cadastros simples (fontes, formas, categorias) ───────────────────
const NOME_COL = { fontes: 'fonte de renda', formas: 'forma de pagamento', categorias: 'categoria' };
export async function salvarSimples(ctx, colecao, obj) {
  const novo = !ctx.dados[colecao].some(x => x.id === obj.id);
  await aplicar(ctx.dados, [{ set: colecao, dados: obj },
    atividade(ctx, novo ? 'cadastrou' : 'alterou', { colecao, id: obj.id, descricao: `${obj.nome} (${NOME_COL[colecao]})`, valor: null })]);
  return obj;
}
export async function excluirSimples(ctx, colecao, id) {
  const o = ctx.dados[colecao].find(x => x.id === id);
  await aplicar(ctx.dados, [{ apagar: colecao, id },
    atividade(ctx, 'excluiu', { colecao, id, descricao: `${o?.nome} (${NOME_COL[colecao]})`, valor: null })]);
}

// ── Parcelamentos (Etapa 5) ──────────────────────────────────────────
const acharCompra = (ctx, id) => ctx.dados.compras.find(c => c.id === id);

export async function editarCompra(ctx, compraId, mud) {
  const c = acharCompra(ctx, compraId);
  const forma = ctx.dados.formas.find(f => f.id === (mud.formaId || c.formaId));
  if (M.temFatura(forma) && mud.dataCompra) mud = { ...mud, primeiraData: M.vencimentoDaCompra(forma, mud.dataCompra) };
  const r = M.editarCompra(c, ctx.dados.lancamentos, mud, forma, quem(ctx), agora());
  await aplicar(ctx.dados, [{ set: 'compras', dados: r.compra }, ...r.salvar.map(l => ({ set: 'lancamentos', dados: l })),
    ...r.apagar.map(id => ({ apagar: 'lancamentos', id })),
    atividade(ctx, 'editou-compra', { colecao: 'compras', id: compraId, descricao: r.compra.nome, valor: r.compra.valorTotal },
      { parcelas: r.compra.parcelas, parcelasDe: c.parcelas, valorDe: c.valorTotal })]);
  return r.compra;
}

export async function anteciparCompra(ctx, compraId, { valorPago, data, pagoPor, ids }) {
  const c = acharCompra(ctx, compraId);
  const ls = M.anteciparCompra(c, ctx.dados.lancamentos, { valorPago, data, pagoPor: pagoPor || quem(ctx).nome, ids }, quem(ctx), agora());
  const original = ls.reduce((s, l) => s + M.cent(l.valorOriginal), 0);
  await aplicar(ctx.dados, [...ls.map(l => ({ set: 'lancamentos', dados: l })),
    atividade(ctx, 'quitou', { colecao: 'compras', id: compraId, descricao: c.nome, valor: valorPago },
      { parcelas: ls.length, economia: M.reais(original - M.cent(valorPago)), pagoPor: pagoPor || quem(ctx).nome })]);
  return { parcelas: ls.length, economia: M.reais(original - M.cent(valorPago)) };
}

/** Encerrar: apaga só as parcelas que faltam (ex.: devolveu o produto, cancelou). As pagas ficam no histórico. */
export async function encerrarCompra(ctx, compraId) {
  const c = acharCompra(ctx, compraId), pend = M.parcelasDa(compraId, ctx.dados.lancamentos).filter(l => l.status !== 'pago');
  await aplicar(ctx.dados, [{ set: 'compras', dados: { ...c, encerradaEm: ctx.hoje } }, ...pend.map(l => ({ apagar: 'lancamentos', id: l.id })),
    atividade(ctx, 'encerrou', { colecao: 'compras', id: compraId, descricao: c.nome, valor: pend.reduce((s, l) => s + l.valor, 0) }, { parcelas: pend.length })]);
}

/** Excluir tudo: para compra lançada errado. Some a compra e todas as parcelas, inclusive as pagas. */
export async function excluirCompra(ctx, compraId) {
  const c = acharCompra(ctx, compraId), ps = M.parcelasDa(compraId, ctx.dados.lancamentos);
  await aplicar(ctx.dados, [{ apagar: 'compras', id: compraId }, ...ps.map(l => ({ apagar: 'lancamentos', id: l.id })),
    atividade(ctx, 'excluiu', { colecao: 'compras', id: compraId, descricao: c.nome, valor: c.valorTotal })]);
}

// ── Importar a planilha "Contas" (Etapa 7, adiantada) ────────────────
/**
 * Copia para a casa os cadastros e parcelamentos da planilha: cartões e formas, fontes de renda (com o histórico
 * do salário), contas fixas, compras parceladas e as faturas ainda em aberto. Parcelas com vencimento antes de
 * hoje entram como pagas. Não apaga nada do que já existe; ids iguais são substituídos (dá para rodar de novo).
 */
export async function importarPlanilha(ctx) {
  const D = structuredClone((await import('./demo-dados.js')).default);
  const hoje = ctx.hoje, compHoje = hoje.slice(0, 7), em = agora(), eu = quem(ctx);
  const formas = [...D.formas.map(({ confirmar, ...f }) => ({ ...f, ativo: true })),
    { id: 'dinheiro', nome: 'Dinheiro', tipo: 'dinheiro', diaVencimento: 1, limite: null, ativo: true }];
  const porId = Object.fromEntries(formas.map(f => [f.id, f]));
  const limpar = ({ confirmar, ...o }) => o;
  const compras = D.compras.map(c => ({ ...limpar(c), criadoPor: eu.uid, criadoPorNome: eu.nome, criadoEm: em, importado: true }));
  const lanc = compras.flatMap(c => M.gerarParcelas(c, porId[c.formaId]));
  const lancs = lanc.map(l => l.data < hoje ? { ...l, status: 'pago', pagoEm: l.data, confirmado: true } : l)
    .map(l => M.comEvento(l, M.evento('importou', eu, em)));
  const recorrentes = D.recorrentes.map(r => ({ ...limpar(r), criadoPor: eu.uid, criadoPorNome: eu.nome, criadoEm: em }));
  const ate = M.somarMesesComp(compHoje, 12);
  const lancRec = recorrentes.flatMap(r => M.sincronizarRecorrente(r, ctx.dados.lancamentos, compHoje, ate).criar)
    .map(l => { const a = D.ajustes.find(x => x.recorrenteId === l.origem.id && x.competencia === l.competencia); return a ? { ...l, valor: a.valor } : l; });
  const entradas = D.entradas.filter(e => e.fonteId === 'salario').map(e => ({ ...e, criadoPor: eu.uid, criadoPorNome: eu.nome, criadoEm: em }));
  const ops = [
    ...formas.map(d => ({ set: 'formas', dados: d })),
    ...D.fontes.map(d => ({ set: 'fontes', dados: d })),
    ...entradas.map(d => ({ set: 'entradas', dados: d })),
    ...recorrentes.map(d => ({ set: 'recorrentes', dados: d })),
    ...compras.map(d => ({ set: 'compras', dados: d })),
    ...[...lancs, ...lancRec, ...M.faturasInformadas(D.planilhaFaturas, formas, compHoje)].map(d => ({ set: 'lancamentos', dados: d })),
    atividade(ctx, 'importou', { colecao: 'casa', id: 'planilha', descricao: 'os dados da planilha Contas', valor: null },
      { compras: D.compras.length, contas: recorrentes.length }),
  ];
  await aplicar(ctx.dados, ops);
  // valores mais recentes da planilha (07/11/2026)
  await aplicarPlanilha(ctx, (await import('./planilha-2026-11-07.js')).default);
  return { formas: formas.length, compras: D.compras.length, contas: recorrentes.length };
}

/**
 * Corrige casas importadas antes da regra de faturas: apaga as "outras compras" de cartão e cria as faturas
 * com o valor da planilha. As compras detalhadas ficam como detalhe da fatura. Mês já pago continua pago.
 */
export async function corrigirFaturas(ctx) {
  const D = (await import('./demo-dados.js')).default, d = ctx.dados, compHoje = ctx.hoje.slice(0, 7), em = agora(), eu = quem(ctx);
  const velhas = d.compras.filter(c => c.id.startsWith('fatura-'));
  const idsVelhas = new Set(velhas.map(c => c.id));
  const lancVelhos = d.lancamentos.filter(l => idsVelhas.has(l.origem?.id));
  const novas = M.faturasInformadas(D.planilhaFaturas, d.formas, compHoje)
    .filter(f => !d.lancamentos.some(l => l.id === f.id))
    .map(f => {
      const antes = d.lancamentos.filter(l => l.formaId === f.formaId && l.competencia === f.competencia && !M.ehFatura(l));
      const pago = antes.length && antes.every(l => l.status === 'pago');
      const ref = antes.find(l => l.status === 'pago');
      return M.comEvento(pago ? { ...f, status: 'pago', pagoEm: ref.pagoEm, pagoPor: ref.pagoPor || null } : f, M.evento('importou', eu, em));
    });
  const luz = D.ajustes.map(a => d.lancamentos.find(l => l.id === `${a.recorrenteId}_${a.competencia}` && l.status === 'pendente' && l.confirmado === false
    && a.competencia >= compHoje)).filter(Boolean).map(l => ({ ...l, valor: D.ajustes.find(a => l.id === `${a.recorrenteId}_${a.competencia}`).valor }));
  await aplicar(d, [
    ...luz.map(l => ({ set: 'lancamentos', dados: l })),
    ...velhas.map(c => ({ apagar: 'compras', id: c.id })),
    ...lancVelhos.map(l => ({ apagar: 'lancamentos', id: l.id })),
    ...novas.map(l => ({ set: 'lancamentos', dados: l })),
    { casa: { faturasCorrigidas: true } },
    atividade(ctx, 'alterou', { colecao: 'casa', id: 'faturas', descricao: 'as faturas dos cartões conforme a planilha', valor: null }),
  ]);
  return { removidas: velhas.length, criadas: novas.length };
}

/**
 * Aplica uma planilha atualizada: o valor de cada fatura passa a ser o da planilha (o que já foi pago continua
 * pago), as compras/assinaturas já lançadas nesses meses viram "já incluídas" (não somam de novo), contas que
 * saíram são encerradas e as previsões de contas variáveis são atualizadas.
 */
export async function aplicarPlanilha(ctx, P) {
  const d = ctx.dados, compHoje = ctx.hoje.slice(0, 7), em = agora(), eu = quem(ctx), ops = [];
  const formas = Object.fromEntries(d.formas.map(f => [f.id, f]));
  const cobre = (fid, comp) => comp >= compHoje && comp <= P.ate && formas[fid];
  let faturasN = 0, marcadas = 0;
  // 1) faturas
  for (const [fid, meses] of Object.entries(P.faturas)) {
    if (!formas[fid]) continue;
    for (const nova of M.faturasInformadas({ [fid]: meses }, d.formas, compHoje)) {
      const atual = d.lancamentos.find(l => l.id === nova.id);
      const base = atual && atual.status === 'pago'
        ? { ...atual, valorInformado: nova.valor }
        : { ...(atual || nova), valor: nova.valor, valorInformado: nova.valor, valorFinal: false, estimada: false, confirmado: true };
      ops.push({ set: 'lancamentos', dados: M.comEvento(base, M.evento('importou', eu, em, atual ? { valorDe: atual.valorInformado ?? atual.valor, valorPara: nova.valor } : {})) });
      faturasN++;
    }
  }
  // faturas salvas que a planilha nova não tem (dentro do período coberto): some se não foi paga
  for (const l of d.lancamentos) {
    if (!M.ehFatura(l) || l.status === 'pago' || !cobre(l.formaId, l.competencia)) continue;
    if (!(P.faturas[l.formaId] || {})[l.competencia]) ops.push({ apagar: 'lancamentos', id: l.id });
  }
  // 2) compras e assinaturas já lançadas nos meses da planilha: já estão no valor da fatura
  for (const l of d.lancamentos) {
    if (M.ehFatura(l) || !M.temFatura(formas[l.formaId]) || l.naBase || !cobre(l.formaId, l.competencia)) continue;
    ops.push({ set: 'lancamentos', dados: { ...l, naBase: true } }); marcadas++;
  }
  // 3) contas que saíram da planilha
  const encerradas = [];
  for (const [rid, fim] of Object.entries(P.encerrar || {})) {
    const r = d.recorrentes.find(x => x.id === rid);
    if (!r || (r.fim && r.fim <= fim)) continue;
    const novo = { ...r, fim };
    const s = M.sincronizarRecorrente(novo, d.lancamentos, compHoje, M.somarMesesComp(compHoje, 12));
    ops.push({ set: 'recorrentes', dados: novo }, ...s.apagar.map(id => ({ apagar: 'lancamentos', id })));
    encerradas.push(r.nome);
  }
  // 4) previsões de contas variáveis (só se ainda não confirmadas)
  for (const a of P.ajustes || []) {
    const l = d.lancamentos.find(x => x.id === `${a.recorrenteId}_${a.competencia}` && x.status === 'pendente' && x.confirmado === false);
    if (l) ops.push({ set: 'lancamentos', dados: { ...l, valor: a.valor } });
  }
  ops.push({ casa: { planilhaVersao: P.versao } },
    atividade(ctx, 'alterou', { colecao: 'casa', id: 'planilha', descricao: `os valores pela planilha de ${P.versao.split('-').reverse().join('/')}`, valor: null }));
  await aplicar(d, ops);
  return { faturas: faturasN, marcadas, encerradas };
}

// ── Entradas previstas: 13º, férias, PLR (data e valor podem ainda não ser conhecidos) ─────
export async function preverEntrada(ctx, { id, fonteId, descricao, valor, data }) {
  const e = { id: id || novoId(), fonteId, descricao, valor: valor > 0 ? valor : null, data, prevista: true, ref: null,
    ...M.destinoEntrada(data), pessoa: ctx.dados.fontes.find(f => f.id === fonteId)?.pessoa ?? null,
    criadoPor: ctx.usuario.uid, criadoPorNome: quem(ctx).nome, criadoEm: agora() };
  await aplicar(ctx.dados, [{ set: 'entradas', dados: e },
    atividade(ctx, id ? 'alterou' : 'previu', { colecao: 'entradas', id: e.id, descricao, valor: e.valor })]);
  return e;
}
/** Caiu: vira entrada de verdade, com o valor e a data reais */
export async function confirmarEntrada(ctx, id, { valor, data }) {
  const e = ctx.dados.entradas.find(x => x.id === id);
  const novo = { ...e, valor, data: data || e.data, ...M.destinoEntrada(data || e.data), prevista: false, confirmadaEm: agora(), confirmadaPor: quem(ctx).nome };
  await aplicar(ctx.dados, [{ set: 'entradas', dados: novo },
    atividade(ctx, 'confirmou-entrada', { colecao: 'entradas', id, descricao: e.descricao, valor })]);
  return novo;
}
export async function excluirEntrada(ctx, id) {
  const e = ctx.dados.entradas.find(x => x.id === id);
  await aplicar(ctx.dados, [{ apagar: 'entradas', id }, atividade(ctx, 'excluiu', { colecao: 'entradas', id, descricao: e?.descricao || 'entrada', valor: e?.valor ?? null })]);
}
