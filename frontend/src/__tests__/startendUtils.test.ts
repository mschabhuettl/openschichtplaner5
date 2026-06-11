/**
 * Tests für STARTEND-Parsing/Validierung (V-10, Spec D-31/R5.5-9..13):
 * bis zu 3 Zeiträume je Tagestyp, Tageswechsel-Regel, Auto-Berechnung.
 */
import { describe, it, expect } from 'vitest';
import {
  DAY_TYPES,
  parseStartendIntervals,
  validateStartend,
  computeStartendHours,
  buildShiftTimeFields,
} from '../utils/startend';

describe('DAY_TYPES', () => {
  it('hat 8 Tagestypen mit Ft als 8. Eintrag (D-34)', () => {
    expect(DAY_TYPES).toHaveLength(8);
    expect(DAY_TYPES[0]).toBe('Mo');
    expect(DAY_TYPES[6]).toBe('So');
    expect(DAY_TYPES[7]).toBe('Ft');
  });
});

describe('parseStartendIntervals', () => {
  it('parst einen einzelnen Zeitraum', () => {
    expect(parseStartendIntervals('06:00-14:00')).toEqual([{ start: '06:00', end: '14:00' }]);
  });

  it('parst drei leerzeichengetrennte Zeiträume (geteilter Dienst)', () => {
    expect(parseStartendIntervals('06:00-10:00 12:00-15:00 17:00-20:00')).toEqual([
      { start: '06:00', end: '10:00' },
      { start: '12:00', end: '15:00' },
      { start: '17:00', end: '20:00' },
    ]);
  });

  it('normalisiert einstellige Stunden (D-29: H:MM erlaubt)', () => {
    expect(parseStartendIntervals('6:00-14:00')).toEqual([{ start: '06:00', end: '14:00' }]);
  });

  it('liefert [] für leer/null/undefined', () => {
    expect(parseStartendIntervals('')).toEqual([]);
    expect(parseStartendIntervals('   ')).toEqual([]);
    expect(parseStartendIntervals(null)).toEqual([]);
    expect(parseStartendIntervals(undefined)).toEqual([]);
  });
});

describe('validateStartend', () => {
  it('akzeptiert leeren String (Tag nicht gültig)', () => {
    expect(validateStartend('')).toBeNull();
    expect(validateStartend(null)).toBeNull();
  });

  it('akzeptiert 1 bis 3 Zeiträume', () => {
    expect(validateStartend('06:00-14:00')).toBeNull();
    expect(validateStartend('06:00-10:00 14:00-18:00')).toBeNull();
    expect(validateStartend('06:00-10:00 12:00-15:00 17:00-20:00')).toBeNull();
  });

  it('lehnt mehr als 3 Zeiträume ab (R5.5-9)', () => {
    expect(validateStartend('06:00-08:00 09:00-10:00 11:00-12:00 13:00-14:00')).toMatch(/drei Zeiträume/);
  });

  it('lehnt ungültiges Format ab', () => {
    expect(validateStartend('06:00')).toMatch(/Ungültiger Zeitraum/);
    expect(validateStartend('abc-def')).toMatch(/Ungültiger Zeitraum/);
    expect(validateStartend('06:00–14:00')).toMatch(/Ungültiger Zeitraum/); // Gedankenstrich
  });

  it('lehnt ungültige Uhrzeiten ab', () => {
    expect(validateStartend('25:00-26:00')).toMatch(/Ungültige Uhrzeit/);
    expect(validateStartend('06:75-14:00')).toMatch(/Ungültige Uhrzeit/);
  });
});

describe('computeStartendHours', () => {
  it('berechnet die Summe eines Zeitraums', () => {
    expect(computeStartendHours('06:00-14:00')).toBe(8);
  });

  it('summiert mehrere Zeiträume', () => {
    expect(computeStartendHours('06:00-10:00 14:00-18:30')).toBe(8.5);
  });

  it('Tageswechsel: Ende <= Beginn zählt +24h (R5.5-10)', () => {
    expect(computeStartendHours('22:00-06:00')).toBe(8);
    // Ende == Beginn → voller 24h-Umlauf
    expect(computeStartendHours('08:00-08:00')).toBe(24);
  });

  it('rundet auf 2 Nachkommastellen', () => {
    expect(computeStartendHours('06:00-06:50')).toBe(0.83);
  });

  it('liefert 0 für leere oder ungültige Strings', () => {
    expect(computeStartendHours('')).toBe(0);
    expect(computeStartendHours('kaputt')).toBe(0);
  });
});

describe('buildShiftTimeFields', () => {
  it('mappt 8 Zeilen auf STARTEND0..7/DURATION0..7 (0=Mo..7=Ft)', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      i < 5
        ? { startend: '06:00-14:00', duration: 8 }
        : { startend: '', duration: 0 },
    );
    const fields = buildShiftTimeFields(rows);
    expect(fields.STARTEND0).toBe('06:00-14:00');
    expect(fields.DURATION0).toBe(8);
    expect(fields.STARTEND4).toBe('06:00-14:00');
    // Sa/So/Ft nicht gültig → leer/0 (löscht Altwerte beim Update)
    expect(fields.STARTEND5).toBe('');
    expect(fields.DURATION5).toBe(0);
    expect(fields.STARTEND7).toBe('');
    expect(fields.DURATION7).toBe(0);
  });

  it('setzt DURATION auf 0, wenn keine Zeiten definiert sind', () => {
    const rows = Array.from({ length: 8 }, () => ({ startend: '', duration: 5 }));
    const fields = buildShiftTimeFields(rows);
    expect(fields.DURATION0).toBe(0);
  });
});
