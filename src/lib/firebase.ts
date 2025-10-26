import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyASGUwmIn0YMh0wirh3PHOlHX-ZLDO5XII',
  authDomain: 'vlcd-lab.firebaseapp.com',
  projectId: 'vlcd-lab',
  storageBucket: 'vlcd-lab.firebasestorage.app',
  messagingSenderId: '646254735126',
  appId: '1:646254735126:web:1424ce7c2efe7cba6d2a37',
  measurementId: 'G-E6Z6SW5FCB'
} as const;

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let analyticsInitialized = false;

function shouldUseFirebase(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const userAgent = window.navigator?.userAgent ?? '';
  if (/jsdom/i.test(userAgent)) {
    return false;
  }
  return true;
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!shouldUseFirebase()) {
    return null;
  }
  if (!appInstance) {
    const [existingApp] = getApps();
    appInstance = existingApp ?? initializeApp(firebaseConfig);
  }
  return appInstance;
}

export async function ensureAnalytics(): Promise<Analytics | null> {
  const app = getFirebaseApp();
  if (!app || analyticsInitialized) {
    return null;
  }
  try {
    const supported = await isSupported();
    if (!supported) {
      return null;
    }
    const analytics = getAnalytics(app);
    analyticsInitialized = true;
    return analytics;
  } catch (error) {
    console.warn('Failed to initialize analytics', error);
    return null;
  }
}

export function getFirestoreInstance(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }
  firestoreInstance ??= getFirestore(app);
  return firestoreInstance;
}
