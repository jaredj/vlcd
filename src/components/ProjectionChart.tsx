import React, { useMemo } from 'react';
import type { JSX } from 'react';
import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import type { DailyProjection, UnitSystem } from '../types';
import { POUNDS_PER_KILOGRAM, formatWeight, kilogramsToPounds } from '../utils/conversions';

interface TooltipDatum {
  axisValue?: string | number;
  marker?: string;
  seriesName?: string;
  value?: unknown;
}

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

export default function ProjectionChart({ data, unit }: ProjectionChartProps): JSX.Element {
  const chartData = useMemo(
    () =>
      data.map((entry) => ({
        ...entry,
        fastedScale: convertWeight(entry.fastedScaleKg, unit),
        refedScale: convertWeight(entry.refedScaleKg, unit),
        measurement: entry.isMeasurement ? convertWeight(entry.measurementKg ?? entry.refedScaleKg, unit) : null
      })),
    [data, unit]
  );

  const chartOptions = useMemo<EChartsOption>(() => {
    const dates = chartData.map((entry) => entry.date);
    const formatTooltipValue = (value: number): string => {
      const valueKg = unit === 'imperial' ? value / POUNDS_PER_KILOGRAM : value;
      return formatWeight(valueKg, unit, 1);
    };

    const tooltipFormatter = (paramsInput: TooltipDatum | TooltipDatum[] | undefined): string => {
      const params = Array.isArray(paramsInput)
        ? paramsInput
        : paramsInput
          ? [paramsInput]
          : [];
      if (!params.length) {
        return '';
      }

      const axisValue = params[0]?.axisValue;
      const dateLabel = typeof axisValue === 'string' ? axisValue : String(axisValue ?? '');

      const lines = params
        .map((param) => {
          const value = param.value;
          const numericValue = typeof value === 'number' ? value : null;
          if (numericValue === null || Number.isNaN(numericValue)) {
            return null;
          }
          const marker = param.marker ?? '';
          const label = param.seriesName ?? '';
          return `${marker}${label}: ${formatTooltipValue(numericValue)}`;
        })
        .filter((line): line is string => Boolean(line));

      return [`<strong>${dateLabel}</strong>`, ...lines].join('<br/>');
    };

    return {
      color: ['#2563eb', '#f97316', '#059669'],
      textStyle: {
        fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
        color: '#0f172a',
        fontSize: 12
      },
      animationDuration: 600,
      grid: {
        top: 56,
        left: 60,
        right: 24,
        bottom: 80
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderWidth: 0,
        textStyle: {
          color: '#f8fafc'
        },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#94a3b8'
          }
        },
        formatter: tooltipFormatter
      },
      legend: {
        top: 16,
        left: 'center',
        itemWidth: 18,
        itemHeight: 10,
        textStyle: {
          color: '#475569',
          fontWeight: 500
        }
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: '#cbd5f5'
          }
        },
        axisLabel: {
          color: '#475569',
          formatter: (value: string | number) =>
            typeof value === 'string' ? value.slice(5) : String(value).slice(5)
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        axisLine: {
          lineStyle: {
            color: '#cbd5f5'
          }
        },
        splitLine: {
          lineStyle: {
            color: '#e2e8f0'
          }
        },
        axisLabel: {
          color: '#475569',
          formatter: (value: number) => tickFormatter(Number(value), unit)
        }
      },
      dataZoom: [
        {
          type: 'inside',
          throttle: 50
        },
        {
          type: 'slider',
          height: 20,
          bottom: 24,
          borderColor: 'transparent',
          backgroundColor: '#e2e8f0',
          handleIcon:
            'path://M512 64a64 64 0 0 1 64 64v768a64 64 0 0 1-128 0V128a64 64 0 0 1 64-64z',
          handleSize: 20,
          brushSelect: false
        }
      ],
      series: [
        {
          name: 'Refed scale',
          type: 'line',
          smooth: true,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            width: 3
          },
          areaStyle: {
            opacity: 0.08
          },
          data: chartData.map((entry) => entry.refedScale)
        },
        {
          name: 'Fasted scale',
          type: 'line',
          smooth: true,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            width: 3
          },
          areaStyle: {
            opacity: 0.06
          },
          data: chartData.map((entry) => entry.fastedScale)
        },
        {
          name: 'Recorded measurement',
          type: 'line',
          connectNulls: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 2,
            type: 'dashed'
          },
          itemStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(5, 150, 105, 0.35)'
          },
          data: chartData.map((entry) => entry.measurement)
        }
      ]
    };
  }, [chartData, unit]);

  if (!chartData.length) {
    return <p>No projection data yet. Add your profile to begin modelling.</p>;
  }

  return (
    <div style={{ width: '100%', height: 360 }}>
      <ReactECharts option={chartOptions} style={{ height: '100%', width: '100%' }} lazyUpdate notMerge />
    </div>
  );
}
