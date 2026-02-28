/**
 * Unit tests for API cache utility functions in client.ts.
 * Tests invalidateStammdatenCache and invalidateCachePath.
 */
import { describe, it, expect } from 'vitest';

// Mock localStorage before importing
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

import { invalidateStammdatenCache, invalidateCachePath } from '../api/client';

describe('invalidateStammdatenCache', () => {
  it('is a callable function', () => {
    expect(typeof invalidateStammdatenCache).toBe('function');
  });

  it('does not throw when called', () => {
    expect(() => invalidateStammdatenCache()).not.toThrow();
  });

  it('can be called multiple times without error', () => {
    expect(() => {
      invalidateStammdatenCache();
      invalidateStammdatenCache();
    }).not.toThrow();
  });
});

describe('invalidateCachePath', () => {
  it('is a callable function', () => {
    expect(typeof invalidateCachePath).toBe('function');
  });

  it('does not throw when called with a valid path', () => {
    expect(() => invalidateCachePath('/api/employees')).not.toThrow();
  });

  it('does not throw when called with unknown path', () => {
    expect(() => invalidateCachePath('/api/non-existent')).not.toThrow();
  });
});
