// Camada de dados: a mesma interface funciona no modo demonstração (memória) e no Firebase.
import { CONFIG } from './config.js';
import * as M from './modelo.js';

export const modoDemo = !CONFIG.firebase.apiKey || CONFIG.firebase.apiKey.startsWith('COLE');
let fb = null;
const api = async () => (fb ??= await import('./firebase.js'));

export const CATEGORIAS_PADRAO = [
  ['moradia', 'Moradia', '#4C6FD6'], ['contas', 'Contas da casa', '#1E9AA8'], ['cartoes', 'Cartões', '#8A5CD0'],
  ['transporte', 'Transporte/Carro', '#D9822B'], ['mercado', 'Mercado', '#3E9E6E'], ['familia', 'Família', '#D2569B'],
  ['lazer', 'Lazer', '#C9A227'], ['dividas', 'Dívidas/Empréstimos', '#C94545'], ['assinaturas', 'Assinaturas', '#5E7CE2'],
].map(([id, nome, cor], i) => ({ id, nome, cor, ordem: i + 1 }));

export const FORMAS_PADRAO = [
  { id: 'pix', nome: 'Pix/Débito', tipo: 'pix', diaVencimento: 1, limite: null, ativo: true },
  { id: 'boleto', nome: 'Boleto', tipo: 'boleto', diaVencimento: 10, limite: null, ativo: true },
  { id: 'dinheiro', nome: 'Dinheiro', tipo: 'dinheiro', diaVencimento: 1, limite: null, ativo: true },
];

// ── Autenticação ─────────────────────────────────────────────────────
const USUARIO_DEMO = { uid: 'demo', nome: 'Eduardo', email: 'demo@exemplo.com', foto: null };
const daFirebase = u => u && { uid: u.uid, nome: u.displayName || u.email, email: u.email, foto: u.photoURL };

export async function observarUsuario(cb) {
  if (modoDemo) return cb(USUARIO_DEMO);
  const f = await api();
  f.getRedirectResult(f.auth).catch(() => {});
  f.onAuthStateChanged(f.auth, u => cb(daFirebase(u)));
}

/** Navegador embutido de outro app (Claude, Instagram, WhatsApp, Facebook…): o Google não deixa entrar por eles */
export function navegadorEmbutido() {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Claude|GSA\//i.test(ua)
    || (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua) && !navigator.standalone);
}

/**
 * Login só por janelinha (popup). O redirecionamento não funciona quando o app (github.io) e o login
 * (firebaseapp.com) estão em domínios diferentes no Safari/iPhone, então não usamos.
 * O popup é aberto direto no toque, sem esperar nada antes, para o navegador não bloquear.
 */
export function entrarGoogle() {
  if (!fb) return Promise.reject(new Error('O app ainda está carregando. Tente de novo em um segundo.'));
  const prov = new fb.GoogleAuthProvider();
  prov.setCustomParameters({ prompt: 'select_account' });
  return fb.signInWithPopup(fb.auth, prov).catch(e => {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    if (e.code === 'auth/popup-blocked') throw new Error('O navegador bloqueou a janela de login. Permita pop-ups para este site ou abra no Safari/Chrome.');
    if (e.code === 'auth/unauthorized-domain') throw new Error('Este endereço não está autorizado no Firebase (Authentication → Domínios autorizados).');
    throw e;
  });
}

export async function sair() {
  if (modoDemo) return location.reload();
  const f = await api(); await f.signOut(f.auth);
}

// ── Modo offline leve ────────────────────────────────────────────────
// Guarda no aparelho a última cópia dos dados (para abrir sem internet) e uma fila de lançamentos NOVOS
// feitos sem internet. Alterar o que já existe exige internet (evita um apagar a alteração do outro).
export const estado = { offline: false, copiaEm: null };
const ler = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn('sem espaço para guardar', k, e); return false; } };
const kCopia = id => `encontas:copia:${id}`, kFila = id => `encontas:fila:${id}`, kPerfil = uid => `encontas:perfil:${uid}`;
export const semInternet = () => estado.offline || !navigator.onLine;
export const fila = casaId => ler(kFila(casaId)) || [];
export const pendentesDeEnvio = casaId => new Set(fila(casaId).filter(o => o.set === 'lancamentos').map(o => o.dados.id));
let tGuardar = null;
export function guardarCopia(dados) {
  if (modoDemo) return;
  clearTimeout(tGuardar);
  // atividade: só as 50 mais recentes na cópia, para caber no espaço do navegador
  tGuardar = setTimeout(() => gravar(kCopia(dados.casa.id), { em: new Date().toISOString(), dados: { ...dados, atividades: (dados.atividades || []).slice(0, 50) } }), 300);
}
const prazo = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('sem resposta do servidor')), ms))]);

