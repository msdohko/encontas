import * as M from '../modelo.js';
import { brl, esc, ICONES, lerValor, nomeMesCurto } from '../ui.js';
import { mesAno } from './compra.js';

export function render(ctx) {
  const d = ctx.dados;
  const formas = M.resumoFormas(d.formas, M.paraDividas(d.lancamentos, d.formas)).map((r, i) => ({ ...r, f: d.formas[i] })).filter(r => r.falta > 0 || r.f.limite);
  const compras = d.compras.filter(c => c.parcelas > 1).map(c => ({ c, r: M.resumoCompra(c, d.lancamentos) })).filter(x => x.r.total);
  const ativas = compras.filter(x => !x.r.quitada).sort((a, b) => a.r.termina.localeCompare(b.r.termina));
  const quitadas = compras.filter(x => x.r.quitada);
  if (!formas.length && !compras.length) return `<div class="vazio"><p class="vazio__titulo">Nenhuma dívida ou cartão cadastrado.</p>
    <p>Quando você lançar uma compra parcelada, ela aparece aqui com quanto falta pagar e quando termina.</p></div>`;
  const total = formas.reduce((s, r) => s + r.falta, 0);
  const economiaDe = c => M.parcelasDa(c.id, d.lancamentos).filter(l => l.status === 'pago' && l.valorOriginal != null).reduce((t, l) => t + (l.valorOriginal - l.valor), 0);
  const economiaTotal = compras.reduce((t, x) => t + economiaDe(x.c), 0);
  const mesQueVem = M.somarMesesComp(ctx.hoje.slice(0, 7), 1);
  const liberaLogo = ativas.filter(x => x.r.termina.slice(0, 7) <= mesQueVem);

  const itemCompra = ({ c, r }) => `<li><a class="parc" href="#/compra/${esc(c.id)}">
    <span class="parc__topo"><span class="parc__nome">${esc(c.nome)}</span><span class="parc__falta">${r.quitada ? 'quitada' : brl(r.falta)}</span></span>
    <span class="barra" aria-hidden="true"><span style="width:${Math.round((r.pagas / r.total) * 100)}%"></span></span>
    <span class="parc__info">${esc(d.formas.find(f => f.id === c.formaId)?.nome || '')}${M.noSalario(d.formas.find(f => f.id === c.formaId)) ? ' (desconto no salário)' : ''}, ${r.pagas} de ${r.total} pagas${r.quitada ? '' : `, termina em ${mesAno(r.termina)}`}</span>
    ${economiaDe(c) > 0.004 ? `<span class="parc__eco">Economia com antecipações: ${brl(economiaDe(c))}</span>` : ''}
  </a></li>`;

  return `<p class="dividas-total"><span>Falta pagar em faturas e parcelamentos</span><strong>${brl(total)}</strong></p>
  ${economiaTotal > 0.004 ? `<p class="aviso-bom">Vocês já economizaram <strong>${brl(economiaTotal)}</strong> antecipando parcelas.</p>` : ''}
  ${liberaLogo.length ? `<p class="aviso-bom">Até o fim do mês que vem terminam: ${liberaLogo.map(x => `<strong>${esc(x.c.nome)}</strong> (${brl(x.r.proxima?.valor || 0)}/mês)`).join(', ')}.</p>` : ''}

  ${ativas.length ? `<h2 class="bloco__titulo">Compras parceladas <span class="contador contador--neutro">${ativas.length}</span></h2>
  <ul class="parcs">${ativas.map(itemCompra).join('')}</ul>` : ''}

  ${formas.length ? `<h2 class="bloco__titulo dividas__sub">Por cartão e forma de pagamento</h2>
  <ul class="dividas">${formas.map(r => {
    const usado = r.f.limite ? Math.min(100, Math.max(0, (r.falta / r.f.limite) * 100)) : null;
    return `<li class="divida">
      <div class="divida__topo"><span class="divida__nome">${esc(r.forma)}</span><span class="divida__falta">${brl(r.falta)}</span></div>
      ${usado != null ? `<div class="barra ${r.limiteLivre < 0 ? 'barra--estourou' : ''}" role="img" aria-label="${Math.round(usado)}% do limite comprometido"><span style="width:${usado}%"></span></div>
      <p class="divida__limite">${r.limiteLivre < 0 ? `Passou ${brl(-r.limiteLivre)} do limite` : `Limite livre ${brl(r.limiteLivre)} de ${brl(r.f.limite)}`}</p>` : ''}
    </li>`; }).join('')}</ul>` : ''}

  ${quitadas.length ? `<details class="canceladas"><summary>Quitadas e encerradas (${quitadas.length})</summary><ul class="parcs">${quitadas.map(itemCompra).join('')}</ul></details>` : ''}
  ${planoHTML(ctx)}`;
}

// ── Plano de quitação ────────────────────────────────────────────────
const mesAno2 = iso => `${nomeMesCurto(iso.slice(0, 7))}/${iso.slice(2, 4)}`;

