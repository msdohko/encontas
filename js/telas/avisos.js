// Alertas (sininho) e Notificações no celular
import * as M from '../modelo.js';
import { aplicar } from '../store.js';
import * as N from '../notificacoes.js';
import { esc, ICONES, abrirFolha, toast } from '../ui.js';

export function titulo() { return 'Notificações'; }

export const alertasDe = ctx => M.alertas(ctx.dados, ctx.hoje, { diasAntes: 1 });

const COR = { ruim: 'var(--atrasado)', atencao: 'var(--vence)', info: 'var(--q1)' };
export function listaAlertas(lista) {
  if (!lista.length) return '<div class="vazio"><p class="vazio__titulo">Tudo em dia.</p><p>Nenhuma conta vencendo, atrasada ou para confirmar agora.</p></div>';
  return `<ul class="alertas">${lista.map(a => `<li><a href="${a.link}" class="alerta" data-ir>
    <i style="background:${COR[a.nivel]}" aria-hidden="true"></i>
    <span><strong>${esc(a.titulo)}</strong><small>${esc(a.texto)}</small></span>${ICONES.dir2}</a></li>`).join('')}</ul>`;
}

/** Sininho do topo: abre a lista de alertas */
export function abrirAlertas(ctx) {
  const lista = alertasDe(ctx);
  abrirFolha({ titulo: 'Alertas', corpo: `${listaAlertas(lista)}
    <p class="nota"><a href="#/avisos" data-ir>Receber esses avisos no celular</a></p>`,
  ligar: (el, fechar) => el.querySelectorAll('[data-ir]').forEach(a => a.addEventListener('click', () => fechar())) });
}

// ── Tela Mais → Notificações ─────────────────────────────────────────
let idLocal = null;
try { idLocal = localStorage.getItem('dispositivoId'); } catch {}

export function render(ctx) {
  const d = ctx.dados, meu = d.dispositivos.find(x => x.id === idLocal && x.ativo !== false);
  const previa = M.textoNotificacao(M.alertas(d, ctx.hoje, { diasAntes: meu?.diasAntes ?? 1 }));
  let estado;
  if (!N.suportado() && !N.iosForaDoApp()) estado = `<p class="aviso-ruim">Este navegador não recebe notificações. No celular, use o app pelo ícone da tela de início (iPhone com iOS 16.4 ou mais novo) ou o Chrome no Android.</p>`;
  else if (N.iosForaDoApp()) estado = `<p class="aviso-ruim">No iPhone, as notificações só funcionam com o encontas aberto pelo <strong>ícone da tela de início</strong>. Abra por lá e volte aqui.</p>`;
  else if (!N.configurado()) estado = `<p class="aviso-ruim">Falta configurar a chave de notificações do Firebase (Cloud Messaging) no app. O passo a passo está em COMO-CONFIGURAR.md.</p>`;
  else if (meu && N.permissao() === 'granted') estado = `<p class="aviso-bom"><strong>Ativado neste aparelho.</strong> Todo dia por volta das 7h chega um resumo do que vence, do que está atrasado e do que precisa confirmar. Se não tiver nada, não chega nada.</p>`;
  else estado = `<p class="intro">Receba no celular, todo dia de manhã, um aviso do que vence, do que atrasou e do salário para confirmar.</p>
    <button class="btn" data-ativar>Ativar neste aparelho</button>`;

  return `<a class="voltar" href="#/mais">${ICONES.esq} Mais</a>
  <section class="bloco">${estado}
    ${meu ? `<fieldset class="campo"><legend>Avisar dos vencimentos</legend><div class="chips">${[[0, 'Só no dia'], [1, '1 dia antes'], [2, '2 dias antes'], [3, '3 dias antes']].map(([v, r]) =>
      `<label class="chip"><input type="radio" name="diasAntes" value="${v}" ${(meu.diasAntes ?? 1) === v ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div></fieldset>
      <div class="detalhe__acoes"><button type="button" class="btn btn--sec" data-testar>Testar neste aparelho</button>
      <button type="button" class="btn btn--sec" data-desativar>Desativar neste aparelho</button></div>` : ''}
  </section>
  <section class="bloco"><h2 class="bloco__titulo">O aviso de hoje seria</h2>
    ${previa ? `<div class="notif-previa"><img src="./icone-192.png" alt=""><span><strong>${esc(previa.titulo)}</strong><small>${esc(previa.corpo)}</small></span></div>`
      : '<p class="nota">Nada para avisar hoje: não chegaria notificação.</p>'}</section>
  <section class="bloco"><h2 class="bloco__titulo">Todos os alertas de agora</h2>${listaAlertas(M.alertas(d, ctx.hoje, { diasAntes: meu?.diasAntes ?? 1 }))}</section>
  ${d.dispositivos.length ? `<section class="bloco"><h2 class="bloco__titulo">Aparelhos que recebem</h2>
    <ul class="contas">${d.dispositivos.map(x => `<li class="aparelho"><span>${esc(x.pessoa || '')}<small>${esc(x.aparelho || '')}${x.id === idLocal ? ' (este)' : ''}${x.ativo === false ? ', desativado' : ''}</small></span>
      <button type="button" class="link-perigo" data-remover="${esc(x.id)}">Remover</button></li>`).join('')}</ul></section>` : ''}`;
}

export function ligar(el, ctx) {
  const salvar = dados => aplicar(ctx.dados, [{ set: 'dispositivos', dados }]);
  el.querySelector('[data-ativar]')?.addEventListener('click', async ev => {
    const b = ev.currentTarget; b.disabled = true; b.textContent = 'Ativando…';
    try {
      const token = await N.obterToken(), id = await N.idDoToken(token);
      await salvar({ id, token, uid: ctx.usuario.uid, pessoa: ctx.usuario.nome.split(' ')[0], aparelho: N.nomeDoAparelho(), diasAntes: 1, ativo: true, criadoEm: new Date().toISOString() });
      try { localStorage.setItem('dispositivoId', id); } catch {} idLocal = id;
      ctx.render(); toast('Notificações ativadas neste aparelho');
    } catch (e) { console.error(e); b.disabled = false; b.textContent = 'Ativar neste aparelho'; toast(e.message || 'Não deu para ativar.'); }
  });
  const meu = ctx.dados.dispositivos.find(x => x.id === idLocal);
  el.querySelectorAll('[name=diasAntes]').forEach(r => r.addEventListener('change', async () => {
    await salvar({ ...meu, diasAntes: Number(r.value) }); ctx.render(); toast('Preferência salva');
  }));
  el.querySelector('[data-testar]')?.addEventListener('click', async () => {
    const reg = await navigator.serviceWorker.getRegistration('./');
    const p = M.textoNotificacao(M.alertas(ctx.dados, ctx.hoje, { diasAntes: meu?.diasAntes ?? 1 })) || { titulo: 'encontas', corpo: 'Notificações funcionando neste aparelho.' };
    if (reg) reg.showNotification(p.titulo, { body: p.corpo, icon: './icone-192.png', tag: 'encontas-teste' }); else toast('Ative de novo neste aparelho.');
  });
  el.querySelector('[data-desativar]')?.addEventListener('click', async () => { await salvar({ ...meu, ativo: false }); ctx.render(); toast('Desativado neste aparelho'); });
  el.querySelectorAll('[data-remover]').forEach(b => b.addEventListener('click', async () => {
    if (!b.dataset.certeza) { b.dataset.certeza = 1; b.textContent = 'Toque de novo'; return; }
    await aplicar(ctx.dados, [{ apagar: 'dispositivos', id: b.dataset.remover }]); ctx.render(); toast('Aparelho removido');
  }));
}