/** Manda a fila de lançamentos feitos sem internet. Devolve quantos foram enviados. */
export async function enviarFila(dados) {
  const ops = fila(dados.casa.id);
  if (!ops.length || modoDemo) return 0;
  await prazo(gravarNoServidor(dados.casa.id, ops), 20000);
  gravar(kFila(dados.casa.id), []);
  return ops.filter(o => o.set === 'lancamentos').length || ops.length;
}

// ── Perfil e casa ────────────────────────────────────────────────────
export async function perfil(u) {
  if (modoDemo) return { ...u, casaId: 'demo' };
  const salvo = ler(kPerfil(u.uid));
  if (salvo?.casaId && !navigator.onLine) return { ...u, ...salvo };
  let s;
  try { const f = await api(); s = await prazo(f.getDoc(f.doc(f.db, 'usuarios', u.uid)), 12000); }
  catch (e) { if (salvo?.casaId) return { ...u, ...salvo }; throw e; }
  const f = await api(), ref = f.doc(f.db, 'usuarios', u.uid);
  if (s.exists()) { const p = s.data(); gravar(kPerfil(u.uid), { casaId: p.casaId, nome: p.nome }); return { ...u, ...p }; }
  await f.setDoc(ref, { nome: u.nome, email: u.email, foto: u.foto, casaId: null, criadoEm: f.serverTimestamp() });
  return { ...u, casaId: null };
}

export async function criarCasa(u, nome) {
  const f = await api(), ref = f.doc(f.collection(f.db, 'casas'));
  const hoje = new Date(), comp = `${hoje.getFullYear()}-${M.pad(hoje.getMonth() + 1)}`;
  await f.setDoc(ref, {
    nome, dono: u.uid, membros: [u.uid], inicioControle: comp,
    membrosInfo: { [u.uid]: { nome: u.nome, foto: u.foto || null } }, criadoEm: f.serverTimestamp(),
  });
  const b = f.writeBatch(f.db);
  CATEGORIAS_PADRAO.forEach(c => b.set(f.doc(f.db, 'casas', ref.id, 'categorias', c.id), c));
  FORMAS_PADRAO.forEach(c => b.set(f.doc(f.db, 'casas', ref.id, 'formas', c.id), c));
  b.update(f.doc(f.db, 'usuarios', u.uid), { casaId: ref.id });
  await b.commit();
  return ref.id;
}

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export async function gerarConvite(u, casaId) {
  if (modoDemo) return 'DEMO42';
  const f = await api();
  const codigo = Array.from(crypto.getRandomValues(new Uint8Array(6)), n => ALFABETO[n % ALFABETO.length]).join('');
  await f.setDoc(f.doc(f.db, 'convites', codigo), { casaId, criadoPor: u.uid, expiraEm: f.Timestamp.fromMillis(Date.now() + 7 * 864e5) });
  return codigo;
}

export async function entrarComCodigo(u, codigoBruto) {
  const f = await api(), codigo = codigoBruto.trim().toUpperCase();
  const s = await f.getDoc(f.doc(f.db, 'convites', codigo));
  if (!s.exists()) throw new Error('Código não encontrado. Confira as letras e tente de novo.');
  const { casaId, expiraEm } = s.data();
  if (expiraEm.toMillis() < Date.now()) throw new Error('Esse código expirou. Peça um novo para quem convidou você.');
  await f.updateDoc(f.doc(f.db, 'casas', casaId), {
    membros: f.arrayUnion(u.uid), [`membrosInfo.${u.uid}`]: { nome: u.nome, foto: u.foto || null }, ultimoConvite: codigo,
  });
  await f.updateDoc(f.doc(f.db, 'usuarios', u.uid), { casaId });
  return casaId;
}

// ── Leitura ──────────────────────────────────────────────────────────
export const COLECOES = ['categorias', 'formas', 'fontes', 'entradas', 'recorrentes', 'compras', 'lancamentos', 'dispositivos'];

