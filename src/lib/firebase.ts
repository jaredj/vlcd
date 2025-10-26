import { getApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';

type ModeAwareImportMeta = ImportMeta & {
  readonly env?: {
    readonly MODE?: string;
  };
};

const firebaseConfig = {
  apiKey: 'AIzaSyASGUwmIn0YMh0wirh3PHOlHX-ZLDO5XII',
  authDomain: 'vlcd-lab.firebaseapp.com',
  projectId: 'vlcd-lab',
  storageBucket: 'vlcd-lab.firebasestorage.app',
  messagingSenderId: '646254735126',
  appId: '1:646254735126:web:1424ce7c2efe7cba6d2a37',
  measurementId: 'G-E6Z6SW5FCB'
};

let firestoreInstance: Firestore | null = null;
let forceFirebaseUsage: boolean | null = null;

export function __setFirebaseUsageOverride(value: boolean | null): void {
  forceFirebaseUsage = value;
  if (value === false) {
    firestoreInstance = null;
  }
}

function shouldUseFirebase(): boolean {
  if (forceFirebaseUsage !== null) {
    return forceFirebaseUsage;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const mode: string | undefined = (import.meta as ModeAwareImportMeta).env?.MODE;
  /* istanbul ignore next -- test harnesses cannot change the injected mode */
  if (mode === 'test') {
    return false;
  }

  return true;
}

export function getDb(): Firestore | null {
  if (!shouldUseFirebase()) {
    return null;
  }

  if (firestoreInstance) {
    return firestoreInstance;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  firestoreInstance = getFirestore(app);
  return firestoreInstance;
}
