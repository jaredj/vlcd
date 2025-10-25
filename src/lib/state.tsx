/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react';
import type { JSX } from 'react';
import type { AppState, DailyMeasurement, DayPlan, Profile } from '../types';
import { usePersistentState } from './storage';

interface AppContextValue {
  state: AppState;
  setProfile: (profile: Profile) => void;
  updatePlan: (dateIso: string, updates: Partial<DayPlan>, options?: { source?: DayPlan['source'] }) => void;
  removePlan: (dateIso: string) => void;
  recordMeasurement: (measurement: DailyMeasurement) => void;
  removeMeasurement: (dateIso: string) => void;
  reset: () => void;
}

const AppStateContext = createContext<AppContextValue | undefined>(undefined);

interface AppStateProviderProps {
  children: React.ReactNode;
  initialState?: AppState;
}

export function AppStateProvider({ children, initialState }: AppStateProviderProps): JSX.Element {
  const [state, setState] = usePersistentState(initialState);

  const value = useMemo<AppContextValue>(() => {
    function setProfile(profile: Profile) {
      setState((prev) => ({
        ...prev,
        profile
      }));
    }

    function updatePlan(dateIso: string, updates: Partial<DayPlan>, options?: { source?: DayPlan['source'] }) {
      setState((prev) => {
        if (!prev.profile) {
          return prev;
        }
        return {
          ...prev,
          plans: {
            ...prev.plans,
            [dateIso]: {
              ...prev.plans[dateIso],
              date: dateIso,
              ...updates,
              ...(options?.source ? { source: options.source } : {})
            }
          }
        };
      });
    }

    function removePlan(dateIso: string) {
      setState((prev) => {
        if (!prev.plans[dateIso]) {
          return prev;
        }
        const updatedPlans = { ...prev.plans };
        delete updatedPlans[dateIso];
        return { ...prev, plans: updatedPlans };
      });
    }

    function recordMeasurement(measurement: DailyMeasurement) {
      setState((prev) => ({
        ...prev,
        measurements: {
          ...prev.measurements,
          [measurement.date]: measurement
        }
      }));
    }

    function removeMeasurement(dateIso: string) {
      setState((prev) => {
        if (!prev.measurements[dateIso]) {
          return prev;
        }
        const updatedMeasurements = { ...prev.measurements };
        delete updatedMeasurements[dateIso];
        return { ...prev, measurements: updatedMeasurements };
      });
    }

    function reset() {
      setState({ profile: null, plans: {}, measurements: {} });
    }

    return {
      state,
      setProfile,
      updatePlan,
      removePlan,
      recordMeasurement,
      removeMeasurement,
      reset
    };
  }, [setState, state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}

