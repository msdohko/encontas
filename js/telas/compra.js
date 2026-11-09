// Tela de uma compra parcelada (#/compra/<id>): progresso, parcelas, editar, quitar antes, encerrar, excluir
import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { brl, esc, ICONES, nomeMes, abrirFolha, formHTML, ligarForm, toast, lerValor, valorParaCampo, pessoasDaCasa, dataCurta } from '../ui.js';
import { linhaConta, ligarContas, campoExtra, ligarExtra, lerExtra } from './conta.js';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mesAno = iso => `${MES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
const nomeQ = (comp, q) => `${q}ª quinzena de ${nomeMes(comp).split(' ')[0]}`;
const compraDe = ctx => ctx.dados.compras.find(c => c.id === ctx.param);

export function titulo(ctx) { return compraDe(ctx)?.nome || 'Compra'; }

export function render(ctx) {
  const c = compraDe(ctx), d = ctx.dados;
  if (!c) return `<a class="voltar" href="#/dividas">${ICONES.esq} Dívidas</a><div class="vazio"><p class="vazio__titulo">Compra não encontrada.</p><p>Ela pode ter sido excluída.</p></div>`;
  const r = M.resumoCompra(c, d.lancamentos);
  const forma = d.formas.find(f => f.id === c.formaId)?.nome;
  const cat = d.categorias.find(x => x.id === c.categoriaId)?.nome;
  const pct = r.total ? Math.round((r.pagas / r.total) * 100) : 0;
  const pessoas = pessoasDaCasa(d).filter(p => p !== 'Casa'), eu = A.quem(ctx).nome;
  const chips = (nome, itens, marcado) => itens.map(v => `<label class="chip"><input type="radio" name="${nome}" value="${esc(v)}" ${v === marcado ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('');

  return `<a class="voltar" href="#/dividas">${ICONES.esq} Dívidas</a>
  <p class="intro">${[forma, cat, c.pessoa, `${c.parcelas}x de ${brl(c.valorTotal / c.parcelas)}`, `total ${brl(c.valorTotal)}`].filter(Boolean).map(esc).join(', ')}</p>
  <section class="compra-resumo">
    ${r.quitada ? `<p class="compra-resumo__falta positivo"><span>${c.encerradaEm ? 'Encerrada' : 'Quitada'}</span><strong>${brl(r.pago)} pagos</strong></p>`
      : `<p class="compra-resumo__falta"><span>Falta pagar</span><strong>${brl(r.falta)}</strong></p>`}
    <div class="barra barra--grossa" role="img" aria-label="${r.pagas} de ${r.total} parcelas pagas"><span style="width:${pct}%"></span></div>
    <p class="compra-resumo__info">${r.pagas} de ${r.total} parcelas pagas${r.quitada ? (c.encerradaEm ? `, encerrada em ${dataCurta(c.encerradaEm)}` : `, quitada em ${dataCurta(r.parcelas.map(l => l.pagoEm || l.data).sort().at(-1))}`) : r.termina ? `, termina em ${mesAno(r.termina)}` : ''}</p>
    ${r.proxima ? `<p class="compra-resumo__info">Próxima: <strong>${brl(r.proxima.valor)}</strong> em ${dataCurta(r.proxima.data)} (${nomeQ(r.proxima.competencia, r.proxima.quinzena)})</p>` : ''}
    ${c.parcelas > 1 ? (() => {
      const contratado = r.parcelas.reduce((t, l) => t + (l.valorOriginal ?? l.valor), 0);
      const economia = r.parcelas.filter(l => l.status === 'pago' && l.valorOriginal != null).reduce((t, l) => t + (l.valorOriginal - l.valor), 0);
      return `<dl class="compra-numeros">
        <div><dt>Valor contratado</dt><dd>${brl(contratado)}</dd></div>
        <div><dt>Já pago</dt><dd>${brl(r.pago)}</dd></div>
        <div class="positivo"><dt>Economia com antecipações</dt><dd>${brl(economia)}</dd></div>
        <div><dt>Vai pagar no total</dt><dd>${brl(contratado - economia)}<small>${economia > 0 ? 'contratado menos a economia; cai mais a cada antecipação' : 'sem antecipações ainda'}</small></dd></div>
      </dl>`; })() : ''}
  </section>
  ${(() => {
    const grupos = {};
    r.parcelas.filter(l => l.status === 'pago' && (l.historico || []).some(h => h.acao === 'antecipou')).forEach(l => {
      const h = [...l.historico].reverse().find(x => x.acao === 'antecipou');
      (grupos[h.para] ||= []).push(l);
    });
    const datas = Object.keys(grupos).sort().reverse();
    return datas.length ? `<section class="bloco antecipacoes"><h2 class="bloco__titulo">Antecipações</h2><ul>${datas.map(dt => {
      const ls = grupos[dt].sort((a, b) => a.origem.parcela - b.origem.parcela);
      const pago = ls.reduce((t, l) => t + l.valor, 0), cheio = ls.reduce((t, l) => t + (l.valorOriginal ?? l.valor), 0);
      return `<li><div class="antecipacoes__topo"><strong>${dataCurta(dt)}/${dt.slice(0, 4)}</strong><span>${brl(pago)}</span></div>
        <small>${ls.map(l => `${l.origem.parcela}ª (${mesAno(l.dataOriginal || l.data)}) ${brl(l.valor)}`).join(', ')}</small>
        <small class="positivo">${ls.length} parcela${ls.length > 1 ? 's' : ''}, valor cheio ${brl(cheio)}, desconto de ${brl(cheio - pago)}${ls[0].pagoPor ? `, pago por ${esc(ls[0].pagoPor)}` : ''}${ls[0].pagoCom ? `, com dinheiro de ${esc(ls[0].pagoCom)}` : ''}</small></li>`; }).join('')}</ul></section>` : ''; })()}

  ${r.quitada ? '' : `<div class="detalhe__acoes">
    <button type="button" class="btn" data-mostrar>Antecipar parcelas</button>
    <button type="button" class="btn btn--sec" data-editar>Editar compra</button>
  </div>
  <form class="detalhe__form" data-form="quitar" hidden>
    <p class="intro">Marque as parcelas que está pagando e digite em cada uma o valor que o banco mostrou (com desconto).</p>
    <fieldset class="campo"><legend>Parcelas</legend>
      <div class="escolha-parcelas">
        <button type="button" class="link-mais" data-marcar="todas">Marcar todas</button>
        <button type="button" class="link-mais" data-marcar="nenhuma">Desmarcar todas</button>
      </div>
      <ul class="parcelas-check">${(() => { const pend = r.parcelas.filter(l => l.status !== 'pago'); return pend.map((l, i) => `<li>
        <label class="campo--check"><input type="checkbox" name="parc" value="${esc(l.id)}" data-valor="${l.valor}" data-venc="${l.data}" ${pend.length <= 12 || i === 0 ? 'checked' : ''}>
        <span>${l.origem.parcela}ª parcela, ${mesAno(l.data)}<small class="parcelas-check__sub">valor cheio ${brl(l.valor)}</small></span></label>
        <input class="parcelas-check__v" name="vp" data-id="${esc(l.id)}" inputmode="decimal" value="${valorParaCampo(l.valor)}" aria-label="Valor pago da parcela ${l.origem.parcela}">
        <small class="parcelas-check__eco" data-eco="${esc(l.id)}"></small></li>`).join(''); })()}</ul>
    </fieldset>
    <div class="lancar__linha lancar__linha--2">
      <div class="campo"><label>Total a pagar</label><output class="total-antecipar" data-total></output>
        <input name="totalPago" inputmode="decimal" placeholder="Valor do boleto" hidden aria-label="Total pago ao banco"></div>
      <div class="campo"><label for="q-data">Data do pagamento</label><input id="q-data" name="data" type="date" value="${ctx.hoje}"></div>
    </div>
    <details class="so-total"><summary>Não tem o valor de cada parcela?</summary>
      <label class="campo campo--check"><input type="checkbox" name="soTotal"><span>Sei só o total que paguei</span>
        <small class="campo__ajuda">Digite o valor do boleto. O app divide o desconto pelos dias que cada parcela está sendo adiantada (aproximado).</small></label>
    </details>
    <fieldset class="campo"><legend>Quem pagou</legend><div class="chips">${chips('pagoPor', pessoas, eu)}</div></fieldset>
    ${campoExtra()}
    <p class="previa" data-previa></p>
    <button class="btn">Confirmar pagamento</button>
  </form>`}

  <h2 class="bloco__titulo compra__sub">Parcelas</h2>
  ${(() => {
    const linha = l => linhaConta(ctx, l, { titulo: `Parcela ${l.origem.parcela} de ${l.origem.de}` });
    if (r.parcelas.length <= 12) return `<ul class="contas contas--tabela">${r.parcelas.map(linha).join('')}</ul>`;
    const pagas = r.parcelas.filter(l => l.status === 'pago'), abertas = r.parcelas.filter(l => l.status !== 'pago').sort((a, b) => a.data.localeCompare(b.data));
    return `<ul class="contas contas--tabela">${abertas.slice(0, 6).map(linha).join('')}</ul>
      ${abertas.length > 6 ? `<details class="mais-parcelas"><summary>Ver as outras ${abertas.length - 6} parcelas em aberto</summary><ul class="contas contas--tabela">${abertas.slice(6).map(linha).join('')}</ul></details>` : ''}
      ${pagas.length ? `<details class="mais-parcelas"><summary>Parcelas pagas (${pagas.length})</summary><ul class="contas contas--tabela">${pagas.map(linha).join('')}</ul></details>` : ''}`;
  })()}

  <div class="compra__perigo">
    ${r.quitada ? '' : `<button type="button" class="link-perigo" data-encerrar>Encerrar: apagar só as ${r.total - r.pagas} parcelas que faltam</button>`}
    <button type="button" class="link-perigo" data-excluir>Excluir a compra inteira (lançada errado)</button>
  </div>`;
}

