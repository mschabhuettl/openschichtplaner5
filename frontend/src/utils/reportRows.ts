/**
 * Art-Bezeichnung einer Dienstplan-Zeile für den Listenbericht (A8).
 * Sollplan-Schichten (schedule_type=1, Spec 4.12) werden gekennzeichnet, damit
 * der Bericht bei der Datenbasis „Soll- & Istplan" beide unterscheidbar zeigt.
 */
export function entryArt(
  kind: string,
  source: string | null | undefined,
  scheduleType: number | undefined,
): string {
  if (kind === 'absence') return 'Abwesenheit';
  if (kind === 'special_shift') return 'Sonderdienst';
  const base = source === 'cycle' ? 'Dienst (Zyklus)' : 'Dienst';
  return scheduleType === 1 ? `${base} · Soll` : base;
}

// ── A8: Untergliederung des Listenberichts nach KW/Monat ──────────────
export type ReportGroupMode = 'none' | 'kw' | 'month';

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** ISO-8601-Kalenderwoche eines ISO-Datums (YYYY-MM-DD) → [ISO-Jahr, Woche]. */
function isoWeek(dateStr: string): [number, number] {
  const t = new Date(dateStr + 'T00:00:00Z');
  const dayNr = (t.getUTCDay() + 6) % 7;            // Mo=0 … So=6
  t.setUTCDate(t.getUTCDate() - dayNr + 3);          // Donnerstag dieser ISO-Woche
  const isoYear = t.getUTCFullYear();
  const firstThursday = t.getTime();
  t.setUTCMonth(0, 1);                               // 1. Jan des ISO-Jahres
  if (t.getUTCDay() !== 4) {
    t.setUTCMonth(0, 1 + ((4 - t.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - t.getTime()) / 604800000);
  return [isoYear, week];
}

/** Anzeige-Label der Untergruppe für ein ISO-Datum (leer bei mode='none'). */
export function reportGroupLabel(dateStr: string, mode: ReportGroupMode): string {
  if (mode === 'month') {
    return `${MONTHS_DE[Number(dateStr.slice(5, 7)) - 1]} ${dateStr.slice(0, 4)}`;
  }
  if (mode === 'kw') {
    const [y, w] = isoWeek(dateStr);
    return `KW ${String(w).padStart(2, '0')} · ${y}`;
  }
  return '';
}

/**
 * IDs der im Listenbericht anzuzeigenden Mitarbeiter (A8 „Nullzeilen"): mit
 * `showEmpty` werden auch Kandidaten ohne Einträge (z. B. alle Gruppenmitglieder)
 * aufgenommen, sonst nur Mitarbeiter mit mindestens einem Eintrag.
 */
export function withEmptyEmployees(
  idsWithEntries: number[], candidateIds: number[], showEmpty: boolean,
): number[] {
  if (!showEmpty) return [...idsWithEntries];
  return [...new Set([...idsWithEntries, ...candidateIds])];
}

/** Gruppiert datumssortierte Zeilen fortlaufend nach KW/Monat (oder gar nicht). */
export function groupReportRows<T extends { date: string }>(
  rows: T[], mode: ReportGroupMode,
): { label: string; rows: T[] }[] {
  if (mode === 'none') return [{ label: '', rows }];
  const out: { label: string; rows: T[] }[] = [];
  for (const r of rows) {
    const label = reportGroupLabel(r.date, mode);
    const last = out[out.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else out.push({ label, rows: [r] });
  }
  return out;
}
