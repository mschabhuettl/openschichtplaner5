import { describe, it, expect } from 'vitest';
import { periodForDate } from '../utils/periods';
import type { Period } from '../api/client';

function period(p: Partial<Period>): Period {
  return { id: 1, group_id: 1, start: '', end: '', color: null, description: '', ...p };
}

describe('periodForDate', () => {
  const ferien = period({ id: 7, start: '2026-07-10', end: '2026-07-20', color: '#fcd34d', description: 'Sommerferien' });
  const periods = [period({ id: 1, start: '2026-01-01', end: '2026-01-05' }), ferien];

  it('findet den Zeitraum, in den das Datum fällt (inkl. Grenzen)', () => {
    expect(periodForDate(periods, '2026-07-10')?.id).toBe(7);
    expect(periodForDate(periods, '2026-07-15')?.description).toBe('Sommerferien');
    expect(periodForDate(periods, '2026-07-20')?.id).toBe(7);
  });

  it('liefert undefined außerhalb jedes Zeitraums', () => {
    expect(periodForDate(periods, '2026-07-21')).toBeUndefined();
    expect(periodForDate(periods, '2026-06-30')).toBeUndefined();
  });

  it('ignoriert Zeiträume ohne Start/Ende', () => {
    expect(periodForDate([period({ start: '', end: '' })], '2026-07-15')).toBeUndefined();
  });
});
