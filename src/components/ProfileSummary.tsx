import React from 'react';
import type { JSX } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useAppState } from '../lib/state';
import type { ProjectionResult } from '../lib/modeling';
import { formatWeight } from '../utils/conversions';
import { usePulseOnChange } from '../hooks/usePulseOnChange';

interface ProfileSummaryProps {
  projection: ProjectionResult;
  onEditBaseline?: () => void;
  baselineCollapsed?: boolean;
}

export default function ProfileSummary({
  projection,
  onEditBaseline,
  baselineCollapsed
}: ProfileSummaryProps): JSX.Element | null {
  const { state } = useAppState();
  const profile = state.profile;
  const today = new Date();
  const unit = profile?.unitSystem ?? 'imperial';
  const startDateValue = profile ? parseISO(profile.startDate) : today;
  const todayLabel = format(today, 'MMM d, yyyy');
  const formattedStart = format(startDateValue, 'MMM d, yyyy');
  const targetWeightLabel = formatWeight(projection.targetWeightKg, unit);
  const startWeightLabel = formatWeight(projection.startRefedKg, unit);
  const targetDateValue = projection.targetDate ? parseISO(projection.targetDate) : null;
  const formattedTargetDate = targetDateValue ? format(targetDateValue, 'MMM d, yyyy') : null;

  const timeline = (() => {
    const rawElapsedDays = differenceInCalendarDays(today, startDateValue);
    const elapsedDays = Math.max(0, rawElapsedDays);
    const daysUntilStart = rawElapsedDays < 0 ? Math.abs(rawElapsedDays) : 0;
    const totalDays = targetDateValue ? Math.max(1, differenceInCalendarDays(targetDateValue, startDateValue)) : null;
    const progressPercent = totalDays ? (elapsedDays / totalDays) * 100 : 0;
    const clampedPercent = Math.max(0, Math.min(100, progressPercent));
    const daysRemaining = targetDateValue ? differenceInCalendarDays(targetDateValue, today) : null;

    let arrivalStatus: string;
    if (!targetDateValue) {
      arrivalStatus = 'Timeline will update as soon as the model can predict a finish date.';
    } else if (daysRemaining !== null && daysRemaining > 0) {
      arrivalStatus = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
    } else if (daysRemaining === 0) {
      arrivalStatus = 'Projected finish is today.';
    } else if (daysRemaining !== null) {
      const overdue = Math.abs(daysRemaining);
      arrivalStatus = `${overdue} day${overdue === 1 ? '' : 's'} beyond the projection.`;
    } else {
      /* istanbul ignore next -- fallback branch for invalid dates */
      arrivalStatus = '';
    }

    let progressStatus: string;
    if (totalDays === null) {
      progressStatus = 'Timeline projection will appear once a goal date is known.';
    } else if (rawElapsedDays < 0) {
      progressStatus = `Plan begins in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}.`;
    } else if (elapsedDays <= totalDays) {
      const remaining = Math.max(0, totalDays - elapsedDays);
      progressStatus = `${Math.round(progressPercent)}% of the planned timeline completed — ${remaining} day${remaining === 1 ? '' : 's'} remaining.`;
    } else {
      const overdue = elapsedDays - totalDays;
      progressStatus = `The planned timeline passed ${overdue} day${overdue === 1 ? '' : 's'} ago.`;
    }

    const progressBadge = totalDays === null ? '—' : progressPercent >= 100 ? '100%+' : `${Math.round(progressPercent)}%`;

    return {
      clampedPercent,
      progressBadge,
      arrivalStatus,
      progressStatus
    };
  })();

  const startWeightPulse = usePulseOnChange(startWeightLabel);
  const weightPulse = usePulseOnChange(targetWeightLabel);
  const arrivalPulse = usePulseOnChange(`${formattedTargetDate ?? 'pending'}-${timeline.arrivalStatus}`);
  const progressPulse = usePulseOnChange(`${timeline.progressBadge}-${timeline.clampedPercent}`);
  const baselineIsCollapsed = baselineCollapsed ?? true;

  if (!profile) {
    return null;
  }

  return (
    <section>
      <p className="overview-intro">
        Started {formattedStart} — today is {todayLabel}. You&apos;re aiming for <strong>{targetWeightLabel}</strong>
        {formattedTargetDate ? (
          <> by <strong>{formattedTargetDate}</strong>.</>
        ) : (
          <> once the model locks onto a target date.</>
        )}
      </p>
      <div className="highlight-grid">
        <div className={`highlight-card highlight-card--interactive ${startWeightPulse ? 'pulse-highlight' : ''}`}>
          <div className="highlight-card-header">
            <h3>Starting weight</h3>
            <button
              type="button"
              className="icon-button"
              onClick={() => onEditBaseline?.()}
              aria-label="Edit starting setup"
              aria-pressed={!baselineIsCollapsed}
            >
              ✎
            </button>
          </div>
          <p className="highlight-value">{startWeightLabel}</p>
          <p className="highlight-subtext">Set {formattedStart}</p>
        </div>
        <div className={`highlight-card ${weightPulse ? 'pulse-highlight' : ''}`}>
          <h3>Target weight</h3>
          <p className="highlight-value">{targetWeightLabel}</p>
          <p className="highlight-subtext">Starting from {startWeightLabel}</p>
        </div>
        <div className={`highlight-card ${arrivalPulse ? 'pulse-highlight' : ''}`}>
          <h3>Estimated arrival</h3>
          <p className="highlight-value">{formattedTargetDate ?? 'Pending projection'}</p>
          <p className="highlight-subtext">{timeline.arrivalStatus}</p>
        </div>
      </div>
      <div className={`progress-card ${progressPulse ? 'pulse-highlight' : ''}`}>
        <div className="progress-card-header">
          <h3>Progress along the plan</h3>
          <span className="progress-badge">{timeline.progressBadge}</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={timeline.clampedPercent}
          aria-label="Timeline progress toward target date"
        >
          <div className="progress-fill" style={{ width: `${timeline.clampedPercent}%` }} />
        </div>
        <p className="progress-status">{timeline.progressStatus}</p>
      </div>
    </section>
  );
}
