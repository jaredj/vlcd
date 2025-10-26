import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatISO } from 'date-fns';
import App from '../App';
import type { AppState, Profile } from '../types';
import { poundsToKilograms } from '../utils/conversions';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the baseline inputs when no stored profile is available', () => {
    render(<App />);

    expect(screen.getByLabelText(/planned calories per day/i)).toBeInTheDocument();
  });

  it('renders the dashboard when a stored profile is present', () => {
    const todayIso = formatISO(new Date(), { representation: 'date' });
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: '2025-01-01',
      startWeightKg: poundsToKilograms(260),
      heightCm: 180,
      age: 40,
      sex: 'male',
      goal: 'feel-great',
      defaultCalories: 800,
      defaultActivityLevel: 'light'
    };
    const storedState: AppState = {
      profile,
      plans: {
        [todayIso]: { date: todayIso, calories: 900, activityLevel: 'light' }
      },
      measurements: {
        [todayIso]: { date: todayIso, weightKg: poundsToKilograms(250), fasted: true }
      }
    };
    window.localStorage.setItem('vlcd-app-state-v1', JSON.stringify(storedState));

    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: /very-low-calorie diet progress lab/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/energy balance snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/track your weigh-ins/i)).toBeInTheDocument();
    expect(screen.getByText(/record the scale weight/i)).toBeInTheDocument();
  });
});
