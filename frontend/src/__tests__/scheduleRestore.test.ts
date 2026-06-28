import { describe, it, expect } from 'vitest';
import { shiftCreateOptions, absenceTimeOptions } from '../utils/scheduleRestore';
import type { ScheduleEntry } from '../types';

function entry(p: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    employee_id: 1, date: '2026-07-01', kind: 'shift', display_name: 'F',
    color_bk: '#fff', color_text: '#000', ...p,
  };
}

describe('shiftCreateOptions (A10: Detailtreue beim Undo)', () => {
  it('übernimmt Soll-/Istplan-Typ und Arbeitsplatz, wenn gesetzt', () => {
    expect(shiftCreateOptions(entry({ schedule_type: 1, workplace_id: 5 })))
      .toEqual({ schedule_type: 1, workplace_id: 5 });
  });

  it('lässt den Default-Pfad unverändert (Istplan, kein Arbeitsplatz)', () => {
    // schedule_type 0 / kein workplace → keine Felder, damit der Default greift
    expect(shiftCreateOptions(entry({ schedule_type: 0 }))).toEqual({});
    expect(shiftCreateOptions(entry({}))).toEqual({});
  });

  it('übernimmt einzelne gesetzte Felder', () => {
    expect(shiftCreateOptions(entry({ workplace_id: 3 }))).toEqual({ workplace_id: 3 });
    expect(shiftCreateOptions(entry({ schedule_type: 1 }))).toEqual({ schedule_type: 1 });
  });
});

describe('absenceTimeOptions (A10: Teiltags-Treue beim Undo/Move)', () => {
  it('ganztägig (0/fehlend) → undefined (Default-Pfad unverändert)', () => {
    expect(absenceTimeOptions(entry({ kind: 'absence', interval: 0 }))).toBeUndefined();
    expect(absenceTimeOptions(entry({ kind: 'absence' }))).toBeUndefined();
  });

  it('Vormittag/Nachmittag (1/2): nur interval', () => {
    expect(absenceTimeOptions(entry({ kind: 'absence', interval: 1 }))).toEqual({ interval: 1 });
    expect(absenceTimeOptions(entry({ kind: 'absence', interval: 2 }))).toEqual({ interval: 2 });
  });

  it('stundenweise (3): interval + start_time/end_time (Minuten) erhalten', () => {
    expect(absenceTimeOptions(entry({ kind: 'absence', interval: 3, start_time: 480, end_time: 720 })))
      .toEqual({ interval: 3, start_time: 480, end_time: 720 });
  });
});
