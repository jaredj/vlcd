import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '../test-utils';
import { renderWithProviders } from '../test-utils';
import ProfileInputsPanel from '../components/ProfileInputsPanel';

describe('ProfileInputsPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('prefills the default imperial alpinist profile', () => {
    renderWithProviders(<ProfileInputsPanel />);

    const unitsSelect = screen.getByLabelText<HTMLSelectElement>(/units/i);
    expect(unitsSelect).toHaveValue('imperial');

    const weightInput = screen.getByLabelText<HTMLInputElement>(/starting weight/i);
    expect(weightInput).toHaveValue(265);

    const goalSelect = screen.getByLabelText<HTMLSelectElement>(/fitness goal/i);
    expect(goalSelect).toHaveValue('alpinist-ready');

    const ageInput = screen.getByLabelText<HTMLInputElement>(/age/i);
    expect(ageInput).toHaveValue(44);
  });

  it('defaults the start date to October 17, 2025', () => {
    renderWithProviders(<ProfileInputsPanel />);

    const startDateInput = screen.getByLabelText<HTMLInputElement>(/diet start date/i);
    expect(startDateInput).toHaveValue('2025-10-17');
  });

  it('switches to metric and converts values', () => {
    renderWithProviders(<ProfileInputsPanel />);

    fireEvent.change(screen.getByLabelText<HTMLSelectElement>(/units/i), { target: { value: 'metric' } });
    const weightInput = screen.getByLabelText<HTMLInputElement>(/starting weight/i);
    expect(Number(weightInput.value)).toBeCloseTo(120.2, 1);
  });

  it('persists the profile automatically once rendered', async () => {
    renderWithProviders(<ProfileInputsPanel />);

    await waitFor(() => {
      expect(window.localStorage.getItem('vlcd-app-state-v1')).not.toBeNull();
    });

    const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
      profile?: { goal?: string; defaultCalories?: number };
    };
    expect(stored.profile).toMatchObject({
      goal: 'alpinist-ready',
      defaultCalories: 800
    });
  });

  it('displays calorie safety guidance and liability notice', () => {
    renderWithProviders(<ProfileInputsPanel />);

    expect(screen.getByText(/recommended minimum based on your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/strict and constant medical supervision/i)).toBeInTheDocument();
    expect(screen.getByText(/indemnify and hold the creators harmless/i)).toBeInTheDocument();
  });

  it('alerts when planned calories drop below the recommended minimum', () => {
    renderWithProviders(<ProfileInputsPanel />);

    const caloriesInput = screen.getByLabelText<HTMLInputElement>(/planned calories per day/i);
    fireEvent.change(caloriesInput, { target: { value: '400' } });

    expect(screen.getByText(/medical supervision required/i)).toBeInTheDocument();
  });

  it('toggles the baseline details collapse state and remembers the preference', async () => {
    renderWithProviders(<ProfileInputsPanel />);

    const summary = screen.getByText(/units & body details/i);
    const details = summary.closest('details');
    expect(details).toHaveAttribute('open');

    fireEvent.click(summary);

    await waitFor(() => {
      expect(window.localStorage.getItem('vlcd-baseline-collapsed')).toBe('true');
    });
    expect(summary.closest('details')).not.toHaveAttribute('open');

    cleanup();

    renderWithProviders(<ProfileInputsPanel />);
    const newSummary = screen.getByText(/units & body details/i);
    expect(newSummary.closest('details')).not.toHaveAttribute('open');
  });

  it('marks the baseline details as seen after the first render', () => {
    renderWithProviders(<ProfileInputsPanel />);

    expect(window.localStorage.getItem('vlcd-baseline-seen')).toBe('true');
  });

  it('restores the previous collapse preference when baseline details were seen before', () => {
    window.localStorage.setItem('vlcd-baseline-seen', 'true');
    window.localStorage.setItem('vlcd-baseline-collapsed', 'false');

    renderWithProviders(<ProfileInputsPanel />);
    const summary = screen.getByText(/units & body details/i);
    expect(summary.closest('details')).toHaveAttribute('open');

    cleanup();

    window.localStorage.setItem('vlcd-baseline-seen', 'true');
    window.localStorage.setItem('vlcd-baseline-collapsed', 'true');
    renderWithProviders(<ProfileInputsPanel />);
    expect(screen.getByText(/units & body details/i).closest('details')).not.toHaveAttribute('open');
  });

  it('collapses the baseline block when previously viewed but no preference was stored', () => {
    window.localStorage.setItem('vlcd-baseline-seen', 'true');

    renderWithProviders(<ProfileInputsPanel />);

    expect(screen.getByText(/units & body details/i).closest('details')).not.toHaveAttribute('open');
  });
});
