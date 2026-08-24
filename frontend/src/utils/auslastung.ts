/**
 * utils/auslastung — pure Helfer für den Auslastungsbereich des Dienstplans
 * (Original: Ansichten / Dienstplan – Personalauslastung, Spec 4.11.9-5/6):
 * - eigene Zusammenstellung der Auslastungszeilen (Auswahl statt automatisch alle)
 * - Personalbedarf-Unterzeile: Mindestbedarf, optional zusätzlich Maximalbedarf
 */

/** Soll-Bedarf einer Schichtart an einem Wochentag (dieselbe Quelle wie der Zell-Tooltip). */
export interface BedarfMinMax {
  min: number;
  max: number;
}

/**
 * Eigene Zusammenstellung (Spec 4.11.9-5): leere Auswahl = automatisch alle
 * aktiven Schichtarten (heutiges Bild); sonst genau die ausgewählten
 * Schichtarten — auch ohne Einträge/Soll im Monat — in der Reihenfolge von
 * `alle` (Positions-Reihenfolge bleibt erhalten).
 */
export function zusammenstellungZeilen<T extends { ID: number }>(
  aktive: T[],
  alle: T[],
  auswahlIds: number[],
): T[] {
  if (auswahlIds.length === 0) return aktive;
  const set = new Set(auswahlIds);
  return alle.filter(s => set.has(s.ID));
}

/**
 * Zelltext der Bedarfs-Unterzeile (Spec 4.11.9-5/6): Mindestbedarf; mit
 * Maximalbedarf-Option „min–max". Kein Soll (oder leeres 0/0-Soll) → leer.
 */
export function bedarfZellText(req: BedarfMinMax | undefined, maxAn: boolean): string {
  if (!req || (req.min === 0 && req.max === 0)) return '';
  return maxAn ? `${req.min}–${req.max}` : `${req.min}`;
}
