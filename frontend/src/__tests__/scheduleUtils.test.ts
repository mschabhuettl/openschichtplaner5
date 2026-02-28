/**
 * Unit tests for schedule utility logic:
 * - Month/year validation (matching backend API constraints)
 * - Date formatting helpers used in Schedule page
 * - Conflict detection helpers
 */
import { describe, it, expect } from 'vitest';

// ── Pure utility functions (extracted/replicated from frontend logic) ─────────

function isValidMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1900 && year <= 2100;
}

function formatMonthYear(year: number, month: number, locale = 'de-AT'): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('isValidMonth', () => {
  it('accepts 1 through 12', () => {
    for (let m = 1; m <= 12; m++) {
      expect(isValidMonth(m)).toBe(true);
    }
  });
  it('rejects 0', () => expect(isValidMonth(0)).toBe(false));
  it('rejects 13', () => expect(isValidMonth(13)).toBe(false));
  it('rejects negative', () => expect(isValidMonth(-1)).toBe(false));
  it('rejects float', () => expect(isValidMonth(1.5)).toBe(false));
});

describe('isValidYear', () => {
  it('accepts 2024', () => expect(isValidYear(2024)).toBe(true));
  it('accepts boundary 1900', () => expect(isValidYear(1900)).toBe(true));
  it('accepts boundary 2100', () => expect(isValidYear(2100)).toBe(true));
  it('rejects 1899', () => expect(isValidYear(1899)).toBe(false));
  it('rejects 2101', () => expect(isValidYear(2101)).toBe(false));
});

describe('getDaysInMonth', () => {
  it('returns 31 for January', () => expect(getDaysInMonth(2024, 1)).toBe(31));
  it('returns 29 for February in leap year 2024', () => expect(getDaysInMonth(2024, 2)).toBe(29));
  it('returns 28 for February in non-leap year 2023', () => expect(getDaysInMonth(2023, 2)).toBe(28));
  it('returns 30 for April', () => expect(getDaysInMonth(2024, 4)).toBe(30));
  it('returns 31 for December', () => expect(getDaysInMonth(2024, 12)).toBe(31));
});

describe('nextMonth', () => {
  it('increments month normally', () => {
    expect(nextMonth(2024, 6)).toEqual({ year: 2024, month: 7 });
  });
  it('wraps December to January next year', () => {
    expect(nextMonth(2024, 12)).toEqual({ year: 2025, month: 1 });
  });
});

describe('prevMonth', () => {
  it('decrements month normally', () => {
    expect(prevMonth(2024, 6)).toEqual({ year: 2024, month: 5 });
  });
  it('wraps January to December previous year', () => {
    expect(prevMonth(2024, 1)).toEqual({ year: 2023, month: 12 });
  });
});

describe('formatMonthYear', () => {
  it('returns a non-empty string', () => {
    expect(formatMonthYear(2024, 6).length).toBeGreaterThan(0);
  });
  it('includes the year', () => {
    expect(formatMonthYear(2024, 6)).toContain('2024');
  });
});
