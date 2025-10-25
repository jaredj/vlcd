import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { format, parseISO } from 'date-fns';
import { fireEvent, renderWithProviders, screen, waitFor } from '../test-utils';
import PlanAdjustments from '../components/PlanAdjustments';
import { generateProjections } from '../lib/modeling';
import type { AppState, DailyProjection, Profile } from '../types';
import { feetInchesToCentimeters, poundsToKilograms } from '../utils/conversions';

describe('PlanAdjustments', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves custom calorie targets for a day', async () => {
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: '2025-10-17',
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

    const caloriesInput = screen.getByLabelText<HTMLInputElement>(`Calories for ${targetDate}`);
    fireEvent.change(caloriesInput, { target: { value: '950' } });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number; activityLevel?: string }>;
      };
      expect(stored.plans?.[targetDate]?.calories).toBe(950);
    });

    const activitySelect = screen.getByLabelText<HTMLSelectElement>(`Activity for ${targetDate}`);
    fireEvent.change(activitySelect, { target: { value: 'moderate' } });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number; activityLevel?: string }>;
      };
      expect(stored.plans?.[targetDate]?.activityLevel).toBe('moderate');
    });

    const resetButton = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number; activityLevel?: string }>;
      };
      expect(stored.plans?.[targetDate]).toBeUndefined();
    });

    expect(screen.getByText(/recommended minimum based on your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/indemnify and hold the creators harmless/i)).toBeInTheDocument();
  });

  it('flags days planned below the recommended minimum', () => {
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: '2025-10-17',
      startWeightKg: poundsToKilograms(265),
      heightCm: feetInchesToCentimeters(5, 10.5),
      age: 44,
      sex: 'male',
      goal: 'alpinist-ready',
      defaultCalories: 650,
      defaultActivityLevel: 'minimal'
    };
    const plans: AppState['plans'] = {
      '2025-01-01': { date: '2025-01-01', calories: 450, activityLevel: 'minimal' }
    };
    const initialState: AppState = { profile, plans, measurements: {} };
    const projection = generateProjections(initialState, 1);

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    expect(screen.getByText(/medical supervision required/i)).toBeInTheDocument();
  });

  it('visually distinguishes past, present, and future days', () => {
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: '2025-10-17',
      startWeightKg: poundsToKilograms(265),
      heightCm: feetInchesToCentimeters(5, 10.5),
      age: 44,
      sex: 'male',
      goal: 'alpinist-ready',
      defaultCalories: 800,
      defaultActivityLevel: 'minimal'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };
    const projection = generateProjections(initialState, 14);

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    const rows = screen.getAllByRole('row');
    const dataRows = rows.slice(1);
    expect(dataRows.some((row) => row.classList.contains('plan-row-past'))).toBe(true);

    const todayRow = screen.getByRole('row', { current: 'date' });
    expect(todayRow).toHaveClass('plan-row-today');
    expect(todayRow).toHaveAttribute('aria-current', 'date');

    expect(dataRows.some((row) => row.classList.contains('plan-row-future'))).toBe(true);
  });

  it('scrolls the table to today when supported by the browser', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollSpy = vi.fn();
    (HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = scrollSpy;

    const today = format(new Date(), 'yyyy-MM-dd');
    const projections: DailyProjection[] = [
      {
        date: today,
        calories: 1200,
        activityLevel: 'minimal',
        bmr: 1500,
        tee: 1800,
        deficit: -600,
        fastedWeightKg: 90,
        fastedScaleKg: 90,
        refedScaleKg: 90,
        isMeasurement: false
      }
    ];

    try {
      renderWithProviders(<PlanAdjustments projections={projections} unit="imperial" />, {
        initialState: { profile: null, plans: {}, measurements: {} }
      });

      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalled();
      });
    } finally {
      if (originalScrollIntoView) {
        HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: () => void }).scrollIntoView;
      }
    }
  });

  it(
    'displays the full projection horizon in the adjustments table',
    { timeout: 15000 },
    () => {
      const profile: Profile = {
        unitSystem: 'imperial',
        startDate: '2025-10-17',
        startWeightKg: poundsToKilograms(265),
        heightCm: feetInchesToCentimeters(5, 10.5),
      age: 44,
      sex: 'male',
      goal: 'alpinist-ready',
      defaultCalories: 800,
      defaultActivityLevel: 'minimal'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };
    const projection = generateProjections(initialState, 420);

    expect(projection.projections.length).toBeGreaterThan(40);

    const finalDay = projection.projections[projection.projections.length - 1];

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(projection.projections.length + 1);

    const lastDateLabel = format(parseISO(finalDay.date), 'MMM d');
      expect(screen.getAllByText(lastDateLabel).length).toBeGreaterThan(0);

      const finalCaloriesInput = screen.getByLabelText(`Calories for ${finalDay.date}`);
      expect(finalCaloriesInput).toBeInTheDocument();
    }
  );

  it('falls back gracefully when projections are unavailable', () => {
    const initialState: AppState = { profile: null, plans: {}, measurements: {} };

    renderWithProviders(
      <PlanAdjustments projections={[]} unit="imperial" />,
      { initialState }
    );

    expect(screen.getByText(/projections are not available yet/i)).toBeInTheDocument();
  });
});
