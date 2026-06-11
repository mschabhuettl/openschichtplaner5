/**
 * STARTEND-Arbeitszeit-Strings nach Spec D-31/D-34 (V-10).
 *
 * Format: `HH:MM-HH:MM[ HH:MM-HH:MM[ HH:MM-HH:MM]]` — bis zu drei
 * leerzeichengetrennte Zeiträume pro Tagestyp. Tagindex 0..7 ist
 * 0 = Montag … 6 = Sonntag, 7 = Feiertag ('Ft').
 * Ende <= Beginn bedeutet Tageswechsel (z. B. 22:00-06:00).
 */

export const DAY_TYPES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So', 'Ft'] as const;

export interface TimeInterval {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

const INTERVAL_RE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

/** Minuten seit 00:00 aus "HH:MM"; null bei ungültiger Uhrzeit. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Zerlegt einen STARTEND-String in Zeiträume. Wirft nicht; ungültige Tokens werden mitgeliefert (validateStartend prüft). */
export function parseStartendIntervals(s: string | null | undefined): TimeInterval[] {
  if (!s || !s.trim()) return [];
  return s
    .trim()
    .split(/\s+/)
    .map(tok => {
      const m = INTERVAL_RE.exec(tok);
      if (!m) return { start: tok, end: '' };
      return { start: `${m[1].padStart(2, '0')}:${m[2]}`, end: `${m[3].padStart(2, '0')}:${m[4]}` };
    });
}

/**
 * Validiert einen STARTEND-String (R5.5-9/D-31).
 * Rückgabe: null = gültig (auch leer), sonst deutsche Fehlermeldung.
 */
export function validateStartend(s: string | null | undefined): string | null {
  if (!s || !s.trim()) return null; // leer = an diesem Tag nicht gültig
  const tokens = s.trim().split(/\s+/);
  if (tokens.length > 3) return 'Maximal drei Zeiträume je Tagestyp (R5.5-9).';
  for (const tok of tokens) {
    const m = INTERVAL_RE.exec(tok);
    if (!m) return `Ungültiger Zeitraum "${tok}" — erwartet HH:MM-HH:MM.`;
    if (toMinutes(`${m[1]}:${m[2]}`) === null || toMinutes(`${m[3]}:${m[4]}`) === null) {
      return `Ungültige Uhrzeit in "${tok}".`;
    }
  }
  return null;
}

/**
 * Arbeitsstunden aus den Zeiträumen eines STARTEND-Strings (R5.5-13).
 * Ende <= Beginn zählt als Tageswechsel (+24h, R5.5-10/D-30).
 * Rückgabe auf 2 Nachkommastellen gerundet; 0 bei leerem/ungültigem String.
 */
export function computeStartendHours(s: string | null | undefined): number {
  if (validateStartend(s) !== null) return 0;
  let totalMin = 0;
  for (const iv of parseStartendIntervals(s)) {
    const start = toMinutes(iv.start);
    const end = toMinutes(iv.end);
    if (start === null || end === null) continue;
    let span = end - start;
    if (span <= 0) span += 24 * 60; // Tageswechsel
    totalMin += span;
  }
  return Math.round((totalMin / 60) * 100) / 100;
}

/** Zeile des Zeiten-Dialogs: ein Tagestyp (Index 0..7 = Mo..So, Ft). */
export interface DayTimeRow {
  startend: string;  // STARTEND-String (leer = nicht gültig)
  duration: number;  // Iststunden (Dezimalzahl)
}

/**
 * Baut die STARTEND0..7/DURATION0..7-Felder für create/updateShift.
 * Leere Tage werden mit ''/0 gesendet (PUT filtert null heraus, '' löscht).
 */
export function buildShiftTimeFields(rows: DayTimeRow[]): Record<string, string | number> {
  const fields: Record<string, string | number> = {};
  rows.slice(0, 8).forEach((row, i) => {
    fields[`STARTEND${i}`] = row.startend.trim();
    fields[`DURATION${i}`] = row.startend.trim() ? row.duration || 0 : 0;
  });
  return fields;
}
