import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { brl, esc, seletorMes, dataCurta, ROTULO_SITUACAO, abrirFolha, toast, lerValor, valorParaCampo, nomeMes } from '../ui.js';
import { painelDoMes, receitasDe } from './inicio.js';
import { linhaConta, ligarContas } from './conta.js';
import { linhaEntrada, ligarEntradas } from './entrada.js';

export function render(ctx) {
  const d = ctx.dados, v = ctx.quinzenaVista;
  const [q1, q2] = painelDoMes(ctx);
  const resumo = v === 1 ? q1 : v === 2 ? q2 : {
    receita: q1.receita + q2.receita, gastos: q1.gastos + q2.gastos, extras: q1.extras + q2.extras, aPagar: q1.aPagar + q2.aPagar,
    veio: q1.veio, saldoFinal: q2.veio != null ? q2.saldoFinal : q1.saldo + q2.saldo, informadaNa2: q1.veio == null && q2.veioInformado };
  const q = v === 'mes' ? 1 : v, chave = `${ctx.comp}-${q}`;
  const mesNome = nomeMes(ctx.comp).split(' ')[0];
  const linhaVeio = resumo.veio != null
    ? `<p class="veio"><span>${q === 1 ? 'Veio do mês anterior' : 'Veio da 1ª quinzena'}${(v === 'mes' ? q1 : resumo).veioInformado ? ' <small>(informado por vocês)</small>' : ''}</span>
        <strong class="${resumo.veio < 0 ? 'negativo' : ''}">${resumo.veio < 0 ? '−' : '+'} ${brl(Math.abs(resumo.veio))}</strong>
        <button type="button" class="link-mais" data-sobra="${chave}">ajustar</button></p>`
    : resumo.informadaNa2 ? `<p class="nota">A sobra inclui o que vocês informaram que tinham na conta no começo da 2ª quinzena.</p>`
    : `<button type="button" class="link-mais veio-informar" data-sobra="${chave}">Tem dinheiro que sobrou de antes? Informe o saldo da conta para ele entrar na conta</button>`;
  const formas = Object.fromEntries(d.formas.map(f => [f.id, f.nome]));
  const cats = Object.fromEntries(d.categorias.map(c => [c.id, c]));
  const itens = M.doCaixa(d.lancamentos, d.formas).filter(l => l.competencia === ctx.comp && (v === 'mes' || l.quinzena === v))
    .map(l => ({ ...l, sit: M.situacao(l, ctx.hoje) })).sort((a, b) => a.data.localeCompare(b.data) || b.valor - a.valor);

  const entradas = receitasDe(ctx, [ctx.comp]).filter(r => v === 'mes' || r.quinzena === v).sort((a, b) => a.data.localeCompare(b.data));
  const fonte = id => d.fontes.find(f => f.id === id)?.nome || 'Entrada';
  const aba = (val, rot) => `<button role="tab" class="abas__aba" data-q="${val}" aria-selected="${v === val}">${rot}</button>`;
  return `${seletorMes(ctx.comp)}
  <div class="abas" role="tablist" aria-label="Período">${aba('mes', 'Mês inteiro')}${aba(1, '1ª quinzena')}${aba(2, '2ª quinzena')}</div>
  <dl class="resumo-q q-${v}">
    <div><dt>Entra</dt><dd>${brl(resumo.receita)}</dd></div>
    <div><dt>Sai</dt><dd>${brl(resumo.gastos)}</dd></div>
    <div><dt>A pagar</dt><dd>${brl(resumo.aPagar)}</dd></div>
    <div class="${resumo.saldoFinal < 0 ? 'negativo' : 'positivo'}"><dt>${resumo.saldoFinal < 0 ? 'Falta' : 'Sobra'}</dt><dd>${brl(Math.abs(resumo.saldoFinal))}</dd></div>
  </dl>
  ${linhaVeio}
  ${resumo.extras > 0.004 ? `<p class="nota">${brl(resumo.extras)} pagos com dinheiro extra (abono, PLR, férias…) não entram nesta conta.</p>` : ''}
  ${entradas.length ? `<ul class="entradas" aria-label="Entradas">${entradas.map(r => linhaEntrada(ctx, r)).join('')}</ul>` : ''}
  ${itens.length ? `<ul class="contas contas--tabela">
    <li class="contas__cab" aria-hidden="true"><span>Vence</span><span>Conta</span><span>Categoria</span><span>Valor</span><span>Situação</span><span></span></li>
    ${itens.map(l => linhaConta(ctx, l, { comCategoria: true })).join('')}
  </ul>
  <p class="nota">Toque no nome de uma conta para pagar, mudar a data ou o valor, ou ver o histórico. O ✓ marca como pago na hora.</p>`
  : `<div class="vazio"><p class="vazio__titulo">Nenhuma conta neste período.</p><p>Use o botão Lançar para adicionar.</p></div>`}`;
}

