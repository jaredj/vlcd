import React, { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { formatISO } from 'date-fns';
import { useAppState } from '../lib/state';
import type { UnitSystem } from '../types';
import { formatWeight, kilogramsToPounds, poundsToKilograms } from '../utils/conversions';

interface MeasurementFormProps {
  unit: UnitSystem;
}

export default function MeasurementForm({ unit }: MeasurementFormProps): JSX.Element {
  const { recordMeasurement, removeMeasurement, state } = useAppState();
  const [date, setDate] = useState<string>(formatISO(new Date(), { representation: 'date' }));
  const [weight, setWeight] = useState<number>(() =>
    unit === 'imperial'
      ? Math.round(kilogramsToPounds(state.profile?.startWeightKg ?? 0))
      : Math.round(state.profile?.startWeightKg ?? 0)
  );
  const [fasted, setFasted] = useState<boolean>(true);
  const todayIso = formatISO(new Date(), { representation: 'date' });

  const records = useMemo(() => Object.values(state.measurements).sort((a, b) => a.date.localeCompare(b.date)), [state.measurements]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weightKg = unit === 'imperial' ? poundsToKilograms(weight) : weight;
    recordMeasurement({ date, weightKg, fasted });
  }

  return (
    <section>
      <h2>Track your weigh-ins</h2>
      <p>Record the scale weight for any past or current day. Mark if it was taken while fasted.</p>
      <form onSubmit={handleSubmit} className="grid two-columns">
        <label>
          Date
          <input
            type="date"
            max={todayIso}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <label>
          Weight ({unit === 'imperial' ? 'lb' : 'kg'})
          <input type="number" step="0.1" value={weight} onChange={(event) => setWeight(Number(event.target.value))} required />
        </label>
        <label>
          <input type="checkbox" checked={fasted} onChange={(event) => setFasted(event.target.checked)} /> Fasted measurement
        </label>
        <div>
          <button type="submit">Save measurement</button>
        </div>
      </form>
      {records.length ? (
        <div className="table-wrapper" style={{ marginTop: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight</th>
                <th>Fasted?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((entry) => (
                <tr key={entry.date}>
                  <td>{entry.date}</td>
                  <td>{formatWeight(entry.weightKg, unit)}</td>
                  <td>{entry.fasted ? 'Yes' : 'No'}</td>
                  <td>
                    <button type="button" onClick={() => removeMeasurement(entry.date)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No measurements added yet.</p>
      )}
    </section>
  );
}
