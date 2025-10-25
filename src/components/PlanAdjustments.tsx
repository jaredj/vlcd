import React, { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { differenceInCalendarDays, format, formatISO, parseISO } from 'date-fns';
import { useAppState } from '../lib/state';
import { ACTIVITY_LABELS } from '../lib/activity';
import type { DailyProjection, UnitSystem } from '../types';
import { formatWeight, kilogramsToPounds, poundsToKilograms } from '../utils/conversions';

interface PlanAdjustmentsProps {
  projections: DailyProjection[];
  unit: UnitSystem;
}

export default function PlanAdjustments({ projections, unit }: PlanAdjustmentsProps): JSX.Element {
  const { state, updatePlan, removePlan, recordMeasurement, removeMeasurement } = useAppState();
  const focusDays = 21;
  const [weightDraftsByUnit, setWeightDraftsByUnit] = useState<Record<UnitSystem, Record<string, string>>>(() => ({
    imperial: {},
    metric: {}
  }));
  const [fastedDraftsByUnit, setFastedDraftsByUnit] = useState<Record<UnitSystem, Record<string, boolean>>>(() => ({
    imperial: {},
    metric: {}
  }));
  const weightDrafts = weightDraftsByUnit[unit];
  const fastedDrafts = fastedDraftsByUnit[unit];
  const todayIso = formatISO(new Date(), { representation: 'date' });

  function updateWeightDraft(dateIso: string, value: string) {
    setWeightDraftsByUnit((prev) => ({
      ...prev,
      [unit]: {
        ...prev[unit],
        [dateIso]: value
      }
    }));
  }

  function clearWeightDraft(dateIso: string) {
    setWeightDraftsByUnit((prev) => {
      const nextUnitDrafts = { ...prev[unit] };
      delete nextUnitDrafts[dateIso];
      return { ...prev, [unit]: nextUnitDrafts };
    });
  }

  function updateFastedDraft(dateIso: string, value: boolean) {
    setFastedDraftsByUnit((prev) => ({
      ...prev,
      [unit]: {
        ...prev[unit],
        [dateIso]: value
      }
    }));
  }


  function rippleCalories(dateIso: string, calories: number) {
    if (!Number.isFinite(calories)) return;
    const startIndex = projections.findIndex((entry) => entry.date === dateIso);
    if (startIndex < 0) return;

    const initialPlan = state.plans[dateIso];
    const startingActivity = initialPlan?.activityLevel ?? projections[startIndex].activityLevel;
    updatePlan(dateIso, { calories, activityLevel: startingActivity }, { source: 'manual' });

    for (let i = startIndex + 1; i < projections.length; i += 1) {
      const entry = projections[i];
      const plan = state.plans[entry.date];
      if (plan?.source === 'manual') {
        break;
      }
      updatePlan(
        entry.date,
        {
          calories,
          activityLevel: plan?.activityLevel ?? entry.activityLevel
        },
        { source: 'propagated' }
      );
    }
  }

  function getWeightDisplayValue(dateIso: string): string {
    if (weightDrafts[dateIso] !== undefined) {
      return weightDrafts[dateIso];
    }
    const measurement = state.measurements[dateIso];
    if (!measurement) return '';
    const value = unit === 'imperial' ? kilogramsToPounds(measurement.weightKg) : measurement.weightKg;
    return value.toFixed(1);
  }

  function getFastedValue(dateIso: string): boolean {
    if (fastedDrafts[dateIso] !== undefined) {
      return fastedDrafts[dateIso];
    }
    return state.measurements[dateIso]?.fasted ?? true;
  }

  function commitWeight(dateIso: string) {
    const measurement = state.measurements[dateIso];
    const draft = weightDrafts[dateIso];
    const trimmed = draft?.trim() ?? '';
    const fasted = getFastedValue(dateIso);

    if (!trimmed) {
      if (measurement) {
        removeMeasurement(dateIso);
      }
      clearWeightDraft(dateIso);
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    const weightKg = unit === 'imperial' ? poundsToKilograms(parsed) : parsed;
    recordMeasurement({ date: dateIso, weightKg, fasted });
    clearWeightDraft(dateIso);
  }

  function handleFastedChange(dateIso: string, nextValue: boolean) {
    updateFastedDraft(dateIso, nextValue);
    const measurement = state.measurements[dateIso];
    const draftWeight = weightDrafts[dateIso];
    const trimmedDraft = draftWeight?.trim();
    if (measurement) {
      recordMeasurement({ date: dateIso, weightKg: measurement.weightKg, fasted: nextValue });
    } else if (trimmedDraft) {
      const parsed = Number(trimmedDraft);
      if (Number.isFinite(parsed) && parsed > 0) {
        const weightKg = unit === 'imperial' ? poundsToKilograms(parsed) : parsed;
        recordMeasurement({ date: dateIso, weightKg, fasted: nextValue });
      }
    }
  }

  function getRowStatus(dateIso: string): 'past' | 'today' | 'future' {
    const delta = differenceInCalendarDays(parseISO(dateIso), parseISO(todayIso));
    if (delta < 0) return 'past';
    if (delta === 0) return 'today';
    return 'future';
  }

  const upcoming = useMemo(() => {
    return projections.slice(0, focusDays);
  }, [focusDays, projections]);

  if (!upcoming.length) {
    return <p>Projections are not available yet.</p>;
  }

  return (
    <section>
      <h2>Daily plan adjustments</h2>
      <p>
        Fine-tune specific days by altering calories or anticipated activity. Adjustments automatically ripple into the rest of
        the model.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Calories</th>
              <th>Activity</th>
              <th>Weight</th>
              <th>Fasted?</th>
              <th>Fasted scale</th>
              <th>Refed scale</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((day) => {
              const custom = state.plans[day.date];
              const rowStatus = getRowStatus(day.date);
              const disableWeight = rowStatus === 'future';
              const weightValue = getWeightDisplayValue(day.date);
              const fasted = getFastedValue(day.date);
              const statusLabel = rowStatus === 'past' ? 'Past' : rowStatus === 'today' ? 'Today' : 'Upcoming';
              return (
                <tr key={day.date} className={`day-row status-${rowStatus}`}>
                  <td>{format(parseISO(day.date), 'MMM d')}</td>
                  <td>
                    <span className={`status-badge status-${rowStatus}`}>{statusLabel}</span>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={400}
                      max={4000}
                      step={10}
                      aria-label={`Calories for ${day.date}`}
                      value={custom?.calories ?? day.calories}
                      onChange={(event) => rippleCalories(day.date, Number(event.target.value))}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Activity for ${day.date}`}
                      value={custom?.activityLevel ?? day.activityLevel}
                      onChange={(event) =>
                        updatePlan(
                          day.date,
                          {
                            activityLevel: event.target.value as typeof day.activityLevel,
                            calories: custom?.calories ?? day.calories
                          },
                          { source: 'manual' }
                        )
                      }
                    >
                      {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step={0.1}
                      inputMode="decimal"
                      aria-label={`Weight for ${day.date}`}
                      value={weightValue}
                      disabled={disableWeight}
                      onChange={(event) => updateWeightDraft(day.date, event.target.value)}
                      onBlur={() => commitWeight(day.date)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitWeight(day.date);
                        }
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Fasted measurement for ${day.date}`}
                      checked={fasted}
                      disabled={disableWeight}
                      onChange={(event) => handleFastedChange(day.date, event.target.checked)}
                    />
                  </td>
                  <td>{formatWeight(day.fastedScaleKg, unit)}</td>
                  <td>{formatWeight(day.refedScaleKg, unit)}</td>
                  <td>
                    {custom ? (
                      <button type="button" onClick={() => removePlan(day.date)}>
                        Reset
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
