import { addDays, differenceInCalendarDays, formatISO } from 'date-fns';
import { getGoalInfo } from './goals';
import type {
  ActivityLevel,
  AppState,
  DailyMeasurement,
  DailyProjection,
  DayPlan,
  FitnessGoal,
  Profile
} from '../types';
import { bmi, metersSquared } from '../utils/conversions';

const ENERGY_DENSITY_PER_KG = 7700; // kcal/kg, blended lean and fat tissue

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  minimal: 1.18,
  light: 1.28,
  moderate: 1.42
};

const SEX_OFFSETS: Record<Profile['sex'], number> = {
  male: 5,
  female: -161,
  nonbinary: -78
};

export interface ProjectionResult {
  projections: DailyProjection[];
  targetWeightKg: number;
  targetDate: string | null;
  startFastedKg: number;
  startRefedKg: number;
  currentRefedKg: number | null;
}

function getPlanForDate(profile: Profile, plans: Record<string, DayPlan>, dateIso: string): {
  calories: number;
  activityLevel: ActivityLevel;
} {
  const plan = plans[dateIso];
  return {
    calories: plan?.calories ?? profile.defaultCalories,
    activityLevel: plan?.activityLevel ?? profile.defaultActivityLevel
  };
}

function getMeasurementForDate(
  measurements: Record<string, DailyMeasurement>,
  dateIso: string
): DailyMeasurement | undefined {
  return measurements[dateIso];
}

function calculateBmr(profile: Profile, weightKg: number, calories: number, weightLossKg: number): number {
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age + SEX_OFFSETS[profile.sex];
  const vlcdDrag = calories <= 900 ? 0.06 : calories <= 1100 ? 0.03 : 0.0;
  const adaptiveDrag = Math.min(0.25, Math.max(0, weightLossKg) * 0.0035);
  const adjusted = base * (1 - vlcdDrag - adaptiveDrag);
  return Math.max(1100, adjusted);
}

function computeNormalizedBuffer(weightKg: number, activity: ActivityLevel): number {
  const base = Math.max(1.1, weightKg * 0.018);
  const activityBonus = activity === 'moderate' ? 0.6 : activity === 'light' ? 0.35 : 0.2;
  return base + activityBonus;
}

function computeFastedWaterFraction(deficit: number, calories: number): number {
  const effectiveDeficit = Math.max(0, deficit);
  const deficitFactor = Math.min(0.65, effectiveDeficit / 2400 * 0.65);
  const vlcdFactor = calories <= 900 ? 0.18 : calories <= 1100 ? 0.1 : calories <= 1400 ? 0.05 : 0;
  const fraction = 1 - deficitFactor - vlcdFactor;
  return Math.min(1, Math.max(0.25, fraction));
}

function deriveFastedFromMeasurement(
  measurementKg: number,
  fasted: boolean,
  bufferKg: number,
  fastedFraction: number
): {
  fastedMassKg: number;
  fastedScaleKg: number;
  refedScaleKg: number;
} {
  if (fasted) {
    const fastedMass = measurementKg - bufferKg * fastedFraction;
    const refed = fastedMass + bufferKg;
    return { fastedMassKg: Math.max(35, fastedMass), fastedScaleKg: measurementKg, refedScaleKg: refed };
  }
  const fastedMass = measurementKg - bufferKg;
  const fastedScale = fastedMass + bufferKg * fastedFraction;
  return {
    fastedMassKg: Math.max(35, fastedMass),
    fastedScaleKg: fastedScale,
    refedScaleKg: measurementKg
  };
}

function computeTargetWeightKg(goal: FitnessGoal, heightCm: number, startBmi: number): number {
  const goalInfo = getGoalInfo(goal);
  const area = metersSquared(heightCm);
  const targetBmi = Math.min(goalInfo.targetBmi, Math.max(goalInfo.minimumBmi ?? goalInfo.targetBmi, startBmi - 0.5));
  return targetBmi * area;
}

export function generateProjections(state: AppState, horizonDays = 365): ProjectionResult {
  const { profile, plans, measurements } = state;
  if (!profile) {
    return {
      projections: [],
      targetWeightKg: 0,
      targetDate: null,
      startFastedKg: 0,
      startRefedKg: 0,
      currentRefedKg: null
    };
  }

  const startBmi = bmi(profile.startWeightKg, profile.heightCm);
  const targetWeightKg = computeTargetWeightKg(profile.goal, profile.heightCm, startBmi);
  const startBuffer = computeNormalizedBuffer(profile.startWeightKg, profile.defaultActivityLevel);
  const startFastedKg = Math.max(35, profile.startWeightKg - startBuffer);
  const startRefedKg = startFastedKg + startBuffer;

  const startDate = new Date(profile.startDate);
  const today = formatISO(new Date(), { representation: 'date' });

  let previousFastedMass = startFastedKg;
  let projections: DailyProjection[] = [];
  let targetDate: string | null = null;
  let currentRefedKg: number | null = null;

  for (let i = 0; i <= horizonDays; i += 1) {
    const date = addDays(startDate, i);
    const dateIso = formatISO(date, { representation: 'date' });
    const { calories, activityLevel } = getPlanForDate(profile, plans, dateIso);
    const buffer = computeNormalizedBuffer(previousFastedMass, activityLevel);
    const measurement = getMeasurementForDate(measurements, dateIso);

    const weightLossFromStart = startFastedKg - previousFastedMass;
    const bmr = calculateBmr(profile, previousFastedMass, calories, weightLossFromStart);
    const tee = bmr * ACTIVITY_FACTORS[activityLevel];
    const deficit = tee - calories;
    const diminishing = 1 - Math.min(0.45, Math.max(0, weightLossFromStart) / startFastedKg * 0.65);
    const effectiveDeficit = deficit * diminishing;
    const tissueDeltaKg = -(effectiveDeficit / ENERGY_DENSITY_PER_KG);

    let projectedFastedMass = Math.max(35, previousFastedMass + tissueDeltaKg);
    let fastedFraction = computeFastedWaterFraction(deficit, calories);
    let fastedScaleKg = projectedFastedMass + buffer * fastedFraction;
    let refedScaleKg = projectedFastedMass + buffer;
    let measurementKg: number | undefined;
    let measurementFasted: boolean | undefined;

    if (measurement) {
      const measurementBuffer = computeNormalizedBuffer(measurement.weightKg, activityLevel);
      fastedFraction = computeFastedWaterFraction(deficit, calories);
      const derived = deriveFastedFromMeasurement(
        measurement.weightKg,
        measurement.fasted,
        measurementBuffer,
        fastedFraction
      );
      projectedFastedMass = derived.fastedMassKg;
      fastedScaleKg = derived.fastedScaleKg;
      refedScaleKg = derived.refedScaleKg;
      measurementKg = measurement.weightKg;
      measurementFasted = measurement.fasted;
    }

    previousFastedMass = projectedFastedMass;

    if (!targetDate && refedScaleKg <= targetWeightKg) {
      targetDate = dateIso;
    }

    if (dateIso === today) {
      currentRefedKg = refedScaleKg;
    }

    projections.push({
      date: dateIso,
      calories,
      activityLevel,
      bmr,
      tee,
      deficit,
      fastedWeightKg: projectedFastedMass,
      fastedScaleKg,
      refedScaleKg,
      isMeasurement: Boolean(measurement),
      measurementKg,
      measurementFasted
    });

    if (differenceInCalendarDays(date, new Date()) > 730) {
      break;
    }
  }

  return {
    projections,
    targetWeightKg,
    targetDate,
    startFastedKg,
    startRefedKg,
    currentRefedKg
  };
}
