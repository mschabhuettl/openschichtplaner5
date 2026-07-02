/**
 * Zentrale Sortierregeln des Design-Systems (UX-Audit B2) — die EINE Quelle
 * für Reihenfolgen, original-treu:
 *
 * - Mitarbeiterlisten: alphabetisch NAME → FIRSTNAME (Original-Default
 *   „Ansicht > Sortierung > Name", wie lib get_employees).
 * - Schichten/Abwesenheitsarten als Zeilen: POSITION (Original-Reihenfolge
 *   der Stammdaten, NICHT Beginnzeit — per Wine-Orakel belegt).
 * - Dienst-Einträge innerhalb eines Tages/Kontexts: Beginnzeit, dann Name.
 */

export function deCompare(a: string | undefined, b: string | undefined): number {
  return (a || '').localeCompare(b || '', 'de');
}

/** Mitarbeiter: NAME → FIRSTNAME (→ POSITION als stabiler Tiebreaker). */
export function byNameFirstname(
  a: { NAME?: string; FIRSTNAME?: string; POSITION?: number },
  b: { NAME?: string; FIRSTNAME?: string; POSITION?: number },
): number {
  return (
    deCompare(a.NAME, b.NAME) ||
    deCompare(a.FIRSTNAME, b.FIRSTNAME) ||
    (a.POSITION ?? 0) - (b.POSITION ?? 0)
  );
}

/** Stammdaten-Zeilen (Schichten, Abwesenheitsarten): POSITION wie das Original. */
export function byPosition(
  a: { POSITION?: number; NAME?: string },
  b: { POSITION?: number; NAME?: string },
): number {
  return (a.POSITION ?? 0) - (b.POSITION ?? 0) || deCompare(a.NAME, b.NAME);
}

/** Einträge im Tageskontext: Beginnzeit (Minuten), dann Name alphabetisch. */
export function byStartTimeThenName(
  a: { start_min?: number | null; name?: string },
  b: { start_min?: number | null; name?: string },
): number {
  const sa = a.start_min ?? Number.MAX_SAFE_INTEGER;
  const sb = b.start_min ?? Number.MAX_SAFE_INTEGER;
  return sa - sb || deCompare(a.name, b.name);
}
