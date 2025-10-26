import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '../test-utils';
import ProfileForm from '../components/ProfileForm';
import type { Profile } from '../types';

function createProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: 'Test Person',
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
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('resets its state when a new profile is provided', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<ProfileForm profile={createProfile()} onSubmit={onSubmit} submitLabel="Save" />);

    expect(screen.getByLabelText<HTMLInputElement>(/profile name/i)).toHaveValue('Test Person');
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
    window.localStorage.setItem('vlcd-last-profile-name', 'Auto Submitter');
    render(<ProfileForm profile={null} onSubmit={onSubmit} submitLabel="Save" autoSubmit />);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const firstSubmission = onSubmit.mock.calls[0][0] as Profile;
    expect(firstSubmission.name).toBe('Auto Submitter');
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
    expect(secondSubmission.name).toBe('Auto Submitter');
    expect(secondSubmission.defaultCalories).toBe(900);
    expect(secondSubmission.startWeightKg).toBeCloseTo(firstSubmission.startWeightKg, 1);
  });

  it('submits via the button and triggers the completion callback', () => {
    const onSubmit = vi.fn();
    const onAfterSubmit = vi.fn();
    render(<ProfileForm profile={null} onSubmit={onSubmit} submitLabel="Save" onAfterSubmit={onAfterSubmit} />);

    fireEvent.change(screen.getByLabelText<HTMLInputElement>(/profile name/i), {
      target: { value: 'Button Submitter' }
    });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onAfterSubmit).toHaveBeenCalledTimes(1);

    const submitted = onSubmit.mock.calls[0][0] as Profile;
    expect(submitted.name).toBe('Button Submitter');
    expect(submitted.defaultCalories).toBe(800);
  });

  it('supports collapsing baseline details when requested', () => {
    const onBaselineCollapsedChange = vi.fn();
    const { rerender } = render(
      <ProfileForm
        profile={null}
        onSubmit={vi.fn()}
        submitLabel="Save"
        baselineCollapsed={false}
        onBaselineCollapsedChange={onBaselineCollapsedChange}
      />
    );

    expect(screen.getByLabelText(/diet start date/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide starting setup/i }));
    expect(onBaselineCollapsedChange).toHaveBeenCalledWith(true);

    rerender(
      <ProfileForm
        profile={null}
        onSubmit={vi.fn()}
        submitLabel="Save"
        baselineCollapsed
        onBaselineCollapsedChange={onBaselineCollapsedChange}
      />
    );

    expect(screen.queryByLabelText(/diet start date/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit starting setup/i }));
    expect(onBaselineCollapsedChange).toHaveBeenLastCalledWith(false);
  });

  it('allows dismissing the calorie warning and shows a tooltip thereafter', () => {
    render(<ProfileForm profile={null} onSubmit={vi.fn()} submitLabel="Save" />);

    const caloriesInput = screen.getByLabelText<HTMLInputElement>(/planned calories per day/i);
    fireEvent.change(caloriesInput, { target: { value: '400' } });

    const dismissButton = screen.getByRole('button', { name: /dismiss warning/i });
    fireEvent.click(dismissButton);

    expect(screen.queryByRole('button', { name: /dismiss warning/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: /medical supervision required/i })).toBeInTheDocument();
    expect(window.localStorage.getItem('vlcd-calorie-warning-dismissed')).toBe('true');

    cleanup();

    render(<ProfileForm profile={null} onSubmit={vi.fn()} submitLabel="Save" />);
    const followUpCalories = screen.getByLabelText<HTMLInputElement>(/planned calories per day/i);
    fireEvent.change(followUpCalories, { target: { value: '400' } });
    expect(screen.getByRole('tooltip', { name: /medical supervision required/i })).toBeInTheDocument();
  });
});
