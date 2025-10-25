import React from 'react';
import type { JSX } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { DailyProjection, UnitSystem } from '../types';
import { POUNDS_PER_KILOGRAM, formatWeight, kilogramsToPounds } from '../utils/conversions';

interface ProjectionChartProps {
  data: DailyProjection[];
  unit: UnitSystem;
}

function convertWeight(valueKg: number, unit: UnitSystem): number {
  return unit === 'imperial' ? kilogramsToPounds(valueKg) : valueKg;
}

function tickFormatter(value: number, unit: UnitSystem): string {
  const suffix = unit === 'imperial' ? 'lb' : 'kg';
  return `${value.toFixed(0)} ${suffix}`;
}

const tooltipFormatter = (unit: UnitSystem) =>
  (value: number | string, name: string): [string, string] => {
    if (typeof value !== 'number') {
      return [String(value), name];
    }
    const kgValue = unit === 'imperial' ? value / POUNDS_PER_KILOGRAM : value;
    return [formatWeight(kgValue, unit, 1), name];
  };

export default function ProjectionChart({ data, unit }: ProjectionChartProps): JSX.Element {
  if (!data.length) {
    return <p>No projection data yet. Add your profile to begin modelling.</p>;
  }

  const chartData = data.map((entry) => ({
    ...entry,
    fastedScale: convertWeight(entry.fastedScaleKg, unit),
    refedScale: convertWeight(entry.refedScaleKg, unit),
    measurement: entry.isMeasurement ? convertWeight(entry.measurementKg ?? entry.refedScaleKg, unit) : null
  }));

  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} />
          <YAxis tickFormatter={(value) => tickFormatter(Number(value), unit)} />
          <Tooltip formatter={tooltipFormatter(unit)} />
          <Legend />
          <Line type="monotone" dataKey="refedScale" name="Refed scale" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="fastedScale" name="Fasted scale" stroke="#f97316" strokeWidth={2} dot={false} />
          <Line
            type="monotone"
            dataKey="measurement"
            name="Recorded measurement"
            stroke="#059669"
            strokeWidth={2}
            dot={{ r: 5 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
