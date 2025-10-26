import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import type { AppState } from '../types';
import { getFirestoreInstance } from './firebase';

const STORAGE_KEY = 'vlcd-app-state-v1';
export const LAST_PROFILE_NAME_KEY = 'vlcd-last-profile-name';
const COLLECTION_NAME = 'appStates';

export const INITIAL_STATE: AppState = {
  profile: null,
  plans: {},
  measurements: {},
};

const firestore = getFirestoreInstance();
const useRemoteStorage = Boolean(firestore);

function normalizeState(state?: Partial<AppState>): AppState {
  const rawProfile = state?.profile;
  const profile = rawProfile && typeof rawProfile === 'object' && typeof rawProfile.name === 'string'
    ? rawProfile
    : null;
  return {
    profile,
    plans: state?.plans ?? {},
    measurements: state?.measurements ?? {},
  };
}

function sanitizeDocumentId(name: string): string {
  return name.replace(/\//g, '_');
}

function readLocalState(): AppState {
  if (typeof window === 'undefined') {
    return INITIAL_STATE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return INITIAL_STATE;
    }
    return normalizeState(JSON.parse(raw) as Partial<AppState>);
  } catch (error) {
    console.warn('Failed to parse stored state', error);
    return INITIAL_STATE;
  }
}

function persistLocalState(state: AppState): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getStoredName(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const name = window.localStorage.getItem(LAST_PROFILE_NAME_KEY);
  return name ?? null;
}

export function getLastProfileName(): string | null {
  return getStoredName();
}

export function setLastProfileName(name: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  const trimmed = name?.trim();
  if (trimmed) {
    window.localStorage.setItem(LAST_PROFILE_NAME_KEY, trimmed);
  } else {
    window.localStorage.removeItem(LAST_PROFILE_NAME_KEY);
  }
}

async function fetchRemoteState(name: string): Promise<AppState | null> {
  if (!firestore) {
    return null;
  }
  try {
    const snapshot = await getDoc(doc(firestore, COLLECTION_NAME, sanitizeDocumentId(name)));
    if (!snapshot.exists()) {
      return null;
    }
    return normalizeState(snapshot.data() as Partial<AppState>);
  } catch (error) {
    console.warn('Failed to load state from Firestore', error);
    return null;
  }
}

async function saveRemoteState(name: string, state: AppState): Promise<void> {
  if (!firestore) {
    return;
  }
  try {
    await setDoc(doc(firestore, COLLECTION_NAME, sanitizeDocumentId(name)), state);
  } catch (error) {
    console.warn('Failed to save state to Firestore', error);
  }
}

async function deleteRemoteState(name: string): Promise<void> {
  if (!firestore) {
    return;
  }
  try {
    await deleteDoc(doc(firestore, COLLECTION_NAME, sanitizeDocumentId(name)));
  } catch (error) {
    console.warn('Failed to delete state from Firestore', error);
  }
}

export function usePersistentState(initialOverride?: AppState): [AppState, (next: AppState) => void] {
  const [state, setState] = useState<AppState>(() => {
    if (initialOverride) {
      return normalizeState(initialOverride);
    }
    if (useRemoteStorage) {
      return INITIAL_STATE;
    }
    return readLocalState();
  });
  const [activeName, setActiveName] = useState<string | null>(() => {
    if (initialOverride?.profile?.name) {
      return initialOverride.profile.name;
    }
    return getStoredName();
  });
  const previousNameRef = useRef<string | null>(activeName);
  const skipNextRemoteWriteRef = useRef(useRemoteStorage);
  const latestStateRef = useRef(state);

  useEffect(() => {
    previousNameRef.current = activeName;
  }, [activeName]);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!useRemoteStorage) {
      persistLocalState(state);
      return;
    }
    if (skipNextRemoteWriteRef.current) {
      skipNextRemoteWriteRef.current = false;
      return;
    }
    const name = state.profile?.name?.trim();
    if (!name) {
      return;
    }
    setLastProfileName(name);
    void saveRemoteState(name, state);
  }, [state]);

  useEffect(() => {
    if (!useRemoteStorage) {
      return;
    }
    const name = activeName?.trim();
    if (!name) {
      return;
    }
    let cancelled = false;
    skipNextRemoteWriteRef.current = true;
    void (async () => {
      const remoteState = await fetchRemoteState(name);
      if (cancelled) {
        return;
      }
      if (remoteState) {
        setState(remoteState);
        return;
      }
      setLastProfileName(name);
      await saveRemoteState(name, latestStateRef.current);
      skipNextRemoteWriteRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [activeName]);

  const updateState = useCallback(
    (next: AppState) => {
      const normalized = normalizeState(next);
      const nextName = normalized.profile?.name?.trim() ?? null;
      if (!nextName) {
        const previousName = previousNameRef.current;
        setActiveName(null);
        setState({ ...normalized, profile: null });
        if (useRemoteStorage && previousName) {
          void deleteRemoteState(previousName);
        }
        if (previousName) {
          setLastProfileName(previousName);
        }
        return;
      }

      if (useRemoteStorage && nextName !== activeName) {
        skipNextRemoteWriteRef.current = true;
      }

      setActiveName(nextName);
      setLastProfileName(nextName);
      setState(normalized);
    },
    [activeName]
  );

  return [state, updateState];
}

export function clearStoredState(): void {
  const storedName = getStoredName();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LAST_PROFILE_NAME_KEY);
  }
  if (useRemoteStorage && storedName) {
    void deleteRemoteState(storedName);
  }
}
