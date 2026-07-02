/**
 * Pure Hilfsfunktionen für das Jahres-Tagesraster (V-8, Spec 4.4).
 */
import type { ScheduleEntry } from '../types';

export const MONTH_ABBR = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** Tage im Monat (month 1–12); Date-Rollover: Tag 0 des Folgemonats. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Lookup "YYYY-MM-DD" → Einträge des Tages (für EINEN Mitarbeiter).
 * Anzeige-Reihenfolge wie buildEntryMap im Dienstplan: Dienste vor
 * Abwesenheiten (Spec 6.7, stabil).
 */
export function buildDayMap(entries: ScheduleEntry[]): Map<string, ScheduleEntry[]> {
  const m = new Map<string, ScheduleEntry[]>();
  for (const e of entries) {
    const list = m.get(e.date);
    if (list) list.push(e);
    else m.set(e.date, [e]);
  }
  m.forEach(list => {
    if (list.length > 1) {
      list.sort((a, b) => (a.kind === 'absence' ? 1 : 0) - (b.kind === 'absence' ? 1 : 0));
    }
  });
  return m;
}

/** Zell-Label auf das Kürzel begrenzen (Original: gleich große Matrix-Zellen,
 *  kein Langtext wie „N-CT 5:45-15:45" aus freien Sonderdienst-Kurznamen). */
export function shortLabel(label: string): string {
  return (label || '').trim().split(/\s+/)[0] || '?';
}