export function ligar(el, ctx) {
  const c = compraDe(ctx); if (!c) return;
  ligarContas(el, ctx);
  const r = M.resumoCompra(c, ctx.dados.lancamentos);
  const fq = el.querySelector('[data-form=quitar]');
  el.querySelector('[data-mostrar]')?.addEventListener('click', () => { fq.hidden = !fq.hidden; });
  if (fq) {
    const marcadas = () => [...fq.querySelectorAll('input[name=parc]:checked')];
    const campoValor = id => fq.querySelector(`input[name=vp][data-id="${id}"]`);
    const distribuir = () => {
      const ps = marcadas().map(ck => ({ id: ck.value, valor: Number(ck.dataset.valor), data: ck.dataset.venc }));
      const t = lerValor(fq.totalPago.value);
      if (!ps.length || !(t > 0)) return;
      const vs = M.distribuirDesconto(ps, t, fq.data.value || ctx.hoje);
      for (const [id, v] of Object.entries(vs)) campoValor(id).value = valorParaCampo(v);
    };
    const previa = () => {
      const soTotal = fq.soTotal.checked;
      fq.totalPago.hidden = !soTotal; fq.querySelector('[data-total]').hidden = soTotal;
      fq.querySelectorAll('input[name=vp]').forEach(i => { i.readOnly = soTotal; });
      if (soTotal) distribuir();
      let cheio = 0, pago = 0;
      fq.querySelectorAll('input[name=parc]').forEach(ck => {
        const inp = campoValor(ck.value), eco = fq.querySelector(`[data-eco="${ck.value}"]`);
        inp.disabled = !ck.checked; inp.closest('li').classList.toggle('desmarcada', !ck.checked);
        if (!ck.checked) { eco.textContent = ''; return; }
        const v = lerValor(inp.value) || 0, full = Number(ck.dataset.valor);
        cheio += full; pago += v;
        eco.textContent = full - v > 0.004 ? `desconto ${brl(full - v)}` : '';
      });
      const n = marcadas().length, q = fq.data.value ? nomeQ(M.competenciaDe(fq.data.value), M.quinzenaDe(fq.data.value)) : '';
      fq.querySelector('[data-total]').textContent = brl(pago);
      fq.querySelector('[data-previa]').innerHTML = !n ? 'Marque ao menos uma parcela.' :
        (soTotal && !(lerValor(fq.totalPago.value) > 0) ? 'Digite o total do boleto. ' : '') +
        `${n} parcela${n > 1 ? 's' : ''} (valor cheio ${brl(cheio)}). ${cheio - pago > 0.004 ? `Economia de <strong>${brl(cheio - pago)}</strong>. ` : ''}Sai da <strong>${q}</strong> e libera os meses dessas parcelas.`;
    };
    fq.querySelectorAll('[data-marcar]').forEach(b => b.addEventListener('click', () => {
      fq.querySelectorAll('input[name=parc]').forEach(c => { c.checked = b.dataset.marcar === 'todas'; campoValor(c.value).value = valorParaCampo(Number(c.dataset.valor)); }); previa();
    }));
    fq.addEventListener('input', previa); fq.addEventListener('change', previa); previa(); ligarExtra(fq);
    fq.addEventListener('submit', async e => {
      e.preventDefault();
      const ids = marcadas().map(i => i.value);
      if (!ids.length) return toast('Marque ao menos uma parcela.');
      if (fq.soTotal.checked) { if (!(lerValor(fq.totalPago.value) > 0)) return toast('Digite o total que pagou.'); distribuir(); }
      const valores = Object.fromEntries(ids.map(id => [id, lerValor(campoValor(id).value)]));
      if (Object.values(valores).some(v => !(v > 0))) return toast('Confira o valor de cada parcela marcada.');
      const total = Object.values(valores).reduce((t, v) => t + v, 0);
      fq.querySelector('button.btn').disabled = true;
      const res = await A.anteciparCompra(ctx, c.id, { valorPago: total, data: fq.data.value, pagoPor: fq.pagoPor.value, ids, valores, pagoCom: lerExtra(fq) });
      ctx.render();
      toast(`${c.nome}: ${res.parcelas} parcela${res.parcelas > 1 ? 's' : ''} paga${res.parcelas > 1 ? 's' : ''}${res.economia > 0 ? `, economia de ${brl(res.economia)}` : ''}`);
    });
  }

  el.querySelector('[data-editar]')?.addEventListener('click', () => abrirEdicaoCompra(ctx, c));

  const duasVezes = (b, fn) => b?.addEventListener('click', async () => {
    if (!b.dataset.certeza) { b.dataset.certeza = 1; b.dataset.texto = b.textContent; b.textContent = 'Toque de novo para confirmar'; setTimeout(() => { delete b.dataset.certeza; b.textContent = b.dataset.texto; }, 3500); return; }
    await fn();
  });
  duasVezes(el.querySelector('[data-encerrar]'), async () => { await A.encerrarCompra(ctx, c.id); ctx.render(); toast(`${c.nome}: parcelas restantes apagadas`); });
  duasVezes(el.querySelector('[data-excluir]'), async () => { await A.excluirCompra(ctx, c.id); location.hash = '#/dividas'; toast(`${c.nome} excluída`); });
}

