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
