/**
 * Pure Hilfsfunktionen für den Einsatzplan.
 */
import type { CSSProperties } from 'react';
import type { DayEntry } from '../api/client';
import { deCompare } from '../utils/sortOrder';
import { tint, spine } from '../utils/shiftColor';
import type { Employee, ShiftType } from '../types';

/**
 * Voreingestellte Arbeitsstunden eines Sonderdienstes für einen Tag (A6):
 * die Iststunden der gewählten Schicht am Wochentag des Datums. Index-Konvention
 * wie in der Library (calculations.day_index): DURATION0=Mo … DURATION6=So;
 * fehlt der Tageswert, gilt der Default DURATION0. Feiertage (lib-Index 7) werden
 * im Dialog nicht aufgelöst — der Planer kann den Wert frei überschreiben.
 */
export function shiftDurationForDate(shift: ShiftType | undefined, isoDate: string): number {
  if (!shift) return 0;
  const jsDay = new Date(isoDate + 'T00:00:00').getDay(); // 0=So … 6=Sa
  const libIdx = (jsDay + 6) % 7;                          // Mo=0 … So=6
  const perDay = (shift as unknown as Record<string, number | undefined>)[`DURATION${libIdx}`];
  return Number(perDay || shift.DURATION0 || 0);
}

/**
 * Aufsteigende Liste der ISO-Tagesdaten von startIso bis endIso (inklusive),
 * für die Mehrtages-Erfassung von Sonderdiensten (A6). UTC-Arithmetik vermeidet
 * Zeitzonen-/Sommerzeit-Drift. Ist endIso leer/ungültig oder vor startIso, wird
 * nur der Starttag zurückgegeben.
 */
export function datesInRange(startIso: string, endIso: string): string[] {
  const start = new Date(startIso + 'T00:00:00Z');
  if (isNaN(start.getTime())) return [];
  const end = new Date((endIso || startIso) + 'T00:00:00Z');
  if (isNaN(end.getTime()) || end < start) return [startIso];
  const out: string[] = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * IDs der Schichtarten, die in den übergebenen Einträgen besetzt sind
 * (mindestens ein eingeteilter Mitarbeiter). Abwesenheits- und Frei-Einträge
 * zählen nicht — sie werden in eigenen Zeilen geführt. Grundlage für das
 * optionale Ausblenden leerer Schichtzeilen (Spec 4.3-5 / 4.11.10-2).
 */
export function occupiedShiftIds(entries: Iterable<DayEntry>): Set<number> {
  const occupied = new Set<number>();
  for (const e of entries) {
    if (e.shift_id != null && e.kind && e.kind !== 'absence') occupied.add(e.shift_id);
  }
  return occupied;
}

/**
 * Einträge einer Zelle wie das Original ordnen (Default „Ansicht > Sortierung
 * > Name"): alphabetisch nach Mitarbeitername — über die zentrale
 * Design-System-Sortierung (utils/sortOrder).
 */
export function byEmployeeName(a: DayEntry, b: DayEntry): number {
  return deCompare(a.employee_name, b.employee_name);
}

/**
 * Effektive individuelle MA-Farbe für die Anzeigeoption „Mitarbeiternamen in
 * individuellen Farben" (Spec 4.11.10-3a): Labelfarbe CBKLABEL, Fallback
 * Planfarbe CBKSCHED — wie in der Mitarbeiterliste. Weiß/0/fehlend = keine Farbe.
 */
export function maLabelHex(
  emp: Pick<Employee, 'CBKLABEL' | 'CBKLABEL_HEX' | 'CBKSCHED' | 'CBKSCHED_HEX'> | undefined,
): string | undefined {
  if (!emp) return undefined;
  const pick = (bgr?: number, hex?: string) =>
    bgr == null || bgr === 0 || bgr === 16777215 || !hex ? undefined : hex;
  return pick(emp.CBKLABEL, emp.CBKLABEL_HEX) ?? pick(emp.CBKSCHED, emp.CBKSCHED_HEX);
}

/**
 * Namens-Badge in MA-Farbe: Tint-Fläche + 3px-Spine, Text = Schrift-Token
 * (Rohfarben nie roh rendern, docs/design-system.md §4). Ohne Farbe kein Stil.
 */
export function maBadgeStyle(hex: string | undefined, isDark: boolean): CSSProperties | undefined {
  if (!hex) return undefined;
  const theme = isDark ? 'dark' : 'light';
  return { backgroundColor: tint(hex, theme), boxShadow: `inset 3px 0 0 ${spine(hex, theme)}` };
}

/**
 * Anzeigeoption „Arbeitsplatz voranstellen" (Spec 4.11.10-3b): bei Diensten mit
 * zugeordnetem Arbeitsplatz dessen Bezeichnung als Präfix „<Arbeitsplatz>: ".
 * Abwesenheits- und Frei-Einträge bleiben ohne Präfix.
 */
export function arbeitsplatzPraefix(
  entry: Pick<DayEntry, 'kind' | 'workplace_id' | 'workplace_name'>,
): string {
  if (entry.kind !== 'shift' && entry.kind !== 'special_shift') return '';
  if (!entry.workplace_id || !entry.workplace_name) return '';
  return `${entry.workplace_name}: `;
}
