import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStoredState, getLastProfileName, setLastProfileName, usePersistentState } from '../lib/storage';
import type { AppState } from '../types';

const STORAGE_KEY = 'vlcd-app-state-v1';

describe('usePersistentState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('prioritizes an initial override when provided', () => {
    const override: AppState = {
      profile: null,
      plans: { '2025-01-01': { date: '2025-01-01', calories: 800 } },
      measurements: {}
    };

    const { result } = renderHook(() => usePersistentState(override));

    expect(result.current[0]).toEqual(override);

    act(() => {
      result.current[1](override);
    });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(override);
  });

  it('hydrates state from localStorage when available', () => {
    const stored: Partial<AppState> = {
      profile: {
        name: 'Stored Profile',
        unitSystem: 'metric',
        startDate: '2025-01-01',
        startWeightKg: 95,
        heightCm: 175,
        age: 36,
        sex: 'female',
        goal: 'feel-great',
        defaultCalories: 900,
        defaultActivityLevel: 'light'
      },
      plans: { '2025-01-02': { date: '2025-01-02', activityLevel: 'light' } }
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => usePersistentState());

    expect(result.current[0]).toEqual({
      profile: stored.profile,
      plans: stored.plans,
      measurements: {}
    });
  });

  it('falls back to the initial state when localStorage is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = renderHook(() => usePersistentState());

    expect(result.current[0]).toEqual({ profile: null, plans: {}, measurements: {} });
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('clearStoredState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('removes any persisted state', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    window.localStorage.setItem('vlcd-last-profile-name', 'Stored');
    clearStoredState();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('vlcd-last-profile-name')).toBeNull();
  });
});

describe('profile name helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists trimmed profile names', () => {
    setLastProfileName('  Example User  ');
    expect(getLastProfileName()).toBe('Example User');
    setLastProfileName(null);
    expect(getLastProfileName()).toBeNull();
  });
});
