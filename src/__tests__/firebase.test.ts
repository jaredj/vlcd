import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';

const ORIGINAL_WINDOW = globalThis.window;

const {
  getAppsMock,
  getAppMock,
  initializeAppMock,
  getFirestoreMock
} = vi.hoisted(() => ({
  getAppsMock: vi.fn<() => unknown[]>(() => []),
  getAppMock: vi.fn(() => ({})),
  initializeAppMock: vi.fn<() => unknown>(() => ({ name: 'app' })),
  getFirestoreMock: vi.fn<() => unknown>(() => ({ name: 'firestore' }))
}));

vi.mock('firebase/app', () => ({
  getApp: getAppMock,
  getApps: getAppsMock,
  initializeApp: initializeAppMock
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: getFirestoreMock,
  Firestore: class {}
}));

describe('firebase integration helpers', () => {
  afterEach(() => {
    vi.resetModules();
    getAppsMock.mockReset();
    getAppMock.mockReset();
    initializeAppMock.mockReset();
    getFirestoreMock.mockReset();
    (globalThis as { window: typeof window }).window = ORIGINAL_WINDOW;
  });

  it('returns null when running under test mode', async () => {
    vi.resetModules();

    const { getDb } = await import('../lib/firebase');

    expect(getDb()).toBeNull();
    expect(getAppsMock).not.toHaveBeenCalled();
    expect(initializeAppMock).not.toHaveBeenCalled();
  });

  it('short-circuits when window is unavailable', async () => {
    vi.resetModules();
    (globalThis as { window: typeof window | undefined }).window = undefined;

    const { getDb } = await import('../lib/firebase');

    expect(getDb()).toBeNull();
    expect(getAppsMock).not.toHaveBeenCalled();
  });

  it('initializes firestore when no apps exist', async () => {
    vi.resetModules();

    const appInstance = { name: 'app' } as const;
    const firestoreInstance = { name: 'firestore' } as const;
    getAppsMock.mockReturnValue([]);
    initializeAppMock.mockReturnValue(appInstance);
    getFirestoreMock.mockReturnValue(firestoreInstance);

    const { __setFirebaseUsageOverride, getDb } = await import('../lib/firebase');

    __setFirebaseUsageOverride(true);
    const db = getDb();
    expect(db).toBe(firestoreInstance);
    expect(getAppsMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'vlcd-lab' })
    );
    expect(getFirestoreMock).toHaveBeenCalledWith(appInstance);

    const second = getDb();
    expect(second).toBe(db);
    expect(getAppsMock).toHaveBeenCalledTimes(1);
    expect(getFirestoreMock).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing firebase app when present', async () => {
    vi.resetModules();

    const existingApp = { name: 'existing-app' } as const;
    const existingFirestore = { db: true } as const;
    getAppsMock.mockReturnValue([existingApp] as unknown[]);
    getAppMock.mockReturnValue(existingApp as unknown as FirebaseApp);
    getFirestoreMock.mockReturnValue(existingFirestore as unknown as Firestore);

    const { __setFirebaseUsageOverride, getDb } = await import('../lib/firebase');

    __setFirebaseUsageOverride(true);
    const db = getDb();
    expect(db).toBe(existingFirestore);
    expect(getAppsMock).toHaveBeenCalledTimes(1);
    expect(getAppMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(getFirestoreMock).toHaveBeenCalledWith(existingApp);

    const second = getDb();
    expect(second).toBe(db);
    expect(getAppsMock).toHaveBeenCalledTimes(1);
    expect(getFirestoreMock).toHaveBeenCalledTimes(1);
  });

  it('disables firebase usage when the override is set to false', async () => {
    vi.resetModules();

    const appInstance = { name: 'app' } as const;
    const firestoreInstance = { name: 'firestore' } as const;
    getAppsMock.mockReturnValue([]);
    initializeAppMock.mockReturnValue(appInstance as unknown as FirebaseApp);
    getFirestoreMock.mockReturnValue(firestoreInstance as unknown as Firestore);

    const { __setFirebaseUsageOverride, getDb } = await import('../lib/firebase');

    __setFirebaseUsageOverride(true);
    expect(getDb()).toBe(firestoreInstance);
    expect(getFirestoreMock).toHaveBeenCalledTimes(1);

    __setFirebaseUsageOverride(false);
    expect(getDb()).toBeNull();

    __setFirebaseUsageOverride(true);
    expect(getDb()).toBe(firestoreInstance);
    expect(getFirestoreMock).toHaveBeenCalledTimes(2);
  });
});
