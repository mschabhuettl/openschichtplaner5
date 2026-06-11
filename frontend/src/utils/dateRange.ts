/** Maximale Zeitraumlänge für besonderen Bedarf (Bulk-Anlage als Einzeltage, V-11). */
export const MAX_SPECIAL_RANGE_DAYS = 92;

/** Alle ISO-Daten von from bis to (inklusive); leer bei ungültigem Bereich. */
export function expandDateRange(from: string, to: string): string[] {
  if (!from) return [];
  const end = to || from;
  if (end < from) return [];
  const dates: string[] = [];
  const cur = new Date(`${from}T00:00:00`);
  const stop = new Date(`${end}T00:00:00`);
  while (cur <= stop && dates.length <= MAX_SPECIAL_RANGE_DAYS) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
