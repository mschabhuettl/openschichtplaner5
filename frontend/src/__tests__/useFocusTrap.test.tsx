/**
 * Tests for useFocusTrap — accessible modal focus management: initial focus,
 * Tab/Shift+Tab cycling (skipping disabled controls), Escape, and focus
 * restoration to the trigger on close.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { useFocusTrap } from '../hooks/useFocusTrap';

function Dialog({
  active,
  onEscape,
  preferInput = false,
  withDisabled = false,
  withInput = false,
}: {
  active: boolean;
  onEscape?: () => void;
  preferInput?: boolean;
  withDisabled?: boolean;
  withInput?: boolean;
}) {
  const ref = useFocusTrap<HTMLDivElement>(active, { onEscape, preferInput });
  if (!active) return null;
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      {withInput && <input data-testid="field" />}
      <button data-testid="first">First</button>
      {withDisabled && (
        <button data-testid="disabled-mid" disabled>
          Disabled
        </button>
      )}
      <button data-testid="last">Last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('moves initial focus to the first focusable element', () => {
    const { getByTestId } = render(<Dialog active />);
    act(() => vi.runAllTimers());
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('prefers the first input when preferInput is set', () => {
    const { getByTestId } = render(<Dialog active preferInput withInput />);
    act(() => vi.runAllTimers());
    expect(document.activeElement).toBe(getByTestId('field'));
  });

  it('wraps Tab from the last element back to the first', () => {
    const { getByTestId } = render(<Dialog active />);
    act(() => vi.runAllTimers());
    getByTestId('last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('wraps Shift+Tab from the first element to the last', () => {
    const { getByTestId } = render(<Dialog active />);
    act(() => vi.runAllTimers());
    getByTestId('first').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('last'));
  });

  it('excludes disabled controls from the tab cycle', () => {
    const { getByTestId } = render(<Dialog active withDisabled />);
    act(() => vi.runAllTimers());
    // Shift+Tab from the first focusable must skip the disabled button and
    // land on the last enabled button.
    getByTestId('first').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('last'));
  });

  it('invokes onEscape when Escape is pressed', () => {
    const onEscape = vi.fn();
    render(<Dialog active onEscape={onEscape} />);
    act(() => vi.runAllTimers());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously focused element on close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(<Dialog active />);
    act(() => vi.runAllTimers());
    expect(document.activeElement).not.toBe(trigger);

    rerender(<Dialog active={false} />);
    // cleanup runs synchronously on the effect teardown
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });

  it('does not trap or focus while inactive', () => {
    const onEscape = vi.fn();
    render(<Dialog active={false} onEscape={onEscape} />);
    act(() => vi.runAllTimers());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('ignores non-Tab/Escape keys', () => {
    const { getByTestId } = render(<Dialog active />);
    act(() => vi.runAllTimers());
    getByTestId('last').focus();
    fireEvent.keyDown(document, { key: 'a' });
    // focus unchanged
    expect(document.activeElement).toBe(getByTestId('last'));
  });
});
