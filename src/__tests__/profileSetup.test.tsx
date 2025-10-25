import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '../test-utils';
import { renderWithProviders } from '../test-utils';
import ProfileSetup from '../components/ProfileSetup';
import { feetInchesToCentimeters, poundsToKilograms } from '../utils/conversions';

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

    const startDateInput = screen.getByLabelText<HTMLInputElement>(/diet start date/i);
    expect(startDateInput).toHaveValue('2025-10-17');

    const goalSelect = screen.getByLabelText<HTMLSelectElement>(/fitness goal/i);
    expect(goalSelect).toHaveValue('alpinist-ready');

    const ageInput = screen.getByLabelText<HTMLInputElement>(/age/i);
    expect(ageInput).toHaveValue(44);
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

  it('renders embedded variant copy when profile exists', () => {
    const profile = {
      unitSystem: 'imperial' as const,
      startDate: '2025-10-17',
      startWeightKg: poundsToKilograms(220),
      heightCm: feetInchesToCentimeters(5, 10),
      age: 40,
      sex: 'female' as const,
      goal: 'feel-great' as const,
      defaultCalories: 900,
      defaultActivityLevel: 'light' as const
    };
    renderWithProviders(<ProfileSetup variant="embedded" />, {
      initialState: { profile, plans: {}, measurements: {} }
    });

    expect(screen.getByRole('heading', { name: /adjust your profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile changes/i })).toBeInTheDocument();
  });
});
