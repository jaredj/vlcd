import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../types';

const firestoreDoc = (...segments: unknown[]) => ({ path: segments.join('/') });

describe('usePersistentState with Firestore', () => {
  type FirestoreSnapshot = { exists: () => boolean; data: () => unknown };
  const setDocMock = vi.fn<(ref: unknown, data: unknown) => Promise<void>>();
  const getDocMock = vi.fn<(ref: unknown) => Promise<FirestoreSnapshot>>();
  const deleteDocMock = vi.fn<(ref: unknown) => Promise<void>>();

  async function loadStorage() {
    vi.resetModules();
    setDocMock.mockReset();
    getDocMock.mockReset();
    deleteDocMock.mockReset();

    vi.doMock('firebase/firestore', () => ({
      doc: firestoreDoc,
      setDoc: setDocMock,
      getDoc: getDocMock,
      deleteDoc: deleteDocMock,
    }));

    vi.doMock('../lib/firebase', () => ({
      getFirestoreInstance: () => ({ __firestore: true }),
    }));

    return import('../lib/storage');
  }

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('firebase/firestore');
    vi.doUnmock('../lib/firebase');
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hydrates state from Firestore when a document exists', async () => {
    const storage = await loadStorage();
    const remoteState: AppState = {
      profile: {
        name: 'RemoteUser',
        unitSystem: 'metric',
        startDate: '2025-01-01',
        startWeightKg: 90,
        heightCm: 175,
        age: 34,
        sex: 'female',
        goal: 'feel-great',
        defaultCalories: 900,
        defaultActivityLevel: 'light',
      },
      plans: { '2025-01-02': { date: '2025-01-02', calories: 950 } },
      measurements: {},
    };

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => remoteState,
    } as FirestoreSnapshot);
    const { result } = renderHook(() =>
      storage.usePersistentState({
        profile: {
          name: 'RemoteUser',
          unitSystem: 'imperial',
          startDate: '2025-01-01',
          startWeightKg: 95,
          heightCm: 180,
          age: 34,
          sex: 'female',
          goal: 'feel-great',
          defaultCalories: 900,
          defaultActivityLevel: 'light',
        },
        plans: {},
        measurements: {},
      })
    );

    await waitFor(() => {
      expect(result.current[0]).toEqual(remoteState);
    });
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('writes new state when no remote document exists', async () => {
    const storage = await loadStorage();
    getDocMock.mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as FirestoreSnapshot);
    const { result } = renderHook(() =>
      storage.usePersistentState({
        profile: {
          name: 'RemoteUser',
          unitSystem: 'metric',
          startDate: '2025-01-01',
          startWeightKg: 90,
          heightCm: 175,
          age: 34,
          sex: 'female',
          goal: 'feel-great',
          defaultCalories: 900,
          defaultActivityLevel: 'light',
        },
        plans: {},
        measurements: {},
      })
    );

    await waitFor(() => {
      expect(getDocMock).toHaveBeenCalled();
    });

    act(() => {
      result.current[1]({
        profile: {
          name: 'RemoteUser',
          unitSystem: 'metric',
          startDate: '2025-01-01',
          startWeightKg: 90,
          heightCm: 175,
          age: 34,
          sex: 'female',
          goal: 'feel-great',
          defaultCalories: 900,
          defaultActivityLevel: 'light',
        },
        plans: { '2025-01-03': { date: '2025-01-03', calories: 870 } },
        measurements: {},
      });
    });

    await waitFor(() => {
      expect(setDocMock).toHaveBeenCalledWith(expect.anything(), {
        profile: expect.objectContaining({ name: 'RemoteUser' }),
        plans: expect.any(Object),
        measurements: expect.any(Object),
      });
    });
  });

  it('deletes remote state when the profile is cleared', async () => {
    const storage = await loadStorage();
    getDocMock.mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as FirestoreSnapshot);
    const { result } = renderHook(() =>
      storage.usePersistentState({
        profile: {
          name: 'RemoteUser',
          unitSystem: 'metric',
          startDate: '2025-01-01',
          startWeightKg: 90,
          heightCm: 175,
          age: 34,
          sex: 'female',
          goal: 'feel-great',
          defaultCalories: 900,
          defaultActivityLevel: 'light',
        },
        plans: {},
        measurements: {},
      })
    );

    await waitFor(() => {
      expect(getDocMock).toHaveBeenCalled();
    });

    act(() => {
      result.current[1]({ profile: null, plans: {}, measurements: {} });
    });

    await waitFor(() => {
      expect(deleteDocMock).toHaveBeenCalled();
    });
  });

  it('ignores late remote responses after unmounting', async () => {
    const storage = await loadStorage();
    let resolveSnapshot: (value: FirestoreSnapshot) => void = () => undefined;
    const remoteState: AppState = {
      profile: {
        name: 'SlowUser',
        unitSystem: 'metric',
        startDate: '2025-01-01',
        startWeightKg: 90,
        heightCm: 175,
        age: 34,
        sex: 'female',
        goal: 'feel-great',
        defaultCalories: 900,
        defaultActivityLevel: 'light',
      },
      plans: {},
      measurements: {},
    };

    getDocMock.mockImplementationOnce(
      () =>
        new Promise<FirestoreSnapshot>((resolve) => {
          resolveSnapshot = resolve;
        })
    );

    let latestState: AppState | null = null;
    const { unmount } = renderHook(() => {
      const hookValue = storage.usePersistentState({
        profile: remoteState.profile,
        plans: remoteState.plans,
        measurements: remoteState.measurements,
      });
      latestState = hookValue[0];
      return hookValue;
    });

    const initialState = latestState;
    unmount();

    resolveSnapshot({
      exists: () => true,
      data: () => remoteState,
    });

    await Promise.resolve();
    expect(latestState).toBe(initialState);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('clears remote documents when clearing stored state', async () => {
    const storage = await loadStorage();
    window.localStorage.setItem('vlcd-last-profile-name', 'RemoteUser');

    storage.clearStoredState();

    await Promise.resolve();
    expect(deleteDocMock).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('RemoteUser') }));
    expect(window.localStorage.getItem('vlcd-last-profile-name')).toBeNull();
  });

  it('logs errors when remote deletion fails', async () => {
    const storage = await loadStorage();
    const error = new Error('permission denied');
    deleteDocMock.mockRejectedValueOnce(error);
    window.localStorage.setItem('vlcd-last-profile-name', 'RemoteUser');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    storage.clearStoredState();

    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith('Failed to delete state from Firestore', error);
    warnSpy.mockRestore();
  });

  it('defaults to the initial state when no override is provided', async () => {
    const storage = await loadStorage();

    const { result } = renderHook(() => storage.usePersistentState());

    expect(result.current[0]).toEqual(storage.INITIAL_STATE);
  });

  it('fetches a new document when switching to a different profile name', async () => {
    const storage = await loadStorage();
    getDocMock.mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as FirestoreSnapshot);
    const { result } = renderHook(() =>
      storage.usePersistentState({
        profile: {
          name: 'RemoteUser',
          unitSystem: 'metric',
          startDate: '2025-01-01',
          startWeightKg: 90,
          heightCm: 175,
          age: 34,
          sex: 'female',
          goal: 'feel-great',
          defaultCalories: 900,
          defaultActivityLevel: 'light',
        },
        plans: {},
        measurements: {},
      })
    );

    await waitFor(() => {
      expect(getDocMock).toHaveBeenCalledTimes(1);
    });

    getDocMock.mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as FirestoreSnapshot);

    act(() => {
      result.current[1]({
        profile: {
          name: 'SecondUser',
          unitSystem: 'metric',
          startDate: '2025-01-01',
          startWeightKg: 90,
          heightCm: 175,
          age: 34,
          sex: 'female',
          goal: 'feel-great',
          defaultCalories: 900,
          defaultActivityLevel: 'light',
        },
        plans: {},
        measurements: {},
      });
    });

    await waitFor(() => {
      expect(getDocMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ path: expect.stringContaining('SecondUser') })
      );
      expect(setDocMock).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('SecondUser') }),
        expect.objectContaining({ profile: expect.objectContaining({ name: 'SecondUser' }) })
      );
    });
  });
});
