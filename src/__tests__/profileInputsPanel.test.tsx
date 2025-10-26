import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '../test-utils';
import ProfileInputsPanel from '../components/ProfileInputsPanel';
import type { AppState, Profile } from '../types';
import { poundsToKilograms } from '../utils/conversions';

const { getDoc, setDoc } = globalThis.__FIREBASE_MOCKS__;

describe('ProfileInputsPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getDoc.mockResolvedValue({ exists: () => false });
    setDoc.mockResolvedValue(undefined);
  });

  it('renders default profile values and an empty name field', () => {
    renderWithProviders(<ProfileInputsPanel />);

    expect(screen.getByLabelText<HTMLInputElement>(/profile name/i)).toHaveValue('');
    expect(screen.getByLabelText<HTMLSelectElement>(/units/i)).toHaveValue('imperial');
    expect(screen.getByLabelText<HTMLInputElement>(/starting weight/i)).toHaveValue(265);
    expect(screen.getByLabelText<HTMLSelectElement>(/fitness goal/i)).toHaveValue('alpinist-ready');
    expect(screen.getByLabelText<HTMLInputElement>(/diet start date/i)).toHaveValue('2025-10-17');
  });

  it('switches to metric units and converts the inputs', () => {
    renderWithProviders(<ProfileInputsPanel />);

    fireEvent.change(screen.getByLabelText<HTMLSelectElement>(/units/i), { target: { value: 'metric' } });

    expect(Number(screen.getByLabelText<HTMLInputElement>(/starting weight/i).value)).toBeCloseTo(120.2, 1);
    expect(Number(screen.getByLabelText<HTMLInputElement>(/height \(cm\)/i).value)).toBeCloseTo(179.1, 1);
  });

  it('persists the profile to Firestore once a name is provided', async () => {
    renderWithProviders(<ProfileInputsPanel />);

    const nameInput = screen.getByLabelText<HTMLInputElement>(/profile name/i);
    fireEvent.change(nameInput, { target: { value: 'Ava' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalled();
    });

    const lastCall = setDoc.mock.calls[setDoc.mock.calls.length - 1] ?? [];
    const [docRef, payload] = lastCall as [unknown, { profile?: { name: string } }];
    expect(docRef).toMatchObject({ path: 'profiles/Ava' });
    expect(payload).toMatchObject({ profile: expect.objectContaining({ name: 'Ava' }) });
    expect(window.localStorage.getItem('vlcd-last-profile-name')).toBe('Ava');
  });

  it('hydrates profile details from Firestore when the last name is stored', async () => {
    const storedState: AppState = {
      profile: {
        name: 'Remy',
        unitSystem: 'imperial',
        startDate: '2025-05-10',
        startWeightKg: poundsToKilograms(240),
        heightCm: 170,
        age: 32,
        sex: 'female',
        goal: 'feel-great',
        defaultCalories: 950,
        defaultActivityLevel: 'moderate'
      },
      plans: {},
      measurements: {}
    };
    window.localStorage.setItem('vlcd-last-profile-name', 'Remy');
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => storedState
    });

    renderWithProviders(<ProfileInputsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>(/profile name/i)).toHaveValue('Remy');
    });

    expect(screen.getByLabelText<HTMLSelectElement>(/units/i)).toHaveValue('imperial');
    expect(screen.getByLabelText<HTMLInputElement>(/planned calories per day/i)).toHaveValue(950);
  });

  it('clears the remote profile when reset is triggered', async () => {
    const existingProfile: Profile = {
      name: 'Resettable',
      unitSystem: 'imperial',
      startDate: '2025-01-01',
      startWeightKg: poundsToKilograms(250),
      heightCm: 178,
      age: 45,
      sex: 'male',
      goal: 'feel-great',
      defaultCalories: 900,
      defaultActivityLevel: 'light'
    };
    const initialState: AppState = {
      profile: existingProfile,
      plans: { '2025-01-02': { date: '2025-01-02', calories: 850, activityLevel: 'light' } },
      measurements: { '2025-01-03': { date: '2025-01-03', weightKg: poundsToKilograms(248), fasted: true } }
    };

    renderWithProviders(<ProfileInputsPanel />, { initialState });

    fireEvent.click(screen.getByRole('button', { name: /reset everything/i }));

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalled();
    });

    const finalCall = setDoc.mock.calls[setDoc.mock.calls.length - 1] ?? [];
    const payload = finalCall[1] as { profile: null; plans: Record<string, unknown>; measurements: Record<string, unknown> };
    expect(payload).toMatchObject({ profile: null, plans: {}, measurements: {} });
  });

  it('remembers baseline collapse state between renders', async () => {
    renderWithProviders(<ProfileInputsPanel />);

    const hideButton = screen.getByRole('button', { name: /hide starting setup/i });
    fireEvent.click(hideButton);

    await waitFor(() => {
      expect(window.localStorage.getItem('vlcd-baseline-collapsed')).toBe('true');
    });

    expect(screen.queryByLabelText(/diet start date/i)).not.toBeInTheDocument();

    vi.clearAllMocks();
    renderWithProviders(<ProfileInputsPanel />);

    expect(screen.queryByLabelText(/diet start date/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /edit starting setup/i }));
    expect(screen.getByLabelText(/diet start date/i)).toBeInTheDocument();
  });
});
