import React, { useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { format, parseISO, isBefore, isSameDay, startOfDay } from 'date-fns';
import { useAppState } from '../lib/state';
import { ACTIVITY_LABELS } from '../lib/activity';
import type { DailyProjection, UnitSystem } from '../types';
import { formatWeight, kilogramsToPounds, poundsToKilograms } from '../utils/conversions';

interface PlanAdjustmentsProps {
  projections: DailyProjection[];
  unit: UnitSystem;
}

type EditableField = 'calories' | 'fasted' | 'refed';

interface DayStatusInfo {
  status: 'past' | 'today' | 'future';
  label: string;
}

function convertKgToUnit(weightKg: number, unit: UnitSystem): number {
  return unit === 'imperial'
    ? parseFloat(kilogramsToPounds(weightKg).toFixed(1))
    : parseFloat(weightKg.toFixed(1));
}

function convertUnitToKg(value: number, unit: UnitSystem): number {
  return unit === 'imperial' ? poundsToKilograms(value) : value;
}

export default function PlanAdjustments({ projections, unit }: PlanAdjustmentsProps): JSX.Element {
  const { state, updatePlan, removePlan, recordMeasurement, removeMeasurement } = useAppState();
  const [focusDays] = useState(21);
  const [editing, setEditing] = useState<{ date: string; field: EditableField } | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const cancelEditRef = useRef(false);

  const todayStart = useMemo(() => startOfDay(new Date()), []);

  const projectionsByDate = useMemo(() => {
    return new Map(projections.map((day) => [day.date, day] as const));
  }, [projections]);

  const previouslyEditedDates = useMemo(() => new Set(Object.keys(state.plans)), [state.plans]);

  const upcoming = useMemo(() => {
    return projections.slice(0, focusDays);
  }, [focusDays, projections]);

  if (!upcoming.length) {
    return <p>Projections are not available yet.</p>;
  }

  function getDayStatus(dateIso: string): DayStatusInfo {
    const date = parseISO(dateIso);
    if (isSameDay(date, todayStart)) {
      return { status: 'today', label: 'Today' };
    }
    if (isBefore(date, todayStart)) {
      return { status: 'past', label: 'Past' };
    }
    return { status: 'future', label: 'Upcoming' };
  }

  function getWeightKg(day: DailyProjection, field: Extract<EditableField, 'fasted' | 'refed'>): number {
    const measurement = state.measurements[day.date];
    if (measurement) {
      if (measurement.fasted && field === 'fasted') {
        return measurement.weightKg;
      }
      if (!measurement.fasted && field === 'refed') {
        return measurement.weightKg;
      }
    }
    return field === 'fasted' ? day.fastedScaleKg : day.refedScaleKg;
  }

  function getWeightSourceLabel(day: DailyProjection, field: Extract<EditableField, 'fasted' | 'refed'>): string {
    const measurement = state.measurements[day.date];
    if (!measurement) {
      return 'modeled';
    }
    return measurement.fasted === (field === 'fasted') ? 'logged' : 'modeled';
  }

  function beginEditing(day: DailyProjection, field: EditableField) {
    cancelEditRef.current = false;
    setEditing({ date: day.date, field });
    if (field === 'calories') {
      const plan = state.plans[day.date];
      const value = plan?.calories ?? day.calories;
      setDraftValue(String(value));
      return;
    }
    const weightKg = getWeightKg(day, field);
    setDraftValue(String(convertKgToUnit(weightKg, unit)));
  }

  function cancelEditing() {
    cancelEditRef.current = true;
    setEditing(null);
  }

  function rippleCalories(dateIso: string, calories: number) {
    const baseline = projectionsByDate.get(dateIso);
    if (!baseline) {
      return;
    }
    const activityLevel = state.plans[dateIso]?.activityLevel ?? baseline.activityLevel;
    updatePlan(dateIso, { calories, activityLevel });

    const startIndex = projections.findIndex((projection) => projection.date === dateIso);
    if (startIndex === -1) {
      return;
    }

    for (let index = startIndex + 1; index < projections.length; index += 1) {
      const futureDay = projections[index];
      if (previouslyEditedDates.has(futureDay.date)) {
        continue;
      }
      const futureActivity = state.plans[futureDay.date]?.activityLevel ?? futureDay.activityLevel;
      updatePlan(futureDay.date, { calories, activityLevel: futureActivity });
    }
  }

  function commitEditing() {
    if (!editing) {
      return;
    }
    cancelEditRef.current = false;
    const value = draftValue.trim();
    const day = projectionsByDate.get(editing.date);
    if (!day) {
      setEditing(null);
      return;
    }

    if (editing.field === 'calories') {
      if (value === '') {
        setEditing(null);
        return;
      }
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        const clamped = Math.max(400, Math.min(4000, Math.round(parsed)));
        rippleCalories(editing.date, clamped);
      }
      setEditing(null);
      return;
    }

    if (value === '') {
      removeMeasurement(editing.date);
      setEditing(null);
      return;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const weightKg = convertUnitToKg(parsed, unit);
      recordMeasurement({
        date: editing.date,
        weightKg: parseFloat(weightKg.toFixed(3)),
        fasted: editing.field === 'fasted'
      });
    }
    setEditing(null);
  }

  function handleInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      cancelEditRef.current = false;
      commitEditing();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
    }
  }

  function handleInputBlur() {
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }
    commitEditing();
  }

  return (
    <section>
      <h2>Daily plan adjustments</h2>
      <p>
        Fine-tune specific days by altering calories, activity, or recorded weights. Click a value to edit it. Calorie changes
        apply to the selected day and future unedited days, while weight updates are limited to today or the past.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Calories</th>
              <th>Activity</th>
              <th>Fasted scale</th>
              <th>Refed scale</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((day) => {
              const plan = state.plans[day.date];
              const measurement = state.measurements[day.date];
              const status = getDayStatus(day.date);
              const isFuture = status.status === 'future';
              const isEditingCalories = editing?.date === day.date && editing.field === 'calories';
              const isEditingFasted = editing?.date === day.date && editing.field === 'fasted';
              const isEditingRefed = editing?.date === day.date && editing.field === 'refed';
              const fastedKg = getWeightKg(day, 'fasted');
              const refedKg = getWeightKg(day, 'refed');
              const fastedSource = getWeightSourceLabel(day, 'fasted');
              const refedSource = getWeightSourceLabel(day, 'refed');

              return (
                <tr key={day.date} className={`day-row day-${status.status}`}>
                  <td>
                    <div className="date-cell">
                      <span>{format(parseISO(day.date), 'MMM d')}</span>
                      <span className={`status-pill status-pill-${status.status}`}>{status.label}</span>
                    </div>
                  </td>
                  <td>
                    <div className="value-cell">
                      {isEditingCalories ? (
                        <input
                          type="number"
                          min={400}
                          max={4000}
                          step={10}
                          autoFocus
                          aria-label={`Calories for ${day.date}`}
                          className="inline-input"
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          onBlur={handleInputBlur}
                          onKeyDown={handleInputKey}
                        />
                      ) : (
                        <button
                          type="button"
                          className="value-button"
                          aria-label={`Edit calories for ${day.date}`}
                          onClick={() => beginEditing(day, 'calories')}
                        >
                          <span className="value-primary">{(plan?.calories ?? day.calories).toLocaleString()} kcal</span>
                          {plan?.calories !== undefined ? <span className="value-meta">custom</span> : null}
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <select
                      aria-label={`Activity for ${day.date}`}
                      value={plan?.activityLevel ?? day.activityLevel}
                      onChange={(event) =>
                        updatePlan(day.date, {
                          activityLevel: event.target.value as typeof day.activityLevel,
                          calories: plan?.calories ?? day.calories
                        })
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
                    <div className="value-cell">
                      {isEditingFasted ? (
                        <input
                          type="number"
                          min={unit === 'imperial' ? 60 : 30}
                          max={unit === 'imperial' ? 700 : 320}
                          step={0.1}
                          autoFocus
                          aria-label={`Fasted weight for ${day.date}`}
                          className="inline-input"
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          onBlur={handleInputBlur}
                          onKeyDown={handleInputKey}
                        />
                      ) : (
                        <button
                          type="button"
                          className="value-button"
                          aria-label={`Edit fasted weight for ${day.date}`}
                          onClick={() => (!isFuture ? beginEditing(day, 'fasted') : undefined)}
                          disabled={isFuture}
                        >
                          <span className="value-primary">{formatWeight(fastedKg, unit)}</span>
                          <span className="value-meta">{fastedSource}</span>
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="value-cell">
                      {isEditingRefed ? (
                        <input
                          type="number"
                          min={unit === 'imperial' ? 60 : 30}
                          max={unit === 'imperial' ? 700 : 320}
                          step={0.1}
                          autoFocus
                          aria-label={`Refed weight for ${day.date}`}
                          className="inline-input"
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          onBlur={handleInputBlur}
                          onKeyDown={handleInputKey}
                        />
                      ) : (
                        <button
                          type="button"
                          className="value-button"
                          aria-label={`Edit refed weight for ${day.date}`}
                          onClick={() => (!isFuture ? beginEditing(day, 'refed') : undefined)}
                          disabled={isFuture}
                        >
                          <span className="value-primary">{formatWeight(refedKg, unit)}</span>
                          <span className="value-meta">{refedSource}</span>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    {plan ? (
                      <button type="button" className="secondary" onClick={() => removePlan(day.date)}>
                        Reset plan
                      </button>
                    ) : null}
                    {measurement ? (
                      <button type="button" className="ghost" onClick={() => removeMeasurement(day.date)}>
                        Clear weight
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
