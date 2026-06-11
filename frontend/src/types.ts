/**
 * frontend/src/types.ts
 * Zentrale Stammdaten-Typen — Re-Export aus ./types/index.ts.
 *
 * Hinweis zur Auflösung: bei `import ... from '../types'` gewinnt diese Datei
 * gegen das gleichnamige Verzeichnis. Endpunkt-/Response-Typen (DayEntry,
 * WeekSchedule, EmployeeStats, MonthSummary, …) leben in src/api/client.ts.
 */

export type {
  Employee,
  Group,
  ShiftType,
  LeaveType,
  Holiday,
  HolidayInterval,
  Workplace,
  ScheduleEntry,
  User,
  Stats,
  ExtraCharge,
} from './types/index';
