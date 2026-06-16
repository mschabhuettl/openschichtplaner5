import type { ScheduleEntry } from '../types';

/**
 * Zusatzfelder, die beim Wiederherstellen eines Dienstplan-Schichteintrags
 * (Undo/Redo) erhalten bleiben müssen (A10, Detailtreue): Soll-/Istplan-Typ
 * (Spec 4.12) und Arbeitsplatz-Zuordnung (Spec 6.4). Nur gesetzte Werte werden
 * übernommen, damit der Default-Pfad (Istplan, kein Arbeitsplatz) unverändert bleibt.
 */
export function shiftCreateOptions(e: ScheduleEntry): { schedule_type?: number; workplace_id?: number } {
  const o: { schedule_type?: number; workplace_id?: number } = {};
  if (e.schedule_type) o.schedule_type = e.schedule_type;
  if (e.workplace_id) o.workplace_id = e.workplace_id;
  return o;
}
