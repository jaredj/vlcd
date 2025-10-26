import React, { useCallback, useEffect } from 'react';
import type { JSX } from 'react';
import { useAppState } from '../lib/state';
import ProfileForm from './ProfileForm';
import LiabilityNotice from './LiabilityNotice';
import { useBaselineEditorState } from '../hooks/useBaselineEditorState';

interface ProfileInputsPanelProps {
  baselineCollapsed?: boolean;
  onBaselineCollapsedChange?: (collapsed: boolean) => void;
}

export default function ProfileInputsPanel({
  baselineCollapsed: baselineCollapsedProp,
  onBaselineCollapsedChange
}: ProfileInputsPanelProps = {}): JSX.Element {
  const { state, setProfile, reset, loadProfileByName, profileName } = useAppState();
  const [internalCollapsed, setInternalCollapsed] = useBaselineEditorState();
  const baselineCollapsed = baselineCollapsedProp ?? internalCollapsed;

  useEffect(() => {
    if (baselineCollapsedProp === undefined) {
      return;
    }
    setInternalCollapsed(baselineCollapsedProp);
  }, [baselineCollapsedProp, setInternalCollapsed]);

  const handleBaselineCollapsedChange = useCallback(
    (collapsed: boolean) => {
      setInternalCollapsed(collapsed);
      onBaselineCollapsedChange?.(collapsed);
    },
    [onBaselineCollapsedChange, setInternalCollapsed]
  );

  const handleProfileNameBlur = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === (profileName ?? '').trim()) {
        return;
      }
      void loadProfileByName(trimmed);
    },
    [loadProfileByName, profileName]
  );

  return (
    <section>
      <ProfileForm
        profile={state.profile}
        profileName={profileName ?? undefined}
        onSubmit={setProfile}
        submitLabel="Save profile"
        autoSubmit
        baselineCollapsed={baselineCollapsed}
        onBaselineCollapsedChange={handleBaselineCollapsedChange}
        onProfileNameBlur={handleProfileNameBlur}
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
