import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '../test-utils';
import { usePulseOnChange } from '../hooks/usePulseOnChange';

describe('usePulseOnChange', () => {
  it('activates briefly when the observed value changes', () => {
    vi.useFakeTimers();

    function PulseProbe({ value }: { value: string }) {
      const active = usePulseOnChange(value, 100);
      return <span data-testid="pulse-state">{active ? 'active' : 'idle'}</span>;
    }

    const { rerender } = render(<PulseProbe value="initial" />);
    expect(screen.getByTestId('pulse-state')).toHaveTextContent('idle');

    rerender(<PulseProbe value="updated" />);

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByTestId('pulse-state')).toHaveTextContent('active');

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByTestId('pulse-state')).toHaveTextContent('idle');

    vi.useRealTimers();
  });

  it('restarts the pulse when values change in quick succession', () => {
    vi.useFakeTimers();

    function PulseProbe({ value }: { value: string }) {
      const active = usePulseOnChange(value, 200);
      return <span data-testid="pulse-state">{active ? 'active' : 'idle'}</span>;
    }

    const { rerender } = render(<PulseProbe value="a" />);

    rerender(<PulseProbe value="b" />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByTestId('pulse-state')).toHaveTextContent('active');

    rerender(<PulseProbe value="c" />);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId('pulse-state')).toHaveTextContent('active');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('pulse-state')).toHaveTextContent('idle');

    vi.useRealTimers();
  });

  it('cleans up timers when the observing component unmounts', () => {
    vi.useFakeTimers();

    function PulseProbe({ value }: { value: string }) {
      const active = usePulseOnChange(value, 200);
      return <span data-testid="pulse-state">{active ? 'active' : 'idle'}</span>;
    }

    const { rerender, unmount } = render(<PulseProbe value="first" />);
    rerender(<PulseProbe value="second" />);

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
