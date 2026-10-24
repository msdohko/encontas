// Ações do usuário → operações de gravação (valem para demo e Firebase)
import * as M from './modelo.js';
import { aplicar, novoId } from './store.js';

const horizonte = ctx => M.somarMesesComp(ctx.hoje.slice(0, 7), 12);

/** Compra/gasto: 1x ou parcelado. Gera a compra e as parcelas. */
export async function lancarCompra(ctx, { nome, valorTotal, parcelas, formaId, categoriaId, data, pessoa }) {
  const forma = ctx.dados.formas.find(f => f.id === formaId);
  const compra = { id: novoId(), nome, valorTotal, parcelas, formaId, categoriaId, primeiraData: data, pessoa,
    criadoPor: ctx.usuario.uid, criadoEm: ctx.hoje };
  const lancs = M.gerarParcelas(compra, forma);
  await aplicar(ctx.dados, [{ set: 'compras', dados: compra }, ...lancs.map(l => ({ set: 'lancamentos', dados: l }))]);
  return lancs;
}

/** Dinheiro que entrou. Se for de uma fonte com dia (salário), vira a confirmação daquele mês. */
export async function lancarEntrada(ctx, { fonteId, valor, data, descricao, ref }) {
  const fonte = ctx.dados.fontes.find(f => f.id === fonteId);
  const destino = M.destinoEntrada(data);
  const e = { id: ref ? `${fonteId}_${ref}` : novoId(), fonteId, valor, data, ref: ref ?? null, descricao: descricao || null,
    pessoa: fonte?.pessoa ?? null, ...destino, criadoPor: ctx.usuario.uid };
  await aplicar(ctx.dados, [{ set: 'entradas', dados: e }]);
  return e;
}

/** Conta de valor variável (luz…): confirma o valor que chegou */
export async function confirmarValor(ctx, lancId, valor) {
  const l = ctx.dados.lancamentos.find(x => x.id === lancId);
  await aplicar(ctx.dados, [{ set: 'lancamentos', dados: { ...l, valor, confirmado: true } }]);
}

/** Salva conta fixa ou assinatura e acerta os lançamentos futuros (cria, atualiza, apaga) */
export async function salvarRecorrente(ctx, rec) {
  rec.id ??= novoId();
  const desde = ctx.hoje.slice(0, 7);
  const s = M.sincronizarRecorrente(rec, ctx.dados.lancamentos, desde, horizonte(ctx));
  await aplicar(ctx.dados, [
    { set: 'recorrentes', dados: rec },
    ...[...s.criar, ...s.atualizar].map(l => ({ set: 'lancamentos', dados: l })),
    ...s.apagar.map(id => ({ apagar: 'lancamentos', id })),
  ]);
  return rec;
}

/** Excluir conta fixa/assinatura: some dos meses futuros, o que já foi pago fica no histórico */
export async function excluirRecorrente(ctx, rec) {
  const desde = ctx.hoje.slice(0, 7);
  const futuros = ctx.dados.lancamentos.filter(l => l.origem?.id === rec.id && l.status !== 'pago' && l.competencia >= desde);
  await aplicar(ctx.dados, [{ apagar: 'recorrentes', id: rec.id }, ...futuros.map(l => ({ apagar: 'lancamentos', id: l.id }))]);
}

/** Assinatura: "ainda uso" renova a revisão; "cancelar" encerra no mês atual */
export const revisarAssinatura = (ctx, a) => salvarRecorrente(ctx, { ...a, ultimaRevisao: ctx.hoje });
export const cancelarAssinatura = (ctx, a) => salvarRecorrente(ctx, { ...a, fim: ctx.hoje.slice(0, 7), ultimaRevisao: ctx.hoje });

/** Cadastros simples (fontes, formas, categorias) */
export const salvarSimples = (ctx, colecao, obj) => aplicar(ctx.dados, [{ set: colecao, dados: obj }]).then(() => obj);
export const excluirSimples = (ctx, colecao, id) => aplicar(ctx.dados, [{ apagar: colecao, id }]);
