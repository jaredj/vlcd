import React, { useEffect } from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderWithProviders, waitFor } from '../test-utils';
import { useAppState } from '../lib/state';

describe('AppStateProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function NoProfileUpdater() {
    const { updatePlan, state } = useAppState();
    useEffect(() => {
      updatePlan('2025-10-17', { calories: 1000 }, { source: 'manual' });
    }, [updatePlan]);
    return <pre data-testid="plans">{JSON.stringify(state.plans)}</pre>;
  }

  it('does not mutate plans when no profile is set', async () => {
    renderWithProviders(<NoProfileUpdater />, {
      initialState: { profile: null, plans: {}, measurements: {} }
    });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, unknown>;
      };
      expect(stored.plans ?? {}).toEqual({});
    });
  });
});
