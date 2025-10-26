import React, { useEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useAppState } from '../lib/state';
import { ACTIVITY_LABELS } from '../lib/activity';
import type { DailyProjection, UnitSystem } from '../types';
import { formatWeight } from '../utils/conversions';
import { calculateMinimumSafeCalories } from '../utils/calorieSafety';
import LiabilityNotice from './LiabilityNotice';

interface PlanAdjustmentsProps {
  projections: DailyProjection[];
  unit: UnitSystem;
}

export default function PlanAdjustments({ projections, unit }: PlanAdjustmentsProps): JSX.Element {
  const { state, updatePlan, removePlan } = useAppState();

  const upcoming = useMemo(() => {
    return projections;
  }, [projections]);

  const profile = state.profile;
  const minimumSafeCalories = useMemo(() => {
    if (!profile) {
      return null;
    }
    return calculateMinimumSafeCalories({
      weightKg: profile.startWeightKg,
      heightCm: profile.heightCm,
      age: profile.age,
      sex: profile.sex
    });
  }, [profile]);

  const belowMinimumDates = useMemo(() => {
    if (!minimumSafeCalories) {
      return [] as string[];
    }
    return upcoming
      .map((day) => {
        const custom = state.plans[day.date];
        const calories = custom?.calories ?? day.calories;
        return calories < minimumSafeCalories ? day.date : null;
      })
      .filter((date): date is string => Boolean(date));
  }, [minimumSafeCalories, upcoming, state.plans]);

  const todayRowRef = useRef<HTMLTableRowElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const hasScrolledToToday = useRef(false);

  useEffect(() => {
    if (hasScrolledToToday.current) {
      return;
    }

    const sectionElement = sectionRef.current;
    if (!sectionElement) {
      return;
    }

    const scrollToToday = () => {
      const element = todayRowRef.current;
      if (!element || typeof element.scrollIntoView !== 'function') {
        return;
      }
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasScrolledToToday.current = true;
    };

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      scrollToToday();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasScrolledToToday.current) {
          scrollToToday();
        }
      });
    },
    {
      threshold: 0.1
    });

    observer.observe(sectionElement);

    return () => {
      observer.disconnect();
    };
  }, [upcoming]);

  if (!upcoming.length) {
    return <p>Projections are not available yet.</p>;
  }

  const today = new Date();

  return (
    <section ref={sectionRef}>
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
              const dayDate = parseISO(day.date);
              const delta = differenceInCalendarDays(dayDate, today);
              const rowClassName =
                delta < 0 ? 'plan-row plan-row-past' : delta === 0 ? 'plan-row plan-row-today' : 'plan-row plan-row-future';
              return (
                <tr
                  key={day.date}
                  className={rowClassName}
                  ref={delta === 0 ? todayRowRef : undefined}
                  aria-current={delta === 0 ? 'date' : undefined}
                >
                  <td>{format(parseISO(day.date), 'MMM d')}</td>
                  <td>
                    <input
                      type="number"
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
      {minimumSafeCalories ? (
        <div className="notice" role="note">
          <p>
            Recommended minimum based on your profile: <strong>{minimumSafeCalories.toLocaleString()} kcal/day</strong>.
          </p>
          {belowMinimumDates.length ? (
            <p>
              <strong>Medical supervision required:</strong> One or more planned days fall below this level. Such
              protocols must only occur under strict and constant medical supervision.
            </p>
          ) : (
            <p>Targets below this threshold must only be undertaken under strict and constant medical supervision.</p>
          )}
        </div>
      ) : null}
      <LiabilityNotice />
    </section>
  );
}
