import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { AppState, Profile } from '../types';
import { firestore } from './firebase';

export const INITIAL_STATE: AppState = {
  profile: null,
  plans: {},
  measurements: {}
};

const COLLECTION_NAME = 'profiles';
const LAST_PROFILE_NAME_KEY = 'vlcd-last-profile-name';

function normalizeProfile(profile: Profile, fallbackName?: string | null): Profile | null {
  const normalizedName = (profile.name ?? fallbackName ?? '').trim();
  if (!normalizedName) {
    return null;
  }
  return {
    ...profile,
    name: normalizedName
  };
}

function normalizeState(state: AppState, fallbackName?: string | null): AppState {
  const profile = state.profile ? normalizeProfile(state.profile, fallbackName) : null;

  return {
    profile,
    plans: state.plans ?? {},
    measurements: state.measurements ?? {}
  };
}

async function persistState(name: string, state: AppState): Promise<void> {
  try {
    await setDoc(doc(firestore, COLLECTION_NAME, name), state);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_PROFILE_NAME_KEY, name);
    }
  } catch (error) {
    console.error('Failed to persist application state', error);
  }
}

async function loadState(name: string): Promise<AppState | null> {
  try {
    const snapshot = await getDoc(doc(firestore, COLLECTION_NAME, name));
    if (!snapshot.exists()) {
      return normalizeState(INITIAL_STATE, name);
    }
    const data = snapshot.data() as Partial<AppState>;
    return normalizeState(
      {
        profile: data.profile ?? null,
        plans: data.plans ?? {},
        measurements: data.measurements ?? {}
      },
      name
    );
  } catch (error) {
    console.error('Failed to load application state', error);
    return null;
  }
}

export interface PersistentStateController {
  state: AppState;
  setState: (next: AppState) => void;
  loadStateByName: (name: string) => Promise<AppState | null>;
  profileName: string | null;
}

export function usePersistentState(initialOverride?: AppState): PersistentStateController {
  const [state, setState] = useState<AppState>(() => {
    if (initialOverride) {
      return normalizeState(initialOverride, initialOverride.profile?.name ?? null);
    }
    return INITIAL_STATE;
  });
  const activeNameRef = useRef<string | null>(initialOverride?.profile?.name ?? null);
  const [profileName, setProfileName] = useState<string | null>(initialOverride?.profile?.name ?? null);

  const applyState = useCallback(
    (next: AppState) => {
      const normalized = normalizeState(next, activeNameRef.current);
      const nameToPersist = normalized.profile?.name ?? activeNameRef.current;

      if (normalized.profile?.name) {
        activeNameRef.current = normalized.profile.name;
      }
      if (nameToPersist) {
        void persistState(nameToPersist, normalizeState(normalized, nameToPersist));
        setProfileName(nameToPersist);
      } else {
        setProfileName(null);
      }

      setState(normalized);
    },
    []
  );

  const loadStateByName = useCallback(async (rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) {
      return null;
    }
    const loaded = await loadState(trimmed);
    if (!loaded) {
      return null;
    }
    activeNameRef.current = trimmed;
    setState(loaded);
    setProfileName(trimmed);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_PROFILE_NAME_KEY, trimmed);
    }
    return loaded;
  }, []);

  useEffect(() => {
    if (initialOverride) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const storedName = window.localStorage.getItem(LAST_PROFILE_NAME_KEY);
    if (!storedName) {
      return;
    }
    void (async () => {
      await loadStateByName(storedName);
    })();
  }, [initialOverride, loadStateByName]);

  return {
    state,
    setState: applyState,
    loadStateByName,
    profileName
  };
}

export function clearStoredState(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(LAST_PROFILE_NAME_KEY);
}
