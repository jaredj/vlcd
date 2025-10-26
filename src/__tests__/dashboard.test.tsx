import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatISO } from 'date-fns';
import { fireEvent, renderWithProviders, screen } from '../test-utils';
import Dashboard from '../components/Dashboard';
import type { AppState, Profile } from '../types';
import { poundsToKilograms } from '../utils/conversions';
import * as modeling from '../lib/modeling';

describe('Dashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the baseline panel when no profile exists', () => {
    const initialState: AppState = { profile: null, plans: {}, measurements: {} };

    renderWithProviders(<Dashboard />, { initialState });

    expect(screen.getByLabelText(/planned calories per day/i)).toBeInTheDocument();
  });

  it('shows current plan insights when a profile is configured', () => {
    const todayIso = formatISO(new Date(), { representation: 'date' });
    const profile: Profile = {
      name: 'Test Profile',
      unitSystem: 'metric',
      startDate: todayIso,
      startWeightKg: 120,
      heightCm: 182,
      age: 38,
      sex: 'female',
      goal: 'feel-great',
      defaultCalories: 850,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = {
      profile,
      plans: { [todayIso]: { date: todayIso, calories: 900, activityLevel: 'light' } },
      measurements: {}
    };

    renderWithProviders(<Dashboard />, { initialState });

    expect(screen.getByRole('heading', { name: /very-low-calorie diet progress lab/i })).toBeInTheDocument();
    expect(screen.getByText(/energy balance snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/projected weights/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /trajectory/i })).toBeInTheDocument();
    expect(screen.getByText(/track your weigh-ins/i)).toBeInTheDocument();
  });

  it('opens the baseline editor when the plan snapshot edit control is used', async () => {
    window.localStorage.setItem('vlcd-baseline-seen', 'true');
    window.localStorage.setItem('vlcd-baseline-collapsed', 'true');
    const todayIso = formatISO(new Date(), { representation: 'date' });
    const profile: Profile = {
      name: 'Baseline Profile',
      unitSystem: 'imperial',
      startDate: todayIso,
      startWeightKg: poundsToKilograms(260),
      heightCm: 180,
      age: 40,
      sex: 'male',
      goal: 'feel-great',
      defaultCalories: 900,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };

    renderWithProviders(<Dashboard />, { initialState });

    expect(screen.queryByLabelText(/diet start date/i)).not.toBeInTheDocument();
    const editButtons = screen.getAllByRole('button', { name: /edit starting setup/i });
    const iconButton = editButtons.find((button) => button.classList.contains('icon-button')) ?? editButtons[0];
    fireEvent.click(iconButton);
    expect(await screen.findByLabelText(/diet start date/i)).toBeInTheDocument();
  });

  it('handles missing projection entries gracefully', () => {
    const profile: Profile = {
      name: 'Projection Profile',
      unitSystem: 'imperial',
      startDate: '2025-01-01',
      startWeightKg: poundsToKilograms(260),
      heightCm: 183,
      age: 42,
      sex: 'male',
      goal: 'feel-great',
      defaultCalories: 900,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };

    vi.spyOn(modeling, 'generateProjections').mockReturnValue({
      projections: [],
      targetWeightKg: profile.startWeightKg - 5,
      targetDate: null,
      startFastedKg: profile.startWeightKg,
      startRefedKg: profile.startWeightKg,
      currentRefedKg: null
    });

    renderWithProviders(<Dashboard />, { initialState });

    expect(screen.getByText(/no daily entry available yet/i)).toBeInTheDocument();
  });
});
