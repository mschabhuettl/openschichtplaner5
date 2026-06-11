/**
 * Einstiegsposition (ENTRANCE) für Schichtmodell-Zuordnungen (V-7, R6.3-4/5).
 *
 * Die API persistiert keinen separaten ENTRANCE-Wert; der Einstieg wird über
 * ein zurückgerechnetes Startdatum abgebildet: Einstieg an Position P am Tag S
 * entspricht einer Zuordnung mit Start S − P Tage (Zyklusposition =
 * (Datum − Start) mod Zykluslänge).
 */

export interface EntranceOption {
  /** 1-basierte Position (Woche bzw. Tag). */
  value: number;
  label: string;
}

/** Auswahloptionen je Modell-Einheit: Wochen (unit=1) oder Tage (unit=0). */
export function entranceOptions(unit: number, size: number): EntranceOption[] {
  const count = Math.max(1, size);
  if (unit === 1) {
    return Array.from({ length: count }, (_, i) => ({ value: i + 1, label: `Woche ${i + 1}` }));
  }
  return Array.from({ length: count }, (_, i) => ({ value: i + 1, label: `Tag ${i + 1}` }));
}

/** Tages-Offset der Einstiegsposition (1-basiert) je Einheit. */
export function entranceOffsetDays(unit: number, entrance: number): number {
  const pos = Math.max(1, entrance) - 1;
  return unit === 1 ? pos * 7 : pos;
}

/** Effektives Startdatum (ISO) = gewünschter Start minus Einstiegs-Offset. */
export function effectiveCycleStart(startISO: string, offsetDays: number): string {
  const d = new Date(`${startISO}T00:00:00`);
  if (isNaN(d.getTime())) return startISO;
  d.setDate(d.getDate() - offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
