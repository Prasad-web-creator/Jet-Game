/**
 * firebaseApp.ts — Single Firebase initialization point.
 *
 * Import auth, db, rtdb from this file everywhere else.
 * Never call initializeApp() in any other file.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey:            'AIzaSyD7byzesMXgzal7WzKcfgYxGK0M3IBvDlo',
  authDomain:        'jetgame-8609c.firebaseapp.com',
  projectId:         'jetgame-8609c',
  storageBucket:     'jetgame-8609c.firebasestorage.app',
  messagingSenderId: '120703870300',
  appId:             '1:120703870300:web:86f20cc877fef1f9a08d99',
  measurementId:     'G-XS9KN25KD4',
  // Realtime Database URL — enable RTDB in Firebase console first.
  databaseURL:       'https://jetgame-8609c-default-rtdb.firebaseio.com',
};

// Guard against hot-module-reload double-init in Vite dev mode.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth  = getAuth(app);
export const db    = getFirestore(app);
export const rtdb  = getDatabase(app);

// Analytics — only in browser, non-blocking.
isSupported().then((ok) => {
  if (ok) getAnalytics(app);
}).catch(() => {/* ignore */});

export default app;
