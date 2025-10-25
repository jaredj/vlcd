import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '../test-utils';
import { renderWithProviders } from '../test-utils';
import PlanAdjustments from '../components/PlanAdjustments';
import { generateProjections } from '../lib/modeling';
import type { AppState, Profile } from '../types';
import { feetInchesToCentimeters, poundsToKilograms } from '../utils/conversions';
import { addDays, formatISO, subDays } from 'date-fns';

describe('PlanAdjustments', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('propagates calorie adjustments forward while respecting manual overrides', async () => {
    const startDateObj = subDays(new Date(), 3);
    const startDate = formatISO(startDateObj, { representation: 'date' });
    const manualOverrideDate = formatISO(addDays(startDateObj, 3), { representation: 'date' });
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate,
      startWeightKg: poundsToKilograms(265),
      heightCm: feetInchesToCentimeters(5, 10.5),
      age: 44,
      sex: 'male',
      goal: 'alpinist-ready',
      defaultCalories: 800,
      defaultActivityLevel: 'minimal'
    };
    const initialState: AppState = {
      profile,
      plans: {
        [manualOverrideDate]: { date: manualOverrideDate, calories: 900, activityLevel: 'minimal', source: 'manual' }
      },
      measurements: {}
    };
    const projection = generateProjections(initialState, 10);
    const dayOne = projection.projections[0].date;
    const dayTwo = projection.projections[1].date;
    const dayAfterManual = projection.projections[4].date;

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    const caloriesInput = screen.getByLabelText<HTMLInputElement>(`Calories for ${dayOne}`);
    fireEvent.change(caloriesInput, { target: { value: '950' } });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number; source?: string }>;
      };
      expect(stored.plans?.[dayOne]?.calories).toBe(950);
      expect(stored.plans?.[dayOne]?.source).toBe('manual');
      expect(stored.plans?.[dayTwo]?.calories).toBe(950);
      expect(stored.plans?.[dayTwo]?.source).toBe('propagated');
      expect(stored.plans?.[manualOverrideDate]?.calories).toBe(900);
      expect(stored.plans?.[dayAfterManual]?.calories).toBe(950);
      expect(stored.plans?.[dayAfterManual]?.source).toBe('propagated');
    });

    const dayOneRow = screen.getByLabelText<HTMLInputElement>(`Calories for ${dayOne}`).closest('tr');
    if (!dayOneRow) {
      throw new Error('Could not locate row for manual plan');
    }
    const resetButton = within(dayOneRow).getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number }>;
      };
      expect(stored.plans?.[dayOne]).toBeUndefined();
    });
  });

  it('allows weight edits for past and current days only', async () => {
    const startDateObj = subDays(new Date(), 4);
    const startDate = formatISO(startDateObj, { representation: 'date' });
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate,
      startWeightKg: poundsToKilograms(265),
      heightCm: feetInchesToCentimeters(5, 10.5),
      age: 44,
      sex: 'male',
      goal: 'alpinist-ready',
      defaultCalories: 800,
      defaultActivityLevel: 'minimal'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };
    const projection = generateProjections(initialState, 10);
    const pastDay = projection.projections[2].date;
    const futureDay = projection.projections[6].date;

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    const pastWeightInput = screen.getByLabelText<HTMLInputElement>(`Weight for ${pastDay}`);
    expect(pastWeightInput).not.toBeDisabled();
    fireEvent.change(pastWeightInput, { target: { value: '210.5' } });
    fireEvent.blur(pastWeightInput);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        measurements?: Record<string, { weightKg: number; fasted: boolean }>;
      };
      expect(stored.measurements?.[pastDay]?.weightKg).toBeCloseTo(poundsToKilograms(210.5), 3);
      expect(stored.measurements?.[pastDay]?.fasted).toBe(true);
    });

    let pastFastedToggle = screen.getByLabelText<HTMLInputElement>(`Fasted measurement for ${pastDay}`);
    fireEvent.click(pastFastedToggle);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        measurements?: Record<string, { weightKg: number; fasted: boolean }>;
      };
      expect(stored.measurements?.[pastDay]?.fasted).toBe(false);
    });

    fireEvent.change(pastWeightInput, { target: { value: '' } });
    fireEvent.blur(pastWeightInput);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        measurements?: Record<string, { weightKg: number; fasted: boolean }>;
      };
      expect(stored.measurements?.[pastDay]).toBeUndefined();
    });

    fireEvent.change(pastWeightInput, { target: { value: '205.4' } });
    pastFastedToggle = screen.getByLabelText<HTMLInputElement>(`Fasted measurement for ${pastDay}`);
    fireEvent.click(pastFastedToggle);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        measurements?: Record<string, { weightKg: number; fasted: boolean }>;
      };
      expect(stored.measurements?.[pastDay]?.weightKg).toBeCloseTo(poundsToKilograms(205.4), 3);
      expect(stored.measurements?.[pastDay]?.fasted).toBe(true);
    });

    fireEvent.change(pastWeightInput, { target: { value: '-5' } });
    fireEvent.blur(pastWeightInput);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        measurements?: Record<string, { weightKg: number; fasted: boolean }>;
      };
      expect(stored.measurements?.[pastDay]?.weightKg).toBeCloseTo(poundsToKilograms(205.4), 3);
    });

    const futureWeightInput = screen.getByLabelText<HTMLInputElement>(`Weight for ${futureDay}`);
    expect(futureWeightInput).toBeDisabled();
  });
});
