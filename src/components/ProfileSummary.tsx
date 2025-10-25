import React from 'react';
import type { JSX } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useAppState } from '../lib/state';
import ProfileSetup from './ProfileSetup';
import type { ProjectionResult } from '../lib/modeling';
import { formatWeight } from '../utils/conversions';
import ProfileForm from './ProfileForm';

interface ProfileSummaryProps {
  projection: ProjectionResult;
}

export default function ProfileSummary({ projection }: ProfileSummaryProps): JSX.Element {
  const { state, reset, setProfile } = useAppState();
  const profile = state.profile;

  if (!profile) {
    return <ProfileSetup />;
  }

  const unit = profile.unitSystem;
  const today = format(new Date(), 'MMM d, yyyy');
  const latestEntry = projection.projections.find((item) => item.date === format(new Date(), 'yyyy-MM-dd')) ??
    projection.projections[projection.projections.length - 1];
  const progressDenominator = projection.startRefedKg - projection.targetWeightKg;
  const progressNumerator = projection.startRefedKg - (latestEntry?.refedScaleKg ?? projection.startRefedKg);
  const progressPercentage =
    progressDenominator > 0 ? Math.min(100, Math.max(0, (progressNumerator / progressDenominator) * 100)) : 0;
  const targetDayDelta = projection.targetDate
    ? differenceInCalendarDays(parseISO(projection.targetDate), new Date())
    : null;

  return (
    <>
      <section>
        <h2>Your plan overview</h2>
        <p>
          Started on {format(parseISO(profile.startDate), 'MMM d, yyyy')} — today is {today}. Progress towards goal: {progressPercentage.toFixed(1)}%.
        </p>
        <div className="grid two-columns">
          <div>
            <h3>Weights</h3>
            <p>Starting: {formatWeight(projection.startRefedKg, unit)}</p>
            <p>
              Today (fasted): {latestEntry ? formatWeight(latestEntry.fastedScaleKg, unit) : '—'}
              <br />Today (refed): {latestEntry ? formatWeight(latestEntry.refedScaleKg, unit) : '—'}
            </p>
            <p>Target: {formatWeight(projection.targetWeightKg, unit)}</p>
          </div>
          <div>
            <h3>Timeline</h3>
            {projection.targetDate ? (
              <p>
                Estimated target arrival: {format(parseISO(projection.targetDate), 'MMM d, yyyy')} (
                {targetDayDelta !== null
                  ? targetDayDelta > 0
                    ? `${targetDayDelta} days`
                    : 'already achieved'
                  : '—'}
                ).
              </p>
            ) : (
              <p>No predicted date yet — adjust calories or activity to drive further change.</p>
            )}
            <p style={{ marginTop: '0.75rem' }}>
              Tune your baseline assumptions directly below to see an updated projection without leaving this dashboard.
            </p>
          </div>
        </div>
      </section>
      <section>
        <h2>Adjust your baseline inputs</h2>
        <p>Update any of the original profile values from right here. Changes save immediately when you submit the form.</p>
        <ProfileForm profile={profile} onSubmit={setProfile} submitLabel="Save profile changes" />
        <div style={{ marginTop: '0.75rem' }}>
          <button type="button" style={{ background: '#ef4444' }} onClick={() => reset()}>
            Reset everything
          </button>
        </div>
      </section>
    </>
  );
}
