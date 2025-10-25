export type UnitSystem = 'imperial' | 'metric';

export type Sex = 'female' | 'male' | 'nonbinary';

export type ActivityLevel = 'minimal' | 'light' | 'moderate';

export type FitnessGoal =
  | 'alpinist-ready'
  | 'avoid-obesity-complications'
  | 'feel-great'
  | 'competitive-athlete';

export interface Profile {
  unitSystem: UnitSystem;
  startDate: string; // ISO date
  startWeightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  goal: FitnessGoal;
  defaultCalories: number;
  defaultActivityLevel: ActivityLevel;
}

export interface DayPlan {
  date: string; // ISO date
  calories?: number;
  activityLevel?: ActivityLevel;
  source?: 'manual' | 'propagated';
}

export interface DailyMeasurement {
  date: string; // ISO date
  weightKg: number;
  fasted: boolean;
}

export interface AppState {
  profile: Profile | null;
  plans: Record<string, DayPlan>;
  measurements: Record<string, DailyMeasurement>;
}

export interface DailyProjection {
  date: string;
  calories: number;
  activityLevel: ActivityLevel;
  bmr: number;
  tee: number;
  deficit: number;
  fastedWeightKg: number;
  fastedScaleKg: number;
  refedScaleKg: number;
  isMeasurement: boolean;
  measurementKg?: number;
  measurementFasted?: boolean;
}

export interface GoalInfo {
  label: string;
  description: string;
  targetBmi: number;
  minimumBmi?: number;
}
