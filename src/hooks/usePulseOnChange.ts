import { useEffect, useRef, useState } from 'react';

export function usePulseOnChange<T>(value: T, duration = 700): boolean {
  const [active, setActive] = useState(false);
  const previous = useRef<T>(value);
  const startTimeoutRef = useRef<number | null>(null);
  const clearTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      /* istanbul ignore next -- timers only run in browser environments */
      if (typeof window === 'undefined') {
        return;
      }
      if (startTimeoutRef.current !== null) {
        window.clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
      if (clearTimeoutRef.current !== null) {
        window.clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (Object.is(previous.current, value)) {
      return;
    }
    previous.current = value;

    /* istanbul ignore next -- timers only run in browser environments */
    if (typeof window === 'undefined') {
      return;
    }

    if (startTimeoutRef.current !== null) {
      window.clearTimeout(startTimeoutRef.current);
    }
    if (clearTimeoutRef.current !== null) {
      window.clearTimeout(clearTimeoutRef.current);
    }

    startTimeoutRef.current = window.setTimeout(() => {
      setActive(true);
      clearTimeoutRef.current = window.setTimeout(() => {
        setActive(false);
        clearTimeoutRef.current = null;
      }, duration);
    }, 0);

    return () => {
      /* istanbul ignore next -- timers only run in browser environments */
      if (typeof window === 'undefined') {
        return;
      }
      if (startTimeoutRef.current !== null) {
        window.clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
      if (clearTimeoutRef.current !== null) {
        window.clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
    };
  }, [duration, value]);

  return active;
}
