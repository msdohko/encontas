import * as M from '../modelo.js';
import { brl, esc, seletorMes, dataCurta, ROTULO_SITUACAO } from '../ui.js';
import { painelDoMes, receitasDe } from './inicio.js';
import { linhaConta, ligarContas } from './conta.js';

export function render(ctx) {
  const d = ctx.dados, v = ctx.quinzenaVista;
  const [q1, q2] = painelDoMes(ctx);
  const resumo = v === 1 ? q1 : v === 2 ? q2 : {
    receita: q1.receita + q2.receita, gastos: q1.gastos + q2.gastos, aPagar: q1.aPagar + q2.aPagar, saldo: q1.saldo + q2.saldo };
  const formas = Object.fromEntries(d.formas.map(f => [f.id, f.nome]));
  const cats = Object.fromEntries(d.categorias.map(c => [c.id, c]));
  const itens = d.lancamentos.filter(l => l.competencia === ctx.comp && (v === 'mes' || l.quinzena === v))
    .map(l => ({ ...l, sit: M.situacao(l, ctx.hoje) })).sort((a, b) => a.data.localeCompare(b.data) || b.valor - a.valor);

  const entradas = receitasDe(ctx, [ctx.comp]).filter(r => v === 'mes' || r.quinzena === v).sort((a, b) => a.data.localeCompare(b.data));
  const fonte = id => d.fontes.find(f => f.id === id)?.nome || 'Entrada';
  const aba = (val, rot) => `<button role="tab" class="abas__aba" data-q="${val}" aria-selected="${v === val}">${rot}</button>`;
  return `${seletorMes(ctx.comp)}
  <div class="abas" role="tablist" aria-label="Período">${aba(1, '1ª quinzena')}${aba(2, '2ª quinzena')}${aba('mes', 'Mês inteiro')}</div>
  <dl class="resumo-q q-${v}">
    <div><dt>Entra</dt><dd>${brl(resumo.receita)}</dd></div>
    <div><dt>Sai</dt><dd>${brl(resumo.gastos)}</dd></div>
    <div><dt>A pagar</dt><dd>${brl(resumo.aPagar)}</dd></div>
    <div class="${resumo.saldo < 0 ? 'negativo' : 'positivo'}"><dt>${resumo.saldo < 0 ? 'Falta' : 'Sobra'}</dt><dd>${brl(Math.abs(resumo.saldo))}</dd></div>
  </dl>
  ${entradas.length ? `<ul class="entradas" aria-label="Entradas">${entradas.map(r => `<li class="${r.previsto ? 'entrada--prevista' : ''}">
    <span>${esc(r.descricao || fonte(r.fonteId))}<small>${r.previsto ? `previsto, cai ${dataCurta(r.data)}` : `entrou ${dataCurta(r.data)}`}</small></span>
    <strong>+ ${brl(r.valor)}</strong></li>`).join('')}</ul>` : ''}
  ${itens.length ? `<ul class="contas contas--tabela">
    <li class="contas__cab" aria-hidden="true"><span>Vence</span><span>Conta</span><span>Categoria</span><span>Valor</span><span>Situação</span><span></span></li>
    ${itens.map(l => linhaConta(ctx, l, { comCategoria: true })).join('')}
  </ul>
  <p class="nota">Toque numa conta para pagar, adiar ou ver o histórico. O ✓ marca como pago na hora.</p>`
  : `<div class="vazio"><p class="vazio__titulo">Nenhuma conta neste período.</p><p>Use o botão Lançar para adicionar.</p></div>`}`;
}

export function ligar(el, ctx) {
  ligarContas(el, ctx);
  el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    ctx.quinzenaVista = b.dataset.q === 'mes' ? 'mes' : Number(b.dataset.q); ctx.render();
  }));
}
