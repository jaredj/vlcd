import React from 'react';
import { formatISO } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { fireEvent, renderWithProviders, screen, waitFor } from '../test-utils';
import MeasurementForm from '../components/MeasurementForm';
import type { AppState, Profile } from '../types';
import { poundsToKilograms } from '../utils/conversions';

describe('MeasurementForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('records, lists, and removes weight measurements', async () => {
    const todayIso = formatISO(new Date(), { representation: 'date' });
    const profile: Profile = {
      name: 'Measurement Profile',
      unitSystem: 'imperial',
      startDate: '2025-01-01',
      startWeightKg: poundsToKilograms(260),
      heightCm: 178,
      age: 39,
      sex: 'female',
      goal: 'feel-great',
      defaultCalories: 850,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = {
      profile,
      plans: {},
      measurements: {
        '2025-01-03': { date: '2025-01-03', weightKg: poundsToKilograms(255), fasted: true }
      }
    };

    renderWithProviders(<MeasurementForm unit="imperial" />, { initialState });

    expect(screen.getByText('2025-01-03')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(await screen.findByText(/no measurements added yet/i)).toBeInTheDocument();

    const weightInput = screen.getByLabelText(/weight/i);
    fireEvent.change(weightInput, { target: { value: '200' } });

    const fastedCheckbox = screen.getByLabelText(/fasted measurement/i);
    await userEvent.click(fastedCheckbox);

    await userEvent.click(screen.getByRole('button', { name: /save measurement/i }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        measurements?: Record<string, { weightKg: number; fasted: boolean }>;
      };
      expect(stored.measurements?.[todayIso]).toMatchObject({ fasted: false });
    });

    expect(await screen.findByText(todayIso)).toBeInTheDocument();
    expect((screen.getByLabelText(/date/i) as HTMLInputElement).value).toBe(todayIso);
  });
});
