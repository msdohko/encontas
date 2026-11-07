// Entradas: linha da lista e painel para editar/confirmar previsões (13º, férias, PLR…)
import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { brl, esc, dataCurta, nomeMes, abrirFolha, toast, lerValor, valorParaCampo } from '../ui.js';

const nomeQ = (comp, q) => `${q}ª quinzena de ${nomeMes(comp).split(' ')[0]}`;
const nomeFonte = (ctx, id) => ctx.dados.fontes.find(f => f.id === id)?.nome || 'Entrada';

export function linhaEntrada(ctx, r) {
  const sub = r.previsto ? (r.prevista ? `previsto para ~${dataCurta(r.data)}` : `previsto, cai ${dataCurta(r.data)}`) : `entrou ${dataCurta(r.data)}`;
  const clicavel = !!r.id && ctx.dados.entradas.some(e => e.id === r.id);
  return `<li class="${r.previsto ? 'entrada--prevista' : ''}" ${clicavel ? `data-entrada="${esc(r.id)}" tabindex="0"` : ''}>
    <span>${esc(r.descricao || nomeFonte(ctx, r.fonteId))}<small>${sub}</small></span>
    <strong>${r.semValor ? 'a definir' : '+ ' + brl(r.valor)}</strong></li>`;
}

export function ligarEntradas(el, ctx) {
  el.querySelectorAll('[data-entrada]').forEach(li => {
    li.addEventListener('click', () => abrirEntrada(ctx, li.dataset.entrada));
    li.addEventListener('keydown', e => { if (e.key === 'Enter') abrirEntrada(ctx, li.dataset.entrada); });
  });
}

export function abrirEntrada(ctx, id) {
  const e = ctx.dados.entradas.find(x => x.id === id); if (!e) return;
  const titulo = e.descricao || nomeFonte(ctx, e.fonteId);
  const corpo = `<div class="detalhe">
    <p class="detalhe__valor">${e.valor == null ? 'Valor a definir' : brl(e.valor)} <span class="selo ${e.prevista ? 'selo--pendente' : 'selo--pago'}">${e.prevista ? 'Previsto' : 'Recebido'}</span></p>
    <dl class="detalhe__dados">
      <div><dt>${e.prevista ? 'Previsto para' : 'Entrou em'}</dt><dd>${dataCurta(e.data)}/${e.data.slice(0, 4)} <small>${nomeQ(e.competencia, e.quinzena)}</small></dd></div>
      <div><dt>Fonte</dt><dd>${esc(nomeFonte(ctx, e.fonteId))}</dd></div>
      ${e.criadoPorNome ? `<div><dt>Lançado por</dt><dd>${esc(e.criadoPorNome)}</dd></div>` : ''}
    </dl>
    <form class="detalhe__form" data-form="entrada">
      <div class="lancar__linha lancar__linha--2">
        <div class="campo"><label for="en-valor">${e.prevista ? 'Valor (em branco = a definir)' : 'Valor'}</label><input id="en-valor" name="valor" inputmode="decimal" value="${valorParaCampo(e.valor)}"></div>
        <div class="campo"><label for="en-data">${e.prevista ? 'Data prevista' : 'Data'}</label><input id="en-data" name="data" type="date" value="${e.data}"></div>
      </div>
      <p class="previa" data-previa></p>
      <div class="detalhe__acoes">
        ${e.prevista ? '<button class="btn" data-acao="caiu">Caiu: confirmar</button><button type="button" class="btn btn--sec" data-acao="salvar">Salvar previsão</button>'
          : '<button class="btn" data-acao="salvar-real">Salvar</button>'}
      </div>
    </form>
    <button type="button" class="link-perigo" data-excluir>Excluir esta entrada</button>
  </div>`;
  abrirFolha({ titulo: esc(titulo), corpo, ligar: (el, fechar) => {
    const f = el.querySelector('form');
    const previa = () => { if (!f.data.value) return; const d = M.destinoEntrada(f.data.value);
      f.querySelector('[data-previa]').innerHTML = `Entra na <strong>${nomeQ(d.competencia, d.quinzena)}</strong>.`; };
    f.addEventListener('input', previa); previa();
    const pronto = msg => { fechar(); ctx.render(); toast(msg); };
    f.addEventListener('submit', async ev => {
      ev.preventDefault();
      const acao = ev.submitter?.dataset.acao || 'caiu', v = lerValor(f.valor.value);
      if (acao === 'caiu' || acao === 'salvar-real') {
        if (!(v > 0)) return toast('Digite o valor que caiu.');
        await A.confirmarEntrada(ctx, id, { valor: v, data: f.data.value });
        return pronto(`${titulo}: ${brl(v)} confirmado`);
      }
    });
    el.querySelector('[data-acao=salvar]')?.addEventListener('click', async () => {
      const v = lerValor(f.valor.value);
      await A.preverEntrada(ctx, { id, fonteId: e.fonteId, descricao: e.descricao, valor: v > 0 ? v : null, data: f.data.value });
      pronto('Previsão atualizada');
    });
    el.querySelector('[data-excluir]').addEventListener('click', async ev => {
      const b = ev.currentTarget;
      if (!b.dataset.certeza) { b.dataset.certeza = 1; b.textContent = 'Toque de novo para excluir'; return; }
      await A.excluirEntrada(ctx, id); pronto('Entrada excluída');
    });
  } });
}
