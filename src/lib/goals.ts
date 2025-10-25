import type { FitnessGoal, GoalInfo } from '../types';

export const GOALS: Record<FitnessGoal, GoalInfo> = {
  'alpinist-ready': {
    label: 'Alpinist-ready',
    description:
      'Balances strength, aerobic reserves, and a modest body fat buffer to support long days in alpine terrain without carrying unnecessary mass.',
    targetBmi: 22.5,
    minimumBmi: 21
  },
  'avoid-obesity-complications': {
    label: 'Avoid obesity-related complications',
    description: 'Focuses on reducing metabolic risk factors by reaching the upper range of the healthy BMI spectrum.',
    targetBmi: 27.5,
    minimumBmi: 24.5
  },
  'feel-great': {
    label: 'Feel great day to day',
    description: 'Targets a mid-healthy BMI associated with lower fatigue and better energy levels.',
    targetBmi: 24,
    minimumBmi: 22
  },
  'competitive-athlete': {
    label: 'Competitive athlete',
    description: 'A lean composition that prioritises power-to-weight ratio for advanced training volumes.',
    targetBmi: 21.5,
    minimumBmi: 20.5
  }
};

export function getGoalInfo(goal: FitnessGoal): GoalInfo {
  return GOALS[goal];
}
