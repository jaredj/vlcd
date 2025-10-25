import React, { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { formatISO } from 'date-fns';
import { getGoalInfo, GOALS } from '../lib/goals';
import { useAppState } from '../lib/state';
import { ACTIVITY_LABELS } from '../lib/activity';
import type { FitnessGoal, Profile, Sex, UnitSystem } from '../types';
import {
  bmi,
  centimetersToFeetInches,
  feetInchesToCentimeters,
  formatWeight,
  kilogramsToPounds,
  poundsToKilograms
} from '../utils/conversions';
import { calculateMinimumSafeCalories } from '../utils/calorieSafety';
import LiabilityNotice from './LiabilityNotice';

const DEFAULT_START_WEIGHT_LB = 265;
const DEFAULT_HEIGHT_FEET = 5;
const DEFAULT_HEIGHT_INCHES = 10.5;
const DEFAULT_HEIGHT_CM = feetInchesToCentimeters(DEFAULT_HEIGHT_FEET, DEFAULT_HEIGHT_INCHES);
const DEFAULT_CALORIES = 800;
const DEFAULT_AGE = 44;
const DEFAULT_GOAL: FitnessGoal = 'alpinist-ready';

interface FormState {
  unitSystem: UnitSystem;
  startDate: string;
  startWeight: number;
  heightFeet: number;
  heightInches: number;
  heightCm: number;
  age: number;
  sex: Sex;
  goal: FitnessGoal;
  defaultCalories: number;
  defaultActivityLevel: Profile['defaultActivityLevel'];
}

interface ProfileSetupProps {
  onComplete?: () => void;
}

export default function ProfileSetup({ onComplete }: ProfileSetupProps): JSX.Element {
  const { state, setProfile } = useAppState();
  const existingProfile = state.profile;

  const [form, setForm] = useState<FormState>(() => {
    if (existingProfile) {
      const heightFeetInches = centimetersToFeetInches(existingProfile.heightCm);
      return {
        unitSystem: existingProfile.unitSystem,
        startDate: existingProfile.startDate,
        startWeight:
          existingProfile.unitSystem === 'imperial'
            ? kilogramsToPounds(existingProfile.startWeightKg)
            : existingProfile.startWeightKg,
        heightFeet: heightFeetInches.feet,
        heightInches: parseFloat(heightFeetInches.inches.toFixed(2)),
        heightCm: existingProfile.heightCm,
        age: existingProfile.age,
        sex: existingProfile.sex,
        goal: existingProfile.goal,
        defaultCalories: existingProfile.defaultCalories,
        defaultActivityLevel: existingProfile.defaultActivityLevel
      };
    }

    return {
      unitSystem: 'imperial',
      startDate: formatISO(new Date(), { representation: 'date' }),
      startWeight: DEFAULT_START_WEIGHT_LB,
      heightFeet: DEFAULT_HEIGHT_FEET,
      heightInches: DEFAULT_HEIGHT_INCHES,
      heightCm: DEFAULT_HEIGHT_CM,
      age: DEFAULT_AGE,
      sex: 'male',
      goal: DEFAULT_GOAL,
      defaultCalories: DEFAULT_CALORIES,
      defaultActivityLevel: 'minimal'
    };
  });

  const heightCm = form.unitSystem === 'imperial' ? feetInchesToCentimeters(form.heightFeet, form.heightInches) : form.heightCm;
  const weightKg = form.unitSystem === 'imperial' ? poundsToKilograms(form.startWeight) : form.startWeight;
  const profilePreviewBmi = bmi(weightKg, heightCm);
  const goalInfo = useMemo(() => getGoalInfo(form.goal), [form.goal]);
  const goalWeightKg = goalInfo.targetBmi * (heightCm / 100) * (heightCm / 100);
  const minimumSafeCalories = useMemo(
    () =>
      calculateMinimumSafeCalories({
        weightKg,
        heightCm,
        age: form.age,
        sex: form.sex
      }),
    [form.age, form.sex, heightCm, weightKg]
  );
  const isBelowMinimum = form.defaultCalories < minimumSafeCalories;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile: Profile = {
      unitSystem: form.unitSystem,
      startDate: form.startDate,
      startWeightKg: weightKg,
      heightCm,
      age: form.age,
      sex: form.sex,
      goal: form.goal,
      defaultCalories: form.defaultCalories,
      defaultActivityLevel: form.defaultActivityLevel
    };
    setProfile(profile);
    onComplete?.();
  }

  function handleUnitChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const unit = event.target.value as UnitSystem;
    setForm((prev) => {
      if (prev.unitSystem === unit) {
        return prev;
      }
      if (unit === 'metric') {
        return {
          ...prev,
          unitSystem: unit,
          startWeight: parseFloat(poundsToKilograms(prev.startWeight).toFixed(2)),
          heightCm: feetInchesToCentimeters(prev.heightFeet, prev.heightInches)
        };
      }
      const feetInches = centimetersToFeetInches(prev.heightCm);
      return {
        ...prev,
        unitSystem: unit,
        startWeight: parseFloat(kilogramsToPounds(prev.startWeight).toFixed(1)),
        heightFeet: feetInches.feet,
        heightInches: parseFloat(feetInches.inches.toFixed(1))
      };
    });
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section>
      <h2>{existingProfile ? 'Update your profile' : 'Create your VLCD profile'}</h2>
      <p>
        We will use your personal data to estimate a realistic target weight and chart how a very-low-calorie
        dietary approach is likely to evolve.
      </p>
      <form onSubmit={handleSubmit} className="grid two-columns">
        <label>
          Units
          <select value={form.unitSystem} onChange={handleUnitChange}>
            <option value="imperial">Imperial (lb, ft/in)</option>
            <option value="metric">Metric (kg, cm)</option>
          </select>
        </label>
        <label>
          Diet start date
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => updateField('startDate', event.target.value)}
            required
          />
        </label>
        <label>
          Starting weight ({form.unitSystem === 'imperial' ? 'lb' : 'kg'})
          <input
            type="number"
            min={form.unitSystem === 'imperial' ? 60 : 30}
            max={form.unitSystem === 'imperial' ? 700 : 320}
            step="0.1"
            value={form.startWeight}
            onChange={(event) => updateField('startWeight', Number(event.target.value))}
            required
          />
        </label>
        {form.unitSystem === 'imperial' ? (
          <div className="grid two-columns">
            <label>
              Height (ft)
              <input
                type="number"
                min={4}
                max={7}
                step="1"
                value={form.heightFeet}
                onChange={(event) => updateField('heightFeet', Number(event.target.value))}
                required
              />
            </label>
            <label>
              Height (in)
              <input
                type="number"
                min={0}
                max={11.9}
                step="0.1"
                value={form.heightInches}
                onChange={(event) => updateField('heightInches', Number(event.target.value))}
                required
              />
            </label>
          </div>
        ) : (
          <label>
            Height (cm)
            <input
              type="number"
              min={140}
              max={215}
              step="0.5"
              value={form.heightCm}
              onChange={(event) => updateField('heightCm', Number(event.target.value))}
              required
            />
          </label>
        )}
        <label>
          Age
          <input type="number" min={18} max={90} value={form.age} onChange={(event) => updateField('age', Number(event.target.value))} required />
        </label>
        <label>
          Sex assigned at birth
          <select value={form.sex} onChange={(event) => updateField('sex', event.target.value as Sex)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="nonbinary">Non-binary / intersex</option>
          </select>
        </label>
        <label>
          Fitness goal
          <select value={form.goal} onChange={(event) => updateField('goal', event.target.value as FitnessGoal)}>
            {Object.entries(GOALS).map(([value, info]) => (
              <option key={value} value={value}>
                {info.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Planned calories per day
          <input
            type="number"
            min={0}
            max={2500}
            step="10"
            value={form.defaultCalories}
            onChange={(event) => updateField('defaultCalories', Number(event.target.value))}
            required
            aria-describedby="calorie-safety-note"
          />
        </label>
        <div className="notice" role="note" id="calorie-safety-note">
          <p>
            Recommended minimum for your current stats: <strong>{minimumSafeCalories.toLocaleString()} kcal/day</strong>.
          </p>
          {isBelowMinimum ? (
            <p>
              <strong>Medical supervision required:</strong> Plans below this level must only be pursued under strict and
              constant medical supervision.
            </p>
          ) : (
            <p>Only consider going below this threshold with strict and constant medical supervision.</p>
          )}
        </div>
        <label>
          Expected baseline activity
          <select
            value={form.defaultActivityLevel}
            onChange={(event) => updateField('defaultActivityLevel', event.target.value as Profile['defaultActivityLevel'])}
          >
            {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div>
          <h3>Your estimated BMI</h3>
          <p className="badge">{profilePreviewBmi.toFixed(1)}</p>
          <p>
            Target for the <strong>{goalInfo.label}</strong> goal: {goalInfo.targetBmi.toFixed(1)} BMI — approximately{' '}
            {formatWeight(goalWeightKg, form.unitSystem)}.
          </p>
          <small>{goalInfo.description}</small>
        </div>
        <div>
          <button type="submit">{existingProfile ? 'Update profile' : 'Save profile'}</button>
        </div>
      </form>
      <LiabilityNotice />
    </section>
  );
}
