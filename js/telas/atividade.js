// Feed de Atividade: quem lançou, pagou, adiou, cadastrou ou excluiu o quê, e quando
import { brl, esc, ICONES, quando } from '../ui.js';
import { abrirConta } from './conta.js';

const VERBO = {
  lancou: 'lançou', pagou: 'pagou', desfez: 'desfez o pagamento de', adiou: 'adiou', renegociou: 'renegociou',
  confirmou: 'confirmou o valor de', entrada: 'registrou a entrada', 'confirmou-entrada': 'confirmou a entrada de',
  cadastrou: 'cadastrou', alterou: 'alterou', excluiu: 'excluiu', cancelou: 'cancelou a assinatura', revisou: 'confirmou que ainda usa',
  'editou-compra': 'editou a compra', quitou: 'quitou antes', encerrou: 'encerrou as parcelas restantes de',
};

function texto(a) {
  let t = `${VERBO[a.acao] || a.acao} ${a.descricao || ''}`.trim();
  if (a.acao === 'pagou' && a.pagoPor && a.pagoPor !== a.nome) t = `marcou ${a.descricao} como pago por ${a.pagoPor}`;
  if ((a.acao === 'adiou' || a.acao === 'renegociou') && a.para) t += ` para ${a.para.slice(8, 10)}/${a.para.slice(5, 7)}`;
  if (a.acao === 'lancou' && a.parcelas > 1) t += ` em ${a.parcelas}x`;
  if (a.acao === 'quitou') t += ` (${a.parcelas} parcelas${a.economia > 0 ? `, economia de ${brl(a.economia)}` : ''})`;
  if (a.acao === 'editou-compra' && a.parcelasDe && a.parcelasDe !== a.parcelas) t += `: ${a.parcelasDe}x para ${a.parcelas}x`;
  return t;
}

function rotuloDia(iso, hoje) {
  const d = iso.slice(0, 10);
  if (d === hoje) return 'Hoje';
  const ontem = new Date(new Date(hoje).getTime() - 864e5).toISOString().slice(0, 10);
  if (d === ontem) return 'Ontem';
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

export function titulo() { return 'Atividade'; }

export function render(ctx) {
  const todas = [...(ctx.dados.atividades || [])].sort((a, b) => b.em.localeCompare(a.em));
  const pessoas = [...new Set(todas.map(a => a.nome))];
  const filtro = ctx.filtroAtividade || 'todos';
  const lista = todas.filter(a => filtro === 'todos' || a.nome === filtro).slice(0, 200);
  const grupos = [];
  for (const a of lista) {
    const dia = rotuloDia(new Date(a.em).toLocaleDateString('sv-SE'), ctx.hojeReal || ctx.hoje);
    if (grupos.at(-1)?.dia !== dia) grupos.push({ dia, itens: [] });
    grupos.at(-1).itens.push(a);
  }
  const chip = (v, r) => `<button type="button" class="filtro ${filtro === v ? 'filtro--ativo' : ''}" data-filtro="${esc(v)}" aria-pressed="${filtro === v}">${esc(r)}</button>`;
  return `<a class="voltar" href="#/mais">${ICONES.esq} Mais</a>
  <p class="intro">Tudo o que foi lançado, pago, adiado ou alterado na casa, e por quem.</p>
  ${pessoas.length > 1 ? `<div class="filtros">${chip('todos', 'Todos')}${pessoas.map(p => chip(p, p)).join('')}</div>` : ''}
  ${grupos.length ? grupos.map(g => `<section class="ativ-dia"><h2 class="ativ-dia__titulo">${g.dia}</h2>
    <ul class="ativ">${g.itens.map(a => `<li class="ativ__item ativ__item--${esc(a.acao)}">
      <span class="avatar avatar--letra avatar--peq" aria-hidden="true">${esc((a.nome || '?')[0])}</span>
      <span class="ativ__texto"><strong>${esc(a.nome)}</strong> ${esc(texto(a))}${a.valor != null ? ` <span class="ativ__valor">${brl(a.valor)}</span>` : ''}</span>
      <time>${quando(a.em).slice(6)}</time>
      ${a.colecao === 'lancamentos' && ctx.dados.lancamentos.some(l => l.id === a.alvoId) ? `<button type="button" class="icone-btn" data-ver="${esc(a.alvoId)}" aria-label="Ver conta">${ICONES.dir2}</button>`
        : a.colecao === 'compras' && ctx.dados.compras.some(c => c.id === a.alvoId) ? `<a class="icone-btn" href="#/compra/${esc(a.alvoId)}" aria-label="Ver compra">${ICONES.dir2}</a>` : ''}
    </li>`).join('')}</ul></section>`).join('')
  : `<div class="vazio"><p class="vazio__titulo">Nada por aqui ainda.</p><p>Assim que alguém lançar, pagar ou adiar uma conta, aparece aqui.</p></div>`}`;
}

export function ligar(el, ctx) {
  el.querySelectorAll('[data-filtro]').forEach(b => b.addEventListener('click', () => { ctx.filtroAtividade = b.dataset.filtro; ctx.render(); }));
  el.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => abrirConta(ctx, b.dataset.ver)));
}
