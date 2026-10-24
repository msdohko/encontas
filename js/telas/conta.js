// Uma conta (lançamento): linha das listas + painel de detalhe com pagar, adiar, renegociar e histórico
import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { brl, esc, dataCurta, nomeMes, ROTULO_SITUACAO, ICONES, abrirFolha, toast, lerValor, valorParaCampo, pessoasDaCasa, quando } from '../ui.js';

const nomeQ = (comp, q) => `${q}ª quinzena de ${nomeMes(comp).split(' ')[0]}`;
const dataLonga = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// ── Linha da lista ───────────────────────────────────────────────────
export function linhaConta(ctx, l, { comCategoria = false } = {}) {
  const d = ctx.dados, sit = M.situacao(l, ctx.hoje);
  const forma = d.formas.find(f => f.id === l.formaId)?.nome;
  const cat = d.categorias.find(c => c.id === l.categoriaId);
  const sub = [forma, l.status === 'pago' && l.pagoPor ? `pago por ${l.pagoPor}` : null, M.foiAdiado(l) && l.status !== 'pago' ? 'adiada' : null]
    .filter(Boolean).join(', ');
  return `<li class="conta conta--${sit}" data-lanc="${esc(l.id)}" tabindex="0" aria-label="${esc(l.descricao)}, ${brl(l.valor)}, ${ROTULO_SITUACAO[sit]}. Abrir detalhes">
    <span class="conta__data">${dataCurta(l.data)}</span>
    <span class="conta__nome">${esc(l.descricao)}<small>${esc(sub)}</small></span>
    ${comCategoria ? `<span class="conta__cat"><i style="background:${esc(cat?.cor || '#999')}"></i>${esc(cat?.nome || 'Sem categoria')}</span>` : ''}
    <span class="conta__valor">${l.confirmado === false ? '≈ ' : ''}${brl(l.valor)}</span>
    <span class="selo selo--${sit}">${ROTULO_SITUACAO[sit]}</span>
    ${l.status === 'pago'
      ? `<span class="conta__pagar conta__pagar--feito" aria-hidden="true">${ICONES.check}</span>`
      : `<button type="button" class="conta__pagar" data-pagar="${esc(l.id)}" aria-label="Marcar ${esc(l.descricao)} como pago">${ICONES.check}</button>`}
  </li>`;
}

/** Liga os cliques: ✓ paga na hora (com Desfazer); tocar na linha abre o detalhe */
export function ligarContas(el, ctx) {
  el.querySelectorAll('[data-pagar]').forEach(b => b.addEventListener('click', async e => {
    e.stopPropagation(); b.disabled = true;
    const l = await A.pagar(ctx, b.dataset.pagar);
    ctx.render();
    toast(`${l.descricao}: pago por ${l.pagoPor}`, { rotulo: 'Desfazer', fn: async () => { await A.desfazerPagamento(ctx, l.id); ctx.render(); } });
  }));
  el.querySelectorAll('[data-lanc]').forEach(li => {
    li.addEventListener('click', () => abrirConta(ctx, li.dataset.lanc));
    li.addEventListener('keydown', e => { if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirConta(ctx, li.dataset.lanc); } });
  });
}

// ── Histórico em frases ──────────────────────────────────────────────
function frase(h, l) {
  const v = h.valorDe != null ? `, de ${brl(h.valorDe)} para ${brl(h.valorPara)}` : '';
  switch (h.acao) {
    case 'lancou': return `${h.nome} lançou`;
    case 'pagou': return `${h.nome} marcou como pago${h.pagoPor && h.pagoPor !== h.nome ? ` por ${h.pagoPor}` : ''} em ${dataCurta(h.data || l.pagoEm || h.em.slice(0, 10))}${v}`;
    case 'desfez': return `${h.nome} desfez o pagamento`;
    case 'adiou': return `${h.nome} ${h.valorDe != null ? 'renegociou' : 'adiou'}: de ${dataCurta(h.de)} para ${dataCurta(h.para)}${v}${h.motivo ? `. Motivo: ${h.motivo}` : ''}`;
    case 'confirmou': return `${h.nome} confirmou o valor${v}`;
    default: return h.para ? `Adiada de ${dataCurta(h.de)} para ${dataCurta(h.para)}` : (h.acao || 'Alteração');
  }
}

