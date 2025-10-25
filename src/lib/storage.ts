import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../types';

const STORAGE_KEY = 'vlcd-app-state-v1';

export const INITIAL_STATE: AppState = {
  profile: null,
  plans: {},
  measurements: {}
};

export function usePersistentState(
  initialOverride?: AppState
): [AppState, Dispatch<SetStateAction<AppState>>] {
  const [state, setState] = useState<AppState>(() => {
    if (initialOverride) {
      return initialOverride;
    }
    if (typeof window === 'undefined') {
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
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState];
}

export function clearStoredState(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
