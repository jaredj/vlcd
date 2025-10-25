import React, { useMemo } from 'react';
import type { JSX } from 'react';
import { formatISO } from 'date-fns';
import { useAppState } from '../lib/state';
import { generateProjections } from '../lib/modeling';
import ProfileSummary from './ProfileSummary';
import ProjectionChart from './ProjectionChart';
import PlanAdjustments from './PlanAdjustments';
import MeasurementForm from './MeasurementForm';
import MethodologyDetails from './MethodologyDetails';
import { formatWeight } from '../utils/conversions';
import ProfileForm from './ProfileForm';
import LiabilityNotice from './LiabilityNotice';

export default function Dashboard(): JSX.Element {
  const { state, setProfile, reset } = useAppState();
  const projection = useMemo(() => generateProjections(state, 420), [state]);
  const profile = state.profile;
  const unit = profile?.unitSystem ?? 'imperial';
  const todayIso = formatISO(new Date(), { representation: 'date' });
  const todayEntry = projection.projections.find((entry) => entry.date === todayIso) ?? projection.projections[0];

  return (
    <main>
      <h1>Very-Low-Calorie Diet Progress Lab</h1>
      <section>
        <h2>Baseline inputs</h2>
        <ProfileForm profile={profile} onSubmit={setProfile} submitLabel="Save baseline inputs" />
        <LiabilityNotice />
        {profile ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" style={{ background: '#ef4444' }} onClick={() => reset()}>
              Reset everything
            </button>
          </div>
        ) : null}
      </section>
      {profile ? <ProfileSummary projection={projection} /> : null}
      {profile ? (
        <section>
          <h2>Energy balance snapshot</h2>
          {todayEntry ? (
            <div className="grid two-columns">
              <div>
                <p className="badge">Today&apos;s plan</p>
                <p>Calories planned: {todayEntry.calories.toLocaleString()} kcal</p>
                <p>Total expenditure: {Math.round(todayEntry.tee).toLocaleString()} kcal</p>
                <p>
                  Expected deficit: {Math.round(todayEntry.deficit).toLocaleString()} kcal ({
                    todayEntry.deficit > 0 ? 'loss' : 'gain'
                  })
                </p>
              </div>
              <div>
                <p className="badge">Projected weights</p>
                <p>Fasted scale: {formatWeight(todayEntry.fastedScaleKg, unit)}</p>
                <p>Refed scale: {formatWeight(todayEntry.refedScaleKg, unit)}</p>
              </div>
            </div>
          ) : (
            <p>No daily entry available yet.</p>
          )}
        </section>
      ) : null}
      {profile ? (
        <section>
          <h2>Trajectory</h2>
          <ProjectionChart data={projection.projections} unit={unit} />
        </section>
      ) : null}
      {profile ? <PlanAdjustments projections={projection.projections} unit={unit} /> : null}
      {profile ? <MeasurementForm key={`${unit}-${Math.round(profile.startWeightKg)}`} unit={unit} /> : null}
      <MethodologyDetails />
    </main>
  );
}
