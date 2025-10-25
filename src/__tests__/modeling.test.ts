import { describe, expect, it } from 'vitest';
import { generateProjections } from '../lib/modeling';
import type { AppState, Profile } from '../types';
import { feetInchesToCentimeters, poundsToKilograms } from '../utils/conversions';

describe('generateProjections', () => {
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

  it('returns a target weight and timeline for the alpinist goal', () => {
    const state: AppState = { profile, plans: {}, measurements: {} };
    const result = generateProjections(state, 200);
    expect(result.targetWeightKg).toBeLessThan(profile.startWeightKg);
    const finalProjection = result.projections[result.projections.length - 1];
    expect(finalProjection.refedScaleKg).toBeLessThan(profile.startWeightKg);
    expect(Math.abs(result.projections[0].refedScaleKg - profile.startWeightKg)).toBeLessThan(0.5);
  });

  it('respects recorded measurements and flags them in the timeline', () => {
    const state: AppState = {
      profile,
      plans: {},
      measurements: {
        '2025-01-05': { date: '2025-01-05', weightKg: poundsToKilograms(240), fasted: false }
      }
    };
    const result = generateProjections(state, 40);
    const measuredDay = result.projections.find((entry) => entry.date === '2025-01-05');
    expect(measuredDay).toBeDefined();
    expect(measuredDay?.isMeasurement).toBe(true);
    expect(measuredDay?.refedScaleKg).toBeCloseTo(poundsToKilograms(240), 2);
  });

  it('shows reduced deficit for high calorie plan overrides', () => {
    const state: AppState = {
      profile,
      plans: {
        '2025-01-02': {
          date: '2025-01-02',
          calories: 2600,
          activityLevel: 'minimal'
        }
      },
      measurements: {}
    };
    const result = generateProjections(state, 10);
    const dayTwo = result.projections.find((entry) => entry.date === '2025-01-02');
    expect(dayTwo).toBeDefined();
    expect(dayTwo?.deficit).toBeLessThan(0);
  });

  it('captures rapid glycogen losses during severe early deficits', () => {
    const aggressiveProfile: Profile = {
      ...profile,
      defaultCalories: 350,
      defaultActivityLevel: 'moderate'
    };

    const state: AppState = { profile: aggressiveProfile, plans: {}, measurements: {} };
    const result = generateProjections(state, 10);
    const weekProjection = result.projections.find((entry) => entry.date === '2025-01-08');
    expect(weekProjection).toBeDefined();
    const dropKg = aggressiveProfile.startWeightKg - (weekProjection?.refedScaleKg ?? aggressiveProfile.startWeightKg);
    expect(dropKg).toBeGreaterThan(3.5);
    expect(weekProjection?.fastedScaleKg).toBeLessThan(weekProjection?.refedScaleKg ?? 0);
  });
});
