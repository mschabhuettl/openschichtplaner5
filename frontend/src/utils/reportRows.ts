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
