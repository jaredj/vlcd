import React from 'react';
import type { JSX } from 'react';
import { useAppState } from '../lib/state';
import type { Profile } from '../types';
import LiabilityNotice from './LiabilityNotice';
import ProfileForm from './ProfileForm';

interface ProfileSetupProps {
  onComplete?: () => void;
}

export default function ProfileSetup({ onComplete }: ProfileSetupProps): JSX.Element {
  const { state, setProfile } = useAppState();
  const existingProfile = state.profile;

  function handleSubmit(profile: Profile) {
    setProfile(profile);
    onComplete?.();
  }

  return (
    <section>
      <h2>{existingProfile ? 'Update your profile' : 'Create your VLCD profile'}</h2>
      <p>
        We will use your personal data to estimate a realistic target weight and chart how a very-low-calorie dietary approach is
        likely to evolve.
      </p>
      <ProfileForm
        profile={existingProfile}
        onSubmit={handleSubmit}
        submitLabel={existingProfile ? 'Update profile' : 'Save profile'}
      />
      <LiabilityNotice />
    </section>
  );
}
