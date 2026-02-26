/**
 * frontend/src/types.ts
 * Central TypeScript interfaces for OpenSchichtplaner5 API responses.
 * Re-exports existing types and adds new ones for dashboard / schedule endpoints.
 */

// ── Re-export all existing types ──────────────────────────────────────────────
export type {
  Employee,
  Group,
  ShiftType,
  LeaveType,
  Holiday,
  Workplace,
  ScheduleEntry,
  User,
  Stats,
  ExtraCharge,
} from './types/index';

// Alias: Shift is the same as ShiftType (public-facing name)
import type { ShiftType } from './types/index';
export type Shift = ShiftType;

// ── New interfaces ────────────────────────────────────────────────────────────

/** A single employee's assignment on a specific day */
export interface DayEntry {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  shift_id: number | null;
  shift_name: string;
  shift_short: string;
  color_bk: string;
  color_text: string;
  workplace_id: number | null;
  workplace_name: string;
  kind: 'shift' | 'special_shift' | 'absence' | null;
  leave_name: string;
  display_name: string;
}

/** Absence record (absence-kind DayEntry with extra metadata) */
export interface Absence {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  leave_name: string;
  color_bk: string;
  color_text: string;
  display_name: string;
  date?: string;
}

/** Aggregated day view: a date plus all employee assignments */
export interface DaySchedule {
  date: string;
  entries: DayEntry[];
}

/** Week view response from /api/schedule/week */
export interface WeekSchedule {
  week_start: string;
  week_end: string;
  days: DaySchedule[];
}

/** Per-employee monthly statistics */
export interface EmployeeStats {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  target_hours: number;
  actual_hours: number;
  absence_days: number;
  overtime_hours: number;
  vacation_used: number;
}

/**
 * Yearly statistics entry (one row per employee, aggregated for a year).
 * Maps to the task-requested shape: soll_hours / ist_hours / delta / absence_days.
 */
export interface Statistics {
  employee_id: number;
  name: string;
  soll_hours: number;
  ist_hours: number;
  delta: number;
  absence_days: number;
}

/** Month summary used in year overview per employee */
export interface MonthSummary {
  month: number;
  shifts: number;
  absences: number;
  target_hours: number;
  actual_hours: number;
  label_counts: Record<string, number>;
}
