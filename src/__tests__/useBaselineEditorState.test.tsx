import React from 'react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useBaselineEditorState } from '../hooks/useBaselineEditorState';

function BaselineEditorHarness(): JSX.Element {
  const [collapsed, setCollapsed] = useBaselineEditorState();

  return (
    <div>
      <span data-testid="state">{collapsed ? 'collapsed' : 'open'}</span>
      <button type="button" onClick={() => setCollapsed(!collapsed)}>
        Toggle
      </button>
    </div>
  );
}

describe('useBaselineEditorState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists the collapsed state across renders', () => {
    const { rerender } = render(<BaselineEditorHarness />);

    expect(screen.getByTestId('state')).toHaveTextContent('open');
    expect(window.localStorage.getItem('vlcd-baseline-seen')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /toggle/i }));
    expect(window.localStorage.getItem('vlcd-baseline-collapsed')).toBe('true');
    expect(screen.getByTestId('state')).toHaveTextContent('collapsed');

    rerender(<BaselineEditorHarness />);
    expect(screen.getByTestId('state')).toHaveTextContent('collapsed');
  });
});

