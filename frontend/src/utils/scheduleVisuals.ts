/**
 * Taktwerk — reine Visual-Logik der Dienstplan-Referenzansicht:
 * Phasenkerbe (Schichtphase aus dem Dienstbeginn), Tagbogen (Tageslicht-
 * Gradient je Tagesspalte), Zeitfaden (Jetzt-Position im Raster) und
 * Saldo-Formatierung. Nur pure functions — kein React, kein DOM.
 */

export type Phase = 'frueh' | 'mitte' | 'spaet' | 'nacht';

/**
 * Phasenkerbe-Zuordnung: Dienstbeginn (Minuten seit 0:00) → Phase.
 * [03:00,10:00) früh · [15:00,21:00) spät · [21:00,03:00) nacht ·
 * sonst (Tagdienste, unbekannter Beginn) Mitte.
 */
export function phaseForStart(startMinutes: number | null): Phase {
  if (startMinutes == null || Number.isNaN(startMinutes)) return 'mitte';
  const m = ((startMinutes % 1440) + 1440) % 1440;
  if (m >= 180 && m < 600) return 'frueh';
  if (m >= 900 && m < 1260) return 'spaet';
  if (m >= 1260 || m < 180) return 'nacht';
  return 'mitte';
}

/**
 * Vertikale Kerben-Position im Chip. Referenz-Offsets (Zeilenhöhe 25px):
 * früh 2 → top 4px (oben), Mitte/spät 8 → 10px, nacht 13 → 15px (unten);
 * für andere Zeilenhöhen (kompakt 22px) proportional gerundet.
 */
const PHASE_OFFSET: Record<Phase, number> = { frueh: 2, mitte: 8, spaet: 8, nacht: 13 };

export function notchTopPx(phase: Phase, rowH: number): number {
  return Math.round((PHASE_OFFSET[phase] * rowH) / 25) + 2;
}

/**
 * Tagbogen-Stops in Prozent der Zellbreite: Nacht → Tageslicht → Nacht,
 * mit 5 %-Blendzonen an beiden Kanten (Referenz Juli: 05:20/20:50 → 22/27/82/87).
 */
export function tagbogenStops(sunriseMin: number, sunsetMin: number): {
  nightEnd: number; dayStart: number; dayEnd: number; nightStart: number;
} {
  const a = Math.round((sunriseMin / 1440) * 100);
  const b = Math.round((sunsetMin / 1440) * 100);
  return { nightEnd: a, dayStart: a + 5, dayEnd: b - 5, nightStart: b };
}

export function tagbogenGradient(
  sunriseMin: number,
  sunsetMin: number,
  nightColor: string,
  dayColor: string,
): string {
  const s = tagbogenStops(sunriseMin, sunsetMin);
  return `linear-gradient(90deg, ${nightColor} 0 ${s.nightEnd}%, ${dayColor} ${s.dayStart}% ${s.dayEnd}%, ${nightColor} ${s.nightStart}% 100%)`;
}

/**
 * Sonnenauf-/-untergang je Monat (1–12), Näherung Monatsmitte Deutschland
 * (inkl. Sommerzeit). Minuten seit 0:00. Juli = 320/1250 (05:20/20:50) —
 * Fixpunkt der Design-Referenz.
 */
const SUN_TIMES: ReadonlyArray<readonly [number, number]> = [
  [490, 990],   // Jan 08:10 / 16:30
  [450, 1050],  // Feb 07:30 / 17:30
  [390, 1110],  // Mär 06:30 / 18:30
  [380, 1215],  // Apr 06:20 / 20:15
  [330, 1260],  // Mai 05:30 / 21:00
  [305, 1290],  // Jun 05:05 / 21:30
  [320, 1250],  // Jul 05:20 / 20:50
  [360, 1230],  // Aug 06:00 / 20:30
  [410, 1170],  // Sep 06:50 / 19:30
  [460, 1100],  // Okt 07:40 / 18:20
  [450, 990],   // Nov 07:30 / 16:30
  [490, 960],   // Dez 08:10 / 16:00
];

export function sunTimesForMonth(month: number): { sunriseMin: number; sunsetMin: number } {
  const idx = Math.min(12, Math.max(1, Math.round(month))) - 1;
  const [sunriseMin, sunsetMin] = SUN_TIMES[idx];
  return { sunriseMin, sunsetMin };
}

/**
 * Zeitfaden-X-Position (px vom Panel-Innenrand):
 * Namensspalte + volle Tagesspalten + Tagesanteil der aktuellen Spalte.
 */
export function zeitfadenLeft(
  dayIndex: number,
  minutesOfDay: number,
  nameW = 178,
  cellW = 42,
): number {
  return nameW + dayIndex * cellW + Math.round((cellW * minutesOfDay) / 1440);
}

/**
 * Saldo-Format der Namenszelle: Vorzeichen immer (− = U+2212),
 * eine Nachkommastelle, Dezimal-Komma (z. B. "+3,5", "−2,0").
 */
export function formatSaldo(hours: number): string {
  const sign = hours < 0 ? '−' : '+';
  return sign + Math.abs(hours).toFixed(1).replace('.', ',');
}
