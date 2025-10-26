import { useCallback, useEffect, useState } from 'react';

const SEEN_KEY = 'vlcd-baseline-seen';
const COLLAPSED_KEY = 'vlcd-baseline-collapsed';

export function useBaselineEditorState(): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    /* istanbul ignore next -- server environments do not provide window */
    if (typeof window === 'undefined') {
      return false;
    }
    const seen = window.localStorage.getItem(SEEN_KEY);
    if (!seen) {
      return false;
    }
    const stored = window.localStorage.getItem(COLLAPSED_KEY);
    return stored ? stored === 'true' : true;
  });

  useEffect(() => {
    /* istanbul ignore next -- server environments do not provide window */
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(SEEN_KEY, 'true');
  }, []);

  const update = useCallback((nextCollapsed: boolean) => {
    setCollapsed(nextCollapsed);
    /* istanbul ignore next -- server environments do not provide window */
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COLLAPSED_KEY, nextCollapsed ? 'true' : 'false');
    }
  }, []);

  return [collapsed, update];
}

