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
import ProfileInputsPanel from './ProfileInputsPanel';

export default function Dashboard(): JSX.Element {
  const { state } = useAppState();
  const projection = useMemo(() => generateProjections(state, 420), [state]);
  const unit = state.profile?.unitSystem;
  const todayIso = formatISO(new Date(), { representation: 'date' });
  const todayEntry = projection.projections.find((entry) => entry.date === todayIso) ?? projection.projections[0];

  return (
    <main>
      <h1>Very-Low-Calorie Diet Progress Lab</h1>
      <ProfileInputsPanel />
      {unit ? (
        <>
          <ProfileSummary projection={projection} />
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
          <section>
            <h2>Trajectory</h2>
            <ProjectionChart data={projection.projections} unit={unit} />
          </section>
          <PlanAdjustments projections={projection.projections} unit={unit} />
          <MeasurementForm key={`${unit}-${Math.round(state.profile.startWeightKg)}`} unit={unit} />
        </>
      ) : (
        <section>
          <p>Enter your baseline data above to generate a projection.</p>
        </section>
      )}
      <MethodologyDetails />
    </main>
  );
}