function planoHTML(ctx) {
  const dv = M.dividasAtivas(ctx.dados.compras, ctx.dados.lancamentos);
  if (!dv.length) return '';
  const p = ctx.plano || { extra: 0, criterio: 'alivio' };
  const meses = M.parcelasPorMes(dv, ctx.hoje.slice(0, 7), 12), max = Math.max(1, ...meses.map(m => m.valor));
  return `<section class="bloco plano" data-plano>
    <h2 class="bloco__titulo">Plano de quitação</h2>
    <p class="intro">Recebeu um dinheiro extra (PLR, férias, 13º)? Veja qual dívida atacar primeiro e quanto sobra por mês depois.</p>
    <form class="plano__form" novalidate>
      <div class="campo"><label for="pl-extra">Dinheiro extra para quitar</label>
        <input id="pl-extra" name="extra" inputmode="decimal" placeholder="Ex.: 3.000,00" value="${p.extra ? String(p.extra).replace('.', ',') : ''}"></div>
      <fieldset class="campo"><legend>Atacar primeiro</legend><div class="chips">
        <label class="chip"><input type="radio" name="criterio" value="alivio" ${p.criterio !== 'menor' ? 'checked' : ''}><span>As que terminam antes</span></label>
        <label class="chip"><input type="radio" name="criterio" value="menor" ${p.criterio === 'menor' ? 'checked' : ''}><span>As de menor valor</span></label>
      </div></fieldset>
    </form>
    <div data-plano-res>${planoResultado(dv, p)}</div>
    <h3 class="bloco__titulo dividas__sub">Quanto vai em parcelas por mês</h3>
    <div class="evol evol--uma" style="grid-template-columns:repeat(12,minmax(0,1fr))" role="img" aria-label="${meses.map(m => `${nomeMesCurto(m.comp)}: ${brl(m.valor)}`).join('; ')}">
      ${meses.map(m => `<div class="evol__mes"><div class="evol__barras"><span class="evol__b evol__b--sai" style="height:${Math.max(m.valor > 0 ? 2 : 0, (m.valor / max) * 100)}%" title="${brl(m.valor)}"></span></div>
        <span class="evol__rot">${nomeMesCurto(m.comp)}</span></div>`).join('')}
    </div>
    <p class="nota">De ${brl(meses[0].valor)} em ${nomeMesCurto(meses[0].comp)} para ${brl(meses.at(-1).valor)} em ${nomeMesCurto(meses.at(-1).comp)}/${meses.at(-1).comp.slice(2, 4)}, sem antecipar nada. Faturas que vieram da planilha sem as compras não entram aqui.</p>
  </section>`;
}

function planoResultado(dv, { extra, criterio }) {
  const r = M.planoQuitacao(dv, extra, criterio);
  const linha = x => `<li class="plano__item ${x.acao ? 'plano__item--' + x.acao : ''}">
    <a href="#/compra/${esc(x.compra.id)}"><span class="plano__nome">${esc(x.compra.nome)}</span>
      <small>faltam ${x.restantes} de ${brl(x.parcela)}, termina ${mesAno2(x.termina)}</small></a>
    <span class="plano__valor">${brl(x.falta)}</span>
    ${x.acao === 'quita' ? `<p class="plano__acao">${x.restantes > 1 ? `Quita com ${brl(x.usa)}: libera <strong>${brl(x.parcela)}/mês</strong> a partir de ${mesAno2(x.proxima)}` : `Paga a última parcela (${brl(x.usa)}) com o extra: alivia só ${mesAno2(x.proxima)}`}</p>`
      : x.acao === 'antecipa' ? `<p class="plano__acao">Antecipa ${x.n === 1 ? 'a última parcela' : `as ${x.n} últimas`} (${brl(x.usa)}): termina em <strong>${mesAno2(x.novoFim)}</strong> em vez de ${mesAno2(x.termina)}</p>` : ''}
  </li>`;
  const quitadas = r.passos.filter(x => x.acao === 'quita').length;
  const resumo = extra > 0 ? `<p class="${r.alivioMensal > 0 ? 'aviso-bom' : 'nota'}">${r.alivioMensal > 0
      ? `Com ${brl(extra)} vocês quitam ${quitadas} dívida${quitadas > 1 ? 's' : ''} e passam a ter <strong>${brl(r.alivioMensal)} a mais por mês</strong> enquanto elas durariam.`
      : quitadas ? `${brl(extra)} paga ${quitadas === 1 ? 'a última parcela' : 'as últimas parcelas'} que já iam terminar: alivia só o mês delas.`
      : `${brl(extra)} não quita nenhuma dívida inteira, mas encurta o prazo.`}${r.sobra > 0.004 ? ` Sobram ${brl(r.sobra)}.` : ''}
      O banco costuma dar desconto ao antecipar, então deve sair mais barato que isso.</p>` : '';
  return `${resumo}<ol class="plano__lista">${r.passos.map(linha).join('')}</ol>`;
}

export function ligar(el, ctx) {
  const box = el.querySelector('[data-plano]'); if (!box) return;
  const f = box.querySelector('form'), res = box.querySelector('[data-plano-res]');
  const dv = M.dividasAtivas(ctx.dados.compras, ctx.dados.lancamentos);
  const atualizar = () => { ctx.plano = { extra: lerValor(f.extra.value) || 0, criterio: f.criterio.value }; res.innerHTML = planoResultado(dv, ctx.plano); };
  f.addEventListener('input', atualizar); f.addEventListener('change', e => { if (e.target.type === 'radio') atualizar(); }); f.addEventListener('submit', e => e.preventDefault());
}
