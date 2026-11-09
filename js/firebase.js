// Carregado só quando o Firebase está configurado (fora do modo demonstração).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch,
  serverTimestamp, arrayUnion, Timestamp, query, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { CONFIG } from './config.js';

export const app = initializeApp(CONFIG.firebase);
export const auth = getAuth(app);
// Safari (Mac, iPhone, iPad e app na tela de início): sem cache em disco e com conexão simples (long polling),
// porque o cache do Firestore e a conexão contínua travam no WebKit. Chrome/Edge/Firefox: cache local para abrir rápido.
const ua = navigator.userAgent;
const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const safari = ios || (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg\//.test(ua));
let semCache = safari;
try { semCache ||= localStorage.getItem('semCache') === '1'; } catch {}
export const db = initializeFirestore(app, {
  localCache: semCache ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ...(safari ? { experimentalForceLongPolling: true } : {}),
});

export {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp, arrayUnion, Timestamp,
  query, orderBy, limit,
};
