/**
 * Tests für die ENTRANCE-Auswahllogik der Schichtmodell-Zuordnung (V-7, R6.3-4/5).
 */
import { describe, it, expect } from 'vitest';
import { entranceOptions, entranceOffsetDays, effectiveCycleStart } from '../utils/cycleEntrance';

describe('entranceOptions', () => {
  it('liefert Wochen-Optionen bei Einheit Wochen (unit=1)', () => {
    const opts = entranceOptions(1, 3);
    expect(opts).toHaveLength(3);
    expect(opts[0]).toEqual({ value: 1, label: 'Woche 1' });
    expect(opts[2]).toEqual({ value: 3, label: 'Woche 3' });
  });

  it('liefert Tag-Optionen bei Einheit Tage (unit=0)', () => {
    const opts = entranceOptions(0, 5);
    expect(opts).toHaveLength(5);
    expect(opts[0].label).toBe('Tag 1');
    expect(opts[4].label).toBe('Tag 5');
  });

  it('liefert mindestens eine Option', () => {
    expect(entranceOptions(1, 0)).toHaveLength(1);
  });
});

describe('entranceOffsetDays', () => {
  it('Woche 1 / Tag 1 = kein Offset', () => {
    expect(entranceOffsetDays(1, 1)).toBe(0);
    expect(entranceOffsetDays(0, 1)).toBe(0);
  });

  it('Wochen-Einheit: (Woche−1)·7 Tage', () => {
    expect(entranceOffsetDays(1, 2)).toBe(7);
    expect(entranceOffsetDays(1, 4)).toBe(21);
  });

  it('Tage-Einheit: (Tag−1) Tage', () => {
    expect(entranceOffsetDays(0, 3)).toBe(2);
  });
});

describe('effectiveCycleStart', () => {
  it('ohne Offset bleibt das Startdatum unverändert', () => {
    expect(effectiveCycleStart('2026-07-01', 0)).toBe('2026-07-01');
  });

  it('rechnet den Einstieg als zurückdatierten Start (Einstieg Woche 2 ab 01.07. → Start 24.06.)', () => {
    expect(effectiveCycleStart('2026-07-01', 7)).toBe('2026-06-24');
  });

  it('überquert Monats- und Jahresgrenzen korrekt', () => {
    expect(effectiveCycleStart('2026-01-03', 7)).toBe('2025-12-27');
  });

  it('lässt ungültige Eingaben unverändert', () => {
    expect(effectiveCycleStart('kein-datum', 7)).toBe('kein-datum');
  });
});
