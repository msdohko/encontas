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

export async function entrarGoogle() {
  const f = await api(), prov = new f.GoogleAuthProvider();
  prov.setCustomParameters({ prompt: 'select_account' });
  try { await f.signInWithPopup(f.auth, prov); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/cancelled-popup-request'].includes(e.code))
      return f.signInWithRedirect(f.auth, prov);
    if (e.code === 'auth/popup-closed-by-user') return;
    throw e;
  }
}

export async function sair() {
  if (modoDemo) return location.reload();
  const f = await api(); await f.signOut(f.auth);
}

// ── Perfil e casa ────────────────────────────────────────────────────
export async function perfil(u) {
  if (modoDemo) return { ...u, casaId: 'demo' };
  const f = await api(), ref = f.doc(f.db, 'usuarios', u.uid), s = await f.getDoc(ref);
  if (s.exists()) return { ...u, ...s.data() };
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
export const COLECOES = ['categorias', 'formas', 'fontes', 'entradas', 'recorrentes', 'compras', 'lancamentos'];

export async function carregarCasa(casaId, hojeComp) {
  const dados = modoDemo ? await demo() : await lerFirestore(casaId);
  // Garante os lançamentos das contas fixas/assinaturas até 12 meses à frente (ids fixos: nunca duplica)
  const ate = M.somarMesesComp(hojeComp, 12), criar = [];
  for (const r of dados.recorrentes) criar.push(...M.sincronizarRecorrente(r, dados.lancamentos, hojeComp, ate).criar);
  if (criar.length) await aplicar(dados, criar.map(l => ({ set: 'lancamentos', dados: l })));
  return dados;
}

async function lerFirestore(casaId) {
  const f = await api();
  const casa = (await f.getDoc(f.doc(f.db, 'casas', casaId))).data();
  const listas = await Promise.all(COLECOES.map(c => f.getDocs(f.collection(f.db, 'casas', casaId, c))));
  const dados = { casa: { id: casaId, ...casa } };
  COLECOES.forEach((c, i) => { dados[c] = listas[i].docs.map(d => ({ ...d.data(), id: d.id })); });
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
export async function aplicar(dados, ops) {
  for (const op of ops) {
    if (op.set) {
      op.dados.id ??= novoId();
      const lista = dados[op.set], i = lista.findIndex(x => x.id === op.dados.id);
      if (i >= 0) lista[i] = op.dados; else lista.push(op.dados);
    } else if (op.apagar) {
      dados[op.apagar] = dados[op.apagar].filter(x => x.id !== op.id);
    } else if (op.casa) Object.assign(dados.casa, op.casa);
  }
  if (modoDemo) return;
  const f = await api(), casaId = dados.casa.id;
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
    ...D.compras.flatMap(c => M.gerarParcelas(c, formaPorId[c.formaId])),
    ...D.recorrentes.flatMap(r => M.gerarRecorrentes(r, '2027-10')),
  ];
  D.ajustes.forEach(a => { const l = lanc.find(l => l.origem.id === a.recorrenteId && l.competencia === a.competencia); if (l) { l.valor = a.valor; l.confirmado = true; } });
  for (const [fid, porMes] of Object.entries(D.planilhaFaturas)) {
    if (fid.startsWith('_')) continue;
    for (const [comp, valor] of Object.entries(porMes)) {
      const det = lanc.filter(l => l.formaId === fid && l.competencia === comp).reduce((s, l) => s + M.cent(l.valor), 0);
      const dif = M.cent(valor) - det;
      if (dif > 0) lanc.push(...M.gerarParcelas({ id: `${fid}-${comp}`, nome: `${formaPorId[fid].nome}: outras compras`,
        valorTotal: M.reais(dif), parcelas: 1, formaId: fid, categoriaId: 'cartoes',
        primeiraData: `${comp}-${M.pad(formaPorId[fid].diaVencimento)}` }, formaPorId[fid]));
    }
  }
  // Situação de exemplo: pago até 22/out, exceto luz e fatura Condor da 2ª quinzena de outubro
  const emAberto = l => l.competencia === '2026-10' && l.quinzena === 2 && (l.origem.id === 'luz' || l.formaId === 'condor');
  lanc = lanc.map(l => (l.data < '2026-10-15' || (l.data < '2026-10-23' && !emAberto(l))) ? { ...M.marcarPago(l, l.data), confirmado: true } : l);
  cacheDemo = {
    casa: { id: 'demo', nome: 'Casa Eduardo e Amanda', dono: 'demo', inicioControle: '2026-10', membros: ['demo', 'amanda'],
      membrosInfo: { demo: { nome: 'Eduardo' }, amanda: { nome: 'Amanda' } } },
    categorias: [...D.categorias, { id: 'assinaturas', nome: 'Assinaturas', cor: '#5E7CE2', ordem: 9 }],
    formas: [...D.formas, { id: 'dinheiro', nome: 'Dinheiro', tipo: 'dinheiro', diaVencimento: 1, limite: null, ativo: true }],
    fontes: D.fontes, entradas: D.entradas, recorrentes: D.recorrentes, compras: D.compras, lancamentos: lanc,
  };
  return cacheDemo;
}
