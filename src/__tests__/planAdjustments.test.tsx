import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '../test-utils';
import { renderWithProviders } from '../test-utils';
import PlanAdjustments from '../components/PlanAdjustments';
import { generateProjections } from '../lib/modeling';
import type { AppState, Profile } from '../types';
import { feetInchesToCentimeters, poundsToKilograms } from '../utils/conversions';

describe('PlanAdjustments', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves custom calorie targets for a day', async () => {
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: '2025-01-01',
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
    const targetDate = projection.projections[0].date;

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    const editButton = screen.getByRole('button', { name: `Edit calories for ${targetDate}` });
    fireEvent.click(editButton);
    const caloriesInput = screen.getByLabelText<HTMLInputElement>(`Calories for ${targetDate}`);
    fireEvent.change(caloriesInput, { target: { value: '950' } });
    fireEvent.blur(caloriesInput);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number }>;
      };
      expect(stored.plans?.[targetDate]?.calories).toBe(950);
    });
  });
});
