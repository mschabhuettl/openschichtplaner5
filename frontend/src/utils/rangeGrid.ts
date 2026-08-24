/**
 * Tagesspalten-Ableitung für den Dienstplan-Zeitraumdruck (Spec 7.4.1,
 * Berichte #2 Halbjahr / #5 Spezieller / #6 Sonstiger Zeitraum): freies
 * Von/Bis-Raster über Monatsgrenzen hinweg mit KW/WE/Feiertags-Flags sowie
 * Wochen-Blöcke für den Seitenumbruch beim Druck (Spec 7.4.1 Nr. 5
 * „Zeitraum je Druckseite").
 */
import { getISOWeek } from './isoWeek';

/** Maximale Zeitraumlänge = Halbjahr (Bericht #2 als längster Zeitraum-Fall). */
export const MAX_RANGE_DAYS = 185;

export interface RangeDay {
  /** ISO-Datum YYYY-MM-DD */
  date: string;
  day: number;
  /** 1–12 */
  month: number;
  year: number;
  /** 0=So … 6=Sa (wie Date.getDay()) */
  weekday: number;
  isoWeek: number;
  isWeekend: boolean;
  isHoliday: boolean;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Anzahl Tage von from bis to, beide inklusive (UTC-basiert, DST-fest). */
export function rangeDayCount(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000) + 1;
}

/** Feldfehler (deutsch) für den Von/Bis-Zeitraum oder null, wenn gültig. */
export function validateRange(from: string, to: string): string | null {
  if (!from || !to) return 'Bitte Zeitraum (Von/Bis) auswählen.';
  if (to < from) return 'Das Von-Datum muss vor dem Bis-Datum liegen.';
  const days = rangeDayCount(from, to);
  if (days > MAX_RANGE_DAYS) {
    return `Zeitraum zu lang: ${days} Tage — maximal ${MAX_RANGE_DAYS} Tage (Halbjahr).`;
  }
  return null;
}

/** Alle Tage von from bis to (inklusive) mit KW/WE/Feiertags-Flags. */
export function buildRangeDays(
  from: string,
  to: string,
  holidayDates: ReadonlySet<string>,
): RangeDay[] {
  if (!from || !to || to < from) return [];
  const days: RangeDay[] = [];
  const cur = new Date(`${from}T00:00:00`);
  const count = Math.min(rangeDayCount(from, to), MAX_RANGE_DAYS);
  for (let i = 0; i < count; i++) {
    const date = isoDate(cur);
    const weekday = cur.getDay();
    days.push({
      date,
      day: cur.getDate(),
      month: cur.getMonth() + 1,
      year: cur.getFullYear(),
      weekday,
      isoWeek: getISOWeek(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()),
      isWeekend: weekday === 0 || weekday === 6,
      isHoliday: holidayDates.has(date),
    });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Vom Zeitraum berührte (Jahr, Monat)-Paare — für die Monats-API-Calls. */
export function monthsInRange(from: string, to: string): { year: number; month: number }[] {
  if (!from || !to || to < from) return [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const months: { year: number; month: number }[] = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); ) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

/**
 * Wochen-Blöcke für den Seitenumbruch: geschnitten wird nur an Wochenanfängen
 * (Montag), je Block höchstens maxDays Tage (Default 28 = 4 Wochen je
 * Druckseite); Randwochen dürfen unvollständig sein.
 */
export function chunkIntoWeekBlocks(days: RangeDay[], maxDays = 28): RangeDay[][] {
  const weeks: RangeDay[][] = [];
  for (const d of days) {
    if (weeks.length === 0 || d.weekday === 1) weeks.push([d]);
    else weeks[weeks.length - 1].push(d);
  }
  const blocks: RangeDay[][] = [];
  let cur: RangeDay[] = [];
  for (const week of weeks) {
    if (cur.length > 0 && cur.length + week.length > maxDays) {
      blocks.push(cur);
      cur = [];
    }
    cur = cur.concat(week);
  }
  if (cur.length > 0) blocks.push(cur);
  return blocks;
}
