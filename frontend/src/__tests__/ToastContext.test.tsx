/**
 * Tests for ToastContext — the global toast queue with de-duplication and
 * type-dependent auto-dismiss durations. Timers are faked to drive expiry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ToastProvider, useGlobalToast } from '../contexts/ToastContext';

function setup() {
  return renderHook(() => useGlobalToast(), { wrapper: ToastProvider });
}

describe('ToastContext', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with no toasts', () => {
    const { result } = setup();
    expect(result.current.toasts).toHaveLength(0);
  });

  it('showToast adds a toast and defaults the type to success', () => {
    const { result } = setup();
    act(() => result.current.showToast('Gespeichert'));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ message: 'Gespeichert', type: 'success' });
    expect(result.current.toasts[0].id).toBeTruthy();
  });

  it('de-duplicates an identical message+type while visible', () => {
    const { result } = setup();
    act(() => result.current.showToast('Fehler', 'error'));
    act(() => result.current.showToast('Fehler', 'error'));
    expect(result.current.toasts).toHaveLength(1);
    // a different type with the same text is not a duplicate
    act(() => result.current.showToast('Fehler', 'info'));
    expect(result.current.toasts).toHaveLength(2);
  });

  it('auto-dismisses a success toast after 3000ms', () => {
    const { result } = setup();
    act(() => result.current.showToast('ok'));
    act(() => vi.advanceTimersByTime(2999));
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('keeps error toasts visible longer (5500ms)', () => {
    const { result } = setup();
    act(() => result.current.showToast('boom', 'error'));
    act(() => vi.advanceTimersByTime(3000)); // success would be gone by now
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('removeToast removes by id and frees the dedup key', () => {
    const { result } = setup();
    act(() => result.current.showToast('hi', 'info'));
    const id = result.current.toasts[0].id;
    act(() => result.current.removeToast(id));
    expect(result.current.toasts).toHaveLength(0);
    // same message can be shown again now that its key was released
    act(() => result.current.showToast('hi', 'info'));
    expect(result.current.toasts).toHaveLength(1);
  });

  it('frees the dedup key after auto-dismiss so the message can recur', () => {
    const { result } = setup();
    act(() => result.current.showToast('again'));
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.toasts).toHaveLength(0);
    act(() => result.current.showToast('again'));
    expect(result.current.toasts).toHaveLength(1);
  });

  it('useGlobalToast throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useGlobalToast())).toThrow(/within ToastProvider/);
    spy.mockRestore();
  });
});
