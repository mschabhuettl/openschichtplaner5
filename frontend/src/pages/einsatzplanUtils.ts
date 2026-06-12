/**
 * Pure Hilfsfunktionen für den Einsatzplan.
 */
import type { DayEntry } from '../api/client';

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
