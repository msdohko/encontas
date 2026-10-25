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

const raiz = document.getElementById('app');
const ROTAS = {
  inicio:    { tela: inicio,    nome: 'Início',    icone: 'inicio' },
  quinzenas: { tela: quinzenas, nome: 'Quinzenas', icone: 'quinzenas' },
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
};

// Estado compartilhado entre as telas
const ctx = {
  usuario: null, dados: null, hoje: hojeISO(),
  comp: hojeISO().slice(0, 7), quinzenaVista: Number(hojeISO().slice(8, 10)) < 15 ? 1 : 2,
  modoDemo: S.modoDemo, store: S, aplicarTema,
  render: () => desenhar(),
  recarregar: async () => { ctx.dados = await S.carregarCasa(ctx.usuario.casaId, ctx.hoje.slice(0, 7)); desenhar(); },
};
if (S.modoDemo) { ctx.hoje = '2026-10-23'; ctx.comp = '2026-10'; ctx.quinzenaVista = 2; }

// ── Tema (automático / claro / escuro) ───────────────────────────────
export function aplicarTema(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem('tema', t); } catch {}
}
try { aplicarTema(localStorage.getItem('tema') || 'auto'); } catch {}

// ── Fluxo de entrada ─────────────────────────────────────────────────
function carregando(msg = 'Abrindo…') { raiz.innerHTML = `<div class="tela-cheia"><p class="carregando">${msg}</p></div>`; }

carregando();
S.observarUsuario(async u => {
  if (!u) { ctx.usuario = null; return mostrarEntrada(); }
  carregando('Carregando sua casa…');
  try {
    ctx.usuario = await S.perfil(u);
    if (!ctx.usuario.casaId) return mostrarEntrada();
    ctx.dados = await S.carregarCasa(ctx.usuario.casaId, ctx.hoje.slice(0, 7));
    desenhar();
  } catch (e) { console.error(e); raiz.innerHTML = `<div class="tela-cheia"><p class="erro">Não foi possível carregar seus dados: ${esc(e.message)}</p></div>`; }
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

function desenhar() {
  if (!ctx.usuario?.casaId || !ctx.dados) return;
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
        <h1 class="titulo-tela">${nome}</h1>
        ${tela.render(ctx)}
      </main>
      <nav class="inferior" aria-label="Navegação">${links('inferior')}</nav>
    </div>`;
  const conteudo = raiz.querySelector('#conteudo');
  conteudo.querySelectorAll('[data-mes]').forEach(b => b.addEventListener('click', () => {
    ctx.comp = mesSeguinte(ctx.comp, Number(b.dataset.mes)); desenhar();
  }));
  tela.ligar?.(conteudo, ctx);
}

addEventListener('hashchange', () => { desenhar(); document.getElementById('conteudo')?.focus({ preventScroll: true }); scrollTo(0, 0); });
export { toast };
