/**
 * Tests for useKeyboardShortcuts — the global keyboard navigation hook.
 * The hook binds a document-level keydown listener, so behaviour is exercised
 * by dispatching real KeyboardEvents and asserting the navigate / toggle
 * callbacks and event.defaultPrevented.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

function mkCbs() {
  return {
    navigate: vi.fn(),
    onToggleSpotlight: vi.fn(),
    onToggleShortcuts: vi.fn(),
    onNewItem: vi.fn(),
  };
}

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  document.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('Ctrl+K and Cmd+K open the spotlight and preventDefault', () => {
    const cbs = mkCbs();
    renderHook(() => useKeyboardShortcuts(cbs));
    const ev = press('k', { ctrlKey: true });
    expect(cbs.onToggleSpotlight).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
    press('k', { metaKey: true });
    expect(cbs.onToggleSpotlight).toHaveBeenCalledTimes(2);
  });

  it('"/" opens spotlight, "?" toggles the shortcuts help', () => {
    const cbs = mkCbs();
    renderHook(() => useKeyboardShortcuts(cbs));
    expect(press('/').defaultPrevented).toBe(true);
    expect(cbs.onToggleSpotlight).toHaveBeenCalledTimes(1);
    expect(press('?').defaultPrevented).toBe(true);
    expect(cbs.onToggleShortcuts).toHaveBeenCalledTimes(1);
  });

  it('"n" triggers the new-item callback', () => {
    const cbs = mkCbs();
    renderHook(() => useKeyboardShortcuts(cbs));
    expect(press('n').defaultPrevented).toBe(true);
    expect(cbs.onNewItem).toHaveBeenCalledTimes(1);
  });

  it('"g" then a mapped key navigates (g p → /schedule)', () => {
    const cbs = mkCbs();
    renderHook(() => useKeyboardShortcuts(cbs));
    press('g');
    expect(cbs.navigate).not.toHaveBeenCalled(); // g alone is just a prefix
    expect(press('p').defaultPrevented).toBe(true);
    expect(cbs.navigate).toHaveBeenCalledWith('/schedule');
  });

  it('"g" then an unmapped key navigates nowhere', () => {
    const cbs = mkCbs();
    renderHook(() => useKeyboardShortcuts(cbs));
    press('g');
    press('z');
    expect(cbs.navigate).not.toHaveBeenCalled();
  });

  it('the "g" prefix expires after 1 s', () => {
    vi.useFakeTimers();
    const cbs = mkCbs();
    renderHook(() => useKeyboardShortcuts(cbs));
    press('g');
    vi.advanceTimersByTime(1100); // prefix window elapses
    press('p');
    expect(cbs.navigate).not.toHaveBeenCalled();
  });

  it('Alt+key navigates via the Alt map (Alt+t → /team)', () => {
    const cbs = mkCbs();
    renderHook(() => useKeyboardShortcuts(cbs));
    expect(press('t', { altKey: true }).defaultPrevented).toBe(true);
    expect(cbs.navigate).toHaveBeenCalledWith('/team');
  });

  it('ignores plain keys while typing, but Ctrl+K still fires', () => {
    const cbs = mkCbs();
    renderHook(() => useKeyboardShortcuts(cbs));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    press('/'); // typing — must be ignored
    press('n');
    expect(cbs.onToggleSpotlight).not.toHaveBeenCalled();
    expect(cbs.onNewItem).not.toHaveBeenCalled();

    press('k', { ctrlKey: true }); // global override fires even in inputs
    expect(cbs.onToggleSpotlight).toHaveBeenCalledTimes(1);
  });

  it('removes the listener on unmount', () => {
    const cbs = mkCbs();
    const { unmount } = renderHook(() => useKeyboardShortcuts(cbs));
    unmount();
    press('/');
    expect(cbs.onToggleSpotlight).not.toHaveBeenCalled();
  });
});
