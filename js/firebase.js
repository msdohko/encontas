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
// Cache local: abre rápido e mostra os dados sem internet. Se travar, a tela de erro oferece "Recarregar sem cache".
let semCache = false;
try { semCache = localStorage.getItem('semCache') === '1'; } catch {}
export const db = initializeFirestore(app, {
  localCache: semCache ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp, arrayUnion, Timestamp,
  query, orderBy, limit,
};
