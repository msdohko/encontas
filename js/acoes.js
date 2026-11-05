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
export async function lancarCompra(ctx, { nome, valorTotal, parcelas, formaId, categoriaId, data, pessoa }) {
  const forma = ctx.dados.formas.find(f => f.id === formaId), em = agora();
  const compra = { id: novoId(), nome, valorTotal, parcelas, formaId, categoriaId, primeiraData: data, pessoa,
    criadoPor: ctx.usuario.uid, criadoPorNome: quem(ctx).nome, criadoEm: em };
  const naHora = M.pagaNaHora(forma, parcelas, data, ctx.hoje);
  const lancs = M.gerarParcelas(compra, forma).map(l => M.comEvento(l, M.evento('lancou', quem(ctx), em)))
    .map(l => naHora ? { ...l, status: 'pago', pagoEm: data, pagoPor: pessoa || quem(ctx).nome, confirmado: true } : l);
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
const achar = (ctx, id) => ctx.dados.lancamentos.find(x => x.id === id);
const salvarLanc = (ctx, l, acao, extra) => aplicar(ctx.dados, [{ set: 'lancamentos', dados: l },
  atividade(ctx, acao, { colecao: 'lancamentos', id: l.id, descricao: l.descricao, valor: l.valor }, extra)]);

/** Conta de valor variável (luz…): confirma o valor que chegou */
export async function confirmarValor(ctx, id, valor) {
  const l = achar(ctx, id);
  const novo = M.comEvento({ ...l, valor, confirmado: true }, M.evento('confirmou', quem(ctx), agora(), { valorDe: l.valor, valorPara: valor }));
  await salvarLanc(ctx, novo, 'confirmou', { valorDe: l.valor });
}

export async function pagar(ctx, id, { pagoPor, data, valorPago } = {}) {
  const l = achar(ctx, id);
  const novo = M.pagar(l, { pagoPor: pagoPor || quem(ctx).nome, data: data || ctx.hoje, valorPago }, quem(ctx), agora());
  await salvarLanc(ctx, novo, 'pagou', { pagoPor: novo.pagoPor });
  return novo;
}

export async function desfazerPagamento(ctx, id) {
  const novo = M.desfazerPagamento(achar(ctx, id), quem(ctx), agora());
  await salvarLanc(ctx, novo, 'desfez');
  return novo;
}

export async function adiar(ctx, id, { novaData, motivo, novoValor }) {
  const l = achar(ctx, id);
  const novo = M.adiar(l, novaData, motivo, quem(ctx), agora(), novoValor);
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
  const r = M.editarCompra(c, ctx.dados.lancamentos, mud, forma, quem(ctx), agora());
  await aplicar(ctx.dados, [{ set: 'compras', dados: r.compra }, ...r.salvar.map(l => ({ set: 'lancamentos', dados: l })),
    ...r.apagar.map(id => ({ apagar: 'lancamentos', id })),
    atividade(ctx, 'editou-compra', { colecao: 'compras', id: compraId, descricao: r.compra.nome, valor: r.compra.valorTotal },
      { parcelas: r.compra.parcelas, parcelasDe: c.parcelas, valorDe: c.valorTotal })]);
  return r.compra;
}

export async function anteciparCompra(ctx, compraId, { valorPago, data, pagoPor }) {
  const c = acharCompra(ctx, compraId);
  const ls = M.anteciparCompra(c, ctx.dados.lancamentos, { valorPago, data, pagoPor: pagoPor || quem(ctx).nome }, quem(ctx), agora());
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
  // faturas digitadas na planilha que não estão detalhadas → "outras compras" (só meses de agora em diante)
  for (const [fid, porMes] of Object.entries(D.planilhaFaturas)) {
    if (fid.startsWith('_')) continue;
    for (const [comp, valor] of Object.entries(porMes)) {
      if (comp < compHoje) continue;
      const det = lanc.filter(l => l.formaId === fid && l.competencia === comp).reduce((s, l) => s + M.cent(l.valor), 0);
      const dif = M.cent(valor) - det;
      if (dif <= 0) continue;
      const c = { id: `fatura-${fid}-${comp}`, nome: `${porId[fid].nome}: outras compras`, valorTotal: M.reais(dif), parcelas: 1,
        formaId: fid, categoriaId: 'cartoes', primeiraData: `${comp}-${M.pad(porId[fid].diaVencimento)}`, importado: true };
      compras.push(c); lanc.push(...M.gerarParcelas(c, porId[fid]));
    }
  }
  const lancs = lanc.map(l => l.data < hoje ? { ...l, status: 'pago', pagoEm: l.data, confirmado: true } : l)
    .map(l => M.comEvento(l, M.evento('importou', eu, em)));
  const recorrentes = D.recorrentes.map(r => ({ ...limpar(r), criadoPor: eu.uid, criadoPorNome: eu.nome, criadoEm: em }));
  const ate = M.somarMesesComp(compHoje, 12);
  const lancRec = recorrentes.flatMap(r => M.sincronizarRecorrente(r, ctx.dados.lancamentos, compHoje, ate).criar);
  const entradas = D.entradas.filter(e => e.fonteId === 'salario').map(e => ({ ...e, criadoPor: eu.uid, criadoPorNome: eu.nome, criadoEm: em }));
  const ops = [
    ...formas.map(d => ({ set: 'formas', dados: d })),
    ...D.fontes.map(d => ({ set: 'fontes', dados: d })),
    ...entradas.map(d => ({ set: 'entradas', dados: d })),
    ...recorrentes.map(d => ({ set: 'recorrentes', dados: d })),
    ...compras.map(d => ({ set: 'compras', dados: d })),
    ...[...lancs, ...lancRec].map(d => ({ set: 'lancamentos', dados: d })),
    atividade(ctx, 'importou', { colecao: 'casa', id: 'planilha', descricao: 'os dados da planilha Contas', valor: null },
      { compras: D.compras.length, contas: recorrentes.length }),
  ];
  await aplicar(ctx.dados, ops);
  return { formas: formas.length, compras: D.compras.length, contas: recorrentes.length };
}
