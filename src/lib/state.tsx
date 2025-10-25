/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react';
import type { JSX } from 'react';
import type { AppState, DailyMeasurement, DayPlan, Profile } from '../types';
import { usePersistentState } from './storage';

interface AppContextValue {
  state: AppState;
  setProfile: (profile: Profile) => void;
  updatePlan: (dateIso: string, updates: Partial<DayPlan>) => void;
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
      setState({
        profile,
        plans: state.plans,
        measurements: state.measurements
      });
    }

    function updatePlan(dateIso: string, updates: Partial<DayPlan>) {
      if (!state.profile) return;
      setState({
        ...state,
        plans: {
          ...state.plans,
          [dateIso]: {
            ...state.plans[dateIso],
            date: dateIso,
            ...updates
          }
        }
      });
    }

    function removePlan(dateIso: string) {
      if (!state.plans[dateIso]) return;
      const updatedPlans = { ...state.plans };
      delete updatedPlans[dateIso];
      setState({ ...state, plans: updatedPlans });
    }

    function recordMeasurement(measurement: DailyMeasurement) {
      setState({
        ...state,
        measurements: {
          ...state.measurements,
          [measurement.date]: measurement
        }
      });
    }

    function removeMeasurement(dateIso: string) {
      if (!state.measurements[dateIso]) return;
      const updatedMeasurements = { ...state.measurements };
      delete updatedMeasurements[dateIso];
      setState({ ...state, measurements: updatedMeasurements });
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

