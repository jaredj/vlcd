import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '../test-utils';
import { useAppState } from '../lib/state';
import type { AppState, Profile } from '../types';
import { poundsToKilograms } from '../utils/conversions';

const SAMPLE_PROFILE: Profile = {
  name: 'Sample Person',
  unitSystem: 'imperial',
  startDate: '2025-01-01',
  startWeightKg: poundsToKilograms(255),
  heightCm: 178,
  age: 40,
  sex: 'male',
  goal: 'feel-great',
  defaultCalories: 900,
  defaultActivityLevel: 'light'
};

const PLAN_DATE = '2025-01-02';
const MEASUREMENT_DATE = '2025-01-03';

function StateHarness({ profile }: { profile: Profile }) {
  const ctx = useAppState();
  return (
    <div>
      <pre data-testid="state-json">{JSON.stringify(ctx.state)}</pre>
      <button type="button" onClick={() => ctx.updatePlan(PLAN_DATE, { calories: 900 })}>
        update-plan
      </button>
      <button type="button" onClick={() => ctx.removePlan(PLAN_DATE)}>
        remove-plan
      </button>
      <button type="button" onClick={() => ctx.setProfile(profile)}>
        set-profile
      </button>
      <button
        type="button"
        onClick={() => ctx.recordMeasurement({ date: MEASUREMENT_DATE, weightKg: poundsToKilograms(250), fasted: false })}
      >
        record-measurement
      </button>
      <button type="button" onClick={() => ctx.removeMeasurement(MEASUREMENT_DATE)}>
        remove-measurement
      </button>
      <button type="button" onClick={() => ctx.reset()}>
        reset
      </button>
    </div>
  );
}

describe('AppStateProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('exposes helpers for managing profile, plans, and measurements', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StateHarness profile={SAMPLE_PROFILE} />);

    const readState = (): AppState =>
      JSON.parse(screen.getByTestId('state-json').textContent ?? '{}') as AppState;

    expect(readState()).toEqual({ profile: null, plans: {}, measurements: {} });

    await user.click(screen.getByRole('button', { name: /update-plan/i }));
    expect(readState()).toEqual({ profile: null, plans: {}, measurements: {} });

    await user.click(screen.getByRole('button', { name: /set-profile/i }));
    await waitFor(() => {
      expect(readState().profile).toMatchObject({ unitSystem: 'imperial' });
    });

    await user.click(screen.getByRole('button', { name: /update-plan/i }));
    await waitFor(() => {
      expect(readState().plans[PLAN_DATE]).toMatchObject({ calories: 900 });
    });

    await user.click(screen.getByRole('button', { name: /record-measurement/i }));
    await waitFor(() => {
      expect(readState().measurements[MEASUREMENT_DATE]).toMatchObject({ fasted: false });
    });

    await user.click(screen.getByRole('button', { name: /remove-measurement/i }));
    await waitFor(() => {
      expect(readState().measurements[MEASUREMENT_DATE]).toBeUndefined();
    });

    await user.click(screen.getByRole('button', { name: /remove-plan/i }));
    await waitFor(() => {
      expect(readState().plans[PLAN_DATE]).toBeUndefined();
    });

    await user.click(screen.getByRole('button', { name: /reset/i }));
    await waitFor(() => {
      expect(readState()).toEqual({ profile: null, plans: {}, measurements: {} });
    });
  });
});
