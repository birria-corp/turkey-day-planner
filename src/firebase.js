import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
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

// Desktop uses a popup; phones use a redirect (popups are unreliable on mobile).
// signInWithRedirect on desktop GitHub Pages fails (COOP + IndexedDB), so keep the split.
const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export async function signIn() {
  if (isMobile()) {
    await signInWithRedirect(auth, provider);
  } else {
    await signInWithPopup(auth, provider);
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
