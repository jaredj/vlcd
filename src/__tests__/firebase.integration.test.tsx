import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

import { __setFirebaseUsageOverride, getDb } from '../lib/firebase';
import { AppStateProvider, useAppState } from '../lib/state';
import { clearStoredState } from '../lib/storage';
import type { Profile } from '../types';

const env = globalThis.process?.env ?? {};
const proxyUrl = env.HTTPS_PROXY ?? env.https_proxy ?? null;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

type FirestoreDb = NonNullable<ReturnType<typeof getDb>>;

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

describe('firebase live integration', () => {
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
