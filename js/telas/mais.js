import * as M from '../modelo.js';
import * as A from '../acoes.js';
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
  const ultima = [...(d.atividades || [])].sort((a, b) => b.em.localeCompare(a.em))[0];
  return `
  <section class="bloco">
    <ul class="menu">${link('#/diaadia', 'Dia a dia', d.formas.some(M.ehBeneficio) ? `vale mercado: ${brl(d.formas.filter(M.ehBeneficio).reduce((s, f) => s + M.saldoBeneficio(f, d.lancamentos, comp).saldo, 0))} livre` : 'gastos à vista e vale mercado')}
      ${link('#/atividade', 'Atividade', ultima ? `última: ${esc(ultima.nome)}` : 'quem fez o quê')}</ul>
  </section>
  ${!ctx.modoDemo && d.compras.some(c => c.importado) && d.casa.planilhaVersao !== '2026-11-07' ? `<section class="bloco bloco--importar">
    <h2 class="bloco__titulo">Atualizar com a planilha de 07/11</h2>
    <p class="intro">Coloca nas faturas os valores novos da planilha (nov/26 a set/27), encerra o Empréstimo Pan, que saiu da planilha, e marca as compras do cartão que você já lançou como "já incluídas" nesses meses, para não somarem duas vezes. O que já está pago continua pago.</p>
    <button class="btn" data-acao="planilha-0711">Atualizar valores</button>
  </section>` : ''}
  ${!ctx.modoDemo && !d.casa.faturasCorrigidas && d.compras.some(c => c.id.startsWith('fatura-')) ? `<section class="bloco bloco--importar">
    <h2 class="bloco__titulo">Corrigir as faturas dos cartões</h2>
    <p class="intro">Os cartões passam a ter uma conta "Fatura" por mês com o valor da planilha (até set/2027). As compras detalhadas (celulares, Guitarra, Havan…) viram só o detalhe dentro da fatura e param de somar duas vezes. O que você já ajustou nas outras contas não muda.</p>
    <button class="btn" data-acao="corrigir-faturas">Corrigir faturas</button>
  </section>` : ''}
  ${!ctx.modoDemo && !d.compras.some(c => c.importado) ? `<section class="bloco bloco--importar">
    <h2 class="bloco__titulo">Começar com a planilha</h2>
    <p class="intro">Traz da planilha Contas os cartões, o salário e o vale, as contas fixas, os parcelamentos e as faturas em aberto. O que venceu antes de hoje entra como pago. Depois é só conferir e ajustar.</p>
    <button class="btn" data-acao="importar">Importar dados da planilha</button>
  </section>` : ''}
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

const d0 = ctx => ctx.dados;

export function ligar(el, ctx) {
  el.querySelectorAll('input[name=tema]').forEach(i => i.addEventListener('change', () => ctx.aplicarTema(i.value)));
  el.querySelector('[data-acao=importar]')?.addEventListener('click', async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Importando…';
    try { const r = await A.importarPlanilha(ctx); ctx.render(); toast(`Importado: ${r.compras} parcelamentos, ${r.contas} contas fixas e ${r.formas} formas de pagamento`); }
    catch (err) { console.error(err); toast('Não foi possível importar: ' + err.message); b.disabled = false; b.textContent = 'Importar dados da planilha'; }
  });
  el.querySelector('[data-acao=corrigir-faturas]')?.addEventListener('click', async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Corrigindo…';
    try { const r = await A.corrigirFaturas(ctx); ctx.render(); toast(`Pronto: ${r.criadas} faturas criadas a partir da planilha`); }
    catch (err) { console.error(err); toast('Não foi possível corrigir: ' + err.message); b.disabled = false; b.textContent = 'Corrigir faturas'; }
  });
  el.querySelector('[data-acao=planilha-0711]')?.addEventListener('click', async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Atualizando…';
    try {
      if (!d0(ctx).casa.faturasCorrigidas && d0(ctx).compras.some(c => c.id.startsWith('fatura-'))) await A.corrigirFaturas(ctx);
      const P = (await import('../planilha-2026-11-07.js')).default;
      const r = await A.aplicarPlanilha(ctx, P); ctx.render();
      toast(`Atualizado: ${r.faturas} faturas${r.encerradas.length ? `, ${r.encerradas.join(', ')} encerrado` : ''}`);
    } catch (err) { console.error(err); toast('Não foi possível atualizar: ' + err.message); b.disabled = false; b.textContent = 'Atualizar valores'; }
  });
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
