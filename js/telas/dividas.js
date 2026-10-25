import * as M from '../modelo.js';
import { brl, esc, ICONES } from '../ui.js';
import { mesAno } from './compra.js';

export function render(ctx) {
  const d = ctx.dados;
  const formas = M.resumoFormas(d.formas, d.lancamentos).map((r, i) => ({ ...r, f: d.formas[i] })).filter(r => r.falta > 0 || r.f.limite);
  const compras = d.compras.filter(c => c.parcelas > 1).map(c => ({ c, r: M.resumoCompra(c, d.lancamentos) })).filter(x => x.r.total);
  const ativas = compras.filter(x => !x.r.quitada).sort((a, b) => a.r.termina.localeCompare(b.r.termina));
  const quitadas = compras.filter(x => x.r.quitada);
  if (!formas.length && !compras.length) return `<div class="vazio"><p class="vazio__titulo">Nenhuma dívida ou cartão cadastrado.</p>
    <p>Quando você lançar uma compra parcelada, ela aparece aqui com quanto falta pagar e quando termina.</p></div>`;
  const total = formas.reduce((s, r) => s + r.falta, 0);
  const mesQueVem = M.somarMesesComp(ctx.hoje.slice(0, 7), 1);
  const liberaLogo = ativas.filter(x => x.r.termina.slice(0, 7) <= mesQueVem);

  const itemCompra = ({ c, r }) => `<li><a class="parc" href="#/compra/${esc(c.id)}">
    <span class="parc__topo"><span class="parc__nome">${esc(c.nome)}</span><span class="parc__falta">${r.quitada ? 'quitada' : brl(r.falta)}</span></span>
    <span class="barra" aria-hidden="true"><span style="width:${Math.round((r.pagas / r.total) * 100)}%"></span></span>
    <span class="parc__info">${esc(d.formas.find(f => f.id === c.formaId)?.nome || '')}, ${r.pagas} de ${r.total} pagas${r.quitada ? '' : `, termina em ${mesAno(r.termina)}`}</span>
  </a></li>`;

  return `<p class="dividas-total"><span>Falta pagar em parcelamentos</span><strong>${brl(total)}</strong></p>
  ${liberaLogo.length ? `<p class="aviso-bom">Até o fim do mês que vem terminam: ${liberaLogo.map(x => `<strong>${esc(x.c.nome)}</strong> (${brl(x.r.proxima?.valor || 0)}/mês)`).join(', ')}.</p>` : ''}

  ${ativas.length ? `<h2 class="bloco__titulo">Parcelamentos <span class="contador contador--neutro">${ativas.length}</span></h2>
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
  <p class="nota">O plano de quitação (qual dívida atacar primeiro) chega na Etapa 9.</p>`;
}