function origemTexto(ctx, l) {
  const o = l.origem || {};
  if (o.tipo === 'recorrente') return 'Conta fixa, lançada automaticamente todo mês';
  if (o.tipo === 'assinatura') return 'Assinatura, lançada automaticamente todo mês';
  if (o.tipo === 'compra') {
    const c = ctx.dados.compras.find(x => x.id === o.id);
    return o.de > 1 ? `Parcela ${o.parcela} de ${o.de}${c ? ` (total ${brl(c.valorTotal)})` : ''}` : 'Compra à vista';
  }
  return '';
}

// ── Painel de detalhe ────────────────────────────────────────────────
export function abrirConta(ctx, id) {
  const l = ctx.dados.lancamentos.find(x => x.id === id);
  if (!l) return;
  const d = ctx.dados, sit = M.situacao(l, ctx.hoje), eu = A.quem(ctx).nome;
  const forma = d.formas.find(f => f.id === l.formaId)?.nome || 'Não informado';
  const cat = d.categorias.find(c => c.id === l.categoriaId)?.nome || 'Sem categoria';
  const pessoas = pessoasDaCasa(d).filter(p => p !== 'Casa');
  const chips = (nome, itens, marcado) => itens.map(v => `<label class="chip"><input type="radio" name="${nome}" value="${esc(v)}" ${v === marcado ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('');
  const hist = [...(l.historico || [])].reverse();
  const excluivel = l.origem?.tipo === 'compra' && l.origem.de === 1;

  const corpo = `<div class="detalhe">
    <p class="detalhe__valor">${l.confirmado === false ? '≈ ' : ''}${brl(l.valor)} <span class="selo selo--${sit}">${ROTULO_SITUACAO[sit]}</span></p>
    ${l.valorOriginal != null ? `<p class="detalhe__nota">Valor original: ${brl(l.valorOriginal)}</p>` : ''}
    <dl class="detalhe__dados">
      <div><dt>Vence</dt><dd>${dataLonga(l.data)} <small>${nomeQ(l.competencia, l.quinzena)}</small></dd></div>
      <div><dt>Onde</dt><dd>${esc(forma)}</dd></div>
      <div><dt>Categoria</dt><dd>${esc(cat)}</dd></div>
      ${l.pessoa ? `<div><dt>Quem gastou</dt><dd>${esc(l.pessoa)}</dd></div>` : ''}
      ${l.status === 'pago' ? `<div><dt>Pago</dt><dd>${l.pagoPor ? `por ${esc(l.pagoPor)} ` : ''}em ${dataLonga(l.pagoEm)}</dd></div>` : ''}
      <div><dt>Origem</dt><dd>${esc(origemTexto(ctx, l))}</dd></div>
    </dl>

    ${l.status === 'pendente' ? `
    <div class="detalhe__acoes">
      <button type="button" class="btn" data-mostrar="pagar">Marcar como pago</button>
      <button type="button" class="btn btn--sec" data-mostrar="adiar">Adiar ou renegociar</button>
    </div>
    <form class="detalhe__form" data-form="pagar" hidden>
      <fieldset class="campo"><legend>Quem pagou</legend><div class="chips">${chips('pagoPor', pessoas, eu)}</div></fieldset>
      <div class="lancar__linha lancar__linha--2">
        <div class="campo"><label for="p-data">Data do pagamento</label><input id="p-data" name="data" type="date" value="${ctx.hoje}" required></div>
        <div class="campo"><label for="p-valor">Valor pago</label><input id="p-valor" name="valor" inputmode="decimal" value="${valorParaCampo(l.valor)}"></div>
      </div>
      <small class="campo__ajuda">Se pagou com juros ou desconto, ajuste o valor. O original fica guardado.</small>
      <button class="btn">Confirmar pagamento</button>
    </form>
    <form class="detalhe__form" data-form="adiar" hidden>
      <div class="campo"><label for="a-data">Nova data</label><input id="a-data" name="data" type="date" value="${l.data}" required></div>
      <p class="previa" data-previa></p>
      <fieldset class="campo"><legend>Motivo</legend><div class="chips">${chips('motivo', ['Sem dinheiro agora', 'Renegociei', 'Combinei outra data', 'Outro'], '')}</div></fieldset>
      <label class="campo campo--check"><input type="checkbox" name="mudaValor"><span>O valor mudou na renegociação</span></label>
      <div class="campo" data-novo-valor hidden><label for="a-valor">Novo valor</label><input id="a-valor" name="valor" inputmode="decimal" value="${valorParaCampo(l.valor)}"></div>
      <button class="btn">Confirmar nova data</button>
    </form>` : `
    <div class="detalhe__acoes"><button type="button" class="btn btn--sec" data-desfazer>Desfazer pagamento</button></div>`}
    ${excluivel ? `<button type="button" class="link-perigo" data-excluir>Excluir este gasto</button>` : ''}

    <h3 class="detalhe__sub">Histórico</h3>
    ${hist.length ? `<ol class="historico">${hist.map(h => `<li><span>${esc(frase(h, l))}</span><time>${h.em ? quando(h.em) : ''}</time></li>`).join('')}</ol>`
      : `<p class="nada">${esc(origemTexto(ctx, l) || 'Sem alterações ainda.')}. Nenhuma alteração até agora.</p>`}
  </div>`;

  abrirFolha({ titulo: esc(l.descricao), corpo, ligar: (el, fechar) => {
    const pronto = (msg, acao) => { fechar(); ctx.render(); toast(msg, acao); };
    el.querySelectorAll('[data-mostrar]').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('[data-form]').forEach(f => { f.hidden = f.dataset.form !== b.dataset.mostrar; });
      el.querySelector(`[data-form="${b.dataset.mostrar}"] input`)?.focus();
    }));

    const fp = el.querySelector('[data-form=pagar]');
    fp?.addEventListener('submit', async e => {
      e.preventDefault(); fp.querySelector('.btn').disabled = true;
      const v = lerValor(fp.valor.value);
      const n = await A.pagar(ctx, id, { pagoPor: fp.pagoPor.value || eu, data: fp.data.value, valorPago: v > 0 ? v : undefined });
      pronto(`${n.descricao}: pago por ${n.pagoPor}`, { rotulo: 'Desfazer', fn: async () => { await A.desfazerPagamento(ctx, id); ctx.render(); } });
    });

    const fa = el.querySelector('[data-form=adiar]');
    if (fa) {
      const previa = () => {
        if (!fa.data.value) return;
        const comp = M.competenciaDe(fa.data.value), q = M.quinzenaDe(fa.data.value);
        const muda = comp !== l.competencia || q !== l.quinzena;
        fa.querySelector('[data-previa]').innerHTML = muda ? `Passa para a <strong>${nomeQ(comp, q)}</strong>.` : `Continua na ${nomeQ(comp, q)}.`;
        fa.querySelector('[data-novo-valor]').hidden = !fa.mudaValor.checked;
      };
      fa.addEventListener('input', previa); fa.addEventListener('change', previa); previa();
      fa.addEventListener('submit', async e => {
        e.preventDefault();
        const novoValor = fa.mudaValor.checked ? lerValor(fa.valor.value) : undefined;
        if (fa.data.value === l.data && novoValor == null) return toast('Escolha uma data diferente.');
        fa.querySelector('.btn').disabled = true;
        const n = await A.adiar(ctx, id, { novaData: fa.data.value, motivo: fa.motivo.value || null, novoValor: novoValor > 0 ? novoValor : undefined });
        pronto(`${n.descricao}: agora vence ${dataCurta(n.data)}`);
      });
    }

    el.querySelector('[data-desfazer]')?.addEventListener('click', async () => {
      await A.desfazerPagamento(ctx, id); pronto('Pagamento desfeito');
    });
    el.querySelector('[data-excluir]')?.addEventListener('click', async e => {
      const b = e.currentTarget;
      if (!b.dataset.certeza) { b.dataset.certeza = 1; b.textContent = 'Toque de novo para excluir'; return; }
      await A.excluirLancamento(ctx, id); pronto('Gasto excluído');
    });
  } });
}
