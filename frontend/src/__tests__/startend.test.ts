/** Tests für die STARTEND-Arbeitszeit-Logik (Spec D-30/D-31/D-34, R5.5-9/-10/-13). */
import { describe, it, expect } from 'vitest';
import {
  parseStartendIntervals,
  validateStartend,
  computeStartendHours,
  buildShiftTimeFields,
} from '../utils/startend';

describe('parseStartendIntervals', () => {
  it('leer/undefined → []', () => {
    expect(parseStartendIntervals('')).toEqual([]);
    expect(parseStartendIntervals(null)).toEqual([]);
    expect(parseStartendIntervals(undefined)).toEqual([]);
  });

  it('füllt einstellige Stunden auf HH:MM auf', () => {
    expect(parseStartendIntervals('8:00-16:00')).toEqual([{ start: '08:00', end: '16:00' }]);
  });

  it('zerlegt bis zu drei leerzeichengetrennte Zeiträume', () => {
    expect(parseStartendIntervals('08:00-12:00 12:30-16:30')).toEqual([
      { start: '08:00', end: '12:00' },
      { start: '12:30', end: '16:30' },
    ]);
  });

  it('ungültige Tokens werden mit leerem end mitgeliefert', () => {
    expect(parseStartendIntervals('abc')).toEqual([{ start: 'abc', end: '' }]);
  });
});

describe('validateStartend', () => {
  it('leer ist gültig (an dem Tag nicht gültig) → null', () => {
    expect(validateStartend('')).toBeNull();
    expect(validateStartend(null)).toBeNull();
  });

  it('gültiger Einzel-/Mehrfachzeitraum → null', () => {
    expect(validateStartend('08:00-16:00')).toBeNull();
    expect(validateStartend('08:00-12:00 13:00-17:00')).toBeNull();
  });

  it('mehr als drei Zeiträume → Fehler (R5.5-9)', () => {
    expect(validateStartend('06:00-07:00 08:00-09:00 10:00-11:00 12:00-13:00')).toMatch(/drei/i);
  });

  it('ungültiges Format → Fehler', () => {
    expect(validateStartend('0800-1600')).toMatch(/Ungültiger Zeitraum/);
  });

  it('ungültige Uhrzeit (Stunde > 23 / Minute > 59) → Fehler', () => {
    expect(validateStartend('25:00-08:00')).toMatch(/Ungültige Uhrzeit/);
    expect(validateStartend('08:60-16:00')).toMatch(/Ungültige Uhrzeit/);
  });
});

describe('computeStartendHours', () => {
  it('einfacher Zeitraum', () => {
    expect(computeStartendHours('08:00-16:00')).toBe(8);
    expect(computeStartendHours('08:15-16:45')).toBe(8.5);
  });

  it('Tageswechsel: Ende <= Beginn zählt +24h (R5.5-10/D-30)', () => {
    expect(computeStartendHours('22:00-06:00')).toBe(8);
    expect(computeStartendHours('16:00-00:00')).toBe(8); // bis Mitternacht
  });

  it('Ende == Beginn = voller Tag (24h)', () => {
    expect(computeStartendHours('00:00-00:00')).toBe(24);
  });

  it('Summe mehrerer Zeiträume', () => {
    expect(computeStartendHours('08:00-12:00 12:30-16:30')).toBe(8);
  });

  it('leer/ungültig → 0', () => {
    expect(computeStartendHours('')).toBe(0);
    expect(computeStartendHours('garbage')).toBe(0);
    expect(computeStartendHours('25:00-08:00')).toBe(0);
  });
});

describe('buildShiftTimeFields', () => {
  it('belegt je Tagestyp STARTEND/DURATION; leere Tage → ""/0 (Aufrufer liefert alle 8 Zeilen)', () => {
    const rows = [
      { startend: '08:00-16:00', duration: 8 },
      ...Array.from({ length: 7 }, () => ({ startend: '', duration: 0 })),
    ];
    const fields = buildShiftTimeFields(rows);
    expect(fields.STARTEND0).toBe('08:00-16:00');
    expect(fields.DURATION0).toBe(8);
    expect(fields.STARTEND7).toBe('');
    expect(fields.DURATION7).toBe(0);
  });

  it('leerer Tag → DURATION auf 0 gezwungen, auch wenn duration gesetzt wäre', () => {
    const fields = buildShiftTimeFields([{ startend: '  ', duration: 5 }]);
    expect(fields.STARTEND0).toBe('');
    expect(fields.DURATION0).toBe(0);
  });

  it('begrenzt auf 8 Tagestypen (0..7)', () => {
    const rows = Array.from({ length: 10 }, () => ({ startend: '08:00-16:00', duration: 8 }));
    const fields = buildShiftTimeFields(rows);
    expect(fields.STARTEND8).toBeUndefined();
    expect(Object.keys(fields).filter(k => k.startsWith('STARTEND')).length).toBe(8);
  });
});
