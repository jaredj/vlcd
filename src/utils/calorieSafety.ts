import type { Profile } from '../types';

type MinimumCalorieInput = Pick<Profile, 'age' | 'sex'> & {
  weightKg: number;
  heightCm: number;
};

const SEX_OFFSETS: Record<Profile['sex'], number> = {
  male: 5,
  female: -161,
  nonbinary: -78
};

function estimateRestingEnergy({ age, sex, weightKg, heightCm }: MinimumCalorieInput): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || !Number.isFinite(age)) {
    return 1200;
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_OFFSETS[sex];
  return Math.max(1100, base);
}

export function calculateMinimumSafeCalories(input: MinimumCalorieInput): number {
  const restingEnergy = estimateRestingEnergy(input);
  const recommended = Math.round((restingEnergy * 0.38) / 10) * 10;
  return Math.max(450, recommended);
}
