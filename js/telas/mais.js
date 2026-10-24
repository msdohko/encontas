import * as M from '../modelo.js';
import { esc, toast, ICONES, brl } from '../ui.js';

let codigoGerado = null;

export function render(ctx) {
  const d = ctx.dados, { casa } = d, comp = ctx.hoje.slice(0, 7);
  const assin = d.recorrentes.filter(r => r.assinatura && M.assinaturaAtiva(r, comp));
  const custo = assin.reduce((s, a) => s + M.custoMensal(a), 0);
  const revisar = assin.filter(a => M.precisaRevisar(a, ctx.hoje)).length;
  const link = (href, nome, info) => `<li><a class="menu__item" href="${href}"><span>${nome}</span><small>${info}</small>${ICONES.dir2}</a></li>`;
  let tema = 'auto'; try { tema = localStorage.getItem('tema') || 'auto'; } catch {}
  const membros = casa.membros.map(uid => ({ uid, ...(casa.membrosInfo?.[uid] || { nome: 'Membro' }) }));
  const opTema = (v, r) => `<label class="opcao"><input type="radio" name="tema" value="${v}" ${tema === v ? 'checked' : ''}><span>${r}</span></label>`;
  return `
  <section class="bloco">
    <h2 class="bloco__titulo">Cadastros</h2>
    <ul class="menu">
      ${link('#/assinaturas', 'Assinaturas', `${brl(custo)}/mês${revisar ? `, ${revisar} para revisar` : ''}`)}
      ${link('#/cadastros/fontes', 'Fontes de renda', `${d.fontes.length}`)}
      ${link('#/cadastros/contas', 'Contas fixas', `${d.recorrentes.filter(r => !r.assinatura).length}`)}
      ${link('#/cadastros/formas', 'Cartões e formas de pagamento', `${d.formas.length}`)}
      ${link('#/cadastros/categorias', 'Categorias', `${d.categorias.length}`)}
    </ul>
  </section>
  <section class="bloco">
    <h2 class="bloco__titulo">${esc(casa.nome)}</h2>
    <ul class="membros">${membros.map(m => `<li>${m.foto ? `<img class="avatar" src="${esc(m.foto)}" alt="">` : `<span class="avatar avatar--letra">${esc(m.nome[0])}</span>`}
      <span>${esc(m.nome)}${m.uid === ctx.usuario.uid ? ' <small>(você)</small>' : ''}${m.uid === casa.dono ? ' <small>dono</small>' : ''}</span></li>`).join('')}</ul>
    <div class="convite">
      <p>Para alguém entrar na casa e ver as mesmas contas, gere um código. Ele vale por 7 dias.</p>
      ${codigoGerado ? `<div class="convite__codigo"><strong>${codigoGerado}</strong>
        <button class="btn btn--sec" data-acao="copiar">${ICONES.copiar} Copiar</button>
        <a class="btn btn--sec" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`Entre na nossa casa no app ${location.origin + location.pathname} com o código ${codigoGerado}`)}">Enviar no WhatsApp</a></div>`
        : `<button class="btn" data-acao="convite">Gerar código de convite</button>`}
    </div>
  </section>
  <section class="bloco">
    <h2 class="bloco__titulo">Aparência</h2>
    <div class="opcoes" role="radiogroup" aria-label="Tema">${opTema('auto', 'Automático')}${opTema('light', 'Claro')}${opTema('dark', 'Escuro')}</div>
  </section>
  <section class="bloco bloco--conta">
    <p>Conectado como <strong>${esc(ctx.usuario.email)}</strong></p>
    <button class="btn btn--sec" data-acao="sair">${ICONES.sair} Sair</button>
  </section>`;
}

export function ligar(el, ctx) {
  el.querySelectorAll('input[name=tema]').forEach(i => i.addEventListener('change', () => ctx.aplicarTema(i.value)));
  el.querySelector('[data-acao=sair]')?.addEventListener('click', () => ctx.store.sair());
  el.querySelector('[data-acao=convite]')?.addEventListener('click', async e => {
    e.target.disabled = true;
    try { codigoGerado = await ctx.store.gerarConvite(ctx.usuario, ctx.usuario.casaId); ctx.render(); }
    catch (err) { toast('Não foi possível gerar o código: ' + err.message); e.target.disabled = false; }
  });
  el.querySelector('[data-acao=copiar]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(codigoGerado); toast('Código copiado'); } catch { toast('Copie manualmente: ' + codigoGerado); }
  });
}
