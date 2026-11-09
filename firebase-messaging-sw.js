// Service worker das notificações (Firebase Cloud Messaging). Mostra o aviso com o app fechado e abre o app no toque.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAPTV8i-G6zowIwu_d1Qw5rPankVEDCcL0',
  authDomain: 'encontas-43f45.firebaseapp.com',
  projectId: 'encontas-43f45',
  storageBucket: 'encontas-43f45.firebasestorage.app',
  messagingSenderId: '1087849810507',
  appId: '1:1087849810507:web:1441c6499250e63e659bce',
});
const messaging = firebase.messaging();

// Mensagem só com dados (sem "notification"): monta o aviso aqui
messaging.onBackgroundMessage(msg => {
  if (msg.notification) return; // o navegador já mostra sozinho
  const d = msg.data || {};
  self.registration.showNotification(d.titulo || 'encontas', { body: d.corpo || '', icon: './icone-192.png', badge: './icone-192.png', tag: 'encontas-diario', data: d });
});

self.addEventListener('notificationclick', e => {
  if (e.notification.data?.FCM_MSG) return; // aviso montado pelo Firebase: ele mesmo abre o link
  e.notification.close();
  const alvo = new URL('./' + (e.notification.data?.link || '#/inicio'), self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(c => c.url.startsWith(self.registration.scope));
    return w ? w.navigate(alvo).then(c => (c || w).focus()) : clients.openWindow(alvo);
  }));
});

// ── Offline leve: guarda a casca do app (HTML, CSS, JS, ícones, Firebase e fontes) ──────────
// Arquivos do app: tenta a internet primeiro (sempre a versão nova); sem internet, usa a cópia guardada.
// Bibliotecas com versão no endereço (Firebase, fontes): usa a cópia guardada direto.
const CACHE = 'encontas-casca-v1';
const CASCA = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icone-192.png',
  './icone-180.png',
  './icone.svg',
  './css/app.css',
  './js/acoes.js',
  './js/app.js',
  './js/config.js',
  './js/firebase.js',
  './js/modelo.js',
  './js/notificacoes.js',
  './js/store.js',
  './js/telas/assinaturas.js',
  './js/telas/atividade.js',
  './js/telas/avisos.js',
  './js/telas/cadastros.js',
  './js/telas/compra.js',
  './js/telas/conta.js',
  './js/telas/diaadia.js',
  './js/telas/dividas.js',
  './js/telas/entrada.js',
  './js/telas/entrar.js',
  './js/telas/inicio.js',
  './js/telas/lancar.js',
  './js/telas/mais.js',
  './js/telas/quinzenas.js',
  './js/telas/relatorios.js',
  './js/telas/simulador.js',
  './js/ui.js',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CASCA.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('encontas-casca-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const FIXOS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (FIXOS.test(r.url)) {
    e.respondWith(caches.match(r).then(c => c || fetch(r).then(resp => { if (resp.ok) caches.open(CACHE).then(k => k.put(r, resp.clone())); return resp; })));
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (url.pathname.endsWith('firebase-messaging-sw.js')) return;
  e.respondWith((async () => {
    const rede = fetch(r).then(resp => { if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(k => k.put(r, copia)); } return resp; });
    try { return await Promise.race([rede, new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 4000))]); }
    catch {
      const c = await caches.match(r, { ignoreSearch: true }) || (r.mode === 'navigate' && (await caches.match('./index.html') || await caches.match('./')));
      if (c) return c;
      return rede; // sem cópia: espera a rede mesmo
    }
  })());
});
