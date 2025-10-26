import React, { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useAppState } from '../lib/state';
import ProfileForm from './ProfileForm';
import LiabilityNotice from './LiabilityNotice';

export default function ProfileInputsPanel(): JSX.Element {
  const { state, setProfile, reset } = useAppState();
  const [baselineCollapsed, setBaselineCollapsed] = useState<boolean>(() => {
    /* istanbul ignore next -- tests always run in a browser-like environment */
    if (typeof window === 'undefined') {
      return false;
    }
    const seen = window.localStorage.getItem('vlcd-baseline-seen');
    if (!seen) {
      return false;
    }
    const stored = window.localStorage.getItem('vlcd-baseline-collapsed');
    return stored ? stored === 'true' : true;
  });

  useEffect(() => {
    /* istanbul ignore next -- not triggered in non-browser test runs */
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('vlcd-baseline-seen', 'true');
  }, []);

  const handleBaselineCollapsedChange = useCallback((collapsed: boolean) => {
    setBaselineCollapsed(collapsed);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('vlcd-baseline-collapsed', collapsed ? 'true' : 'false');
    }
  }, []);

  return (
    <section>
      <h2>Baseline inputs</h2>
      <ProfileForm
        profile={state.profile}
        onSubmit={setProfile}
        submitLabel="Save profile"
        autoSubmit
        baselineCollapsed={baselineCollapsed}
        onBaselineCollapsedChange={handleBaselineCollapsedChange}
      />
      <div style={{ marginTop: '0.75rem' }}>
        <button type="button" style={{ background: '#ef4444' }} onClick={() => reset()}>
          Reset everything
        </button>
      </div>
      <LiabilityNotice />
    </section>
  );
}
