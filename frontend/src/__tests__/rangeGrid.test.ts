/**
 * Unit-Tests der Zeitraum-Raster-Helfer (Spec 7.4.1, Berichte #2/#5/#6):
 * Tagesspalten über Monats-/Jahresgrenzen inkl. KW/WE/Feiertags-Flags,
 * Monats-Ableitung für die API-Calls, Wochen-Blöcke für den Seitenumbruch
 * und die Von/Bis-Validierung.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_RANGE_DAYS,
  rangeDayCount,
  validateRange,
  buildRangeDays,
  monthsInRange,
  chunkIntoWeekBlocks,
} from '../utils/rangeGrid';

describe('rangeDayCount', () => {
  it('zählt beide Grenztage mit', () => {
    expect(rangeDayCount('2026-07-01', '2026-07-01')).toBe(1);
    expect(rangeDayCount('2026-07-27', '2026-08-09')).toBe(14);
    expect(rangeDayCount('2026-01-01', '2026-07-04')).toBe(185);
  });
});

describe('validateRange', () => {
  it('meldet leere Felder', () => {
    expect(validateRange('', '2026-07-01')).toMatch(/Von\/Bis/);
    expect(validateRange('2026-07-01', '')).toMatch(/Von\/Bis/);
  });

  it('meldet ungültige Reihenfolge', () => {
    expect(validateRange('2026-07-02', '2026-07-01')).toMatch(/Von-Datum/);
  });

  it('erlaubt genau ein Halbjahr (185 Tage), lehnt 186 Tage ab', () => {
    expect(validateRange('2026-01-01', '2026-07-04')).toBeNull();
    expect(validateRange('2026-01-01', '2026-07-05')).toMatch(/185/);
  });

  it('akzeptiert einen gültigen 14-Tage-Zeitraum', () => {
    expect(validateRange('2026-07-27', '2026-08-09')).toBeNull();
  });
});

describe('buildRangeDays', () => {
  it('leitet Tage über die Monatsgrenze mit Wochentag, KW und WE-Flags ab', () => {
    // Mo 27.07.2026 – So 02.08.2026 = genau KW 31
    const days = buildRangeDays('2026-07-27', '2026-08-02', new Set());
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({
      date: '2026-07-27', day: 27, month: 7, year: 2026,
      weekday: 1, isoWeek: 31, isWeekend: false, isHoliday: false,
    });
    expect(days[4]).toMatchObject({ date: '2026-07-31', month: 7, weekday: 5, isWeekend: false });
    expect(days[5]).toMatchObject({ date: '2026-08-01', day: 1, month: 8, weekday: 6, isWeekend: true });
    expect(days[6]).toMatchObject({ date: '2026-08-02', weekday: 0, isWeekend: true });
    expect(days.every(d => d.isoWeek === 31)).toBe(true);
  });

  it('setzt das Feiertags-Flag aus der Datumsmenge', () => {
    const days = buildRangeDays('2026-12-28', '2027-01-03', new Set(['2027-01-01']));
    expect(days).toHaveLength(7);
    const jan1 = days.find(d => d.date === '2027-01-01');
    expect(jan1).toMatchObject({ isHoliday: true, year: 2027, isoWeek: 53 });
    expect(days.filter(d => d.isHoliday)).toHaveLength(1);
    // Jahresgrenze: KW 53 läuft durch
    expect(days.every(d => d.isoWeek === 53)).toBe(true);
  });

  it('liefert leer bei ungültiger Reihenfolge und kappt bei MAX_RANGE_DAYS', () => {
    expect(buildRangeDays('2026-07-02', '2026-07-01', new Set())).toEqual([]);
    expect(buildRangeDays('', '2026-07-01', new Set())).toEqual([]);
    expect(buildRangeDays('2026-01-01', '2027-12-31', new Set())).toHaveLength(MAX_RANGE_DAYS);
  });
});

describe('monthsInRange', () => {
  it('liefert alle berührten Monate inklusive Rändern', () => {
    expect(monthsInRange('2026-07-15', '2026-09-01')).toEqual([
      { year: 2026, month: 7 }, { year: 2026, month: 8 }, { year: 2026, month: 9 },
    ]);
    expect(monthsInRange('2026-07-01', '2026-07-31')).toEqual([{ year: 2026, month: 7 }]);
  });

  it('funktioniert über die Jahresgrenze', () => {
    expect(monthsInRange('2026-12-28', '2027-01-03')).toEqual([
      { year: 2026, month: 12 }, { year: 2027, month: 1 },
    ]);
  });

  it('liefert leer bei ungültigem Bereich', () => {
    expect(monthsInRange('2026-08-01', '2026-07-01')).toEqual([]);
  });
});

describe('chunkIntoWeekBlocks', () => {
  it('lässt kurze Zeiträume in einem Block (14-Tage-Aushang)', () => {
    const days = buildRangeDays('2026-07-27', '2026-08-09', new Set());
    const blocks = chunkIntoWeekBlocks(days);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveLength(14);
  });

  it('schneidet lange Zeiträume nur an Montagen, max. 28 Tage je Block', () => {
    // Mo 29.06.2026 + 35 Tage → 28 (4 Wochen) + 7
    const days = buildRangeDays('2026-06-29', '2026-08-02', new Set());
    expect(days).toHaveLength(35);
    const blocks = chunkIntoWeekBlocks(days);
    expect(blocks.map(b => b.length)).toEqual([28, 7]);
    expect(blocks[1][0].weekday).toBe(1); // Folgeblock beginnt am Montag
  });

  it('behandelt Randwochen: Start mitten in der Woche', () => {
    // Mi 01.07.2026, 10 Tage, maxDays 7 → Mi–So (5) + Mo–Fr (5)
    const days = buildRangeDays('2026-07-01', '2026-07-10', new Set());
    const blocks = chunkIntoWeekBlocks(days, 7);
    expect(blocks.map(b => b.length)).toEqual([5, 5]);
    expect(blocks[0][0].weekday).toBe(3);
    expect(blocks[1][0].weekday).toBe(1);
    // kein Tag geht verloren, Reihenfolge bleibt
    expect(blocks.flat().map(d => d.date)).toEqual(days.map(d => d.date));
  });

  it('ein Halbjahr ergibt lückenlose Blöcke mit Montags-Schnitten', () => {
    const days = buildRangeDays('2026-01-01', '2026-06-30', new Set());
    const blocks = chunkIntoWeekBlocks(days);
    expect(blocks.flat()).toHaveLength(days.length);
    for (const b of blocks) expect(b.length).toBeLessThanOrEqual(28);
    for (const b of blocks.slice(1)) expect(b[0].weekday).toBe(1);
  });
});
