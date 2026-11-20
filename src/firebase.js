import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// Public web config. It only identifies the project; Firestore rules control access.
const firebaseConfig = {
  apiKey: 'AIzaSyBtMphLavoo3Io9j72lKvZv55GCUvMtyOM',
  authDomain: 'turkey-day-planner.firebaseapp.com',
  projectId: 'turkey-day-planner',
  storageBucket: 'turkey-day-planner.firebasestorage.app',
  messagingSenderId: '310279736399',
  appId: '1:310279736399:web:8d28fc2b50cc6c4a1f2e3a',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Offline cache so the kitchen's weak Wi-Fi does not block the app.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const provider = new GoogleAuthProvider();

// Always use the popup, on phones too. signInWithRedirect does not work from GitHub Pages:
// the app (github.io) and the sign-in domain (firebaseapp.com) differ, and browsers block the
// shared storage the redirect result travels through, so you land back on the sign-in button.
// Same approach as ZepTrack, which signs in on Android with a popup.
export async function signIn() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    if (e.code === 'auth/popup-blocked') {
      throw new Error('Your browser blocked the sign-in window. Allow popups for this site, then tap Sign in again.');
    }
    console.error('sign-in error', e.code, e.message);
    throw e;
  }
}

/** Call once on load so a finished mobile redirect surfaces any error. */
export function finishRedirect() {
  return getRedirectResult(auth).catch((e) => {
    console.error('redirect sign-in error', e.code, e.message);
    throw e;
  });
}

export const signOutUser = () => signOut(auth);
export const watchAuth = (cb) => onAuthStateChanged(auth, cb);
