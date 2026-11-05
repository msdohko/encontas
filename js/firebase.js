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

const app = initializeApp(CONFIG.firebase);
export const auth = getAuth(app);
// iPhone/iPad (Safari e app na tela de início): sem cache em disco e com conexão simples (long polling),
// porque o cache do Firestore e a conexão contínua costumam travar no iOS. Nos outros, cache local para abrir rápido.
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let semCache = ios;
try { semCache ||= localStorage.getItem('semCache') === '1'; } catch {}
export const db = initializeFirestore(app, {
  localCache: semCache ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ...(ios ? { experimentalForceLongPolling: true } : {}),
});

export {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp, arrayUnion, Timestamp,
  query, orderBy, limit,
};
