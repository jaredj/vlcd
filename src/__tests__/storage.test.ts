import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearStoredState, usePersistentState } from '../lib/storage';
import type { AppState } from '../types';
import { poundsToKilograms } from '../utils/conversions';

const { getDoc, setDoc } = globalThis.__FIREBASE_MOCKS__;

describe('usePersistentState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getDoc.mockResolvedValue({ exists: () => false });
    setDoc.mockResolvedValue(undefined);
  });

  it('prioritizes an initial override and persists updates', async () => {
    const override: AppState = {
      profile: {
        name: 'Override',
        unitSystem: 'imperial',
        startDate: '2025-01-01',
        startWeightKg: poundsToKilograms(250),
        heightCm: 175,
        age: 36,
        sex: 'female',
        goal: 'feel-great',
        defaultCalories: 900,
        defaultActivityLevel: 'light'
      },
      plans: { '2025-01-02': { date: '2025-01-02', calories: 850, activityLevel: 'light' } },
      measurements: {}
    };

    const { result } = renderHook(() => usePersistentState(override));

    expect(result.current.state).toEqual(override);

    act(() => {
      result.current.setState({
        ...override,
        plans: {
          '2025-01-02': { date: '2025-01-02', calories: 900, activityLevel: 'moderate' }
        }
      });
    });

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalled();
    });

    const lastCall = setDoc.mock.calls[setDoc.mock.calls.length - 1] ?? [];
    const [docRef, payload] = lastCall as [unknown, AppState];
    expect(docRef).toMatchObject({ path: 'profiles/Override' });
    expect(payload).toMatchObject({
      plans: {
        '2025-01-02': { date: '2025-01-02', calories: 900, activityLevel: 'moderate' }
      }
    });
  });

  it('hydrates state from Firestore when loading by name', async () => {
    const stored: AppState = {
      profile: {
        name: 'Remy',
        unitSystem: 'metric',
        startDate: '2025-02-01',
        startWeightKg: 90,
        heightCm: 168,
        age: 30,
        sex: 'male',
        goal: 'alpinist-ready',
        defaultCalories: 800,
        defaultActivityLevel: 'minimal'
      },
      plans: {},
      measurements: {}
    };
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => stored
    });

    const { result } = renderHook(() => usePersistentState());

    await act(async () => {
      const loaded = await result.current.loadStateByName('Remy');
      expect(loaded).toEqual(stored);
    });

    expect(result.current.state.profile?.name).toBe('Remy');
    expect(window.localStorage.getItem('vlcd-last-profile-name')).toBe('Remy');
  });

  it('automatically attempts to hydrate using the stored profile name', async () => {
    window.localStorage.setItem('vlcd-last-profile-name', 'Stored');
    const stored: AppState = {
      profile: {
        name: 'Stored',
        unitSystem: 'imperial',
        startDate: '2025-03-03',
        startWeightKg: poundsToKilograms(240),
        heightCm: 172,
        age: 34,
        sex: 'female',
        goal: 'feel-great',
        defaultCalories: 950,
        defaultActivityLevel: 'moderate'
      },
      plans: {},
      measurements: {}
    };
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => stored
    });

    const { result } = renderHook(() => usePersistentState());

    await waitFor(() => {
      expect(result.current.state.profile?.name).toBe('Stored');
    });
  });
});

describe('clearStoredState', () => {
  it('removes the last known profile name', () => {
    window.localStorage.setItem('vlcd-last-profile-name', 'Sample');
    clearStoredState();
    expect(window.localStorage.getItem('vlcd-last-profile-name')).toBeNull();
  });
});
