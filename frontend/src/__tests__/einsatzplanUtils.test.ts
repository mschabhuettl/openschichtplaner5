import { describe, it, expect } from 'vitest';
import { occupiedShiftIds, shiftDurationForDate, datesInRange } from '../pages/einsatzplanUtils';
import type { DayEntry } from '../api/client';
import type { ShiftType } from '../types';

function shift(p: Partial<ShiftType>): ShiftType {
  return {
    ID: 1, NAME: 'S', SHORTNAME: 'S', POSITION: 0,
    COLORBK: 16777215, COLORBK_HEX: '#fff', COLORTEXT: 0, COLORTEXT_HEX: '#000',
    COLORBAR_HEX: '#000', COLORBK_LIGHT: true, HIDE: false,
    TIMES_BY_WEEKDAY: {}, DURATION0: 0,
    ...p,
  };
}

function entry(p: Partial<DayEntry>): DayEntry {
  return {
    employee_id: 1, employee_name: 'X', employee_short: 'X',
    shift_id: null, shift_name: '', shift_short: '',
    color_bk: '#fff', color_text: '#000',
    workplace_id: null, workplace_name: '',
    kind: null, leave_name: '', display_name: '',
    ...p,
  };
}

describe('occupiedShiftIds', () => {
  it('collects shift ids of assigned shifts and special shifts', () => {
    const ids = occupiedShiftIds([
      entry({ shift_id: 5, kind: 'shift' }),
      entry({ shift_id: 5, kind: 'shift' }), // duplicate → one entry in set
      entry({ shift_id: 7, kind: 'special_shift' }),
    ]);
    expect([...ids].sort()).toEqual([5, 7]);
  });

  it('ignores absences and free entries', () => {
    const ids = occupiedShiftIds([
      entry({ shift_id: null, kind: 'absence', leave_name: 'Urlaub' }),
      entry({ shift_id: null, kind: null }), // frei
    ]);
    expect(ids.size).toBe(0);
  });

  it('returns an empty set for no entries', () => {
    expect(occupiedShiftIds([]).size).toBe(0);
  });
});

describe('shiftDurationForDate', () => {
  // Index-Konvention DURATION0=Mo … DURATION6=So (wie lib calculations.day_index).
  const s = shift({ DURATION0: 8, DURATION1: 7, DURATION6: 5 });

  it('liest die Tagesstunden am korrekten Wochentag-Index', () => {
    expect(shiftDurationForDate(s, '2026-06-15')).toBe(8); // Montag → DURATION0
    expect(shiftDurationForDate(s, '2026-06-16')).toBe(7); // Dienstag → DURATION1
    expect(shiftDurationForDate(s, '2026-06-21')).toBe(5); // Sonntag → DURATION6
  });

  it('fällt auf DURATION0 zurück, wenn der Tageswert 0/fehlt', () => {
    // Mittwoch (DURATION2) ist nicht gesetzt → Default DURATION0
    expect(shiftDurationForDate(s, '2026-06-17')).toBe(8);
  });

  it('liefert 0 ohne Schicht', () => {
    expect(shiftDurationForDate(undefined, '2026-06-15')).toBe(0);
  });
});

describe('datesInRange', () => {
  it('listet alle Tage inklusive Start und Ende', () => {
    expect(datesInRange('2026-06-15', '2026-06-17')).toEqual([
      '2026-06-15', '2026-06-16', '2026-06-17',
    ]);
  });

  it('überschreitet Monatsgrenzen korrekt', () => {
    expect(datesInRange('2026-06-29', '2026-07-01')).toEqual([
      '2026-06-29', '2026-06-30', '2026-07-01',
    ]);
  });

  it('gibt nur den Starttag zurück, wenn Ende leer oder vor Start liegt', () => {
    expect(datesInRange('2026-06-15', '')).toEqual(['2026-06-15']);
    expect(datesInRange('2026-06-15', '2026-06-14')).toEqual(['2026-06-15']);
    expect(datesInRange('2026-06-15', '2026-06-15')).toEqual(['2026-06-15']);
  });
});
