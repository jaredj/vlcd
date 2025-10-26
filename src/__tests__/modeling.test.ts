import { describe, expect, it } from 'vitest';
import { generateProjections } from '../lib/modeling';
import type { AppState, Profile } from '../types';
import { feetInchesToCentimeters, poundsToKilograms } from '../utils/conversions';

describe('generateProjections', () => {
  const profile: Profile = {
    name: 'Modeling Profile',
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

  it.concurrent('returns a target weight and timeline for the alpinist goal', () => {
    const state: AppState = { profile, plans: {}, measurements: {} };
    const result = generateProjections(state, 200);
    expect(result.targetWeightKg).toBeLessThan(profile.startWeightKg);
    const finalProjection = result.projections[result.projections.length - 1];
    expect(finalProjection.refedScaleKg).toBeLessThan(profile.startWeightKg);
    expect(Math.abs(result.projections[0].refedScaleKg - profile.startWeightKg)).toBeLessThan(1);
  });

  it.concurrent('respects recorded measurements and flags them in the timeline', () => {
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

  it.concurrent('shows reduced deficit for high calorie plan overrides', () => {
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

  it.concurrent('propagates calorie edits forward until a new adjustment is encountered', () => {
    const state: AppState = {
      profile,
      plans: {
        '2025-01-03': { date: '2025-01-03', calories: 950, activityLevel: 'minimal' },
        '2025-01-06': { date: '2025-01-06', calories: 870, activityLevel: 'minimal' }
      },
      measurements: {}
    };
    const result = generateProjections(state, 10);
    const dayTwo = result.projections.find((entry) => entry.date === '2025-01-02');
    const dayFour = result.projections.find((entry) => entry.date === '2025-01-04');
    const daySix = result.projections.find((entry) => entry.date === '2025-01-06');
    const daySeven = result.projections.find((entry) => entry.date === '2025-01-07');

    expect(dayTwo?.calories).toBe(profile.defaultCalories);
    expect(dayFour?.calories).toBe(950);
    expect(daySix?.calories).toBe(870);
    expect(daySeven?.calories).toBe(870);
  });

  it.concurrent('transitions to maintenance calories once the target weight is achieved', () => {
    const state: AppState = {
      profile,
      plans: {
        '2025-01-01': { date: '2025-01-01', calories: 600, activityLevel: 'minimal' }
      },
      measurements: {}
    };
    const result = generateProjections(state, 400);
    expect(result.targetDate).not.toBeNull();
    if (!result.targetDate) {
      return;
    }

    const targetIndex = result.projections.findIndex((entry) => entry.date === result.targetDate);
    expect(targetIndex).toBeGreaterThan(-1);

    const maintenanceSegment = result.projections.slice(targetIndex);
    expect(maintenanceSegment.length).toBeGreaterThanOrEqual(1);
    expect(maintenanceSegment.length).toBeLessThanOrEqual(3);

    maintenanceSegment.forEach((entry) => {
      expect(Math.abs(entry.tee - entry.calories)).toBeLessThan(50);
      expect(Math.abs(entry.refedScaleKg - entry.fastedScaleKg)).toBeLessThan(0.1);
    });
  });

  it.concurrent('captures rapid early losses when calories are extremely low', () => {
    const aggressiveProfile: Profile = {
      ...profile,
      defaultCalories: 300,
      defaultActivityLevel: 'moderate'
    };
    const state: AppState = { profile: aggressiveProfile, plans: {}, measurements: {} };
    const result = generateProjections(state, 10);
    const weekMark = result.projections.find((entry) => entry.date === '2025-01-08');
    expect(weekMark).toBeDefined();
    if (!weekMark) {
      return;
    }
    expect(weekMark.refedScaleKg).toBeLessThan(poundsToKilograms(254));
    expect(weekMark.refedScaleKg).toBeGreaterThan(poundsToKilograms(246));
  });
});
