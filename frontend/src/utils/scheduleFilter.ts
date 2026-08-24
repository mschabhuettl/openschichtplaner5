/**
 * Mengen-Semantik der Dienstplan-Filter (Schichtart / Abwesenheitsart /
 * Arbeitsplatz, Spec 4.7): jede Dimension ist eine Mehrfachauswahl,
 * leeres Array = „Alle" (kein Filter). Innerhalb einer Dimension gilt
 * ODER, zwischen den Dimensionen UND.
 */
export interface FilterableEntry {
  shift_id?: number | null;
  leave_type_id?: number | null;
  workplace_id?: number | null;
}

/** Aktiver Treffer: nur bei nicht-leerer Auswahl UND enthaltenem Wert. */
export function idInSelection(ids: number[], id: number | null | undefined): boolean {
  return ids.length > 0 && id != null && ids.includes(id);
}

/**
 * Zeilenfilter: Mitarbeiter-Zeile bleibt sichtbar, wenn JEDE aktive
 * Dimension von mindestens einem Eintrag des Monats getroffen wird
 * (leere Dimension zählt immer als Treffer).
 */
export function rowMatchesScheduleFilters(
  entries: FilterableEntry[],
  shiftIds: number[],
  leaveIds: number[],
  workplaceIds: number[],
): boolean {
  return (
    (shiftIds.length === 0 || entries.some(e => idInSelection(shiftIds, e.shift_id))) &&
    (leaveIds.length === 0 || entries.some(e => idInSelection(leaveIds, e.leave_type_id))) &&
    (workplaceIds.length === 0 || entries.some(e => idInSelection(workplaceIds, e.workplace_id)))
  );
}
