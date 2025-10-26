import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../types';

const STORAGE_KEY = 'vlcd-app-state-v1';
const LAST_PROFILE_NAME_KEY = 'vlcd-last-profile-name';

const isBrowser = typeof window !== 'undefined';
const isTestEnv =
  typeof import.meta !== 'undefined' &&
  (((import.meta as ImportMeta & { env?: Record<string, unknown> }).env?.MODE as string | undefined) === 'test');
const useFirestore = isBrowser && !isTestEnv;

let firebaseClientPromise: Promise<typeof import('./firebaseClient')> | null = null;
async function getFirebaseClient() {
  firebaseClientPromise ??= import('./firebaseClient');
  return firebaseClientPromise;
}

export const INITIAL_STATE: AppState = {
  profile: null,
  plans: {},
  measurements: {}
};

function readStoredState(): AppState {
  if (!isBrowser) {
    return INITIAL_STATE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return INITIAL_STATE;
    }
    const parsed = JSON.parse(raw) as AppState;
    return {
      profile: parsed.profile ?? null,
      plans: parsed.plans ?? {},
      measurements: parsed.measurements ?? {}
    };
  } catch (error) {
    console.warn('Failed to parse stored state', error);
    return INITIAL_STATE;
  }
}

export function getLastProfileName(): string {
  if (!isBrowser) {
    return '';
  }
  return window.localStorage.getItem(LAST_PROFILE_NAME_KEY) ?? '';
}

export function rememberLastProfileName(name: string): void {
  if (!isBrowser) {
    return;
  }
  window.localStorage.setItem(LAST_PROFILE_NAME_KEY, name);
}

export function usePersistentState(initialOverride?: AppState): [AppState, (next: AppState) => void] {
  const [state, setState] = useState<AppState>(() => {
    if (initialOverride) {
      return initialOverride;
    }
    if (useFirestore) {
      return INITIAL_STATE;
    }
    return readStoredState();
  });

  const hydrationNameRef = useRef<string | null>(initialOverride?.profile?.name ?? null);

  useEffect(() => {
    if (useFirestore || !isBrowser) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!useFirestore) {
      return;
    }
    const name = state.profile?.name?.trim();
    if (!name) {
      hydrationNameRef.current = null;
      return;
    }
    if (hydrationNameRef.current === name) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const client = await getFirebaseClient();
        const remote = await client.loadAppState(name);
        if (cancelled) {
          return;
        }
        if (remote) {
          hydrationNameRef.current = remote.profile?.name?.trim() ?? name;
          setState(remote);
        } else {
          hydrationNameRef.current = name;
        }
      } catch (error) {
        console.error('Failed to load state from Firestore', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.profile?.name]);

  useEffect(() => {
    if (!useFirestore) {
      return;
    }
    const name = state.profile?.name?.trim();
    if (!name) {
      return;
    }
    if (hydrationNameRef.current !== name) {
      return;
    }

    void (async () => {
      try {
        const client = await getFirebaseClient();
        await client.saveAppState(name, state);
      } catch (error) {
        console.error('Failed to save state to Firestore', error);
      }
    })();
  }, [state]);

  return [state, setState];
}

export function clearStoredState(name?: string): void {
  if (!useFirestore) {
    if (!isBrowser) {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  if (!name) {
    return;
  }

  void (async () => {
    try {
      const client = await getFirebaseClient();
      await client.deleteAppState(name);
    } catch (error) {
      console.error('Failed to clear Firestore state', error);
    }
  })();
}
