import React from 'react';
import type { JSX } from 'react';
import { useAppState } from '../lib/state';
import ProfileForm from './ProfileForm';
import LiabilityNotice from './LiabilityNotice';

export default function ProfileInputsPanel(): JSX.Element {
  const { state, setProfile, reset } = useAppState();

  return (
    <section>
      <h2>Baseline inputs</h2>
      <ProfileForm profile={state.profile} onSubmit={setProfile} submitLabel="Save profile" autoSubmit />
      <div style={{ marginTop: '0.75rem' }}>
        <button type="button" style={{ background: '#ef4444' }} onClick={() => reset()}>
          Reset everything
        </button>
      </div>
      <LiabilityNotice />
    </section>
  );
}
