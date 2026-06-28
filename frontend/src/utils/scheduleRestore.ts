import type { ScheduleEntry } from '../types';
import type { AbsenceInterval, AbsenceTimeOptions } from '../api/client';

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

/**
 * Teiltags-Optionen einer Abwesenheit beim Wiederherstellen/Verschieben einer
 * Zelle erhalten (A10, Spec 3.5.2/D-54): interval 1=vorm./2=nachm./3=stundenweise
 * (mit start_time/end_time in Minuten). Ganztägig (0/fehlend) liefert undefined,
 * damit der Default-Pfad unverändert bleibt. Die Felder stammen aus get_schedule
 * (ab lib 1.14.0); bei älterer API sind sie undefiniert → ganztägig wie bisher.
 */
export function absenceTimeOptions(e: ScheduleEntry): AbsenceTimeOptions | undefined {
  if (!e.interval) return undefined;
  const interval = e.interval as AbsenceInterval;
  if (interval === 3) return { interval, start_time: e.start_time, end_time: e.end_time };
  return { interval };
}
