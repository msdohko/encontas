// Tela de uma compra parcelada (#/compra/<id>): progresso, parcelas, editar, quitar antes, encerrar, excluir
import * as M from '../modelo.js';
import * as A from '../acoes.js';
import { brl, esc, ICONES, nomeMes, abrirFolha, formHTML, ligarForm, toast, lerValor, valorParaCampo, pessoasDaCasa, dataCurta } from '../ui.js';
import { linhaConta, ligarContas } from './conta.js';

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
  </section>

  ${r.quitada ? '' : `<div class="detalhe__acoes">
    <button type="button" class="btn" data-mostrar>Antecipar parcelas</button>
    <button type="button" class="btn btn--sec" data-editar>Editar compra</button>
  </div>
  <form class="detalhe__form" data-form="quitar" hidden>
    <p class="intro">Marque as parcelas que está pagando agora. Se o banco deu desconto, troque o valor de cada uma pelo valor que vai pagar.</p>
    <fieldset class="campo"><legend>Parcelas</legend>
      <div class="escolha-parcelas">
        <button type="button" class="link-mais" data-marcar="todas">Marcar todas</button>
        <button type="button" class="link-mais" data-marcar="nenhuma">Desmarcar todas</button>
      </div>
      <ul class="parcelas-check">${(() => { const pend = r.parcelas.filter(l => l.status !== 'pago'); return pend.map((l, i) => `<li>
        <label class="campo--check"><input type="checkbox" name="parc" value="${esc(l.id)}" data-valor="${l.valor}" ${pend.length <= 12 || i === 0 ? 'checked' : ''}>
        <span>Parcela ${l.origem.parcela}<small class="parcelas-check__sub">${mesAno(l.data)}, cheia ${brl(l.valor)}</small></span></label>
        <input class="parcelas-check__v" name="vp" data-id="${esc(l.id)}" inputmode="decimal" value="${valorParaCampo(l.valor)}" aria-label="Valor pago da parcela ${l.origem.parcela}">
        <small class="parcelas-check__eco" data-eco="${esc(l.id)}"></small></li>`).join(''); })()}</ul>
    </fieldset>
    <div class="lancar__linha lancar__linha--2">
      <div class="campo"><label>Total a pagar</label><output class="total-antecipar" data-total></output></div>
      <div class="campo"><label for="q-data">Data do pagamento</label><input id="q-data" name="data" type="date" value="${ctx.hoje}"></div>
    </div>
    <fieldset class="campo"><legend>Quem pagou</legend><div class="chips">${chips('pagoPor', pessoas, eu)}</div></fieldset>
    <p class="previa" data-previa></p>
    <button class="btn">Confirmar pagamento</button>
  </form>`}

  <h2 class="bloco__titulo compra__sub">Parcelas</h2>
  <ul class="contas contas--tabela">${r.parcelas.map(l => linhaConta(ctx, l, { titulo: `Parcela ${l.origem.parcela} de ${l.origem.de}` })).join('')}</ul>

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
    const previa = () => {
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
        `${n} parcela${n > 1 ? 's' : ''} (valor cheio ${brl(cheio)}). ${cheio - pago > 0.004 ? `Economia de <strong>${brl(cheio - pago)}</strong>. ` : ''}Sai da <strong>${q}</strong> e libera os meses dessas parcelas.`;
    };
    fq.querySelectorAll('[data-marcar]').forEach(b => b.addEventListener('click', () => {
      fq.querySelectorAll('input[name=parc]').forEach(c => { c.checked = b.dataset.marcar === 'todas'; }); previa();
    }));
    fq.addEventListener('input', previa); fq.addEventListener('change', previa); previa();
    fq.addEventListener('submit', async e => {
      e.preventDefault();
      const ids = marcadas().map(i => i.value);
      if (!ids.length) return toast('Marque ao menos uma parcela.');
      const valores = Object.fromEntries(ids.map(id => [id, lerValor(campoValor(id).value)]));
      if (Object.values(valores).some(v => !(v > 0))) return toast('Confira o valor de cada parcela marcada.');
      const total = Object.values(valores).reduce((t, v) => t + v, 0);
      fq.querySelector('button.btn').disabled = true;
      const res = await A.anteciparCompra(ctx, c.id, { valorPago: total, data: fq.data.value, pagoPor: fq.pagoPor.value, ids, valores });
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
