import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { brl, esc, toast, ICONES } from '../ui.js';
import { abrirEdicao } from './cadastros.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function render(ctx) {
  const comp = ctx.hoje.slice(0, 7), d = ctx.dados;
  const todas = d.recorrentes.filter(r => r.assinatura);
  const ativas = todas.filter(a => M.assinaturaAtiva(a, comp)).sort((a, b) => M.custoMensal(b) - M.custoMensal(a));
  const canceladas = todas.filter(a => a.fim && a.fim < comp);
  const mensal = ativas.reduce((s, a) => s + M.custoMensal(a), 0);
  const porPessoa = {};
  ativas.forEach(a => { const p = a.pessoa || 'Sem dono'; porPessoa[p] = (porPessoa[p] || 0) + M.custoMensal(a); });
  const revisar = ativas.filter(a => M.precisaRevisar(a, ctx.hoje));
  const forma = id => d.formas.find(f => f.id === id)?.nome;

  return `<a class="voltar" href="#/mais">${ICONES.esq} Mais</a>
  <div class="assin-total">
    <p><span>Por mês</span><strong>${brl(mensal)}</strong></p>
    <p><span>Por ano</span><strong>${brl(mensal * 12)}</strong></p>
  </div>
  ${Object.keys(porPessoa).length > 1 ? `<ul class="assin-pessoas">${Object.entries(porPessoa).map(([p, v]) =>
    `<li>${esc(p)} <strong>${brl(v)}</strong></li>`).join('')}</ul>` : ''}

  ${revisar.length ? `<section class="bloco bloco--revisao"><h2 class="bloco__titulo">Ainda usam?</h2>
    <p class="intro">A cada 3 meses vale conferir se cada assinatura ainda faz sentido.</p>
    <ul class="revisao">${revisar.map(a => `<li>
      <span class="revisao__nome">${esc(a.nome)}<small>${brl(M.custoMensal(a))} por mês, ${brl(M.custoMensal(a) * 12)} por ano</small></span>
      <span class="revisao__acoes"><button class="btn btn--sec btn--peq" data-uso="${esc(a.id)}">Uso sim</button>
      <button class="btn btn--perigo btn--peq" data-cancelar="${esc(a.id)}">Cancelar</button></span></li>`).join('')}</ul></section>` : ''}

  <div class="linha-acao"><h2 class="bloco__titulo">Ativas</h2><button class="btn btn--peq" data-nova>Nova assinatura</button></div>
  ${ativas.length ? `<ul class="cadastro">${ativas.map(a => `<li><button class="cadastro__item" data-id="${esc(a.id)}">
    <span class="cadastro__nome">${esc(a.nome)}<small>${[a.pessoa, forma(a.formaId), a.ciclo === 'anual' ? `anual, renova em ${MESES[(a.mesRenovacao || 1) - 1]} (${brl(a.valor)})` : `dia ${a.diaVencimento}`].filter(Boolean).map(esc).join(', ')}</small></span>
    <span class="cadastro__valor">${brl(M.custoMensal(a))}<small>/mês</small></span>${ICONES.editar}</button></li>`).join('')}</ul>`
  : `<div class="vazio"><p class="vazio__titulo">Nenhuma assinatura cadastrada.</p><p>Spotify, PS Plus, planos de celular… cadastre para ver quanto somam por mês e por ano.</p></div>`}

  ${canceladas.length ? `<details class="canceladas"><summary>Canceladas: economia de ${brl(canceladas.reduce((s, a) => s + M.custoMensal(a), 0) * 12)} por ano</summary>
    <ul>${canceladas.map(a => `<li>${esc(a.nome)} <small>até ${a.fim.slice(5)}/${a.fim.slice(0, 4)}, ${brl(M.custoMensal(a))}/mês</small></li>`).join('')}</ul></details>` : ''}`;
}

export function ligar(el, ctx) {
  const ach = id => ctx.dados.recorrentes.find(r => r.id === id);
  el.querySelector('[data-nova]')?.addEventListener('click', () => abrirEdicao(ctx, 'assinaturas'));
  el.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => abrirEdicao(ctx, 'assinaturas', ach(b.dataset.id))));
  el.querySelectorAll('[data-uso]').forEach(b => b.addEventListener('click', async () => {
    await A.revisarAssinatura(ctx, ach(b.dataset.uso)); toast('Anotado. Perguntamos de novo em 3 meses.'); ctx.render();
  }));
  el.querySelectorAll('[data-cancelar]').forEach(b => b.addEventListener('click', async () => {
    if (!b.dataset.certeza) { b.dataset.certeza = 1; b.textContent = 'Confirmar'; return; }
    const a = ach(b.dataset.cancelar);
    await A.cancelarAssinatura(ctx, a);
    toast(`${a.nome} cancelada. Sai das contas a partir do mês que vem.`); ctx.render();
  }));
}
