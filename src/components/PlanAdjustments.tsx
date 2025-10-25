import React, { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { format, parseISO } from 'date-fns';
import { useAppState } from '../lib/state';
import { ACTIVITY_LABELS } from '../lib/activity';
import type { DailyProjection, UnitSystem } from '../types';
import { formatWeight } from '../utils/conversions';

interface PlanAdjustmentsProps {
  projections: DailyProjection[];
  unit: UnitSystem;
}

export default function PlanAdjustments({ projections, unit }: PlanAdjustmentsProps): JSX.Element {
  const { state, updatePlan, removePlan } = useAppState();
  const [focusDays] = useState(21);

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
              <th>Calories</th>
              <th>Activity</th>
              <th>Fasted scale</th>
              <th>Refed scale</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((day) => {
              const custom = state.plans[day.date];
              return (
                <tr key={day.date}>
                  <td>{format(parseISO(day.date), 'MMM d')}</td>
                  <td>
                    <input
                      type="number"
                      min={400}
                      max={4000}
                      step={10}
                      aria-label={`Calories for ${day.date}`}
                      value={custom?.calories ?? day.calories}
                      onChange={(event) =>
                        updatePlan(day.date, { calories: Number(event.target.value), activityLevel: day.activityLevel })
                      }
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Activity for ${day.date}`}
                      value={custom?.activityLevel ?? day.activityLevel}
                      onChange={(event) =>
                        updatePlan(day.date, {
                          activityLevel: event.target.value as typeof day.activityLevel,
                          calories: custom?.calories ?? day.calories
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