export async function carregarCasa(casaId, hojeComp, hojeISO) {
  let dados;
  if (modoDemo) dados = await demo();
  else {
    const copia = ler(kCopia(casaId));
    try {
      if (!navigator.onLine && copia) throw new Error('sem internet');
      dados = await prazo(lerFirestore(casaId), copia ? 12000 : 25000);
      estado.offline = false; estado.copiaEm = null;
    } catch (e) {
      if (!copia) throw e;
      dados = copia.dados; estado.offline = true; estado.copiaEm = copia.em;
    }
    // lançamentos feitos sem internet que ainda não subiram
    const pend = fila(casaId);
    if (pend.length) {
      aplicarNaMemoria(dados, pend);
      if (!estado.offline) enviarFila(dados).catch(e => console.warn('fila', e));
    }
  }
  dados.dispositivos ||= []; // aparelhos que recebem notificação
  // Garante os lançamentos das contas fixas/assinaturas até 12 meses à frente (ids fixos: nunca duplica)
  const ate = M.somarMesesComp(hojeComp, 12), criar = [];
  for (const r of dados.recorrentes) criar.push(...M.sincronizarRecorrente(r, dados.lancamentos, hojeComp, ate).criar);
  // parcelas descontadas no salário que já venceram: baixa automática
  if (hojeISO) for (const l of M.baixasNoSalario(dados.lancamentos, dados.formas, hojeISO, new Date().toISOString())) {
    criar.push(l); dados.lancamentos[dados.lancamentos.findIndex(x => x.id === l.id)] = l;
  }
  // salva em segundo plano: a tela abre sem esperar o servidor confirmar (sem internet: só na memória; volta a ser criado depois)
  if (criar.length) {
    if (modoDemo || !estado.offline) aplicar(dados, criar.map(l => ({ set: 'lancamentos', dados: l }))).catch(e => console.error('lançamentos automáticos', e));
    else aplicarNaMemoria(dados, criar.map(l => ({ set: 'lancamentos', dados: l })));
  }
  if (!estado.offline) guardarCopia(dados);
  return dados;
}

async function lerFirestore(casaId) {
  const f = await api();
  const casa = (await f.getDoc(f.doc(f.db, 'casas', casaId))).data();
  const col = c => f.collection(f.db, 'casas', casaId, c);
  const [listas, ativ] = await Promise.all([
    Promise.all(COLECOES.map(c => f.getDocs(col(c)))),
    f.getDocs(f.query(col('atividades'), f.orderBy('em', 'desc'), f.limit(300))), // só as 300 mais recentes
  ]);
  const dados = { casa: { id: casaId, ...casa } };
  COLECOES.forEach((c, i) => { dados[c] = listas[i].docs.map(d => ({ ...d.data(), id: d.id })); });
  dados.atividades = ativ.docs.map(d => ({ ...d.data(), id: d.id }));
  return dados;
}

// ── Escrita ──────────────────────────────────────────────────────────
export const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const limpo = o => JSON.parse(JSON.stringify(o)); // Firestore não aceita undefined

/**
 * Aplica uma lista de operações nos dados em memória E salva:
 *   { set: 'colecao', dados: {...} }      cria ou substitui (gera id se não tiver)
 *   { apagar: 'colecao', id }
 *   { casa: { campo: valor } }            atualiza o documento da casa
 */
function aplicarNaMemoria(dados, ops) {
  for (const op of ops) {
    if (op.set) {
      op.dados.id ??= novoId();
      const lista = dados[op.set], i = lista.findIndex(x => x.id === op.dados.id);
      if (i >= 0) lista[i] = op.dados; else lista.push(op.dados);
    } else if (op.apagar) {
      dados[op.apagar] = dados[op.apagar].filter(x => x.id !== op.id);
    } else if (op.casa) Object.assign(dados.casa, op.casa);
  }
}

export class SemInternet extends Error {}

