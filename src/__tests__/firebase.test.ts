import { describe, expect, it, vi, afterEach } from 'vitest';

const ORIGINAL_USER_AGENT = window.navigator.userAgent;

describe('firebase configuration', () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: ORIGINAL_USER_AGENT,
      configurable: true,
    });
    vi.resetModules();
    vi.doUnmock('firebase/app');
    vi.doUnmock('firebase/firestore');
    vi.doUnmock('firebase/analytics');
  });

  it('returns null when running under jsdom', async () => {
    vi.resetModules();
    vi.doMock('firebase/app', () => ({
      getApps: vi.fn(() => []),
      initializeApp: vi.fn(),
    }));
    vi.doMock('firebase/firestore', () => ({
      getFirestore: vi.fn(),
    }));
    vi.doMock('firebase/analytics', () => ({
      isSupported: vi.fn(() => Promise.resolve(false)),
      getAnalytics: vi.fn(),
    }));

    const { getFirebaseApp, getFirestoreInstance, ensureAnalytics } = await import('../lib/firebase');
    expect(getFirebaseApp()).toBeNull();
    expect(getFirestoreInstance()).toBeNull();
    await expect(ensureAnalytics()).resolves.toBeNull();
  });

  it('initializes Firebase when supported', async () => {
    vi.resetModules();
    const initializeApp = vi.fn(() => ({ name: 'app' }));
    const getApps = vi.fn(() => []);
    const getFirestore = vi.fn(() => ({ instance: 'firestore' }));
    const isSupported = vi.fn(() => Promise.resolve(true));
    const getAnalytics = vi.fn(() => ({ name: 'analytics' }));

    vi.doMock('firebase/app', () => ({ getApps, initializeApp }));
    vi.doMock('firebase/firestore', () => ({ getFirestore }));
    vi.doMock('firebase/analytics', () => ({ isSupported, getAnalytics }));

    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });

    const { getFirebaseApp, getFirestoreInstance, ensureAnalytics } = await import('../lib/firebase');

    const app = getFirebaseApp();
    expect(app).toEqual({ name: 'app' });
    expect(getApps).toHaveBeenCalled();
    expect(getFirestoreInstance()).toEqual({ instance: 'firestore' });

    await ensureAnalytics();
    expect(isSupported).toHaveBeenCalled();
    expect(getAnalytics).toHaveBeenCalled();

    // Subsequent calls reuse cached instances
    expect(getFirebaseApp()).toBe(app);
    expect(getFirestoreInstance()).toEqual({ instance: 'firestore' });
    await ensureAnalytics();
    expect(getAnalytics).toHaveBeenCalledTimes(1);
  });

  it('swallows analytics initialization failures', async () => {
    vi.resetModules();
    const initializeApp = vi.fn(() => ({ name: 'app' }));
    const getApps = vi.fn(() => []);
    const getFirestore = vi.fn(() => ({ instance: 'firestore' }));
    const getAnalytics = vi.fn();
    const error = new Error('not supported');

    vi.doMock('firebase/app', () => ({ getApps, initializeApp }));
    vi.doMock('firebase/firestore', () => ({ getFirestore }));
    vi.doMock('firebase/analytics', () => ({
      isSupported: vi.fn(() => Promise.reject(error)),
      getAnalytics,
    }));

    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0',
      configurable: true,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ensureAnalytics } = await import('../lib/firebase');

    await expect(ensureAnalytics()).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Failed to initialize analytics', error);
    warnSpy.mockRestore();
  });
});
