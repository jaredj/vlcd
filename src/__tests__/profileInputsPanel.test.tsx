import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    window.localStorage.setItem('vlcd-last-profile-name', 'PanelTester');
    renderWithProviders(<ProfileInputsPanel />);

    await waitFor(() => {
      expect(window.localStorage.getItem('vlcd-app-state-v1')).not.toBeNull();
    });

    const stored = JSON.parse(window.localStorage.getItem('vlcd-app-state-v1') ?? '{}') as {
      profile?: { name?: string; goal?: string; defaultCalories?: number };
    };
    expect(stored.profile).toMatchObject({
      name: 'PanelTester',
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

    expect(screen.getByLabelText(/diet start date/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide starting setup/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem('vlcd-baseline-collapsed')).toBe('true');
    });
    expect(screen.queryByLabelText(/diet start date/i)).not.toBeInTheDocument();

    cleanup();

    renderWithProviders(<ProfileInputsPanel />);
    expect(screen.queryByLabelText(/diet start date/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit starting setup/i }));
    await waitFor(() => {
      expect(window.localStorage.getItem('vlcd-baseline-collapsed')).toBe('false');
    });
    expect(screen.getByLabelText(/diet start date/i)).toBeInTheDocument();
  });

  it('marks the baseline details as seen after the first render', () => {
    renderWithProviders(<ProfileInputsPanel />);

    expect(window.localStorage.getItem('vlcd-baseline-seen')).toBe('true');
  });

  it('restores the previous collapse preference when baseline details were seen before', () => {
    window.localStorage.setItem('vlcd-baseline-seen', 'true');
    window.localStorage.setItem('vlcd-baseline-collapsed', 'false');

    renderWithProviders(<ProfileInputsPanel />);
    expect(screen.getByLabelText(/diet start date/i)).toBeInTheDocument();

    cleanup();

    window.localStorage.setItem('vlcd-baseline-seen', 'true');
    window.localStorage.setItem('vlcd-baseline-collapsed', 'true');
    renderWithProviders(<ProfileInputsPanel />);
    expect(screen.queryByLabelText(/diet start date/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit starting setup/i }));
    expect(screen.getByLabelText(/diet start date/i)).toBeInTheDocument();
  });

  it('collapses the baseline block when previously viewed but no preference was stored', () => {
    window.localStorage.setItem('vlcd-baseline-seen', 'true');

    renderWithProviders(<ProfileInputsPanel />);

    expect(screen.queryByLabelText(/diet start date/i)).not.toBeInTheDocument();
  });

  it('resets the stored plan when the reset action is used', async () => {
    const initialState = {
      profile: {
        name: 'Existing Plan',
        unitSystem: 'metric',
        startDate: '2025-01-01',
        startWeightKg: 90,
        heightCm: 180,
        age: 35,
        sex: 'female',
        goal: 'feel-great',
        defaultCalories: 1600,
        defaultActivityLevel: 'moderate'
      },
      plans: { '2025-01-01': { date: '2025-01-01', calories: 900, activityLevel: 'light' } },
      measurements: { '2025-01-02': { date: '2025-01-02', weightKg: 90, fasted: false } }
    } as const;

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem');

    renderWithProviders(<ProfileInputsPanel />, { initialState });

    fireEvent.click(screen.getByRole('button', { name: /reset everything/i }));

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        'vlcd-app-state-v1',
        JSON.stringify({ profile: null, plans: {}, measurements: {} })
      );
    });

    setItemSpy.mockRestore();
  });

  it('respects externally controlled collapse state changes', () => {
    const onBaselineCollapsedChange = vi.fn();
    const { rerender } = renderWithProviders(
      <ProfileInputsPanel baselineCollapsed onBaselineCollapsedChange={onBaselineCollapsedChange} />
    );

    expect(screen.queryByLabelText(/diet start date/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit starting setup/i }));
    expect(onBaselineCollapsedChange).toHaveBeenCalledWith(false);

    rerender(
      <ProfileInputsPanel baselineCollapsed={false} onBaselineCollapsedChange={onBaselineCollapsedChange} />
    );
    expect(screen.getByLabelText(/diet start date/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide starting setup/i }));
    expect(onBaselineCollapsedChange).toHaveBeenLastCalledWith(true);
  });
});
