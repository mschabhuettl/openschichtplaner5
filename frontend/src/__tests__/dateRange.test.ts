/** Tests für den Von/Bis-Zeitraum des besonderen Personalbedarfs (V-11, R5.13-3). */
import { describe, it, expect } from 'vitest';
import { expandDateRange, MAX_SPECIAL_RANGE_DAYS } from '../utils/dateRange';

describe('expandDateRange', () => {
  it('einzelner Tag, wenn Bis leer ist', () => {
    expect(expandDateRange('2026-06-10', '')).toEqual(['2026-06-10']);
  });

  it('expandiert Von/Bis zu Einzeltagen (inklusive)', () => {
    expect(expandDateRange('2026-06-29', '2026-07-02')).toEqual([
      '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02',
    ]);
  });

  it('liefert [] bei Bis < Von oder fehlendem Von', () => {
    expect(expandDateRange('2026-06-10', '2026-06-09')).toEqual([]);
    expect(expandDateRange('', '2026-06-09')).toEqual([]);
  });

  it('begrenzt die Länge auf MAX_SPECIAL_RANGE_DAYS + 1 (Überlänge erkennbar)', () => {
    const result = expandDateRange('2026-01-01', '2026-12-31');
    expect(result.length).toBe(MAX_SPECIAL_RANGE_DAYS + 1);
  });
});
