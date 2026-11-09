// Notificações no celular (Firebase Cloud Messaging). O aviso diário é enviado por um robô do GitHub (scripts/notificar.mjs).
import { CONFIG } from './config.js';

const V = '10.12.2';
export const suportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const configurado = () => !!CONFIG.vapidKey && !CONFIG.vapidKey.startsWith('COLE');
export const permissao = () => (suportado() ? Notification.permission : 'indisponivel');
const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const iosForaDoApp = () => ios() && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches);

let reg = null;
async function registrar() {
  reg ||= await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' });
  await navigator.serviceWorker.ready;
  return reg;
}

/** Pede permissão e devolve o token deste aparelho */
export async function obterToken() {
  if (!suportado()) throw new Error('Este navegador não recebe notificações.');
  if (iosForaDoApp()) throw new Error('No iPhone, abra o encontas pelo ícone da tela de início para ativar.');
  const p = await Notification.requestPermission();
  if (p !== 'granted') throw new Error('Notificações bloqueadas. Libere nos ajustes do navegador ou do celular.');
  const r = await registrar();
  const { app } = await import('./firebase.js');
  const { getMessaging, getToken, onMessage } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-messaging.js`);
  const m = getMessaging(app);
  // com o app aberto, mostra a notificação mesmo assim
  onMessage(m, msg => r.showNotification(msg.notification?.title || 'encontas', { body: msg.notification?.body, icon: './icone-192.png', data: msg.data }));
  return getToken(m, { vapidKey: CONFIG.vapidKey, serviceWorkerRegistration: r });
}

/** Id curto e estável do token (para o documento do aparelho) */
export async function idDoToken(token) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function nomeDoAparelho() {
  const ua = navigator.userAgent;
  const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Aparelho';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : '';
  return [so, nav].filter(Boolean).join(' · ');
}
