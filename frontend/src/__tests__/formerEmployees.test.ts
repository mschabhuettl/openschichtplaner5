/**
 * Ehemalige Mitarbeiter ausblendbar (Befund 27): Ein MA gilt als ehemalig,
 * wenn sein Austritt (EMPEND) vor dem betrachteten Zeitraum liegt.
 */
import { describe, it, expect } from 'vitest';
import { isActiveInPeriod } from '../utils/formerEmployees';

const jan1 = new Date(2026, 0, 1);

describe('isActiveInPeriod', () => {
  it('ohne Austrittsdatum aktiv', () => {
    expect(isActiveInPeriod({ EMPEND: undefined }, jan1)).toBe(true);
    expect(isActiveInPeriod({ EMPEND: '' }, jan1)).toBe(true);
  });
  it('Austritt vor dem Zeitraum → ehemalig', () => {
    expect(isActiveInPeriod({ EMPEND: '2025-12-31' }, jan1)).toBe(false);
  });
  it('Austritt im/nach dem Zeitraum → aktiv (Vergangenheits-Ansichten bleiben vollständig)', () => {
    expect(isActiveInPeriod({ EMPEND: '2026-01-01' }, jan1)).toBe(true);
    expect(isActiveInPeriod({ EMPEND: '2026-06-30' }, jan1)).toBe(true);
  });
  it('ungültige Werte defensiv aktiv', () => {
    expect(isActiveInPeriod({ EMPEND: 'kaputt' }, jan1)).toBe(true);
  });
});
