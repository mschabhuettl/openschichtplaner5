/**
 * Tests for useOnlineStatus / useOnlineStatusWithFlash (browser connectivity).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus, useOnlineStatusWithFlash } from '../hooks/useOnlineStatus';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

afterEach(() => {
  setOnline(true);
  vi.useRealTimers();
});

describe('useOnlineStatus', () => {
  it('reflects the current navigator.onLine value', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('updates on offline and online events', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});

describe('useOnlineStatusWithFlash', () => {
  it('starts online with no reconnect flash', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatusWithFlash());
    expect(result.current.online).toBe(true);
    expect(result.current.justReconnected).toBe(false);
  });

  it('flags justReconnected after offline→online, then clears after 3s', () => {
    vi.useFakeTimers();
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatusWithFlash());

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.online).toBe(false);
    expect(result.current.justReconnected).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.online).toBe(true);
    expect(result.current.justReconnected).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.justReconnected).toBe(false);
  });
});
