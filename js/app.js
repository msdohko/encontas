import * as S from './store.js';
import { CONFIG } from './config.js';
import { ICONES, esc, toast, hojeISO, mesSeguinte } from './ui.js';
import * as inicio from './telas/inicio.js';
import * as quinzenas from './telas/quinzenas.js';
import * as dividas from './telas/dividas.js';
import * as lancar from './telas/lancar.js';
import * as mais from './telas/mais.js';
import * as entrar from './telas/entrar.js';
import * as cadastros from './telas/cadastros.js';
import * as assinaturas from './telas/assinaturas.js';
import * as atividade from './telas/atividade.js';
import * as compra from './telas/compra.js';
import * as diaadia from './telas/diaadia.js';
import * as relatorios from './telas/relatorios.js';
import * as simulador from './telas/simulador.js';
import * as avisos from './telas/avisos.js';
import * as M from './modelo.js';

const raiz = document.getElementById('app');
const ROTAS = {
  inicio:    { tela: inicio,    nome: 'Início',    icone: 'inicio' },
  quinzenas: { tela: quinzenas, nome: 'Contas', icone: 'quinzenas' },
  lancar:    { tela: lancar,    nome: 'Lançar',    icone: 'lancar', destaque: true },
  dividas:   { tela: dividas,   nome: 'Dívidas',   icone: 'dividas' },
  mais:      { tela: mais,      nome: 'Mais',      icone: 'mais' },
};
// Telas que não aparecem na barra (abertas a partir de "Mais")
const SUBROTAS = {
  cadastros:   { tela: cadastros,   nome: 'Cadastros',   pai: 'mais' },
  assinaturas: { tela: assinaturas, nome: 'Assinaturas', pai: 'mais' },
  atividade:   { tela: atividade,   nome: 'Atividade',   pai: 'mais' },
  compra:      { tela: compra,      nome: 'Compra',      pai: 'dividas' },
  diaadia:     { tela: diaadia,     nome: 'Dia a dia',   pai: 'mais' },
  relatorios:  { tela: relatorios,  nome: 'Relatórios',  pai: 'mais' },
  avisos:      { tela: avisos,      nome: 'Notificações', pai: 'mais' },
  simulador:   { tela: simulador,   nome: 'Simulador de compra', pai: 'mais' },
};

// Estado compartilhado entre as telas
const ctx = {
  usuario: null, dados: null, hoje: hojeISO(), pendentes: new Set(),
  comp: hojeISO().slice(0, 7), quinzenaVista: 'mes',
  modoDemo: S.modoDemo, store: S, aplicarTema,
  render: () => desenhar(),
  recarregar: async () => { ctx.dados = await S.carregarCasa(ctx.usuario.casaId, ctx.hoje.slice(0, 7), ctx.hoje); desenhar(); },
};
if (S.modoDemo) { ctx.hoje = '2026-10-23'; ctx.comp = '2026-10'; }

// ── Tema (automático / claro / escuro) ───────────────────────────────
export function aplicarTema(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem('tema', t); } catch {}
}
try { aplicarTema(localStorage.getItem('tema') || 'auto'); } catch {}

// ── Fluxo de entrada ─────────────────────────────────────────────────
function carregando(msg = 'Abrindo…') { raiz.innerHTML = `<div class="tela-cheia"><p class="carregando">${msg}</p></div>`; }

carregando();
const comPrazo = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('demorou demais para responder')), ms))]);

function erroCarregar(e) {
  console.error(e);
  raiz.innerHTML = `<div class="tela-cheia"><div class="erro-carregar">
    <p class="erro">Não foi possível carregar seus dados: ${esc(e.message)}.</p>
    <p>Confira a internet e tente de novo. Se continuar, use “Recarregar sem cache”.</p>
    <button class="btn" data-acao="tentar">Tentar de novo</button>
    <button class="btn btn--sec" data-acao="sem-cache">Recarregar sem cache</button>
    <button class="link-sair" data-acao="sair">Sair da conta</button></div></div>`;
  raiz.querySelector('[data-acao=tentar]').onclick = () => location.reload();
  raiz.querySelector('[data-acao=sem-cache]').onclick = () => { try { localStorage.setItem('semCache', '1'); } catch {} location.reload(); };
  raiz.querySelector('[data-acao=sair]').onclick = () => S.sair();
}

// ── Offline leve ─────────────────────────────────────────────────────
// Guarda a casca do app no aparelho (abre sem internet) e o mesmo service worker recebe as notificações
if ('serviceWorker' in navigator && !S.modoDemo) navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' }).catch(e => console.warn('sw', e));
// Ação recusada sem internet (ou outro erro não tratado): avisa em vez de falhar calado
addEventListener('unhandledrejection', e => {
  const msg = e.reason?.message; if (!msg) return;
  if (e.reason instanceof S.SemInternet) { e.preventDefault(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); toast(msg); desenhar(); }
});
addEventListener('encontas:offline', () => desenhar());
async function voltouInternet() {
  if (!ctx.dados || S.modoDemo) return;
  try {
    const n = await S.enviarFila(ctx.dados);
    await ctx.recarregar();
    if (!S.estado.offline) toast(n ? `Conectado: ${n} lançamento${n > 1 ? 's' : ''} enviado${n > 1 ? 's' : ''}` : 'Conectado: dados atualizados');
  } catch (e) { console.warn('ainda sem conexão', e); }
}
addEventListener('online', voltouInternet);
addEventListener('offline', () => { if (ctx.dados && !S.modoDemo) { S.estado.offline = true; S.estado.copiaEm ||= new Date().toISOString(); desenhar(); } });
// ao voltar para o app (ex.: desbloqueou o celular), tenta sincronizar se estava sem internet
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.estado.offline && navigator.onLine) voltouInternet(); });

