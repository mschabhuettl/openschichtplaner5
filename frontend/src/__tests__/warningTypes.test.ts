/**
 * Unit tests for Warning type logic used in the Notifications/Warnings Center.
 * Tests the shape and type-guards for Warning objects from the API.
 */
import { describe, it, expect } from 'vitest';

// ── Type definitions mirroring the backend API response ──────────────────────

interface Warning {
  id: number;
  type: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  employee_id?: number;
  date?: string;
}

// ── Helper functions (pure logic to test) ────────────────────────────────────

function isValidWarning(w: unknown): w is Warning {
  if (typeof w !== 'object' || w === null) return false;
  const obj = w as Record<string, unknown>;
  return (
    typeof obj.id === 'number' &&
    typeof obj.type === 'string' &&
    ['info', 'warning', 'error'].includes(obj.severity as string) &&
    typeof obj.title === 'string'
  );
}

function countBySeverity(warnings: Warning[]): Record<string, number> {
  return warnings.reduce((acc, w) => {
    acc[w.severity] = (acc[w.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function filterByType(warnings: Warning[], type: string): Warning[] {
  return warnings.filter(w => w.type === type);
}

function sortByPriority(warnings: Warning[]): Warning[] {
  const priority = { error: 0, warning: 1, info: 2 };
  return [...warnings].sort((a, b) => priority[a.severity] - priority[b.severity]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('isValidWarning', () => {
  it('returns true for a valid warning object', () => {
    const w = { id: 1, type: 'overtime_exceeded', severity: 'warning', title: 'Overtime exceeded' };
    expect(isValidWarning(w)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidWarning(null)).toBe(false);
  });

  it('returns false for missing id', () => {
    expect(isValidWarning({ type: 'x', severity: 'info', title: 'T' })).toBe(false);
  });

  it('returns false for invalid severity', () => {
    expect(isValidWarning({ id: 1, type: 'x', severity: 'critical', title: 'T' })).toBe(false);
  });

  it('accepts all valid severities', () => {
    for (const sev of ['info', 'warning', 'error'] as const) {
      expect(isValidWarning({ id: 1, type: 'x', severity: sev, title: 'T' })).toBe(true);
    }
  });
});

describe('countBySeverity', () => {
  const warnings: Warning[] = [
    { id: 1, type: 'a', severity: 'error', title: 'E1' },
    { id: 2, type: 'b', severity: 'warning', title: 'W1' },
    { id: 3, type: 'c', severity: 'warning', title: 'W2' },
    { id: 4, type: 'd', severity: 'info', title: 'I1' },
  ];

  it('counts errors correctly', () => {
    expect(countBySeverity(warnings).error).toBe(1);
  });

  it('counts warnings correctly', () => {
    expect(countBySeverity(warnings).warning).toBe(2);
  });

  it('returns 0 for missing severity', () => {
    expect(countBySeverity(warnings).critical ?? 0).toBe(0);
  });

  it('handles empty array', () => {
    expect(countBySeverity([])).toEqual({});
  });
});

describe('filterByType', () => {
  const warnings: Warning[] = [
    { id: 1, type: 'overtime_exceeded', severity: 'warning', title: 'W1' },
    { id: 2, type: 'conflict', severity: 'error', title: 'E1' },
    { id: 3, type: 'overtime_exceeded', severity: 'warning', title: 'W2' },
  ];

  it('filters by type correctly', () => {
    expect(filterByType(warnings, 'overtime_exceeded')).toHaveLength(2);
  });

  it('returns empty array for unknown type', () => {
    expect(filterByType(warnings, 'nonexistent')).toHaveLength(0);
  });

  it('returns exact matches', () => {
    const result = filterByType(warnings, 'conflict');
    expect(result[0].id).toBe(2);
  });
});

describe('sortByPriority', () => {
  it('sorts error before warning before info', () => {
    const warnings: Warning[] = [
      { id: 1, type: 'a', severity: 'info', title: 'I' },
      { id: 2, type: 'b', severity: 'error', title: 'E' },
      { id: 3, type: 'c', severity: 'warning', title: 'W' },
    ];
    const sorted = sortByPriority(warnings);
    expect(sorted[0].severity).toBe('error');
    expect(sorted[1].severity).toBe('warning');
    expect(sorted[2].severity).toBe('info');
  });

  it('does not mutate original array', () => {
    const warnings: Warning[] = [
      { id: 1, type: 'a', severity: 'info', title: 'I' },
      { id: 2, type: 'b', severity: 'error', title: 'E' },
    ];
    sortByPriority(warnings);
    expect(warnings[0].severity).toBe('info');
  });
});
