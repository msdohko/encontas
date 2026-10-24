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
  const lancs = M.gerarParcelas(compra, forma).map(l => M.comEvento(l, M.evento('lancou', quem(ctx), em)));
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
