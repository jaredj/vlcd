import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../test-utils';
import ProfileForm from '../components/ProfileForm';
import type { Profile } from '../types';

function createProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    unitSystem: 'metric',
    startDate: '2025-01-01',
    startWeightKg: 90,
    heightCm: 180,
    age: 35,
    sex: 'male',
    goal: 'feel-great',
    defaultCalories: 1800,
    defaultActivityLevel: 'moderate',
    ...overrides
  };
}

describe('ProfileForm', () => {
  it('resets its state when a new profile is provided', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<ProfileForm profile={createProfile()} onSubmit={onSubmit} submitLabel="Save" />);

    expect(screen.getByLabelText<HTMLSelectElement>(/units/i)).toHaveValue('metric');
    expect(screen.getByLabelText<HTMLInputElement>(/starting weight/i)).toHaveValue(90);

    const updatedProfile = createProfile({
      unitSystem: 'imperial',
      startDate: '2025-05-01',
      startWeightKg: 110,
      heightCm: 170,
      defaultCalories: 1500
    });

    rerender(<ProfileForm profile={updatedProfile} onSubmit={onSubmit} submitLabel="Save" />);

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLSelectElement>(/units/i)).toHaveValue('imperial');
    });

    const weightInput = screen.getByLabelText<HTMLInputElement>(/starting weight/i);
    expect(Number(weightInput.value)).toBeCloseTo(242.5, 1);
    expect(screen.getByLabelText<HTMLInputElement>(/diet start date/i)).toHaveValue('2025-05-01');
    expect(screen.getByLabelText<HTMLInputElement>(/planned calories per day/i)).toHaveValue(1500);
  });

  it('converts between metric and imperial units when toggled', () => {
    render(<ProfileForm profile={null} onSubmit={vi.fn()} submitLabel="Save" />);

    const unitsSelect = screen.getByLabelText<HTMLSelectElement>(/units/i);
    fireEvent.change(unitsSelect, { target: { value: 'metric' } });

    const metricWeight = screen.getByLabelText<HTMLInputElement>(/starting weight/i);
    expect(Number(metricWeight.value)).toBeCloseTo(120.2, 1);
    const heightCmInput = screen.getByLabelText<HTMLInputElement>(/height \(cm\)/i);
    expect(Number(heightCmInput.value)).toBeCloseTo(179.1, 1);

    fireEvent.change(unitsSelect, { target: { value: 'imperial' } });

    expect(screen.getByLabelText<HTMLInputElement>(/starting weight/i)).toHaveValue(265);
    expect(screen.getByLabelText<HTMLInputElement>(/height \(ft\)/i)).toHaveValue(5);
    expect(screen.getByLabelText<HTMLInputElement>(/height \(in\)/i)).toHaveValue(10.5);
  });

  it('auto submits normalized profiles and resubmits when fields change', async () => {
    const onSubmit = vi.fn();
    render(<ProfileForm profile={null} onSubmit={onSubmit} submitLabel="Save" autoSubmit />);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const firstSubmission = onSubmit.mock.calls[0][0] as Profile;
    expect(firstSubmission.unitSystem).toBe('imperial');
    expect(firstSubmission.startWeightKg).toBeCloseTo(120.2, 1);
    expect(firstSubmission.defaultCalories).toBe(800);

    fireEvent.change(screen.getByLabelText<HTMLInputElement>(/planned calories per day/i), {
      target: { value: '900' }
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });

    const secondSubmission = onSubmit.mock.calls[1][0] as Profile;
    expect(secondSubmission.defaultCalories).toBe(900);
    expect(secondSubmission.startWeightKg).toBeCloseTo(firstSubmission.startWeightKg, 1);
  });

  it('submits via the button and triggers the completion callback', () => {
    const onSubmit = vi.fn();
    const onAfterSubmit = vi.fn();
    render(<ProfileForm profile={null} onSubmit={onSubmit} submitLabel="Save" onAfterSubmit={onAfterSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onAfterSubmit).toHaveBeenCalledTimes(1);

    const submitted = onSubmit.mock.calls[0][0] as Profile;
    expect(submitted.defaultCalories).toBe(800);
  });
});
