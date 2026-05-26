/**
 * Tests for useApiData — focuses on the staleness guard that prevents an
 * out-of-order (slow earlier) response from overwriting newer data.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApiData } from '../hooks/useApiData';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useApiData', () => {
  it('loads data and exposes it', async () => {
    const { result } = renderHook(() => useApiData(() => Promise.resolve('hello'), []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  it('surfaces errors', async () => {
    const { result } = renderHook(() =>
      useApiData(() => Promise.reject(new Error('boom')), []),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('ignores a stale (out-of-order) response — only the latest run commits', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const calls = [() => first.promise, () => second.promise];
    let i = 0;
    const fetchFn = vi.fn(() => calls[Math.min(i++, calls.length - 1)]());

    const { result } = renderHook(() => useApiData(fetchFn, []));

    // Trigger a second run before the first resolves.
    act(() => {
      result.current.refresh();
    });

    // Resolve the SECOND (latest) run first, then the FIRST (stale) one.
    await act(async () => {
      second.resolve('new');
      await second.promise;
    });
    await act(async () => {
      first.resolve('old');
      await first.promise;
    });

    // The stale 'old' response must NOT overwrite the newer 'new' value.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('new');
  });
});