function abrirEdicaoCompra(ctx, c) {
  const d = ctx.dados, r = M.resumoCompra(c, d.lancamentos);
  const campos = [
    { n: 'nome', r: 'Nome', obrig: true },
    { n: 'valorTotal', r: 'Valor total da compra', t: 'dinheiro', obrig: true },
    { n: 'parcelas', r: 'Número de parcelas', t: 'inteiro', obrig: true, ajuda: r.pagas ? `${r.pagas} já pagas. O que falta é redividido nas parcelas restantes.` : '' },
    { n: 'formaId', r: 'Onde desconta', t: 'lista', obrig: true, op: d.formas.filter(f => f.ativo !== false || f.id === c.formaId).map(f => [f.id, f.nome]) },
    { n: 'dataCompra', r: 'Data da compra', t: 'data', se: v => M.temFatura(d.formas.find(f => f.id === v.formaId)),
      ajuda: 'O app coloca a 1ª parcela na fatura certa pelo dia de fechamento do cartão.' },
    { n: 'primeiraData', r: '1ª parcela vence em', t: 'data', se: v => !M.temFatura(d.formas.find(f => f.id === v.formaId)) },
    { n: 'categoriaId', r: 'Categoria', t: 'lista', op: [...d.categorias].sort((a, b) => a.ordem - b.ordem).map(x => [x.id, x.nome]) },
    { n: 'pessoa', r: 'Quem gastou', sugestoes: pessoasDaCasa(d) },
  ];
  abrirFolha({ titulo: `Editar ${esc(c.nome)}`, corpo: formHTML(campos, c, 'Salvar alterações') + '<p class="previa" data-previa-ed></p>', ligar: (el, fechar) => {
    const form = el.querySelector('form'), prev = el.querySelector('[data-previa-ed]');
    form.addEventListener('input', () => {
      const v = { valorTotal: lerValor(form.valorTotal.value), parcelas: Number(form.parcelas.value) };
      try {
        const forma = d.formas.find(f => f.id === form.formaId.value);
        const dc = form.dataCompra && !form.dataCompra.disabled ? form.dataCompra.value : '';
        const pd = M.temFatura(forma) ? (dc ? M.vencimentoDaCompra(forma, dc) : c.primeiraData) : (form.primeiraData?.value || c.primeiraData);
        const ed = M.editarCompra(c, d.lancamentos, { ...c, ...v, formaId: form.formaId.value, primeiraData: pd }, forma, A.quem(ctx), '');
        const pend = ed.salvar.filter(l => l.status !== 'pago').sort((a, b) => a.data.localeCompare(b.data));
        prev.innerHTML = pend.length ? `Ficam <strong>${pend.length}x de ${brl(pend[0].valor)}</strong>, da fatura de ${mesAno(pend[0].data)} até ${mesAno(pend.at(-1).data)}.` : '';
      } catch (e) { prev.textContent = e.message; }
    });
    ligarForm(form, campos, async v => {
      const mud = { ...v, parcelas: Number(v.parcelas) };
      if (!mud.dataCompra) delete mud.dataCompra;
      if (!mud.primeiraData) delete mud.primeiraData;
      await A.editarCompra(ctx, c.id, mud);
      fechar(); ctx.render(); toast('Compra atualizada');
    });
  } });
}
