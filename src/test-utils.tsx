/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import type { AppState } from './types';
import { AppStateProvider } from './lib/state';
import { INITIAL_STATE } from './lib/storage';

type CustomRenderOptions = {
  initialState?: AppState;
} & RenderOptions;

function renderWithProviders(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { initialState = INITIAL_STATE, ...renderOptions } = options;
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <AppStateProvider initialState={initialState}>{children}</AppStateProvider>;
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export * from '@testing-library/react';
export { renderWithProviders };
