import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { getGoalInfo, GOALS } from '../lib/goals';
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

const DEFAULT_START_WEIGHT_LB = 265;
const DEFAULT_HEIGHT_FEET = 5;
const DEFAULT_HEIGHT_INCHES = 10.5;
const DEFAULT_HEIGHT_CM = feetInchesToCentimeters(DEFAULT_HEIGHT_FEET, DEFAULT_HEIGHT_INCHES);
const DEFAULT_CALORIES = 800;
const DEFAULT_AGE = 44;
const DEFAULT_GOAL: FitnessGoal = 'alpinist-ready';
const DEFAULT_START_DATE = '2025-10-17';

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

export interface ProfileFormProps {
  profile: Profile | null;
  onSubmit: (profile: Profile) => void;
  submitLabel: string;
  onAfterSubmit?: () => void;
  autoSubmit?: boolean;
  baselineCollapsed?: boolean;
  onBaselineCollapsedChange?: (collapsed: boolean) => void;
}

function createInitialState(profile: Profile | null): FormState {
  if (profile) {
    const heightFeetInches = centimetersToFeetInches(profile.heightCm);
    return {
      unitSystem: profile.unitSystem,
      startDate: profile.startDate,
      startWeight: profile.unitSystem === 'imperial' ? kilogramsToPounds(profile.startWeightKg) : profile.startWeightKg,
      heightFeet: heightFeetInches.feet,
      heightInches: parseFloat(heightFeetInches.inches.toFixed(2)),
      heightCm: profile.heightCm,
      age: profile.age,
      sex: profile.sex,
      goal: profile.goal,
      defaultCalories: profile.defaultCalories,
      defaultActivityLevel: profile.defaultActivityLevel
    };
  }

  return {
    unitSystem: 'imperial',
    startDate: DEFAULT_START_DATE,
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
}

const CALORIE_WARNING_DISMISSED_KEY = 'vlcd-calorie-warning-dismissed';

export default function ProfileForm({
  profile,
  onSubmit,
  submitLabel,
  onAfterSubmit,
  autoSubmit = false,
  baselineCollapsed,
  onBaselineCollapsedChange
}: ProfileFormProps): JSX.Element {
  const [form, setForm] = useState<FormState>(() => createInitialState(profile));
  const lastSubmitted = useRef<string | null>(null);
  const [warningDismissed, setWarningDismissed] = useState<boolean>(() => {
    /* istanbul ignore next -- server environments do not provide window */
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(CALORIE_WARNING_DISMISSED_KEY) === 'true';
  });

  useEffect(() => {
    startTransition(() => {
      setForm(createInitialState(profile));
    });
    lastSubmitted.current = null;
  }, [profile]);

  useEffect(() => {
    /* istanbul ignore next -- not executed during server-side rendering */
    if (typeof window === 'undefined') {
      return;
    }
    if (warningDismissed) {
      window.localStorage.setItem(CALORIE_WARNING_DISMISSED_KEY, 'true');
    } else {
      window.localStorage.removeItem(CALORIE_WARNING_DISMISSED_KEY);
    }
  }, [warningDismissed]);

  const { heightCm, weightKg } = useMemo(() => {
    const nextHeightCm =
      form.unitSystem === 'imperial' ? feetInchesToCentimeters(form.heightFeet, form.heightInches) : form.heightCm;
    const nextWeightKg = form.unitSystem === 'imperial' ? poundsToKilograms(form.startWeight) : form.startWeight;

    return { heightCm: nextHeightCm, weightKg: nextWeightKg };
  }, [form.heightCm, form.heightFeet, form.heightInches, form.startWeight, form.unitSystem]);

  const normalizedProfile: Profile = useMemo(
    () => ({
      unitSystem: form.unitSystem,
      startDate: form.startDate,
      startWeightKg: weightKg,
      heightCm,
      age: form.age,
      sex: form.sex,
      goal: form.goal,
      defaultCalories: form.defaultCalories,
      defaultActivityLevel: form.defaultActivityLevel
    }),
    [form.age, form.defaultActivityLevel, form.defaultCalories, form.goal, form.sex, form.startDate, form.unitSystem, heightCm, weightKg]
  );

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
  const canAutoSubmit =
    Boolean(form.startDate) &&
    weightKg > 0 &&
    heightCm > 0 &&
    form.age >= 18 &&
    form.defaultCalories > 0;

  useEffect(() => {
    if (!autoSubmit || !canAutoSubmit) {
      return;
    }
    const serialized = JSON.stringify(normalizedProfile);
    if (lastSubmitted.current === serialized) {
      return;
    }
    onSubmit(normalizedProfile);
    lastSubmitted.current = serialized;
  }, [autoSubmit, canAutoSubmit, normalizedProfile, onSubmit]);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(normalizedProfile);
    onAfterSubmit?.();
  }

  const calorieInputDescriptionIds = useMemo(() => {
    const ids = ['calorie-safety-note'];
    if (isBelowMinimum) {
      ids.push(warningDismissed ? 'calorie-warning-tooltip' : 'calorie-warning-panel');
    }
    return ids.join(' ');
  }, [isBelowMinimum, warningDismissed]);

  const baselineIsCollapsed = baselineCollapsed ?? false;
  const detailsProps = baselineCollapsed === undefined ? {} : { open: !baselineIsCollapsed };

  return (
    <form onSubmit={handleSubmit} className="profile-form">
      <details
        className="collapsible"
        {...detailsProps}
        onToggle={(event) => onBaselineCollapsedChange?.(!event.currentTarget.open)}
      >
        <summary>Units &amp; body details</summary>
        <div className="collapsible-content">
          <div className="grid two-columns">
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
              <input
                type="number"
                min={18}
                max={90}
                value={form.age}
                onChange={(event) => updateField('age', Number(event.target.value))}
                required
              />
            </label>
            <label>
              Sex assigned at birth
              <select value={form.sex} onChange={(event) => updateField('sex', event.target.value as Sex)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="nonbinary">Non-binary / intersex</option>
              </select>
            </label>
          </div>
        </div>
      </details>
      <div className="grid two-columns">
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
          <div className="calorie-input-row">
            <input
              type="number"
              min={0}
              max={2500}
              step="10"
              value={form.defaultCalories}
              onChange={(event) => updateField('defaultCalories', Number(event.target.value))}
              required
              aria-describedby={calorieInputDescriptionIds}
            />
            {isBelowMinimum && warningDismissed ? (
              <span
                id="calorie-warning-tooltip"
                className="calorie-warning-tooltip"
                role="tooltip"
                tabIndex={0}
                aria-label="Medical supervision required for plans below your recommended minimum calories."
                data-tooltip="Medical supervision required below this minimum."
              >
                ⚠
              </span>
            ) : null}
          </div>
        </label>
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
            Target for the <strong>{goalInfo.label}</strong> goal: {goalInfo.targetBmi.toFixed(1)} BMI — approximately {formatWeight(goalWeightKg, form.unitSystem)}.
          </p>
          <small>{goalInfo.description}</small>
        </div>
      </div>
      <div className="notice" role="note" id="calorie-safety-note">
        <p>
          Recommended minimum based on your profile: <strong>{minimumSafeCalories.toLocaleString()} kcal/day</strong>.
        </p>
        <p>Only consider going below this threshold with strict and constant medical supervision.</p>
        {isBelowMinimum && !warningDismissed ? (
          <div id="calorie-warning-panel" className="calorie-warning-panel">
            <p>
              <strong>Medical supervision required:</strong> Plans below this level must only be pursued under strict and constant medical supervision.
            </p>
            <button type="button" className="dismiss-warning-button" onClick={() => setWarningDismissed(true)}>
              Dismiss warning
            </button>
          </div>
        ) : null}
      </div>
      {!autoSubmit && (
        <div className="form-actions">
          <button type="submit">{submitLabel}</button>
        </div>
      )}
    </form>
  );
}
