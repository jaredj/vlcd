import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

import { __setFirebaseUsageOverride, getDb } from '../lib/firebase';
import { AppStateProvider, useAppState } from '../lib/state';
import { clearStoredState } from '../lib/storage';
import type { Profile } from '../types';

type UndiciModule = typeof import('undici');

const env = globalThis.process?.env ?? {};
const isVitest = env.VITEST === 'true';
const proxyUrl = env.HTTPS_PROXY ?? env.https_proxy ?? null;
const requestedMode = env.VLCD_FIREBASE_TEST_MODE ?? 'auto';

function isModuleNotFound(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  return code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND';
}

async function configureProxy(url: string) {
  try {
    const moduleId = 'undici';
    const undici = (await import(/* @vite-ignore */ moduleId)) as UndiciModule;
    undici.setGlobalDispatcher(new undici.ProxyAgent(url));
  } catch (error) {
    if (isModuleNotFound(error)) {
      console.warn('Undici not available; skipping proxy configuration for firebase integration tests.');
    } else {
      console.warn('Failed to configure proxy for firebase integration tests.', error);
    }
  }
}

type FirestoreDb = NonNullable<ReturnType<typeof getDb>>;

async function checkInternetAccess(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

let hasInternetAccess = true;

if (requestedMode === 'skip') {
  hasInternetAccess = false;
} else if (requestedMode === 'run') {
  hasInternetAccess = true;
} else {
  hasInternetAccess = isVitest ? await checkInternetAccess() : true;
}

if (isVitest && hasInternetAccess && proxyUrl) {
  await configureProxy(proxyUrl);
}

if (isVitest && !hasInternetAccess) {
  console.warn('Skipping firebase integration tests because no internet access was detected.');
}

const describeIfOnline = !isVitest || hasInternetAccess ? describe : describe.skip;

function requireDb(): FirestoreDb {
  const db = getDb();
  if (!db) {
    throw new Error('Expected Firestore to be available during integration tests.');
  }
  return db;
}

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

beforeAll(() => {
  __setFirebaseUsageOverride(true);
});

afterAll(() => {
  __setFirebaseUsageOverride(null);
});

describeIfOnline('firebase live integration', () => {
  it(
    'persists, updates, and deletes documents with the configured Firestore instance',
    async () => {
      const db = requireDb();
      const documentId = uniqueId('vitest');
      const documentRef = doc(db, 'integrationTests', documentId);
      const createdAtIso = new Date().toISOString();

      await setDoc(documentRef, {
        marker: 'initial',
        createdAt: createdAtIso
      });

      const created = await getDoc(documentRef);
      expect(created.exists()).toBe(true);
      expect(created.data()?.marker).toBe('initial');
      expect(created.data()?.createdAt).toBe(createdAtIso);

      await updateDoc(documentRef, {
        marker: 'updated',
        revision: '2'
      });

      const updated = await getDoc(documentRef);
      expect(updated.exists()).toBe(true);
      expect(updated.data()?.marker).toBe('updated');
      expect(updated.data()?.revision).toBe('2');

      await deleteDoc(documentRef);

      const removed = await getDoc(documentRef);
      expect(removed.exists()).toBe(false);
    },
    60000
  );

  it(
    'uses application state helpers to save and clear a profile document',
    async () => {
      const db = requireDb();
      const profileName = uniqueId('profile');
      const profileDocRef = doc(db, 'appStates', profileName);

      await deleteDoc(profileDocRef);
      window.localStorage.clear();

      const profile: Profile = {
        name: profileName,
        unitSystem: 'metric',
        startDate: new Date().toISOString().slice(0, 10),
        startWeightKg: 82,
        heightCm: 185,
        age: 34,
        sex: 'nonbinary',
        goal: 'feel-great',
        defaultCalories: 2200,
        defaultActivityLevel: 'moderate'
      };

      function ProfileWriter() {
        const { setProfile } = useAppState();
        useEffect(() => {
          setProfile(profile);
        }, [setProfile]);
        return null;
      }

      const { unmount } = render(
        <AppStateProvider>
          <ProfileWriter />
        </AppStateProvider>
      );

      await waitFor(
        async () => {
          const snapshot = await getDoc(profileDocRef);
          expect(snapshot.exists()).toBe(true);
          const data = snapshot.data() as { profile?: { name?: string } } | undefined;
          expect(data?.profile?.name).toBe(profileName);
        },
        { timeout: 60000 }
      );

      window.localStorage.setItem('vlcd-last-profile-name', profileName);
      clearStoredState();

      await waitFor(
        async () => {
          const snapshot = await getDoc(profileDocRef);
          expect(snapshot.exists()).toBe(false);
        },
        { timeout: 60000 }
      );

      unmount();
    },
    60000
  );
});
