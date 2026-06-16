import type { Period } from '../api/client';

/**
 * Erster gekennzeichneter Zeitraum (5PERIO), in den das ISO-Datum fällt (R5.10-8).
 * Start/Ende sind ISO-Strings (YYYY-MM-DD) — der String-Vergleich ist dafür korrekt.
 */
export function periodForDate(periods: Period[], dateStr: string): Period | undefined {
  return periods.find(p => p.start && p.end && dateStr >= p.start && dateStr <= p.end);
}
