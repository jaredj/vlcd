import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import type { AppState } from '../types';
import { getDb } from './firebase';

const STORAGE_KEY = 'vlcd-app-state-v1';
const LAST_PROFILE_NAME_KEY = 'vlcd-last-profile-name';
const COLLECTION_NAME = 'appStates';

export const INITIAL_STATE: AppState = {
  profile: null,
  plans: {},
  measurements: {}
};

function sanitizeState(partial: Partial<AppState> | null | undefined): AppState {
  if (!partial) {
    return INITIAL_STATE;
  }

  const sourceProfile = partial.profile ?? null;
  const profile = sourceProfile
    ? {
        ...sourceProfile,
        name: typeof sourceProfile.name === 'string' ? sourceProfile.name.trim() : ''
      }
    : null;

  return {
    profile,
    plans: partial.plans ?? {},
    measurements: partial.measurements ?? {}
  };
}

function loadLocalState(): AppState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return sanitizeState(parsed);
  } catch (error) {
    console.warn('Failed to parse stored state', error);
    return null;
  }
}

export function usePersistentState(initialOverride?: AppState): [
  AppState,
  Dispatch<SetStateAction<AppState>>
] {
  const [state, setState] = useState<AppState>(() => {
    if (initialOverride) {
      return initialOverride;
    }
    const local = loadLocalState();
    if (local) {
      return local;
    }
    return INITIAL_STATE;
  });
  const lastLoadedNameRef = useRef<string | null>(state.profile?.name ?? null);
  const pendingFetchNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialOverride) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }

    const db = getDb();
    if (!db) {
      return;
    }

    const trimmedName = state.profile?.name?.trim();
    const storedName = window.localStorage.getItem(LAST_PROFILE_NAME_KEY);
    const activeName = trimmedName && trimmedName.length > 0 ? trimmedName : storedName;
    if (!activeName || lastLoadedNameRef.current === activeName) {
      return;
    }

    let cancelled = false;
    pendingFetchNameRef.current = activeName;

    void (async () => {
      try {
        const snapshot = await getDoc(doc(db, COLLECTION_NAME, activeName));
        if (!snapshot.exists()) {
          if (!cancelled) {
            lastLoadedNameRef.current = activeName;
          }
          return;
        }
        const remote = sanitizeState(snapshot.data() as Partial<AppState>);
        const nextState: AppState = {
          ...remote,
          profile: remote.profile
            ? { ...remote.profile, name: remote.profile.name || activeName }
            : null
        };
        if (cancelled) {
          return;
        }
        lastLoadedNameRef.current = activeName;
        setState(nextState);
      } catch (error) {
        console.error('Failed to load state from Firestore', error);
      } finally {
        if (!cancelled && pendingFetchNameRef.current === activeName) {
          pendingFetchNameRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pendingFetchNameRef.current === activeName) {
        pendingFetchNameRef.current = null;
      }
    };
  }, [initialOverride, state.profile?.name]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const db = getDb();
    const trimmedName = state.profile?.name?.trim();
    const storedName = window.localStorage.getItem(LAST_PROFILE_NAME_KEY);
    const targetName = trimmedName && trimmedName.length > 0 ? trimmedName : storedName;

    if (trimmedName) {
      window.localStorage.setItem(LAST_PROFILE_NAME_KEY, trimmedName);
    }

    if (!targetName) {
      if (!db) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    if (pendingFetchNameRef.current === targetName) {
      return;
    }

    const payload = sanitizeState(state);

    if (db) {
      window.localStorage.removeItem(STORAGE_KEY);
      void setDoc(doc(db, COLLECTION_NAME, targetName), payload);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  }, [state]);

  return [state, setState];
}

export function clearStoredState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);

  const db = getDb();
  if (!db) {
    return;
  }

  const targetName = window.localStorage.getItem(LAST_PROFILE_NAME_KEY);
  if (!targetName) {
    return;
  }

  void deleteDoc(doc(db, COLLECTION_NAME, targetName));
}
