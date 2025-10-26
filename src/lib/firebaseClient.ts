/* istanbul ignore file -- Firebase client is exercised via integration with Firestore at runtime */
import { getApps, initializeApp } from 'firebase/app';
import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  type Firestore
} from 'firebase/firestore';
import type { AppState, DayPlan } from '../types';

const firebaseConfig = {
  apiKey: 'AIzaSyASGUwmIn0YMh0wirh3PHOlHX-ZLDO5XII',
  authDomain: 'vlcd-lab.firebaseapp.com',
  projectId: 'vlcd-lab',
  storageBucket: 'vlcd-lab.firebasestorage.app',
  messagingSenderId: '646254735126',
  appId: '1:646254735126:web:1424ce7c2efe7cba6d2a37',
  measurementId: 'G-E6Z6SW5FCB'
};

let firestore: Firestore | null = null;

function getFirestoreInstance(): Firestore {
  if (firestore) {
    return firestore;
  }

  const apps = getApps();
  const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
  firestore = getFirestore(app);
  return firestore;
}

function sanitizePlans(plans: AppState['plans']): AppState['plans'] {
  const sanitized: AppState['plans'] = {};
  for (const [date, plan] of Object.entries(plans)) {
    const nextPlan: DayPlan = { date };
    if (plan.calories !== undefined) {
      nextPlan.calories = plan.calories;
    }
    if (plan.activityLevel !== undefined) {
      nextPlan.activityLevel = plan.activityLevel;
    }
    sanitized[date] = nextPlan;
  }
  return sanitized;
}

function sanitizeState(state: AppState): AppState {
  return {
    profile: state.profile,
    plans: sanitizePlans(state.plans),
    measurements: state.measurements
  };
}

export async function loadAppState(name: string): Promise<AppState | null> {
  const db = getFirestoreInstance();
  const snapshot = await getDoc(doc(db, 'appStates', name));
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data() as Partial<AppState> | undefined;
  if (!data) {
    return null;
  }
  return {
    profile: data.profile ?? null,
    plans: data.plans ?? {},
    measurements: data.measurements ?? {}
  } satisfies AppState;
}

export async function saveAppState(name: string, state: AppState): Promise<void> {
  const db = getFirestoreInstance();
  await setDoc(doc(db, 'appStates', name), sanitizeState(state));
}

export async function deleteAppState(name: string): Promise<void> {
  const db = getFirestoreInstance();
  await deleteDoc(doc(db, 'appStates', name));
}
