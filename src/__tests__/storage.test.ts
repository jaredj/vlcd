import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_STATE, clearStoredState, usePersistentState } from '../lib/storage';
import type { AppState } from '../types';

const STORAGE_KEY = 'vlcd-app-state-v1';

const {
  getDbMock,
  getDocMock,
  setDocMock,
  deleteDocMock,
  docMock
} = vi.hoisted(() => ({
  getDbMock: vi.fn<() => object | null>(() => null),
  getDocMock: vi.fn<
    () => Promise<{
      exists: () => boolean;
      data: () => Partial<AppState>;
    }>
  >(() =>
    Promise.resolve({
      exists: () => false,
      data: () => ({})
    })
  ),
  setDocMock: vi.fn<(ref: unknown, data: unknown) => Promise<void>>(() => Promise.resolve()),
  deleteDocMock: vi.fn<(ref: unknown) => Promise<void>>(() => Promise.resolve()),
  docMock: vi.fn((db: unknown, collection: string, id: string) => ({ db, collection, id }))
}));

vi.mock('../lib/firebase', () => ({
  getDb: getDbMock
}));

vi.mock('firebase/firestore', () => ({
  doc: docMock,
  getDoc: getDocMock,
  setDoc: setDocMock,
  deleteDoc: deleteDocMock
}));

describe('usePersistentState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getDbMock.mockReturnValue(null);
    getDocMock.mockImplementation(() => Promise.resolve({ exists: () => false, data: () => ({}) }));
    setDocMock.mockClear();
    deleteDocMock.mockClear();
    docMock.mockClear();
  });

  it('prioritizes an initial override when provided', () => {
    window.localStorage.setItem('vlcd-last-profile-name', 'OverrideUser');
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
        name: 'Stored User',
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

  it('treats null entries in localStorage as an empty state', () => {
    window.localStorage.setItem(STORAGE_KEY, 'null');

    const { result } = renderHook(() => usePersistentState());

    expect(result.current[0]).toEqual(INITIAL_STATE);
  });

  it('normalizes invalid profile names when hydrating locally', () => {
    const stored: Partial<AppState> = {
      profile: {
        name: 42 as unknown as string,
        unitSystem: 'metric',
        startDate: '2025-01-01',
        startWeightKg: 95,
        heightCm: 175,
        age: 36,
        sex: 'female',
        goal: 'feel-great',
        defaultCalories: 900,
        defaultActivityLevel: 'light'
      }
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => usePersistentState());

    expect(result.current[0].profile).toEqual(
      expect.objectContaining({
        name: '',
        unitSystem: 'metric'
      })
    );
  });

  it('falls back to the initial state when localStorage is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = renderHook(() => usePersistentState());

    expect(result.current[0]).toEqual({ profile: null, plans: {}, measurements: {} });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('hydrates state from firestore when a stored name is available', async () => {
    window.localStorage.setItem('vlcd-last-profile-name', 'FirestoreUser');
    const remoteState: AppState = {
      profile: {
        name: 'FirestoreUser',
        unitSystem: 'metric',
        startDate: '2025-01-01',
        startWeightKg: 85,
        heightCm: 175,
        age: 32,
        sex: 'female',
        goal: 'feel-great',
        defaultCalories: 1200,
        defaultActivityLevel: 'light'
      },
      plans: { '2025-01-02': { date: '2025-01-02', calories: 950 } },
      measurements: {}
    };
    getDbMock.mockReturnValue({});
    getDocMock.mockResolvedValue({ exists: () => true, data: () => remoteState });

    const { result } = renderHook(() => usePersistentState());

    await waitFor(() => {
      expect(result.current[0].profile?.name).toBe('FirestoreUser');
    });

    expect(result.current[0]).toEqual(remoteState);
    expect(getDocMock).toHaveBeenCalled();
  });

  it('refreshes from firestore even when local state exists', async () => {
    const localState: Partial<AppState> = {
      profile: {
        name: 'SyncedUser',
        unitSystem: 'metric',
        startDate: '2025-01-01',
        startWeightKg: 88,
        heightCm: 170,
        age: 34,
        sex: 'male',
        goal: 'feel-great',
        defaultCalories: 1100,
        defaultActivityLevel: 'light'
      },
      plans: { '2025-01-03': { date: '2025-01-03', calories: 1000 } }
    };
    const remoteState: AppState = {
      profile: {
        name: 'SyncedUser',
        unitSystem: 'imperial',
        startDate: '2025-01-10',
        startWeightKg: 200,
        heightCm: 172,
        age: 35,
        sex: 'male',
        goal: 'alpinist-ready',
        defaultCalories: 900,
        defaultActivityLevel: 'moderate'
      },
      plans: { '2025-01-10': { date: '2025-01-10', calories: 900 } },
      measurements: {}
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
    window.localStorage.setItem('vlcd-last-profile-name', 'SyncedUser');
    getDbMock.mockReturnValue({});
    getDocMock.mockResolvedValue({ exists: () => true, data: () => remoteState });

    const { result } = renderHook(() => usePersistentState());

    await waitFor(() => {
      expect(result.current[0]).toEqual(remoteState);
    });

    expect(getDocMock).toHaveBeenCalled();
  });

  it('writes updates to firestore when available', async () => {
    window.localStorage.setItem('vlcd-last-profile-name', 'Writer');
    getDbMock.mockReturnValue({});
    getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });

    const { result } = renderHook(() => usePersistentState());

    await waitFor(() => {
      expect(getDocMock).toHaveBeenCalled();
    });

    const updated: AppState = {
      profile: {
        name: 'Writer',
        unitSystem: 'imperial',
        startDate: '2025-02-01',
        startWeightKg: 100,
        heightCm: 182,
        age: 36,
        sex: 'male',
        goal: 'alpinist-ready',
        defaultCalories: 900,
        defaultActivityLevel: 'moderate'
      },
      plans: { '2025-02-02': { date: '2025-02-02', calories: 880 } },
      measurements: {}
    };

    act(() => {
      result.current[1](updated);
    });

    await waitFor(() => {
      expect(setDocMock).toHaveBeenCalled();
    });

    const setPayload = setDocMock.mock.calls[0]?.[1] as AppState | undefined;
    expect(setPayload).toMatchObject({
      profile: expect.objectContaining({ name: 'Writer', defaultCalories: 900 }),
      plans: expect.objectContaining({ '2025-02-02': expect.objectContaining({ calories: 880 }) })
    });
  });
});

describe('clearStoredState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getDbMock.mockReturnValue(null);
    deleteDocMock.mockClear();
    docMock.mockClear();
  });

  it('removes any persisted state', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    clearStoredState();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('deletes the remote document when available', async () => {
    window.localStorage.setItem('vlcd-last-profile-name', 'CleanupUser');
    getDbMock.mockReturnValue({});
    clearStoredState();

    await waitFor(() => {
      expect(deleteDocMock).toHaveBeenCalled();
    });
    expect(deleteDocMock.mock.calls[0]?.[0]).toMatchObject({ id: 'CleanupUser' });
  });
});
