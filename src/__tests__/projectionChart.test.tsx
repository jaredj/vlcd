import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EChartsOption,
  TooltipComponentFormatterCallbackParams,
  TooltipComponentOption
} from 'echarts';
import { render, screen } from '../test-utils';
import ProjectionChart from '../components/ProjectionChart';
import type { DailyProjection } from '../types';
import { kilogramsToPounds } from '../utils/conversions';

const optionSpy = vi.fn();

vi.mock('echarts-for-react', () => ({
  __esModule: true,
  default: ({ option }: { option: unknown }) => {
    optionSpy(option);
    return <div data-testid="echarts-mock" />;
  }
}));

const sampleData: DailyProjection[] = [
  {
    date: '2025-01-01',
    calories: 800,
    activityLevel: 'light',
    bmr: 1500,
    tee: 1900,
    deficit: 1100,
    fastedWeightKg: 82.4,
    fastedScaleKg: 83,
    refedScaleKg: 84,
    isMeasurement: true,
    measurementKg: 84.2,
    measurementFasted: false
  },
  {
    date: '2025-01-02',
    calories: 780,
    activityLevel: 'light',
    bmr: 1490,
    tee: 1880,
    deficit: 1100,
    fastedWeightKg: 81.8,
    fastedScaleKg: 82.6,
    refedScaleKg: 83.1,
    isMeasurement: false,
    measurementKg: undefined,
    measurementFasted: undefined
  },
  {
    date: '2025-01-03',
    calories: 760,
    activityLevel: 'moderate',
    bmr: 1480,
    tee: 1870,
    deficit: 1110,
    fastedWeightKg: 81.2,
    fastedScaleKg: 82.2,
    refedScaleKg: 82.8,
    isMeasurement: true,
    measurementKg: 82.5,
    measurementFasted: true
  }
];

function getLatestOption(): EChartsOption {
  const calls = optionSpy.mock.calls;
  const latestCall = calls[calls.length - 1];
  expect(latestCall).toBeDefined();
  const [option] = latestCall ?? [];
  expect(option).toBeDefined();
  return option as EChartsOption;
}

function runTooltipFormatter(
  tooltipOption: TooltipComponentOption | TooltipComponentOption[] | undefined,
  params: TooltipComponentFormatterCallbackParams
): string {
  const tooltipConfig = Array.isArray(tooltipOption) ? tooltipOption[0] : tooltipOption;
  expect(tooltipConfig).toBeDefined();
  const formatter = tooltipConfig?.formatter;
  expect(typeof formatter).toBe('function');
  const result = (formatter as (value: TooltipComponentFormatterCallbackParams) => string | string[])(
    params
  );
  return Array.isArray(result) ? result.join('') : result;
}

describe('ProjectionChart', () => {
  beforeEach(() => {
    optionSpy.mockClear();
  });

  it('renders a helpful fallback when no data is available', () => {
    render(<ProjectionChart data={[]} unit="metric" />);

    expect(screen.getByText(/no projection data yet/i)).toBeInTheDocument();
    expect(optionSpy).not.toHaveBeenCalled();
  });

  it('builds a zoomable line chart with metric units', () => {
    render(<ProjectionChart data={sampleData} unit="metric" />);

    const chart = screen.getByTestId('echarts-mock');
    expect(chart).toBeInTheDocument();

    const option = getLatestOption();
    const series = option.series as { data: (number | null)[] }[];

    expect(series[0].data).toEqual([84, 83.1, 82.8]);
    expect(series[1].data).toEqual([83, 82.6, 82.2]);
    expect(series[2].data).toEqual([84.2, null, 82.5]);

    const dataZoom = option.dataZoom as { type: string }[];
    expect(dataZoom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'inside' }),
        expect.objectContaining({ type: 'slider' })
      ])
    );

    const xAxis = option.xAxis as { axisLabel: { formatter: (value: string | number) => string } };
    const yAxis = option.yAxis as { axisLabel: { formatter: (value: number) => string } };

    expect(xAxis.axisLabel.formatter('2025-01-01')).toBe('01-01');
    expect(xAxis.axisLabel.formatter(20250103)).toBe('103');
    expect(yAxis.axisLabel.formatter(84)).toBe('84 kg');

    const tooltipHtml = runTooltipFormatter(
      option.tooltip as TooltipComponentOption,
      [
        { axisValue: '2025-01-01', marker: '● ', seriesName: 'Refed scale', value: 84 },
        {
          axisValue: '2025-01-01',
          marker: '● ',
          seriesName: 'Recorded measurement',
          value: 84.2
        },
        { axisValue: '2025-01-01', marker: '● ', seriesName: 'Empty', value: null }
      ] as unknown as TooltipComponentFormatterCallbackParams
    );

    expect(tooltipHtml).toContain('<strong>2025-01-01</strong>');
    expect(tooltipHtml).toContain('Refed scale');
    expect(tooltipHtml).toContain('84.0 kg');
    expect(tooltipHtml).toContain('Recorded measurement');
    expect(tooltipHtml).toContain('84.2 kg');
    expect(tooltipHtml).not.toContain('Empty');
  });

  it('converts to imperial units and formats the tooltip output', () => {
    render(<ProjectionChart data={sampleData} unit="imperial" />);

    const option = getLatestOption();
    const series = option.series as { data: (number | null)[] }[];

    expect(series[0].data[0]).toBeCloseTo(kilogramsToPounds(84));
    expect(series[1].data[1]).toBeCloseTo(kilogramsToPounds(82.6));
    expect(series[2].data[1]).toBeNull();

    const poundsValue = kilogramsToPounds(82.6);
    const tooltipHtml = runTooltipFormatter(
      option.tooltip as TooltipComponentOption,
      [
        {
          axisValue: '2025-01-02',
          marker: '• ',
          seriesName: 'Fasted scale',
          value: poundsValue
        },
        { axisValue: '2025-01-02', marker: '• ', seriesName: 'Recorded measurement', value: null }
      ] as unknown as TooltipComponentFormatterCallbackParams
    );

    expect(tooltipHtml).toContain('Fasted scale');
    expect(tooltipHtml).toContain('lb');
    expect(tooltipHtml).not.toContain('Recorded measurement');

    const yAxis = option.yAxis as { axisLabel: { formatter: (value: number) => string } };
    expect(yAxis.axisLabel.formatter(poundsValue)).toBe('182 lb');
  });
});
