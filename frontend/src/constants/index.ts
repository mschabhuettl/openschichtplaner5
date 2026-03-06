/**
 * constants/index.ts — Zentrale Konstanten für OpenSchichtplaner5
 *
 * Alle Magic Strings und gemeinsam genutzten Werte hier zentral verwalten.
 */

// ── Benutzer-Rollen ──────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: 'Admin',
  PLANER: 'Planer',
  LESER: 'Leser',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Alle Rollen in Prioritäts-Reihenfolge (höchste zuerst) */
export const ALL_ROLES: Role[] = [ROLES.ADMIN, ROLES.PLANER, ROLES.LESER];

// ── Tausch-/Antrag-Status ────────────────────────────────────────────────────
export const SWAP_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export type SwapStatus = (typeof SWAP_STATUS)[keyof typeof SWAP_STATUS];

// ── Abwesenheits-/Urlaubs-Status ─────────────────────────────────────────────
export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type LeaveStatus = (typeof LEAVE_STATUS)[keyof typeof LEAVE_STATUS];

// ── Mitarbeiter-Sichtbarkeit ─────────────────────────────────────────────────
export const EMPLOYEE_FILTER = {
  ALL: 'all',
  ACTIVE: 'active',
  HIDDEN: 'hidden',
} as const;

export type EmployeeFilter = (typeof EMPLOYEE_FILTER)[keyof typeof EMPLOYEE_FILTER];

// ── Schicht-/Eintrag-Typen ───────────────────────────────────────────────────
export const ENTRY_KIND = {
  SHIFT: 'shift',
  SPECIAL_SHIFT: 'special_shift',
  ABSENCE: 'absence',
} as const;

export type EntryKind = (typeof ENTRY_KIND)[keyof typeof ENTRY_KIND];

// ── Simulation-Status ────────────────────────────────────────────────────────
export const SIM_STATUS = {
  OK: 'ok',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
} as const;

export type SimStatus = (typeof SIM_STATUS)[keyof typeof SIM_STATUS];

// ── Geschlechts-Codes ────────────────────────────────────────────────────────
export const SEX = {
  MALE: 1,
  FEMALE: 2,
  DIVERS: 3,
} as const;

// ── Pagination Defaults ──────────────────────────────────────────────────────
export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

// ── Lokale Storage Keys ───────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  DEV_ROLE: 'devViewRole',
  EMP_FILTER_HIDE: 'emp-filterHide',
  THEME: 'theme',
} as const;