/** Informar o saldo real: direto a sobra do começo da quinzena, ou o que tem na conta agora (o app desconta o que já entrou e saiu) */
function abrirSobra(ctx, chave) {
  const [a, m, qs] = chave.split('-'), comp = `${a}-${m}`, q = Number(qs);
  const atual = M.quinzenaDe(ctx.hoje) === q && ctx.hoje.slice(0, 7) === comp;
  const jaTem = ctx.dados.casa.sobras?.[chave];
  const recebido = receitasDe(ctx, [comp]).filter(r => r.quinzena === q && r.data <= ctx.hoje).reduce((t, r) => t + r.valor, 0);
  const pago = M.doCaixa(ctx.dados.lancamentos, ctx.dados.formas).filter(l => l.competencia === comp && l.quinzena === q && l.status === 'pago' && !M.pagoComExtra(l)).reduce((t, l) => t + l.valor, 0);
  const nomeQ = `${q}ª quinzena de ${nomeMes(comp).split(' ')[0]}`;
  abrirFolha({ titulo: 'Dinheiro que sobrou de antes', corpo: `<form class="detalhe__form" data-form="sobra">
    <p class="intro">Assim o que sobrou na conta passa para a ${nomeQ} e para as próximas, e o "Sobra/Falta" mostra o dinheiro de verdade.</p>
    ${atual ? `<fieldset class="campo"><legend>O que você sabe</legend><div class="chips">
      <label class="chip"><input type="radio" name="modo" value="agora" checked><span>Quanto tenho na conta agora</span></label>
      <label class="chip"><input type="radio" name="modo" value="sobra"><span>Quanto sobrou antes da quinzena</span></label></div></fieldset>` : '<input type="hidden" name="modo" value="sobra">'}
    <div class="campo"><label for="sb-valor" data-rotulo>${atual ? 'Saldo na conta agora' : `Sobrou antes da ${nomeQ}`}</label>
      <input id="sb-valor" name="valor" inputmode="decimal" placeholder="0,00" value="${jaTem != null && !atual ? valorParaCampo(jaTem) : ''}"></div>
    <p class="previa" data-previa></p>
    <div class="detalhe__acoes"><button class="btn">Salvar</button></div>
    ${jaTem != null ? '<button type="button" class="link-perigo" data-apagar>Apagar o valor informado</button>' : ''}
  </form>`, ligar: (el, fechar) => {
    const f = el.querySelector('form'), previa = f.querySelector('[data-previa]');
    const calc = () => { const v = lerValor(f.valor.value); if (!(v != null && !isNaN(v)) || f.valor.value === '') return null;
      return f.modo.value === 'agora' ? Math.round((v - recebido + pago) * 100) / 100 : v; };
    const atualizar = () => {
      f.querySelector('[data-rotulo]').textContent = f.modo.value === 'agora' ? 'Saldo na conta agora' : `Sobrou antes da ${nomeQ}`;
      const s = calc();
      previa.innerHTML = s == null ? (f.modo.value === 'agora' ? `O app desconta o que já entrou nesta quinzena (${brl(recebido)}) e devolve o que já foi pago (${brl(pago)}).` : '')
        : `Veio de antes para a ${nomeQ}: <strong>${s < 0 ? '−' : '+'} ${brl(Math.abs(s))}</strong>${f.modo.value === 'agora' ? ` <small>(${brl(lerValor(f.valor.value))} − ${brl(recebido)} que já entraram + ${brl(pago)} já pagos)</small>` : ''}`;
    };
    f.addEventListener('input', atualizar); f.addEventListener('change', atualizar); atualizar();
    f.addEventListener('submit', async e => {
      e.preventDefault(); const s = calc(); if (s == null) return toast('Digite o valor.');
      await A.definirSobra(ctx, chave, s); fechar(); ctx.render(); toast(`Sobra de ${brl(s)} passa para a ${nomeQ}`);
    });
    el.querySelector('[data-apagar]')?.addEventListener('click', async () => { await A.definirSobra(ctx, chave, null); fechar(); ctx.render(); toast('Valor apagado'); });
  } });
}

export function ligar(el, ctx) {
  el.querySelectorAll('[data-sobra]').forEach(b => b.addEventListener('click', () => abrirSobra(ctx, b.dataset.sobra)));
  ligarContas(el, ctx);
  ligarEntradas(el, ctx);
  el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    ctx.quinzenaVista = b.dataset.q === 'mes' ? 'mes' : Number(b.dataset.q); ctx.render();
  }));
}
