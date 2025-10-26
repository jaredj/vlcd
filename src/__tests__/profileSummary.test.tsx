import React from 'react';
import { addDays, format, formatISO } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '../test-utils';
import ProfileSummary from '../components/ProfileSummary';
import type { AppState, Profile } from '../types';
import type { ProjectionResult } from '../lib/modeling';

describe('ProfileSummary', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when no profile is configured', () => {
    const projection: ProjectionResult = {
      projections: [],
      targetWeightKg: 0,
      targetDate: null,
      startFastedKg: 0,
      startRefedKg: 0,
      currentRefedKg: null
    };
    const initialState: AppState = { profile: null, plans: {}, measurements: {} };

    const { container } = renderWithProviders(<ProfileSummary projection={projection} />, { initialState });

    expect(container).toBeEmptyDOMElement();
  });

  it('summarizes key milestones and targets', () => {
    const todayIso = formatISO(new Date(), { representation: 'date' });
    const projection: ProjectionResult = {
      projections: [
        {
          date: '2025-01-01',
          calories: 900,
          activityLevel: 'light',
          bmr: 1400,
          tee: 1800,
          deficit: 900,
          fastedWeightKg: 95,
          fastedScaleKg: 95,
          refedScaleKg: 96,
          isMeasurement: false
        },
        {
          date: todayIso,
          calories: 850,
          activityLevel: 'light',
          bmr: 1380,
          tee: 1760,
          deficit: 910,
          fastedWeightKg: 85,
          fastedScaleKg: 86,
          refedScaleKg: 87,
          isMeasurement: true,
          measurementKg: 87,
          measurementFasted: false
        }
      ],
      targetWeightKg: 70,
      targetDate: formatISO(addDays(new Date(), 45), { representation: 'date' }),
      startFastedKg: 95,
      startRefedKg: 96,
      currentRefedKg: 87
    };
    const profile: Profile = {
      unitSystem: 'metric',
      startDate: '2025-01-01',
      startWeightKg: 96,
      heightCm: 172,
      age: 37,
      sex: 'female',
      goal: 'feel-great',
      defaultCalories: 850,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };

    renderWithProviders(<ProfileSummary projection={projection} />, { initialState });

    expect(screen.getByRole('heading', { name: /plan snapshot/i })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Started ${format(new Date('2025-01-01'), 'MMM d, yyyy')}`, 'i'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /target weight/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /estimated arrival/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /progress along the plan/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /timeline progress toward target date/i })).toBeInTheDocument();
    expect(screen.getByText(/of the planned timeline completed/i)).toBeInTheDocument();
  });

  it('notes when the target date is still pending', () => {
    const todayIso = formatISO(new Date(), { representation: 'date' });
    const projection: ProjectionResult = {
      projections: [
        {
          date: todayIso,
          calories: 800,
          activityLevel: 'minimal',
          bmr: 1500,
          tee: 1700,
          deficit: 900,
          fastedWeightKg: 90,
          fastedScaleKg: 90,
          refedScaleKg: 91,
          isMeasurement: false
        }
      ],
      targetWeightKg: 75,
      targetDate: null,
      startFastedKg: 92,
      startRefedKg: 93,
      currentRefedKg: null
    };
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: todayIso,
      startWeightKg: 93,
      heightCm: 175,
      age: 41,
      sex: 'male',
      goal: 'feel-great',
      defaultCalories: 900,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };

    renderWithProviders(<ProfileSummary projection={projection} />, { initialState });

    expect(screen.getByText(/Pending projection/i)).toBeInTheDocument();
    expect(screen.getByText(/Timeline will update as soon as the model can predict a finish date/i)).toBeInTheDocument();
  });

  it('notes when the plan has not started yet', () => {
    const startInFuture = formatISO(addDays(new Date(), 5), { representation: 'date' });
    const projection: ProjectionResult = {
      projections: [],
      targetWeightKg: 80,
      targetDate: formatISO(addDays(new Date(), 45), { representation: 'date' }),
      startFastedKg: 90,
      startRefedKg: 92,
      currentRefedKg: null
    };
    const profile: Profile = {
      unitSystem: 'metric',
      startDate: startInFuture,
      startWeightKg: 92,
      heightCm: 175,
      age: 40,
      sex: 'male',
      goal: 'feel-great',
      defaultCalories: 900,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };

    renderWithProviders(<ProfileSummary projection={projection} />, { initialState });

    expect(screen.getByText(/Plan snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/plan begins in 5 day/i)).toBeInTheDocument();
  });

  it('highlights when the plan timeline has been exceeded', () => {
    const startInPast = formatISO(addDays(new Date(), -60), { representation: 'date' });
    const projection: ProjectionResult = {
      projections: [],
      targetWeightKg: 68,
      targetDate: formatISO(addDays(new Date(), -5), { representation: 'date' }),
      startFastedKg: 85,
      startRefedKg: 87,
      currentRefedKg: 80
    };
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: startInPast,
      startWeightKg: 87,
      heightCm: 170,
      age: 44,
      sex: 'female',
      goal: 'alpinist-ready',
      defaultCalories: 900,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };

    renderWithProviders(<ProfileSummary projection={projection} />, { initialState });

    expect(screen.getByText(/timeline passed/i)).toBeInTheDocument();
    expect(screen.getByText(/beyond the projection/i)).toBeInTheDocument();
  });

  it('shows when the finish date is today', () => {
    const todayIso = formatISO(new Date(), { representation: 'date' });
    const projection: ProjectionResult = {
      projections: [],
      targetWeightKg: 70,
      targetDate: todayIso,
      startFastedKg: 90,
      startRefedKg: 92,
      currentRefedKg: 85
    };
    const profile: Profile = {
      unitSystem: 'metric',
      startDate: formatISO(addDays(new Date(), -30), { representation: 'date' }),
      startWeightKg: 92,
      heightCm: 175,
      age: 42,
      sex: 'male',
      goal: 'feel-great',
      defaultCalories: 900,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };

    renderWithProviders(<ProfileSummary projection={projection} />, { initialState });

    expect(screen.getByText(/Projected finish is today/i)).toBeInTheDocument();
  });
});
