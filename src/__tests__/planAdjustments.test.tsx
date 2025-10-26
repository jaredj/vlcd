import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { format, parseISO } from 'date-fns';
import { fireEvent, renderWithProviders, screen, waitFor } from '../test-utils';
import PlanAdjustments from '../components/PlanAdjustments';
import { generateProjections } from '../lib/modeling';
import type { AppState, DailyProjection, Profile } from '../types';
import { feetInchesToCentimeters, poundsToKilograms } from '../utils/conversions';

describe('PlanAdjustments', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves custom calorie targets for a day', async () => {
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: '2025-10-17',
      startWeightKg: poundsToKilograms(265),
      heightCm: feetInchesToCentimeters(5, 10.5),
      age: 44,
      sex: 'male',
      goal: 'alpinist-ready',
      defaultCalories: 800,
      defaultActivityLevel: 'minimal'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };
    const projection = generateProjections(initialState, 10);
    const targetDate = projection.projections[0].date;

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    const caloriesInput = screen.getByLabelText<HTMLInputElement>(`Calories for ${targetDate}`);
    fireEvent.change(caloriesInput, { target: { value: '950' } });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number; activityLevel?: string }>;
      };
      expect(stored.plans?.[targetDate]?.calories).toBe(950);
    });

    const activitySelect = screen.getByLabelText<HTMLSelectElement>(`Activity for ${targetDate}`);
    fireEvent.change(activitySelect, { target: { value: 'moderate' } });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number; activityLevel?: string }>;
      };
      expect(stored.plans?.[targetDate]?.activityLevel).toBe('moderate');
    });

    const resetButton = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number; activityLevel?: string }>;
      };
      expect(stored.plans?.[targetDate]).toBeUndefined();
    });

    expect(screen.getByText(/recommended minimum based on your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/indemnify and hold the creators harmless/i)).toBeInTheDocument();
  });

  it('stores activity adjustments while preserving baseline calories when none are customized', async () => {
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: '2025-10-17',
      startWeightKg: poundsToKilograms(265),
      heightCm: feetInchesToCentimeters(5, 10.5),
      age: 44,
      sex: 'male',
      goal: 'alpinist-ready',
      defaultCalories: 800,
      defaultActivityLevel: 'minimal'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };
    const projection = generateProjections(initialState, 10);
    const targetDate = projection.projections[0].date;
    const targetCalories = projection.projections[0].calories;

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    const activitySelect = screen.getByLabelText<HTMLSelectElement>(`Activity for ${targetDate}`);
    fireEvent.change(activitySelect, { target: { value: 'light' } });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
        plans?: Record<string, { calories?: number; activityLevel?: string }>;
      };
      expect(stored.plans?.[targetDate]?.activityLevel).toBe('light');
      expect(stored.plans?.[targetDate]?.calories).toBe(targetCalories);
    });
  });

  it('flags days planned below the recommended minimum', () => {
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: '2025-10-17',
      startWeightKg: poundsToKilograms(265),
      heightCm: feetInchesToCentimeters(5, 10.5),
      age: 44,
      sex: 'male',
      goal: 'alpinist-ready',
      defaultCalories: 650,
      defaultActivityLevel: 'minimal'
    };
    const plans: AppState['plans'] = {
      '2025-01-01': { date: '2025-01-01', calories: 450, activityLevel: 'minimal' }
    };
    const initialState: AppState = { profile, plans, measurements: {} };
    const projection = generateProjections(initialState, 1);

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    expect(screen.getByText(/medical supervision required/i)).toBeInTheDocument();
  });

  it('visually distinguishes past, present, and future days', () => {
    const profile: Profile = {
      unitSystem: 'imperial',
      startDate: '2025-10-17',
      startWeightKg: poundsToKilograms(265),
      heightCm: feetInchesToCentimeters(5, 10.5),
      age: 44,
      sex: 'male',
      goal: 'alpinist-ready',
      defaultCalories: 800,
      defaultActivityLevel: 'minimal'
    };
    const initialState: AppState = { profile, plans: {}, measurements: {} };
    const projection = generateProjections(initialState, 14);

    renderWithProviders(
      <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
      { initialState }
    );

    const rows = screen.getAllByRole('row');
    const dataRows = rows.slice(1);
    expect(dataRows.some((row) => row.classList.contains('plan-row-past'))).toBe(true);

    const todayRow = screen.getByRole('row', { current: 'date' });
    expect(todayRow).toHaveClass('plan-row-today');
    expect(todayRow).toHaveAttribute('aria-current', 'date');

    expect(dataRows.some((row) => row.classList.contains('plan-row-future'))).toBe(true);
  });

  it('scrolls the table to today when supported by the browser', async () => {
    const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView'
    );

    if (!originalScrollIntoViewDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: () => undefined,
        configurable: true,
        writable: true
      });
    }

    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);

    const today = format(new Date(), 'yyyy-MM-dd');
    const projections: DailyProjection[] = [
      {
        date: today,
        calories: 1200,
        activityLevel: 'minimal',
        bmr: 1500,
        tee: 1800,
        deficit: -600,
        fastedWeightKg: 90,
        fastedScaleKg: 90,
        refedScaleKg: 90,
        isMeasurement: false
      }
    ];

    try {
      renderWithProviders(<PlanAdjustments projections={projections} unit="imperial" />, {
        initialState: { profile: null, plans: {}, measurements: {} }
      });

      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalled();
      });
    } finally {
      scrollSpy.mockRestore();
      if (!originalScrollIntoViewDescriptor) {
        delete (HTMLElement.prototype as { scrollIntoView?: () => void }).scrollIntoView;
      }
    }
  });

  it('does not scroll again on rerender once today has been centered', async () => {
    const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView'
    );

    if (!originalScrollIntoViewDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: () => undefined,
        configurable: true,
        writable: true
      });
    }

    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);

    const today = format(new Date(), 'yyyy-MM-dd');
    const projections: DailyProjection[] = [
      {
        date: today,
        calories: 1200,
        activityLevel: 'minimal',
        bmr: 1500,
        tee: 1800,
        deficit: -600,
        fastedWeightKg: 90,
        fastedScaleKg: 90,
        refedScaleKg: 90,
        isMeasurement: false
      }
    ];

    try {
      const { rerender } = renderWithProviders(
        <PlanAdjustments projections={projections} unit="imperial" />,
        {
          initialState: { profile: null, plans: {}, measurements: {} }
        }
      );

      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalledTimes(1);
      });

      rerender(
        <PlanAdjustments
          projections={[
            {
              ...projections[0],
              calories: projections[0].calories + 50
            }
          ]}
          unit="imperial"
        />
      );

      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalledTimes(1);
      });
    } finally {
      scrollSpy.mockRestore();
      if (!originalScrollIntoViewDescriptor) {
        delete (HTMLElement.prototype as { scrollIntoView?: () => void }).scrollIntoView;
      }
    }
  });

  it('waits to scroll until the adjustments section becomes visible when supported', async () => {
    const originalIntersectionObserver = window.IntersectionObserver;
    const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView'
    );

    if (!originalScrollIntoViewDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: () => undefined,
        configurable: true,
        writable: true
      });
    }

    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);

    const observeMock = vi.fn((_target: Element) => undefined);
    const disconnectMock = vi.fn(() => undefined);
    const takeRecordsMock = vi.fn(() => [] as IntersectionObserverEntry[]);
    const unobserveMock = vi.fn((_target: Element) => undefined);

    let observerCallback: IntersectionObserverCallback | null = null;
    const observers: MockIntersectionObserver[] = [];

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin = '';
      readonly thresholds: readonly number[] = [];

      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
        observers.push(this);
      }

      disconnect(): void {
        disconnectMock();
      }

      observe(target: Element): void {
        observeMock(target);
      }

      takeRecords(): IntersectionObserverEntry[] {
        return takeRecordsMock();
      }

      unobserve(target: Element): void {
        unobserveMock(target);
      }
    }

    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver
    });

    const today = format(new Date(), 'yyyy-MM-dd');
    const projections: DailyProjection[] = [
      {
        date: today,
        calories: 1200,
        activityLevel: 'minimal',
        bmr: 1500,
        tee: 1800,
        deficit: -600,
        fastedWeightKg: 90,
        fastedScaleKg: 90,
        refedScaleKg: 90,
        isMeasurement: false
      }
    ];

    try {
      const { unmount } = renderWithProviders(
        <PlanAdjustments projections={projections} unit="imperial" />,
        {
          initialState: { profile: null, plans: {}, measurements: {} }
        }
      );

      expect(observeMock).toHaveBeenCalled();
      expect(scrollSpy).not.toHaveBeenCalled();
      expect(observerCallback).toBeTruthy();
      if (!observerCallback) {
        throw new Error('Expected intersection observer callback to be registered');
      }
      const callback: IntersectionObserverCallback = observerCallback;
      const observerInstance = observers.length ? observers[observers.length - 1] : null;
      expect(observerInstance).toBeTruthy();

      const sectionHeading = screen.getByRole('heading', { name: /daily plan adjustments/i });
      const sectionElement = sectionHeading.closest('section');
      expect(sectionElement).not.toBeNull();

      callback(
        [
          {
            isIntersecting: false,
            target: sectionElement as Element,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: 0,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: Date.now()
          } as IntersectionObserverEntry
        ],
        observerInstance as unknown as IntersectionObserver
      );

      expect(scrollSpy).not.toHaveBeenCalled();

      callback(
        [
          {
            isIntersecting: true,
            target: sectionElement as Element,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: 1,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: Date.now()
          } as IntersectionObserverEntry
        ],
        observerInstance as unknown as IntersectionObserver
      );

      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalledTimes(1);
      });

      unmount();

      await waitFor(() => {
        expect(disconnectMock).toHaveBeenCalled();
      });
    } finally {
      scrollSpy.mockRestore();
      if (originalIntersectionObserver) {
        Object.defineProperty(window, 'IntersectionObserver', {
          configurable: true,
          writable: true,
          value: originalIntersectionObserver
        });
      } else {
        delete (window as unknown as { IntersectionObserver?: typeof MockIntersectionObserver }).IntersectionObserver;
      }
      if (!originalScrollIntoViewDescriptor) {
        delete (HTMLElement.prototype as { scrollIntoView?: () => void }).scrollIntoView;
      }
    }
  });

  it(
    'displays the full projection horizon in the adjustments table',
    { timeout: 15000 },
    () => {
      const profile: Profile = {
        unitSystem: 'imperial',
        startDate: '2025-10-17',
        startWeightKg: poundsToKilograms(265),
        heightCm: feetInchesToCentimeters(5, 10.5),
        age: 44,
        sex: 'male',
        goal: 'alpinist-ready',
        defaultCalories: 800,
        defaultActivityLevel: 'minimal'
      };
      const initialState: AppState = { profile, plans: {}, measurements: {} };
      const projection = generateProjections(initialState, 420);

      expect(projection.projections.length).toBeGreaterThan(40);

      const finalDay = projection.projections[projection.projections.length - 1];

      renderWithProviders(
        <PlanAdjustments projections={projection.projections} unit={profile.unitSystem} />,
        { initialState }
      );

      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(projection.projections.length + 1);

      const lastDateLabel = format(parseISO(finalDay.date), 'MMM d');
      expect(screen.getAllByText(lastDateLabel).length).toBeGreaterThan(0);

      const finalCaloriesInput = screen.getByLabelText(`Calories for ${finalDay.date}`);
      expect(finalCaloriesInput).toBeInTheDocument();
    }
  );

  it('falls back gracefully when projections are unavailable', () => {
    const initialState: AppState = { profile: null, plans: {}, measurements: {} };

    renderWithProviders(
      <PlanAdjustments projections={[]} unit="imperial" />,
      { initialState }
    );

    expect(screen.getByText(/projections are not available yet/i)).toBeInTheDocument();
  });

  it('skips scrolling setup when the adjustments section is not rendered', async () => {
    const originalIntersectionObserver = window.IntersectionObserver;
    const observeMock = vi.fn((_target: Element) => undefined);

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin = '';
      readonly thresholds: readonly number[] = [];

      constructor() {
        throw new Error('IntersectionObserver should not be instantiated when no section exists');
      }

      disconnect(): void {
        throw new Error('disconnect should not be called when no section exists');
      }

      observe(target: Element): void {
        observeMock(target);
      }

      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }

      unobserve(): void {
        throw new Error('unobserve should not be called when no section exists');
      }
    }

    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver
    });

    const initialState: AppState = { profile: null, plans: {}, measurements: {} };

    try {
      renderWithProviders(
        <PlanAdjustments projections={[]} unit="imperial" />,
        { initialState }
      );

      await waitFor(() => {
        expect(screen.getByText(/projections are not available yet/i)).toBeInTheDocument();
      });

      expect(observeMock).not.toHaveBeenCalled();
    } finally {
      if (originalIntersectionObserver) {
        Object.defineProperty(window, 'IntersectionObserver', {
          configurable: true,
          writable: true,
          value: originalIntersectionObserver
        });
      } else {
        delete (window as unknown as { IntersectionObserver?: typeof MockIntersectionObserver }).IntersectionObserver;
      }
    }
  });
});
