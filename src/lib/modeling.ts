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

function solveMaintenanceCalories({
  profile,
  weightKg,
  activityLevel,
  weightLossFromStart
}: {
  profile: Profile;
  weightKg: number;
  activityLevel: ActivityLevel;
  weightLossFromStart: number;
}): number {
  let calories = Math.max(profile.defaultCalories, 1400);
  for (let i = 0; i < 6; i += 1) {
    const bmr = calculateBmr(profile, weightKg, calories, weightLossFromStart);
    const tee = bmr * ACTIVITY_FACTORS[activityLevel];
    calories = tee;
  }
  return Math.round(calories);
}

interface SimulationOptions {
  profile: Profile;
  previousFastedMass: number;
  calories: number;
  activityLevel: ActivityLevel;
  measurement?: DailyMeasurement;
  startFastedKg: number;
  weightLossFromStart: number;
}

interface SimulationResult {
  projectedFastedMass: number;
  fastedScaleKg: number;
  refedScaleKg: number;
  bmr: number;
  tee: number;
  deficit: number;
  measurementKg?: number;
  measurementFasted?: boolean;
}

function simulateDay({
  profile,
  previousFastedMass,
  calories,
  activityLevel,
  measurement,
  startFastedKg,
  weightLossFromStart
}: SimulationOptions): SimulationResult {
  const buffer = computeNormalizedBuffer(previousFastedMass, activityLevel);
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

  return {
    projectedFastedMass,
    fastedScaleKg,
    refedScaleKg,
    bmr,
    tee,
    deficit,
    measurementKg,
    measurementFasted
  };
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

  const sortedPlans = Object.values(plans)
    .filter((plan): plan is DayPlan => Boolean(plan?.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  let planPointer = 0;
  let activeCalories = profile.defaultCalories;
  let maintenanceActive = false;
  let maintenanceDays = 0;
  let settledDays = 0;

  for (let i = 0; i <= horizonDays; i += 1) {
    const date = addDays(startDate, i);
    const dateIso = formatISO(date, { representation: 'date' });
    if (!maintenanceActive) {
      while (planPointer < sortedPlans.length && sortedPlans[planPointer].date <= dateIso) {
        const anchor = sortedPlans[planPointer];
        if (anchor.calories !== undefined) {
          activeCalories = anchor.calories;
        }
        planPointer += 1;
      }
    }

    const planForDay = plans[dateIso];
    const activityLevel = planForDay?.activityLevel ?? profile.defaultActivityLevel;
    const measurement = getMeasurementForDate(measurements, dateIso);
    const weightLossFromStart = startFastedKg - previousFastedMass;

    if (!maintenanceActive && planForDay?.calories !== undefined) {
      activeCalories = planForDay.calories;
    }

    if (maintenanceActive) {
      activeCalories = solveMaintenanceCalories({
        profile,
        weightKg: previousFastedMass,
        activityLevel,
        weightLossFromStart
      });
    }

    let caloriesForDay = Math.round(activeCalories);

    let dayResult = simulateDay({
      profile,
      previousFastedMass,
      calories: caloriesForDay,
      activityLevel,
      measurement,
      startFastedKg,
      weightLossFromStart
    });

    if (!maintenanceActive && dayResult.refedScaleKg <= targetWeightKg) {
      targetDate = dateIso;
      maintenanceActive = true;
      activeCalories = solveMaintenanceCalories({
        profile,
        weightKg: previousFastedMass,
        activityLevel,
        weightLossFromStart
      });
      caloriesForDay = Math.round(activeCalories);
      dayResult = simulateDay({
        profile,
        previousFastedMass,
        calories: caloriesForDay,
        activityLevel,
        measurement,
        startFastedKg,
        weightLossFromStart
      });
    }

    previousFastedMass = dayResult.projectedFastedMass;

    if (dateIso === today) {
      currentRefedKg = dayResult.refedScaleKg;
    }

    projections.push({
      date: dateIso,
      calories: caloriesForDay,
      activityLevel,
      bmr: dayResult.bmr,
      tee: dayResult.tee,
      deficit: dayResult.deficit,
      fastedWeightKg: dayResult.projectedFastedMass,
      fastedScaleKg: dayResult.fastedScaleKg,
      refedScaleKg: dayResult.refedScaleKg,
      isMeasurement: Boolean(measurement),
      measurementKg: dayResult.measurementKg,
      measurementFasted: dayResult.measurementFasted
    });

    if (maintenanceActive) {
      maintenanceDays += 1;
      if (Math.abs(dayResult.refedScaleKg - dayResult.fastedScaleKg) <= 0.05) {
        settledDays += 1;
      } else {
        settledDays = 0;
      }
      if (settledDays >= 2 || maintenanceDays >= 30) {
        break;
      }
    }

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
