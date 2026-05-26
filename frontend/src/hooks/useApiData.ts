import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiDataOptions {
  /** Don't fetch until this is true (default: true) */
  enabled?: boolean;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Manually re-trigger the fetch */
  refresh: () => void;
}

/**
 * useApiData — lightweight hook for data fetching with loading/error/retry state.
 *
 * Usage:
 *   const { data, loading, error, refresh } = useApiData(() => api.getEmployees());
 */
export function useApiData<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiDataOptions = {},
): UseApiDataResult<T> {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  // Ref to avoid stale closure in refresh
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  // Monotonic call id: only the most recent invocation may commit its result, so
  // out-of-order responses from rapid dep changes can't overwrite newer data.
  const callIdRef = useRef(0);

  const run = useCallback(async () => {
    const callId = ++callIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFnRef.current();
      if (callId === callIdRef.current) setData(result);
    } catch (err) {
      if (callId === callIdRef.current) {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    } finally {
      if (callId === callIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, loading, error, refresh: run };
}