S.observarUsuario(async u => {
  if (!u) { ctx.usuario = null; return mostrarEntrada(); }
  carregando('Carregando sua casa…');
  try {
    ctx.usuario = await comPrazo(S.perfil(u), 20000);
    if (!ctx.usuario.casaId) return mostrarEntrada();
    ctx.dados = await comPrazo(S.carregarCasa(ctx.usuario.casaId, ctx.hoje.slice(0, 7), ctx.hoje), 30000);
    desenhar();
  } catch (e) { erroCarregar(e); }
});

function mostrarEntrada() {
  raiz.innerHTML = entrar.render(ctx);
  entrar.ligar(raiz, ctx, async casaId => { ctx.usuario.casaId = casaId; await ctx.recarregar(); location.hash = '#/inicio'; });
}

// ── Casca: barra lateral (PC) + barra inferior (celular) ────────────
function rotaAtual() {
  const [r, param] = location.hash.replace('#/', '').split('/');
  ctx.param = param || null;
  return ROTAS[r] || SUBROTAS[r] ? r : 'inicio';
}

function faixaOffline() {
  if (S.modoDemo) return '';
  const pend = ctx.pendentes.size;
  if (!S.estado.offline) return pend ? `<p class="faixa-offline faixa-offline--envio">${pend} lançamento${pend > 1 ? 's' : ''} esperando para enviar…</p>` : '';
  const em = S.estado.copiaEm ? new Date(S.estado.copiaEm) : null;
  const quando = em ? `${String(em.getDate()).padStart(2, '0')}/${String(em.getMonth() + 1).padStart(2, '0')} às ${String(em.getHours()).padStart(2, '0')}:${String(em.getMinutes()).padStart(2, '0')}` : '';
  return `<p class="faixa-offline"><strong>Sem internet.</strong> Mostrando os dados de ${quando}. Dá para lançar gastos; pagar e alterar contas volta quando conectar.${pend ? ` <span>${pend} esperando envio.</span>` : ''}
    <button type="button" class="link-mais" data-reconectar>Tentar conectar</button></p>`;
}

function desenhar() {
  if (!ctx.usuario?.casaId || !ctx.dados) return;
  ctx.pendentes = S.modoDemo ? new Set() : S.pendentesDeEnvio(ctx.dados.casa.id);
  const atual = rotaAtual(), rota = ROTAS[atual] || SUBROTAS[atual], { tela } = rota;
  const nome = tela.titulo?.(ctx) || rota.nome, ativo = rota.pai || atual;
  const links = (classe) => Object.entries(ROTAS).map(([id, r]) => `
    <a href="#/${id}" class="${classe}__item${r.destaque ? ` ${classe}__item--destaque` : ''}" ${id === ativo ? 'aria-current="page"' : ''}>
      <span class="${classe}__icone">${ICONES[r.icone]}</span><span class="${classe}__rotulo">${r.nome}</span></a>`).join('');

  raiz.innerHTML = `
    <div class="casca">
      <aside class="lateral" aria-label="Navegação">
        <div class="marca"><span class="marca__simbolo" aria-hidden="true"></span>${esc(CONFIG.nomeApp)}</div>
        <p class="lateral__casa">${esc(ctx.dados.casa.nome)}</p>
        <nav class="lateral__nav">${links('lateral')}</nav>
        <div class="lateral__rodape">
          ${ctx.usuario.foto ? `<img src="${esc(ctx.usuario.foto)}" alt="" class="avatar">` : `<span class="avatar avatar--letra">${esc(ctx.usuario.nome[0])}</span>`}
          <span>${esc(ctx.usuario.nome.split(' ')[0])}</span>
        </div>
      </aside>
      <main class="conteudo" id="conteudo" tabindex="-1">
        ${S.modoDemo ? '<p class="faixa-demo">Modo demonstração com os dados da sua planilha. Nada é salvo.</p>' : ''}
        ${faixaOffline()}
        <div class="topo-tela"><h1 class="titulo-tela">${nome}</h1>${(() => { const al = avisos.alertasDe(ctx), n = al.filter(a => a.nivel !== 'info').length;
          return `<button type="button" class="icone-btn sino" data-sino aria-label="Alertas${al.length ? `: ${al.length}` : ''}">${ICONES.sino}${n ? `<span class="sino__n">${n}</span>` : ''}</button>`; })()}</div>
        ${tela.render(ctx)}
      </main>
      <nav class="inferior" aria-label="Navegação">${links('inferior')}</nav>
    </div>`;
  const conteudo = raiz.querySelector('#conteudo');
  conteudo.querySelectorAll('[data-mes]').forEach(b => b.addEventListener('click', () => {
    ctx.comp = mesSeguinte(ctx.comp, Number(b.dataset.mes)); desenhar();
  }));
  conteudo.querySelector('[data-reconectar]')?.addEventListener('click', e => { e.currentTarget.textContent = 'Conectando…'; voltouInternet().then(() => desenhar()); });
  conteudo.querySelector('[data-sino]')?.addEventListener('click', () => avisos.abrirAlertas(ctx));
  tela.ligar?.(conteudo, ctx);
}

addEventListener('hashchange', () => { desenhar(); document.getElementById('conteudo')?.focus({ preventScroll: true }); scrollTo(0, 0); });
export { toast };
