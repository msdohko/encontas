// Carregado só quando o Firebase está configurado (fora do modo demonstração).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch,
  serverTimestamp, arrayUnion, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { CONFIG } from './config.js';

const app = initializeApp(CONFIG.firebase);
export const auth = getAuth(app);
// Cache local: o app abre e mostra os dados mesmo sem internet
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp, arrayUnion, Timestamp,
};