export async function aplicar(dados, ops) {
  for (const op of ops) if (op.set) op.dados.id ??= novoId();
  const casaId = dados.casa.id;
  if (!modoDemo && semInternet()) {
    // sem internet: só deixa CRIAR coisas novas (ex.: lançar um gasto); mexer no que existe espera a conexão
    const soNovos = ops.every(op => op.set && (op.set === 'atividades' || !dados[op.set].some(x => x.id === op.dados.id)
      || fila(casaId).some(q => q.set === op.set && q.dados.id === op.dados.id)));
    if (!soNovos) throw new SemInternet('Sem internet: dá para lançar gastos novos, mas para pagar ou alterar uma conta precisa estar conectado.');
    aplicarNaMemoria(dados, ops);
    gravar(kFila(casaId), [...fila(casaId).filter(q => !ops.some(o => o.set === q.set && o.dados.id === q.dados?.id)), ...JSON.parse(JSON.stringify(ops))]);
    gravar(kCopia(casaId), { em: estado.copiaEm || new Date().toISOString(), dados });
    return;
  }
  aplicarNaMemoria(dados, ops);
  if (modoDemo) return;
  try { await prazo(gravarNoServidor(casaId, ops), 15000); }
  catch (e) {
    // a internet caiu no meio: o Firestore termina de enviar sozinho enquanto o app estiver aberto
    if (/sem resposta/.test(e.message)) { estado.offline = true; estado.copiaEm ||= new Date().toISOString(); dispatchEvent(new Event('encontas:offline')); }
    else throw e;
  }
  guardarCopia(dados);
}

async function gravarNoServidor(casaId, ops) {
  const f = await api();
  for (let i = 0; i < ops.length; i += 400) {           // limite de 500 por lote
    const b = f.writeBatch(f.db);
    for (const op of ops.slice(i, i + 400)) {
      if (op.set) { const { id, ...resto } = op.dados; b.set(f.doc(f.db, 'casas', casaId, op.set, id), limpo(resto)); }
      else if (op.apagar) b.delete(f.doc(f.db, 'casas', casaId, op.apagar, op.id));
      else if (op.casa) b.update(f.doc(f.db, 'casas', casaId), limpo(op.casa));
    }
    await b.commit();
  }
}

// ── Modo demonstração: tudo a partir da planilha ─────────────────────
let cacheDemo = null;
async function demo() {
  if (cacheDemo) return cacheDemo;
  const D = structuredClone((await import('./demo-dados.js')).default);
  const formaPorId = Object.fromEntries(D.formas.map(f => [f.id, f]));
  let lanc = [
    ...D.compras.flatMap(c => M.gerarParcelas(c, formaPorId[c.formaId])).map(l => ({ ...l, naBase: true })),
    ...D.recorrentes.flatMap(r => M.gerarRecorrentes(r, '2027-10')),
  ];
  D.ajustes.forEach(a => { const l = lanc.find(l => l.origem.id === a.recorrenteId && l.competencia === a.competencia); if (l) { l.valor = a.valor; l.confirmado = true; } });
  const P = (await import('./planilha-2026-11-07.js')).default;
  for (const [fid, meses] of Object.entries(P.faturas)) Object.assign(D.planilhaFaturas[fid] ||= {}, meses);
  lanc.push(...M.faturasInformadas(D.planilhaFaturas, D.formas, '2026-10'));
  // Situação de exemplo: pago até 22/out, exceto luz e fatura Condor da 2ª quinzena de outubro
  const emAberto = l => l.competencia === '2026-10' && l.quinzena === 2 && (l.origem.id === 'luz' || l.formaId === 'condor');
  lanc = lanc.map(l => (l.data < '2026-10-15' || (l.data < '2026-10-23' && !emAberto(l))) ? { ...M.marcarPago(l, l.data), confirmado: true } : l);
  cacheDemo = {
    casa: { id: 'demo', nome: 'Casa Eduardo e Amanda', dono: 'demo', inicioControle: '2026-10', membros: ['demo', 'amanda'],
      membrosInfo: { demo: { nome: 'Eduardo' }, amanda: { nome: 'Amanda' } } },
    categorias: [...D.categorias, { id: 'assinaturas', nome: 'Assinaturas', cor: '#5E7CE2', ordem: 9 }],
    formas: [...D.formas, { id: 'dinheiro', nome: 'Dinheiro', tipo: 'dinheiro', diaVencimento: 1, limite: null, ativo: true }],
    fontes: D.fontes, entradas: D.entradas, recorrentes: D.recorrentes, compras: D.compras, lancamentos: lanc, atividades: [],
  };
  return cacheDemo;
}
