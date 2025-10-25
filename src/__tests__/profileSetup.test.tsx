import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '../test-utils';
import { renderWithProviders } from '../test-utils';
import ProfileSetup from '../components/ProfileSetup';

describe('ProfileSetup', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('prefills the default imperial alpinist profile', () => {
    renderWithProviders(<ProfileSetup />);

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
    renderWithProviders(<ProfileSetup />);

    const startDateInput = screen.getByLabelText<HTMLInputElement>(/diet start date/i);
    expect(startDateInput).toHaveValue('2025-10-17');
  });

  it('switches to metric and converts values', () => {
    renderWithProviders(<ProfileSetup />);

    fireEvent.change(screen.getByLabelText<HTMLSelectElement>(/units/i), { target: { value: 'metric' } });
    const weightInput = screen.getByLabelText<HTMLInputElement>(/starting weight/i);
    expect(Number(weightInput.value)).toBeCloseTo(120.2, 1);
  });

  it('persists the profile on submit', async () => {
    renderWithProviders(<ProfileSetup />);

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

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
    renderWithProviders(<ProfileSetup />);

    expect(screen.getByText(/recommended minimum based on your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/strict and constant medical supervision/i)).toBeInTheDocument();
    expect(screen.getByText(/indemnify and hold the creators harmless/i)).toBeInTheDocument();
  });

  it('alerts when planned calories drop below the recommended minimum', () => {
    renderWithProviders(<ProfileSetup />);

    const caloriesInput = screen.getByLabelText<HTMLInputElement>(/planned calories per day/i);
    fireEvent.change(caloriesInput, { target: { value: '400' } });

    expect(screen.getByText(/medical supervision required/i)).toBeInTheDocument();
  });
});
