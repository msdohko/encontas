import * as M from '../modelo.js';
import { brl, esc } from '../ui.js';

export function render(ctx) {
  const d = ctx.dados;
  const linhas = M.resumoFormas(d.formas, d.lancamentos).map((r, i) => ({ ...r, f: d.formas[i] })).filter(r => r.falta > 0 || r.f.limite);
  if (!linhas.length) return `<div class="vazio"><p class="vazio__titulo">Nenhuma dívida ou cartão cadastrado.</p>
    <p>Quando você lançar uma compra parcelada, ela aparece aqui com quanto falta pagar.</p></div>`;
  const total = linhas.reduce((s, r) => s + r.falta, 0);
  return `<p class="dividas-total"><span>Falta pagar em parcelamentos</span><strong>${brl(total)}</strong></p>
  <ul class="dividas">${linhas.map(r => {
    const usado = r.f.limite ? Math.min(100, Math.max(0, (r.falta / r.f.limite) * 100)) : null;
    return `<li class="divida">
      <div class="divida__topo"><span class="divida__nome">${esc(r.forma)}</span><span class="divida__falta">${brl(r.falta)}</span></div>
      ${usado != null ? `<div class="barra ${r.limiteLivre < 0 ? 'barra--estourou' : ''}" role="img" aria-label="${Math.round(usado)}% do limite comprometido"><span style="width:${usado}%"></span></div>
      <p class="divida__limite">${r.limiteLivre < 0 ? `Passou ${brl(-r.limiteLivre)} do limite` : `Limite livre ${brl(r.limiteLivre)} de ${brl(r.f.limite)}`}</p>` : ''}
    </li>`; }).join('')}</ul>
  <p class="nota">O plano de quitação (qual dívida atacar primeiro) chega na Etapa 9.</p>`;
}
