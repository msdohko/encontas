// Dia a dia: saldo do vale mercado e quanto foi gasto por categoria e por pessoa (só acompanhamento, sem limite)
import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { brl, esc, ICONES, seletorMes, toast } from '../ui.js';
import { linhaConta, ligarContas } from './conta.js';

export function titulo() { return 'Dia a dia'; }

function barras(itens, total) {
  return `<ul class="barras">${itens.map(([nome, v, cor]) => `<li>
    <span class="barras__nome">${cor ? `<i style="background:${esc(cor)}"></i>` : ''}${esc(nome)}</span>
    <span class="barras__valor">${brl(v)}</span>
    <span class="barra" aria-hidden="true"><span style="width:${total ? Math.max(2, (v / total) * 100) : 0}%;${cor ? `background:${esc(cor)}` : ''}"></span></span>
  </li>`).join('')}</ul>`;
}

export function render(ctx) {
  const d = ctx.dados, comp = ctx.comp;
  const vales = d.formas.filter(M.ehBeneficio);
  const gastos = M.gastosDiaADia(d.compras, d.lancamentos, comp, d.formas);
  const cats = Object.fromEntries(d.categorias.map(c => [c.id, c]));
  const soma = ls => ls.reduce((s, l) => s + l.valor, 0);
  const porQ = q => gastos.filter(l => !vales.some(v => v.id === l.formaId) && l.quinzena === q);

  const agrupar = (ls, chave, nomeDe, corDe) => {
    const g = {};
    ls.forEach(l => { const k = chave(l) || '—'; g[k] = (g[k] || 0) + l.valor; });
    return Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, v]) => [nomeDe(k), v, corDe?.(k)]);
  };
  const doCaixa = gastos.filter(l => !vales.some(v => v.id === l.formaId));
  const totalCaixa = soma(doCaixa);

  return `<a class="voltar" href="#/mais">${ICONES.esq} Mais</a>
  ${seletorMes(comp)}
  ${vales.length ? vales.map(v => {
    const s = M.saldoBeneficio(v, d.lancamentos, comp), pct = s.credito ? Math.min(100, (s.usado / s.credito) * 100) : 0;
    return `<section class="vale">
      <div class="vale__topo"><span>${esc(v.nome)}</span><small>${brl(s.credito)} por mês</small></div>
      <p class="vale__saldo ${s.saldo < 0 ? 'negativo' : ''}"><span>${s.saldo < 0 ? 'Passou' : 'Sobra'}</span><strong>${brl(Math.abs(s.saldo))}</strong></p>
      <div class="barra barra--grossa ${s.saldo < 0 ? 'barra--estourou' : ''}" aria-hidden="true"><span style="width:${pct}%"></span></div>
      <p class="vale__info">Usado ${brl(s.usado)} em ${s.gastos.length} compra${s.gastos.length === 1 ? '' : 's'}. Não entra na conta das quinzenas.</p>
      ${s.gastos.length ? `<details><summary>Ver compras</summary><ul class="contas">${s.gastos.sort((a, b) => b.data.localeCompare(a.data)).map(l => linhaConta(ctx, l)).join('')}</ul></details>` : ''}
    </section>`; }).join('')
  : `<section class="bloco bloco--importar"><h2 class="bloco__titulo">Vale mercado</h2>
      <p class="intro">Cadastre o vale para acompanhar o saldo. O que for pago com ele não pesa nas quinzenas.</p>
      <button class="btn" data-criar-vale>Cadastrar vale mercado de R$ 1.700/mês</button></section>`}

  <h2 class="bloco__titulo dividas__sub">Dinheiro, Pix e débito</h2>
  ${doCaixa.length ? `<dl class="resumo-q">
      <div><dt>1ª quinzena</dt><dd>${brl(soma(porQ(1)))}</dd></div>
      <div><dt>2ª quinzena</dt><dd>${brl(soma(porQ(2)))}</dd></div>
      <div><dt>No mês</dt><dd>${brl(totalCaixa)}</dd></div>
      <div><dt>Compras</dt><dd>${doCaixa.length}</dd></div>
    </dl>
    <div class="diaadia-grade">
      <section class="bloco"><h3 class="bloco__titulo">Por categoria</h3>
        ${barras(agrupar(doCaixa, l => l.categoriaId, k => cats[k]?.nome || 'Sem categoria', k => cats[k]?.cor), totalCaixa)}</section>
      <section class="bloco"><h3 class="bloco__titulo">Por pessoa</h3>
        ${barras(agrupar(doCaixa, l => l.pessoa, k => k === '—' ? 'Sem pessoa' : k), totalCaixa)}</section>
    </div>
    <h3 class="bloco__titulo dividas__sub">Lançamentos</h3>
    <ul class="contas contas--tabela">${[...doCaixa].sort((a, b) => b.data.localeCompare(a.data)).map(l => linhaConta(ctx, l, { comCategoria: true })).join('')}</ul>`
  : `<div class="vazio"><p class="vazio__titulo">Nenhum gasto à vista neste mês.</p><p>Quando pagarem algo em dinheiro, Pix ou débito, lancem pelo botão + que aparece aqui.</p></div>`}`;
}

export function ligar(el, ctx) {
  ligarContas(el, ctx);
  el.querySelector('[data-criar-vale]')?.addEventListener('click', async () => {
    await A.salvarSimples(ctx, 'formas', { id: 'vale-mercado', nome: 'Vale mercado', tipo: 'beneficio', saldoMensal: 1700, diaVencimento: 1, limite: null, ativo: true });
    ctx.render(); toast('Vale mercado cadastrado. Ele aparece em "Onde desconta" ao lançar.');
  });
}
