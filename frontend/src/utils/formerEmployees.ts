import type { Employee } from '../types';

/**
 * Ist der Mitarbeiter im betrachteten Zeitraum (ab *periodStart*) noch
 * beschäftigt? Ehemalige (EMPEND vor dem Zeitraum) können in den Ansichten
 * ausgeblendet werden; ohne Austrittsdatum gilt er als aktiv. Ungültige
 * Datumswerte werden defensiv als aktiv behandelt (nie fälschlich verstecken).
 */
export function isActiveInPeriod(emp: Pick<Employee, 'EMPEND'>, periodStart: Date): boolean {
  if (!emp.EMPEND) return true;
  const end = new Date(emp.EMPEND);
  if (Number.isNaN(end.getTime())) return true;
  return end >= periodStart;
}
