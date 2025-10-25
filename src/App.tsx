import React from 'react';
import type { JSX } from 'react';
import Dashboard from './components/Dashboard';
import { AppStateProvider } from './lib/state';

export default function App(): JSX.Element {
  return (
    <AppStateProvider>
      <Dashboard />
    </AppStateProvider>
  );
}
