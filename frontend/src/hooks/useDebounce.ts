import { useState, useEffect } from 'react';

/**
 * Debounces a value by the specified delay (default 300ms).
 * Useful for search inputs to avoid filtering on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
