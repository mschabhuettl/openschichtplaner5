import type { Employee, Group, ShiftType, LeaveType, Holiday, Workplace, ScheduleEntry, User, Stats, ExtraCharge } from '../types';

// ─── Global Search Result ─────────────────────────────────
export interface SearchResult {
  type: 'employee' | 'shift' | 'leave_type' | 'group';
  id: number;
  title: string;
  subtitle: string;
  path: string;
  icon: string;
}

// ─── Workplace Employee (minimal employee info for assignment) ─
export interface WorkplaceEmployee {
  ID: number;
  NAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
  NUMBER: string;
}

// ─── Dashboard Today Types ─────────────────────────────────
export interface DashboardTodayEmployee {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  shift_name: string;
  shift_short: string;
  color_bk: string;
  color_text: string;
  workplace_name: string;
  startend: string;
}

export interface DashboardTodayAbsence {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  leave_name: string;
  color_bk: string;
  color_text: string;
  absence_type?: string;
}

export interface WeekDayData {
  date: string;
  weekday_name: string;
  weekday_short: string;
  count: number;
  is_today: boolean;
  is_weekend: boolean;
}

export interface DashboardToday {
  date: string;
  is_holiday: boolean;
  on_duty: DashboardTodayEmployee[];
  absences: DashboardTodayAbsence[];
  on_duty_count: number;
  absences_count: number;
  week_peak: {
    day: string;
    date: string;
    count: number;
  };
  week_days: WeekDayData[];
}

// ─── Dashboard Upcoming Types ──────────────────────────────
export interface UpcomingHoliday {
  date: string;
  name: string;
  recurring: boolean;
}

export interface BirthdayThisWeek {
  employee_id: number;
  name: string;
  short: string;
  date: string;
  display_date: string;
  days_until: number;
}

export interface DashboardUpcoming {
  holidays: UpcomingHoliday[];
  birthdays_this_week: BirthdayThisWeek[];
  week_start: string;
  week_end: string;
}

// ─── Dashboard Stats Types ─────────────────────────────────
export interface DayCoverage {
  day: number;
  count: number;
  is_weekend: boolean;
  is_today: boolean;
  weekday: number;
}

export interface EmployeeRankingEntry {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  shifts_count: number;
  actual_hours: number;
  target_hours: number;
  overtime_hours: number;
}

export interface DashboardStats {
  total_employees: number;
  shifts_this_month: number;
  active_shift_types: number;
  vacation_days_used: number;
  coverage_by_day: DayCoverage[];
  month: number;
  year: number;
  employee_ranking: EmployeeRankingEntry[];
}

// ─── Dashboard Summary Types ───────────────────────────────
// ─── Schedule Coverage (Personalbedarf-Ampel) ─────────────────
/** Tagesstatus der Personalbedarf-Ampel: 'none' = kein Bedarf definiert. */
export type CoverageStatus = 'under' | 'ok' | 'over' | 'none';

/** Bedarfszelle Gruppe × Schichtart eines Tages (5SHDEM-Wochenbedarf bzw. 5SPDEM-Tagesbedarf). */
export interface CoverageCell {
  group_id: number;
  shift_id: number;
  min: number;
  max: number;
  assigned: number;
  status: 'under' | 'ok' | 'over';
  source: 'SHDEM' | 'SPDEM';
}

export interface CoverageDay {
  day: number;
  date: string;
  scheduled_count: number;
  /** null, wenn für den Tag kein Bedarf definiert ist (status 'none'). */
  required_count: number | null;
  required_min: number | null;
  required_max: number | null;
  status: CoverageStatus;
  cells: CoverageCell[];
}

export interface DashboardSummary {
  employees: { total: number; active: number };
  shifts_today: {
    count: number;
    by_shift: { name: string; count: number; color: string }[];
  };
  shifts_this_month: { scheduled: number; absent: number; coverage_pct: number };
  absences_this_month: {
    total: number;
    by_type: { short: string; name: string; count: number; color: string }[];
  };
  zeitkonto_alerts: { employee: string; employee_short: string; hours_diff: number }[];
  upcoming_birthdays: { name: string; date: string; days_until: number }[];
  staffing_warnings: {
    date: string;
    shift: string;
    shift_name: string;
    actual: number;
    required: number;
    color: string;
  }[];
  groups: number;
  month_label: string;
}

// ─── Shift Cycle Types ─────────────────────────────────────
export interface CycleDay {
  index: number;
  weekday: number;
  shift_id: number | null;
  shift_name: string;
  shift_short: string;
  color_bk: string;
  color_text: string;
  workplace_id: number | null;
}

export interface ShiftCycle {
  ID: number;
  name: string;
  weeks: number;
  unit: number;
  position: number;
  pattern: string;
  schedule: CycleDay[][];  // [week][day]
}

export interface CycleAssignment {
  id: number;
  employee_id: number;
  cycle_id: number;
  start: string;
  end: string;
}

// ─── Staffing Types ────────────────────────────────────────
export interface ShiftRequirement {
  id: number;
  group_id: number;
  weekday: number;
  shift_id: number;
  shift_name: string;
  shift_short: string;
  color_bk: string;
  color_text: string;
  workplace_id: number | null;
  min: number;
  max: number;
}

export interface StaffingRequirements {
  shift_requirements: ShiftRequirement[];
  daily_requirements: unknown[];
}

// ─── Note Types ────────────────────────────────────────────
export interface BackupEntry {
  filename: string;
  size_bytes: number;
  created_at: string; // ISO 8601
}

export interface Note {
  id: number;
  employee_id: number;
  date: string;
  text1: string;
  text2: string;
  category?: string;
}

export interface NoteCreate {
  date: string;
  text: string;
  employee_id?: number;
  text2?: string;
  category?: string;
}

export interface NoteUpdate {
  text?: string;
  text2?: string;
  employee_id?: number;
  date?: string;
  category?: string;
}

// ─── Export Scheduler Types (Q070 / Q075) ─────────────────
export interface ExportSchedule {
  id: number;
  name: string;
  frequency: 'weekly';
  day_of_week: number; // 0=Sun … 6=Sat
  time: string;        // HH:MM
  format: 'xlsx' | 'csv';
  group_id: number | null;
  email_to: string[];
  enabled: boolean;
  created_at?: string;
}

export interface ExportScheduleCreate {
  name: string;
  frequency: 'weekly';
  day_of_week: number;
  time: string;
  format: 'xlsx' | 'csv';
  group_id?: number | null;
  email_to: string[];
  enabled: boolean;
}

export type ExportScheduleUpdate = Partial<ExportScheduleCreate>;

export interface ExportRunResult {
  ok: boolean;
  sent_to: number;
  smtp_not_configured?: boolean;
  message?: string;
}

// ─── Schedule Comments (Q069) ─────────────────────────────
export interface ScheduleComment {
  id: number;
  date: string;
  group_id: number;
  text: string;
  author: string;
  created_at: string;
}

// ─── Zeitkonto Types ───────────────────────────────────────
export interface ZeitkontoRow {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  total_target_hours: number;
  total_actual_hours: number;
  total_difference: number;
  total_adjustment: number;
  total_saldo: number;
}

export interface ZeitkontoMonthDetail {
  month: number;
  target_hours: number;
  actual_hours: number;
  overtime_adjustment: number;
  booking_adjustment: number;
  absence_days: number;
  difference: number;
  adjustment: number;
  saldo: number;
  running_saldo: number;
}

export interface ZeitkontoDetail {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  year: number;
  total_target_hours: number;
  total_actual_hours: number;
  total_difference: number;
  total_adjustment: number;
  total_saldo: number;
  months: ZeitkontoMonthDetail[];
}

export interface ZeitkontoSummary {
  year: number;
  group_id: number | null;
  employee_count: number;
  total_target_hours: number;
  total_actual_hours: number;
  total_saldo: number;
  positive_count: number;
  negative_count: number;
}

export interface Booking {
  id: number;
  employee_id: number;
  date: string;
  type: number;
  value: number;
  note: string;
}

// ─── User Management Types ─────────────────────────────────
export interface UserCreate {
  NAME: string;
  DESCRIP?: string;
  PASSWORD: string;
  role: 'Admin' | 'Planer' | 'Leser';
}

export interface UserUpdate {
  NAME?: string;
  DESCRIP?: string;
  PASSWORD?: string;
  role?: 'Admin' | 'Planer' | 'Leser';
}

export interface LoginResponse {
  ok: boolean;
  token: string;
  expires_at: number;
  user: {
    ID: number;
    NAME: string;
    DESCRIP: string;
    ADMIN: boolean;
    RIGHTS: number;
    role: string;
    /** Granulare Rechte (z. B. write_duties/write_absences), wie auch /api/auth/me sie liefert. */
    permissions?: Record<string, boolean>;
  };
}

// ─── Conflict Types ───────────────────────────────────────
export interface ConflictEntry {
  employee_id: number;
  employee_name?: string;
  date: string;
  type: 'shift_and_absence' | 'holiday_ban' | 'understaffing';
  shift_name?: string;
  absence_name?: string;
  message: string;
}

export interface ScheduleConflicts {
  conflicts: ConflictEntry[];
}

// ─── Settings Types ───────────────────────────────────────
export interface UsettSettings {
  ID: number;
  LOGIN: number;
  SPSHCAT: number;
  OVERTCAT: number;
  ANOANAME: string;
  ANOASHORT: string;
  ANOACRTXT: number;
  ANOACRBAR: number;
  ANOACRBK: number;
  ANOABOLD: number;
  BACKUPFR: number;
}

// ─── Special Staffing Types ───────────────────────────────
export interface SpecialStaffingReq {
  id: number;
  group_id: number;
  date: string;
  shift_id: number;
  shift_name: string;
  shift_short: string;
  color_bk: string;
  color_text: string;
  workplace_id: number | null;
  workplace_name: string;
  min: number;
  max: number;
}

// ─── Restriction Types ────────────────────────────────────
export interface Restriction {
  id: number;
  employee_id: number;
  shift_id: number;
  weekday: number;
  restrict: number;
  reason: string;
  shift_name: string;
  shift_short: string;
}

// ─── Period Types ──────────────────────────────────────────
export interface Period {
  id: number;
  group_id: number;
  start: string;
  end: string;
  color: string | null;
  description: string;
}

// ─── Notification Types ───────────────────────────────────
export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  employee_id: number | null;
  recipient_employee_id: number | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

// ─── Webhook Types ─────────────────────────────────────────
export interface WebhookDeliveryResult {
  success: boolean;
  status_code?: number;
  error?: string;
  attempt: number;
  timestamp: string;
}

export interface WebhookEntry {
  id: number;
  url: string;
  name: string;
  events: string[];
  secret: string;
  active: boolean;
  created_at: string;
  last_delivery: WebhookDeliveryResult | null;
}

// ─── Recurring Shift Types (Q066 / Q073) ─────────────────────
export type RecurringShiftRecurrence = 'weekly' | 'biweekly';

export interface RecurringShift {
  id: number;
  employee_id: number;
  employee_name: string;
  shift_id: number;
  shift_name: string;
  shift_short: string;
  recurrence: RecurringShiftRecurrence;
  day_of_week: number; // 0=Mon … 6=Sun
  valid_from: string;
  valid_until: string | null;
}

export interface RecurringShiftCreate {
  employee_id: number;
  shift_id: number;
  recurrence: RecurringShiftRecurrence;
  day_of_week: number;
  valid_from: string;
  valid_until?: string | null;
}

export interface RecurringShiftGenerateResult {
  created: number;
  skipped: number;
  message?: string;
}

// ─── ORM Mirror Types (Admin) ──────────────────────────────
export interface OrmMirrorStatus {
  mirror_db_exists: boolean;
  table_count: number;
  total_rows: number;
  counts: Record<string, number>;
}

export interface OrmMirrorSyncResult {
  ok: boolean;
  synced: Record<string, number>;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ─── API Compatibility Check ───────────────────────────────────
/** Minimum backend API version this frontend requires (semver). */
const REQUIRED_API_MIN_VERSION = '0.4.0';

function parseVersion(v: string): [number, number, number] {
  const parts = v.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isVersionAtLeast(actual: string, required: string): boolean {
  const [aMaj, aMin, aPatch] = parseVersion(actual);
  const [rMaj, rMin, rPatch] = parseVersion(required);
  if (aMaj !== rMaj) return aMaj > rMaj;
  if (aMin !== rMin) return aMin > rMin;
  return aPatch >= rPatch;
}

/**
 * Check backend API compatibility on app start.
 * Returns an object with `compatible` flag and version info.
 * Shows a dismissible banner via a CustomEvent if the backend is too old.
 */
export async function checkApiCompatibility(): Promise<{
  compatible: boolean;
  backendVersion: string | null;
  requiredVersion: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/version`, { credentials: 'include' });
    if (!res.ok) return { compatible: true, backendVersion: null, requiredVersion: REQUIRED_API_MIN_VERSION };
    const data = await res.json() as { version?: string };
    const backendVersion = data.version ?? '0.0.0';
    const compatible = isVersionAtLeast(backendVersion, REQUIRED_API_MIN_VERSION);
    if (!compatible) {
      window.dispatchEvent(new CustomEvent('sp5:api-incompatible', {
        detail: { backendVersion, requiredVersion: REQUIRED_API_MIN_VERSION },
      }));
    }
    return { compatible, backendVersion, requiredVersion: REQUIRED_API_MIN_VERSION };
  } catch {
    // Network error — don't block the app
    return { compatible: true, backendVersion: null, requiredVersion: REQUIRED_API_MIN_VERSION };
  }
}

/** Fired when any API call returns 401 — AuthContext listens and logs the user out. */
function dispatchUnauthorized() {
  window.dispatchEvent(new CustomEvent('sp5:unauthorized'));
}

// ─── In-memory response cache (stammdaten, 60 s TTL) ──────────
interface CacheEntry<T> { data: T; expires: number }
const _apiCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60_000;

/** Paths that are safe to cache (rarely changing master data). */
const CACHEABLE_PATHS = new Set([
  '/api/v1/employees',
  '/api/v1/groups',
  '/api/v1/shifts',
  '/api/v1/leave-types',
  '/api/v1/workplaces',
  '/api/v1/holidays',
]);

function isCacheable(path: string): boolean {
  // Also cache holidays with year query param
  if (path.startsWith('/api/v1/holidays')) return true;
  return CACHEABLE_PATHS.has(path);
}

/** Invalidate all cached stammdaten (call after mutations). */
export function invalidateStammdatenCache(): void {
  for (const key of _apiCache.keys()) {
    if (isCacheable(key)) _apiCache.delete(key);
  }
}

/** Invalidate a specific cached path. */
export function invalidateCachePath(path: string): void {
  _apiCache.delete(path);
}

/** Read dev-mode token from localStorage (only used for __dev_mode__ header injection). */
function getDevToken(): string | null {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return null;
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    // Only inject X-Auth-Token header for dev mode; normal sessions use HttpOnly cookie
    return session.devMode ? '__dev_mode__' : null;
  } catch {
    return null;
  }
}

/** Build auth headers. For dev mode injects X-Auth-Token; normal sessions rely on HttpOnly cookie. */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const devToken = getDevToken();
  return devToken ? { ...extra, 'X-Auth-Token': devToken } : extra;
}

/** Extract the most informative error message from an API error response. */
async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.clone().json();
    if (data?.detail) return String(data.detail);
    if (data?.message) return String(data.message);
  } catch {
    // response not JSON — fall through to statusText
  }
  return `Fehler ${res.status}: ${res.statusText || 'Unbekannter Fehler'}`;
}

/** Fired when any API call returns 429 — RateLimitBanner listens and shows countdown. */
function dispatchRateLimited(retryAfter: number) {
  window.dispatchEvent(new CustomEvent('sp5:rate-limited', {
    detail: { retry_after: retryAfter },
  }));
}

async function handleResponseError(res: Response): Promise<void> {
  if (res.status === 401) {
    dispatchUnauthorized();
    throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
  }
  if (res.status === 429) {
    // Extract retry_after from JSON body or Retry-After header
    let retryAfter = 60; // default
    try {
      const data = await res.clone().json();
      if (data?.retry_after && typeof data.retry_after === 'number') {
        retryAfter = data.retry_after;
      }
    } catch {
      // Try header fallback
      const headerVal = res.headers.get('Retry-After');
      if (headerVal) {
        const parsed = parseInt(headerVal, 10);
        if (!isNaN(parsed) && parsed > 0) retryAfter = parsed;
      }
    }
    dispatchRateLimited(retryAfter);
    throw new Error(`Zu viele Anfragen. Bitte ${retryAfter} Sekunden warten.`);
  }
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new Error(msg);
  }
}

/** Wrap fetch calls with auto-retry (2 attempts, exponential backoff) on network errors.
 *  Only network-level errors are retried; HTTP 4xx/5xx are NOT retried.
 *  When the browser is offline, fail immediately with a user-friendly message. */
async function safeFetch(input: string, init?: RequestInit, _attempt = 0): Promise<Response> {
  // Fail fast when the browser reports no connectivity
  if (!navigator.onLine) {
    throw new Error('Keine Internetverbindung. Bitte Netzwerk prüfen und erneut versuchen.');
  }
  // Always include credentials so HttpOnly cookies are sent automatically
  const mergedInit: RequestInit = { credentials: 'include', ...init };
  try {
    return await fetch(input, mergedInit);
  } catch (_err) {
    // Re-check connectivity after a failed fetch
    if (!navigator.onLine) {
      throw new Error('Keine Internetverbindung. Bitte Netzwerk prüfen und erneut versuchen.');
    }
    // TypeError: Failed to fetch — server unreachable or CORS
    if (_attempt < 2) {
      // Exponential backoff: 500ms, 1500ms
      await new Promise(r => setTimeout(r, 500 * (2 ** _attempt)));
      return safeFetch(input, mergedInit, _attempt + 1);
    }
    throw new Error('Server nicht erreichbar. Bitte Verbindung prüfen.');
  }
}

async function fetchJSON<T>(path: string): Promise<T> {
  // Serve from cache if available and fresh
  if (isCacheable(path)) {
    const cached = _apiCache.get(path) as CacheEntry<T> | undefined;
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
  }
  const res = await safeFetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  await handleResponseError(res);
  const data = await res.json() as T;
  if (isCacheable(path)) {
    _apiCache.set(path, { data, expires: Date.now() + CACHE_TTL_MS });
  }
  return data;
}

/** Clear cache entries whose path starts with the given prefix. */
function evictCachePrefix(path: string): void {
  // Extract base path without query string
  const base = path.split('?')[0];
  for (const key of _apiCache.keys()) {
    if (key === base || key.startsWith(base + '?') || key.startsWith(base + '/')) {
      _apiCache.delete(key);
    }
  }
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  evictCachePrefix(path);
  const res = await safeFetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  await handleResponseError(res);
  return res.json();
}

async function putJSON<T>(path: string, body: unknown): Promise<T> {
  evictCachePrefix(path);
  const res = await safeFetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  await handleResponseError(res);
  return res.json();
}

async function deleteReq<T>(path: string): Promise<T> {
  evictCachePrefix(path);
  const res = await safeFetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleResponseError(res);
  return res.json();
}

async function patchJSON<T>(path: string, body: unknown): Promise<T> {
  evictCachePrefix(path);
  const res = await safeFetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  await handleResponseError(res);
  return res.json();
}

// ─── Einsatzplan (SPSHI) Types ─────────────────────────────
export interface EinsatzplanEntryCreate {
  employee_id: number;
  date: string;
  name?: string;
  shortname?: string;
  shift_id?: number;
  workplace_id?: number;
  startend?: string;
  duration?: number;
  colortext?: number;
  colorbar?: number;
  colorbk?: number;
}

export interface EinsatzplanEntryUpdate {
  name?: string;
  shortname?: string;
  shift_id?: number;
  workplace_id?: number;
  startend?: string;
  duration?: number;
  colortext?: number;
  colorbar?: number;
  colorbk?: number;
}

export interface DeviationCreate {
  employee_id: number;
  date: string;
  name?: string;
  shortname?: string;
  startend?: string;
  duration?: number;
  colortext?: number;
  colorbar?: number;
  colorbk?: number;
}

export interface SpshiEntry {
  id: number;
  employee_id: number;
  date: string;
  name: string;
  shortname: string;
  shift_id: number;
  shift_name: string;
  shift_short: string;
  workplace_id: number;
  workplace_name: string;
  type: number;   // 0=Sonderdienst, 1=Abweichung
  startend: string;
  duration: number;
  colortext: number;
  colorbar: number;
  colorbk: number;
  color_bk: string;
  color_text: string;
}

// ─── Types for new endpoints ────────────────────────────────
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
  // SPSHI-specific fields (present when kind === 'special_shift')
  spshi_id?: number | null;
  spshi_type?: number | null;
  spshi_startend?: string;
  spshi_duration?: number;
  /** 'cycle' = generierter Zyklusdienst (5CYASS-Expansion); fehlt/null bei manuellen Einträgen. */
  source?: 'cycle' | null;
}

export interface EmployeeStats {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  group_name: string;
  group_id: number | null;
  target_hours: number;
  actual_hours: number;
  shifts_count: number;
  absence_days: number;
  overtime_hours: number;
  vacation_used: number;
  sick_days: number;
}

export interface MonthSummary {
  month: number;
  shifts: number;
  absences: number;
  target_hours: number;
  actual_hours: number;
  label_counts: Record<string, number>;
}

export interface ExtraChargeSummary {
  charge_id: number;
  charge_name: string;
  hours: number;
  shift_count: number;
  start_time: number;
  end_time: number;
  validdays: string;
  holrule: number;
}

export interface ExtraChargeDay {
  employee_id: number;
  employee_name: string;
  date: string;
  charge_id: number;
  charge_name: string;
  hours: number;
}

// ─── Personaltabelle (GET /api/personnel-table) ──
export interface PersonnelTableRow {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  // Standardspalten
  iststunden: number;
  sollstunden: number;
  saldo: number;
  arbeitszeit: number;
  abwesenheit_bezahlt: number;
  sonntag: number;
  feiertag: number;
  sonderdienste: number;
  /** Einteilungen je Schichtart; Schlüssel = Schichtart-ID (JSON-Objektschlüssel sind Strings). */
  shift_counts: Record<string, number>;
  /** Fehltage je Abwesenheitsart; Schlüssel = Abwesenheitsart-ID. */
  absence_days_by_type: Record<string, number>;
  /** Urlaubs-Doppelwert genommen/verbleibend je anspruchsverbundener Art —
   *  nur vorhanden, wenn der Zeitraum genau ein Kalenderjahr umfasst (one_year). */
  leave_accounts?: Record<string, { taken: number; remaining: number }>;
}

export interface PersonnelTableResponse {
  date_from: string;
  date_to: string;
  group_id: number | null;
  /** true = Zeitraum umfasst genau ein Kalenderjahr (Doppelwert verbraucht/Rest). */
  one_year: boolean;
  /** Definition der dynamischen Spalten (Reihenfolge/Beschriftung). */
  columns: {
    shifts: { id: number; name: string; short: string }[];
    leave_types: { id: number; name: string; short: string; entitled: boolean }[];
  };
  rows: PersonnelTableRow[];
}

// ─── Stichtags-Verfall (POST /api/leave-entitlements/forfeit) ──
export interface LeaveForfeitCut {
  employee_id: number;
  employee_name: string;
  leave_type_id: number;
  leave_type_name: string;
  year: number;
  old_rest: number;
  new_rest: number;
  forfeited: number;
}

export interface LeaveForfeitResult {
  ok: boolean;
  cutoff_date: string;
  year: number;
  group_id: number | null;
  dry_run: boolean;
  employees_processed: number;
  cuts: LeaveForfeitCut[];
  total_forfeited: number;
}

// ─── Teiltags-Abwesenheiten (5ABSEN.INTERVAL) ───
/** 0 = ganztägig, 1 = vormittags, 2 = nachmittags, 3 = Zeitraum (start_time/end_time). */
export type AbsenceInterval = 0 | 1 | 2 | 3;

export interface AbsenceTimeOptions {
  interval?: AbsenceInterval;
  /** Nur bei interval=3: Beginn in Minuten ab Mitternacht (0..1440), wie von der API erwartet. */
  start_time?: number;
  /** Nur bei interval=3: Ende in Minuten ab Mitternacht (end < start = rechnerischer Tageswechsel). */
  end_time?: number;
  /** Optionaler Kommentartext (nur bei nicht-ganztägig); wird als Dienstplan-Notiz gespeichert. Max. 125 Zeichen. */
  comment?: string;
}

export interface WeekSchedule {
  week_start: string;
  week_end: string;
  days: {
    date: string;
    entries: DayEntry[];
  }[];
}

// ─── Changelog Types ──────────────────────────────────────
export interface BurnoutRadarEntry {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  risk_level: 'high' | 'medium';
  reasons: string[];
  streak: number;
  overtime_pct: number;
  overtime_hours: number;
  actual_hours: number;
  target_hours: number;
}

export interface ChangelogEntry {
  timestamp: string;
  user: string;
  action: string;      // CREATE | UPDATE | DELETE
  entity: string;      // employee | shift | group | schedule | ...
  entity_id: number;
  details: string;
}

// ─── Overtime Summary Types ────────────────────────────────
export interface OvertimeRow {
  employee_id: number;
  name: string;
  shortname: string;
  number: string;
  soll: number;
  ist: number;
  delta: number;
  saldo: number;
}

export interface OvertimeSummary {
  total_soll: number;
  total_ist: number;
  total_delta: number;
  plus_count: number;
  minus_count: number;
  employee_count: number;
}

// ─── Overtime Dashboard Types (Q071) ──────────────────────
export interface OvertimeDashboardRow {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  contract_hours: number;
  expected_hours: number;
  actual_hours: number;
  difference: number;
  shifts_count: number;
}

export interface OvertimeDashboardResponse {
  year: number;
  month: number;
  group_id: number | null;
  count: number;
  employees: OvertimeDashboardRow[];
}

// ─── Employee Detailed Stats (TASK-12) ────────────────────
export interface EmployeeMonthStats {
  month: number;
  target_hours: number;
  actual_hours: number;
  difference: number;
  weekend_shifts: number;
  night_shifts: number;
  vacation_days: number;
  absence_days: number;
  shifts_count: number;
}

export interface EmployeeYearStats {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  employee_number: string;
  year: number;
  months: EmployeeMonthStats[];
  totals: {
    target_hours: number;
    actual_hours: number;
    difference: number;
    weekend_shifts: number;
    night_shifts: number;
    vacation_days: number;
    absence_days: number;
    shifts_count: number;
  };
}

// ─── Sickness Statistics (Krankenstand) ───────────────────
export interface SicknessEmployeeStat {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  group_name: string;
  group_id: number | null;
  sick_days: number;
  sick_episodes: number;
  bradford_factor: number;
}

export interface SicknessMonthStat {
  month: number;
  sick_days: number;
}

export interface SicknessWeekdayStat {
  weekday: number;
  weekday_name: string;
  sick_days: number;
}

export interface SicknessStatistics {
  year: number;
  sick_type_ids: number[];
  total_sick_days: number;
  affected_employees: number;
  total_employees: number;
  per_employee: SicknessEmployeeStat[];
  per_month: SicknessMonthStat[];
  per_weekday: SicknessWeekdayStat[];
}

// ─── Shift Statistics ──────────────────────────────────────
export interface ShiftPeriod {
  year: number;
  month: number;
  label: string;
}

export interface ShiftUsageEntry {
  shift_id: number;
  name: string;
  short: string;
  color_bk: number | null;
  color_text: number | null;
  category: string;
  monthly_counts: { year: number; month: number; count: number }[];
  total: number;
}

export interface EmpShiftDistribution {
  employee_id: number;
  name: string;
  short: string;
  total_shifts: number;
  by_category: Record<string, number>;
}

export interface ShiftStatisticsData {
  periods: ShiftPeriod[];
  shift_usage: ShiftUsageEntry[];
  employee_distribution: EmpShiftDistribution[];
  category_totals: Record<string, number>;
}

// ─── Year Summary (Jahresrückblick) ─────────────────────────
export interface YearSummaryMonth {
  month: number;
  actual_hours: number;
  target_hours: number;
  absence_days: number;
  vacation_days: number;
  sick_days: number;
  shifts_count: number;
  employee_count: number;
  overtime: number;
}

export interface YearSummaryEmployee {
  employee_id: number;
  name: string;
  group: string;
  actual_hours: number;
  target_hours: number;
  absence_days: number;
  vacation_days: number;
  sick_days: number;
  shifts_count: number;
  overtime: number;
  monthly_hours: number[];
}

export interface YearSummaryTotals {
  actual_hours: number;
  target_hours: number;
  absence_days: number;
  vacation_days: number;
  sick_days: number;
  shifts_count: number;
  overtime: number;
}

export interface YearSummaryData {
  year: number;
  monthly: YearSummaryMonth[];
  employees: YearSummaryEmployee[];
  totals: YearSummaryTotals;
}

// ─── Schedule Templates ─────────────────────────────────────
export interface TemplateAssignment {
  employee_id: number;
  weekday_offset: number;   // 0=Mon … 6=Sun
  shift_id: number;
  employee_name?: string;
  shift_name?: string;
}

export interface ScheduleTemplate {
  id: number;
  name: string;
  description: string;
  assignments: TemplateAssignment[];
  created_at: string;
}

export interface TemplateCreate {
  name: string;
  description?: string;
  assignments: TemplateAssignment[];
}

export interface TemplateCaptureRequest {
  name: string;
  description?: string;
  year: number;
  month: number;
  week_start_day: number;
  group_id?: number;
}

export interface TemplateApplyRequest {
  target_date: string;
  force?: boolean;
}

export interface TemplateApplyResult {
  created: number;
  updated: number;
  skipped: number;
  template_name: string;
}

export interface Wish {
  id: number;
  employee_id: number;
  date: string;
  wish_type: 'WUNSCH' | 'SPERRUNG';
  shift_id: number | null;
  note: string;
  created_at: string;
}

export interface SwapRequest {
  id: number;
  requester_id: number;
  requester_date: string;
  partner_id: number;
  partner_date: string;
  note: string;
  status: 'pending_partner' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  partner_accepted: boolean | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  reject_reason: string;
  // enriched server-side
  requester_name?: string;
  requester_short?: string;
  partner_name?: string;
  partner_short?: string;
  requester_shift?: { id: number; name: string; color: string } | null;
  partner_shift?: { id: number; name: string; color: string } | null;
}

// ─── API ───────────────────────────────────────────────────
export const api = {
  getStats: () => fetchJSON<Stats>('/api/v1/stats'),
  getDashboardSummary: (year: number, month: number) =>
    fetchJSON<DashboardSummary>(`/api/v1/dashboard/summary?year=${year}&month=${month}`),
  getEmployees: (includeHidden?: boolean) =>
    fetchJSON<Employee[]>(`/api/v1/employees${includeHidden ? '?include_hidden=true' : ''}`),
  getGroups: () => fetchJSON<Group[]>('/api/v1/groups'),
  getShifts: (include_hidden = false) =>
    fetchJSON<ShiftType[]>(`/api/v1/shifts${include_hidden ? '?include_hidden=true' : ''}`),
  getLeaveTypes: (include_hidden = false) =>
    fetchJSON<LeaveType[]>(`/api/v1/leave-types${include_hidden ? '?include_hidden=true' : ''}`),
  getWorkplaces: (include_hidden = false) =>
    fetchJSON<Workplace[]>(`/api/v1/workplaces${include_hidden ? '?include_hidden=true' : ''}`),
  /** A9: manuelle Stammdaten-Sortierung (POSITION). entity: employees|shifts|groups|leave_types|workplaces */
  reorderMasterData: (entity: string, orderedIds: number[]) =>
    postJSON<{ ok: boolean; updated: number }>(`/api/v1/reorder/${entity}`, { ordered_ids: orderedIds }),
  getHolidays: (year?: number) => fetchJSON<Holiday[]>(`/api/v1/holidays${year ? `?year=${year}` : ''}`),
  getSchedule: (year: number, month: number, groupId?: number, plan?: 'ist' | 'soll' | 'both') =>
    fetchJSON<ScheduleEntry[]>(`/api/v1/schedule?year=${year}&month=${month}${groupId ? `&group_id=${groupId}` : ''}${plan ? `&plan=${plan}` : ''}`),
  getUsers: () => fetchJSON<User[]>('/api/v1/users'),

  // New endpoints
  getScheduleDay: (date: string, groupId?: number) =>
    fetchJSON<DayEntry[]>(`/api/v1/schedule/day?date=${date}${groupId ? `&group_id=${groupId}` : ''}`),

  /** Monatsmodus: getStatistics(year, month, groupId?) —
   *  freier Auswertungszeitraum: getStatistics({ from, to, group_id? }). */
  getStatistics: (
    yearOrRange: number | { from: string; to: string; group_id?: number },
    month?: number,
    groupId?: number,
  ) => {
    if (typeof yearOrRange === 'object') {
      const p = new URLSearchParams({ from: yearOrRange.from, to: yearOrRange.to });
      if (yearOrRange.group_id != null) p.set('group_id', String(yearOrRange.group_id));
      return fetchJSON<EmployeeStats[]>(`/api/v1/statistics?${p}`);
    }
    return fetchJSON<EmployeeStats[]>(`/api/v1/statistics?year=${yearOrRange}&month=${month}${groupId ? `&group_id=${groupId}` : ''}`);
  },

  // ─── Personaltabelle ───────────────────
  getPersonnelTable: (from: string, to: string, groupId?: number) => {
    const p = new URLSearchParams({ from, to });
    if (groupId != null) p.set('group_id', String(groupId));
    return fetchJSON<PersonnelTableResponse>(`/api/v1/personnel-table?${p}`);
  },

  getScheduleYear: (year: number, employeeId: number) =>
    fetchJSON<MonthSummary[]>(`/api/v1/schedule/year?year=${year}&employee_id=${employeeId}`),

  getEmployeeStatsYear: (employeeId: number, year: number) =>
    fetchJSON<EmployeeYearStats>(`/api/v1/statistics/employee/${employeeId}?year=${year}`),

  getEmployeeStatsMonth: (employeeId: number, year: number, month: number) =>
    fetchJSON<EmployeeYearStats>(`/api/v1/statistics/employee/${employeeId}?year=${year}&month=${month}`),

  getScheduleWeek: (date: string, groupId?: number) =>
    fetchJSON<WeekSchedule>(`/api/v1/schedule/week?date=${date}${groupId ? `&group_id=${groupId}` : ''}`),

  getConflicts: (params: { year: number; month: number; group_id?: number }) => {
    const p = new URLSearchParams({ year: String(params.year), month: String(params.month) });
    if (params.group_id != null) p.set('group_id', String(params.group_id));
    return fetchJSON<ScheduleConflicts>(`/api/v1/schedule/conflicts?${p}`);
  },

  getGroupMembers: (groupId: number) =>
    fetchJSON<Employee[]>(`/api/v1/groups/${groupId}/members`),

  createScheduleEntry: (employee_id: number, date: string, shift_id: number, options?: { schedule_type?: number; workplace_id?: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/schedule', { employee_id, date, shift_id, ...options }),

  deleteScheduleEntry: (employee_id: number, date: string) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/schedule/${employee_id}/${date}`),

  /** Arbeitsplatz (5MASHI.WORKPLACID) eines bestehenden Dienstes setzen; workplace_id=0 entfernt. */
  assignScheduleWorkplace: (employee_id: number, date: string, workplace_id: number) =>
    postJSON<{ ok: boolean; updated: number; workplace_id: number }>('/api/v1/schedule/workplace', { employee_id, date, workplace_id }),

  bulkSchedule: (
    entries: Array<{ employee_id: number; date: string; shift_id: number | null }>,
    overwrite = true,
  ) => postJSON<{ created: number; updated: number; deleted: number }>(
    '/api/v1/schedule/bulk',
    { entries, overwrite },
  ),

  bulkGroupAssign: (params: {
    group_id?: number;
    employee_ids?: number[];
    shift_id: number;
    date_from: string;
    date_to: string;
    overwrite?: boolean;
  }) => postJSON<{ created: number; updated: number; skipped: number; employees: number; days: number; total_assignments: number }>(
    '/api/v1/schedule/bulk-group',
    params,
  ),

  generateSchedule: (params: {
    year: number;
    month: number;
    employee_ids?: number[];
    force?: boolean;
    dry_run?: boolean;
    respect_restrictions?: boolean;
  }) =>
    postJSON<{
      created: number;
      skipped: number;
      skipped_restriction: number;
      errors: string[];
      preview: Array<{ employee_id: number; employee_name: string; date: string; shift_id: number; shift_name: string; status: 'new' | 'skip' | 'overwrite' | 'restricted' }>;
      report: {
        employees?: Array<{ employee_id: number; name: string; total: number; weekend: number; night: number }>;
        skipped_restriction?: number;
        gini?: number;
        fairness_label?: string;
        std_total?: number;
      };
      message: string;
    }>(
      '/api/v1/schedule/generate',
      params,
    ),

  getAbsences: (params?: { year?: number; employee_id?: number; leave_type_id?: number }) => {
    const qs = params ? new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))).toString() : '';
    return fetchJSON<{ id: number; employee_id: number; date: string; leave_type_id: number; leave_type_name: string; leave_type_short: string }[]>(`/api/v1/absences${qs ? `?${qs}` : ''}`);
  },
  createAbsence: (employee_id: number, date: string, leave_type_id: number, options?: AbsenceTimeOptions) =>
    postJSON<{ ok: boolean; record: unknown; warnings?: string[] }>('/api/v1/absences', { employee_id, date, leave_type_id, ...options }),
  updateAbsence: (employee_id: number, date: string, data: { leave_type_id?: number } & AbsenceTimeOptions) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/absences/${employee_id}/${date}`, data),
  deleteAbsence: (employee_id: number, date: string) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/absences/${employee_id}/${date}`),

  getAbsenceStatuses: () =>
    fetchJSON<Record<string, { status: string; reject_reason?: string } | string>>('/api/v1/absences/status'),

  getGroupAssignments: () =>
    fetchJSON<{ employee_id: number; group_id: number }[]>('/api/v1/group-assignments'),

  getLeaveEntitlements: (params?: { year?: number; employee_id?: number }) => {
    const qs = params ? new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))).toString() : '';
    return fetchJSON<{ id: number; employee_id: number; year: number; leave_type_id: number; leave_type_name: string; entitlement: number; carry_forward: number; in_days: boolean }[]>(`/api/v1/leave-entitlements${qs ? `?${qs}` : ''}`);
  },

  // ─── Shift Cycles ─────────────────────────────────────────
  getShiftCycles: () => fetchJSON<ShiftCycle[]>('/api/v1/shift-cycles'),
  getShiftCycle: (id: number) => fetchJSON<ShiftCycle>(`/api/v1/shift-cycles/${id}`),
  getCycleAssignments: () => fetchJSON<CycleAssignment[]>('/api/v1/shift-cycles/assign'),
  assignCycle: (employee_id: number, cycle_id: number, start_date: string, end_date?: string) =>
    postJSON<{ ok: boolean; record: CycleAssignment }>('/api/v1/shift-cycles/assign', { employee_id, cycle_id, start_date, ...(end_date ? { end_date } : {}) }),
  removeCycleAssignment: (employee_id: number) =>
    deleteReq<{ ok: boolean; removed: number }>(`/api/v1/shift-cycles/assign/${employee_id}`),
  createShiftCycle: (name: string, size_weeks: number) =>
    postJSON<{ ok: boolean; cycle: ShiftCycle }>('/api/v1/shift-cycles', { name, size_weeks }),
  updateShiftCycle: (id: number, name: string, size_weeks: number, entries: { index: number; shift_id: number | null }[]) =>
    putJSON<{ ok: boolean; cycle: ShiftCycle }>(`/api/v1/shift-cycles/${id}`, { name, size_weeks, entries }),
  deleteShiftCycle: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/shift-cycles/${id}`),

  // ─── Staffing Requirements ────────────────────────────────
  getStaffingRequirements: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    const qs = params.toString();
    return fetchJSON<StaffingRequirements>(`/api/v1/staffing-requirements${qs ? `?${qs}` : ''}`);
  },

  // ─── Notes ────────────────────────────────────────────────
  getNotes: (params?: { date?: string; employee_id?: number; year?: number; month?: number }) => {
    const p = params ?? {};
    const urlParams = new URLSearchParams();
    if (p.date) urlParams.set('date', p.date);
    if (p.employee_id != null) urlParams.set('employee_id', String(p.employee_id));
    if (p.year != null) urlParams.set('year', String(p.year));
    if (p.month != null) urlParams.set('month', String(p.month));
    const qs = urlParams.toString();
    return fetchJSON<Note[]>(`/api/v1/notes${qs ? `?${qs}` : ''}`);
  },
  addNote: (date: string, text: string, employee_id?: number, text2?: string, category?: string) =>
    postJSON<{ ok: boolean; record: Note }>('/api/v1/notes', { date, text, employee_id: employee_id ?? 0, text2: text2 ?? '', category: category ?? '' }),
  updateNote: (id: number, data: NoteUpdate) =>
    putJSON<{ ok: boolean; record: Note }>(`/api/v1/notes/${id}`, data),
  deleteNote: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/notes/${id}`),

  // ─── Periods ──────────────────────────────────────────────
  getPeriods: (group_id?: number) =>
    fetchJSON<Period[]>(`/api/v1/periods${group_id ? `?group_id=${group_id}` : ''}`),
  createPeriod: (data: { group_id: number; start: string; end: string; description?: string; color?: string }) =>
    postJSON<{ ok: boolean; record: Period }>('/api/v1/periods', data),
  deletePeriod: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/periods/${id}`),

  // ─── Staffing Requirements Write ──────────────────────────
  setStaffingRequirement: (data: { shift_id: number; weekday: number; min: number; max: number; group_id: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/staffing-requirements', data),

  // ─── Zeitkonto ────────────────────────────────────────────
  getZeitkonto: (year: number, groupId?: number, employeeId?: number) => {
    const params = new URLSearchParams({ year: String(year) });
    if (groupId) params.set('group_id', String(groupId));
    if (employeeId) params.set('employee_id', String(employeeId));
    return fetchJSON<ZeitkontoRow[]>(`/api/v1/zeitkonto?${params}`);
  },
  getZeitkontoDetail: (year: number, employeeId: number) =>
    fetchJSON<ZeitkontoDetail>(`/api/v1/zeitkonto/detail?year=${year}&employee_id=${employeeId}`),
  getZeitkontoSummary: (year: number, groupId?: number) => {
    const params = new URLSearchParams({ year: String(year) });
    if (groupId) params.set('group_id', String(groupId));
    return fetchJSON<ZeitkontoSummary>(`/api/v1/zeitkonto/summary?${params}`);
  },
  getBookings: (year?: number, month?: number, employeeId?: number) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    if (employeeId) params.set('employee_id', String(employeeId));
    const qs = params.toString();
    return fetchJSON<Booking[]>(`/api/v1/bookings${qs ? `?${qs}` : ''}`);
  },
  createBooking: (data: { employee_id: number; date: string; type: number; value: number; note?: string }) =>
    postJSON<{ ok: boolean; record: Booking }>('/api/v1/bookings', data),
  updateBooking: (id: number, data: { date?: string; type?: number; value?: number; note?: string }) =>
    putJSON<{ ok: boolean; record: Booking }>(`/api/v1/bookings/${id}`, data),
  deleteBooking: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/bookings/${id}`),

  // ─── CRUD: Employees ──────────────────────────────────────
  createEmployee: (data: Partial<Employee>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/employees', data),
  updateEmployee: (id: number, data: Partial<Employee>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/employees/${id}`, data),
  deleteEmployee: (id: number) =>
    deleteReq<{ ok: boolean; deactivated: number }>(`/api/v1/employees/${id}`),
  activateEmployee: (id: number) =>
    putJSON<{ ok: boolean; activated: number }>(`/api/v1/employees/${id}/activate`, {}),

  // ─── CRUD: Groups ─────────────────────────────────────────
  createGroup: (data: Partial<Group>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/groups', data),
  updateGroup: (id: number, data: Partial<Group>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/groups/${id}`, data),
  deleteGroup: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/v1/groups/${id}`),
  addGroupMember: (groupId: number, employee_id: number) =>
    postJSON<{ ok: boolean; record: unknown }>(`/api/v1/groups/${groupId}/members`, { employee_id }),
  removeGroupMember: (groupId: number, empId: number) =>
    deleteReq<{ ok: boolean; removed: number }>(`/api/v1/groups/${groupId}/members/${empId}`),

  // ─── Bulk Employee Operations ─────────────────────────────
  bulkEmployeeAction: (data: { employee_ids: number[]; action: string; group_id?: number }) =>
    postJSON<{ ok: boolean; affected: number; errors: unknown[] }>('/api/v1/employees/bulk', data),

  // ─── Bulk Absence ─────────────────────────────────────────
  bulkCreateAbsence: (data: { date: string; leave_type_id: number; employee_ids?: number[] }) =>
    postJSON<{ ok: boolean; created: number; skipped: number; errors: unknown[] }>('/api/v1/absences/bulk', data),

  // ─── CRUD: Shifts ─────────────────────────────────────────
  createShift: (data: Partial<ShiftType>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/shifts', data),
  updateShift: (id: number, data: Partial<ShiftType>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/shifts/${id}`, data),
  deleteShift: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/v1/shifts/${id}`),

  // ─── CRUD: Leave Types ────────────────────────────────────
  createLeaveType: (data: Partial<LeaveType>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/leave-types', data),
  updateLeaveType: (id: number, data: Partial<LeaveType>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/leave-types/${id}`, data),
  deleteLeaveType: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/v1/leave-types/${id}`),

  // ─── CRUD: Holidays ───────────────────────────────────────
  /** repeat_years: Feiertag zusätzlich für die nächsten n Jahre anlegen (jahresweise Wiederholung). */
  createHoliday: (data: { DATE: string; NAME: string; INTERVAL?: number; repeat_years?: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/holidays', data),
  updateHoliday: (id: number, data: Partial<Holiday>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/holidays/${id}`, data),
  deleteHoliday: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/holidays/${id}`),

  // ─── CRUD: Workplaces ─────────────────────────────────────
  createWorkplace: (data: Partial<Workplace>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/workplaces', data),
  updateWorkplace: (id: number, data: Partial<Workplace>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/workplaces/${id}`, data),
  deleteWorkplace: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/v1/workplaces/${id}`),

  // ─── Workplace ↔ Employee Assignments ─────────────────────
  getWorkplaceEmployees: (workplaceId: number) =>
    fetchJSON<WorkplaceEmployee[]>(`/api/v1/workplaces/${workplaceId}/employees`),
  assignEmployeeToWorkplace: (workplaceId: number, employeeId: number) =>
    postJSON<{ ok: boolean; added: boolean }>(`/api/v1/workplaces/${workplaceId}/employees/${employeeId}`, {}),
  removeEmployeeFromWorkplace: (workplaceId: number, employeeId: number) =>
    deleteReq<{ ok: boolean; removed: boolean }>(`/api/v1/workplaces/${workplaceId}/employees/${employeeId}`),

  // ─── CRUD: Extra Charges ──────────────────────────────────
  getExtraCharges: (include_hidden = false) =>
    fetchJSON<ExtraCharge[]>(`/api/v1/extracharges${include_hidden ? '?include_hidden=true' : ''}`),
  getExtrachargesByDay: (from: string, to: string) =>
    fetchJSON<ExtraChargeDay[]>(`/api/v1/extracharges/by-day?from=${from}&to=${to}`),
  createExtraCharge: (data: Partial<ExtraCharge>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/extracharges', data),
  updateExtraCharge: (id: number, data: Partial<ExtraCharge>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/extracharges/${id}`, data),
  deleteExtraCharge: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/v1/extracharges/${id}`),
  /** Monatsmodus: getExtraChargesSummary(year, month, employeeId?) —
   *  freier Auswertungszeitraum: getExtraChargesSummary({ from, to, employee_id? }). */
  getExtraChargesSummary: (
    yearOrRange: number | { from: string; to: string; employee_id?: number },
    month?: number,
    employeeId?: number,
  ) => {
    if (typeof yearOrRange === 'object') {
      const p = new URLSearchParams({ from: yearOrRange.from, to: yearOrRange.to });
      if (yearOrRange.employee_id != null) p.set('employee_id', String(yearOrRange.employee_id));
      return fetchJSON<ExtraChargeSummary[]>(`/api/v1/extracharges/summary?${p}`);
    }
    return fetchJSON<ExtraChargeSummary[]>(
      `/api/v1/extracharges/summary?year=${yearOrRange}&month=${month}${employeeId != null ? `&employee_id=${employeeId}` : ''}`
    );
  },

  // ─── Auth ─────────────────────────────────────────────────
  login: (username: string, password: string) =>
    postJSON<LoginResponse>('/api/v1/auth/login', { username, password }),

  // ─── CRUD: Users ──────────────────────────────────────────
  createUser: (data: UserCreate) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/users', data),
  updateUser: (id: number, data: UserUpdate) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/users/${id}`, data),
  deleteUser: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/v1/users/${id}`),

  // ─── Einsatzplan / SPSHI ─────────────────────────────────
  getEinsatzplan: (date: string, groupId?: number) =>
    fetchJSON<SpshiEntry[]>(`/api/v1/einsatzplan?date=${date}${groupId != null ? `&group_id=${groupId}` : ''}`),
  createEinsatzplanEntry: (data: EinsatzplanEntryCreate) =>
    postJSON<{ ok: boolean; record: SpshiEntry }>('/api/v1/einsatzplan', data),
  updateEinsatzplanEntry: (id: number, data: EinsatzplanEntryUpdate) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/v1/einsatzplan/${id}`, data),
  deleteEinsatzplanEntry: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/einsatzplan/${id}`),
  createDeviation: (data: DeviationCreate) =>
    postJSON<{ ok: boolean; record: SpshiEntry }>('/api/v1/einsatzplan/deviation', data),

  // ─── Restrictions ─────────────────────────────────────────
  getRestrictions: (employeeId?: number) =>
    fetchJSON<Restriction[]>(employeeId != null ? `/api/v1/restrictions?employee_id=${employeeId}` : '/api/v1/restrictions'),
  addRestriction: (data: { employee_id: number; shift_id: number; reason?: string; weekday?: number; grade?: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/restrictions', data),
  removeRestriction: (employeeId: number, shiftId: number, weekday = 0) =>
    deleteReq<{ ok: boolean; removed: number }>(`/api/v1/restrictions/${employeeId}/${shiftId}?weekday=${weekday}`),

  // ─── Settings (USETT) ────────────────────────────────────
  getSettings: () => fetchJSON<UsettSettings>('/api/v1/settings'),
  updateSettings: (data: Partial<UsettSettings>) =>
    putJSON<{ ok: boolean; record: UsettSettings }>('/api/v1/settings', data),

  // ─── Special Staffing Requirements (SPDEM) ───────────────
  getSpecialStaffing: (date?: string, groupId?: number) => {
    const p = new URLSearchParams();
    if (date) p.set('date', date);
    if (groupId != null) p.set('group_id', String(groupId));
    const qs = p.toString();
    return fetchJSON<SpecialStaffingReq[]>(`/api/v1/staffing-requirements/special${qs ? `?${qs}` : ''}`);
  },
  createSpecialStaffing: (data: {
    group_id: number; date: string; shift_id: number;
    workplace_id?: number; min: number; max: number;
  }) => postJSON<{ ok: boolean; record: unknown }>('/api/v1/staffing-requirements/special', data),
  updateSpecialStaffing: (id: number, data: Partial<{
    group_id: number; date: string; shift_id: number;
    workplace_id: number; min: number; max: number;
  }>) => putJSON<{ ok: boolean; record: unknown }>(`/api/v1/staffing-requirements/special/${id}`, data),
  deleteSpecialStaffing: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/staffing-requirements/special/${id}`),

  // ─── Cycle Exceptions ─────────────────────────────────────
  getCycleExceptions: (params?: { employee_id?: number; cycle_assignment_id?: number }) => {
    const qs = params ? new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))).toString() : '';
    return fetchJSON<{ id: number; employee_id: number; cycle_assignment_id: number; date: string; type: number }[]>(
      `/api/v1/cycle-exceptions${qs ? `?${qs}` : ''}`);
  },
  setCycleException: (data: { employee_id: number; cycle_assignment_id: number; date: string; type?: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/cycle-exceptions', data),
  deleteCycleException: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/cycle-exceptions/${id}`),

  // ─── Employee Access ───────────────────────────────────────
  getEmployeeAccess: (user_id?: number) => {
    const qs = user_id != null ? `?user_id=${user_id}` : '';
    return fetchJSON<{ id: number; user_id: number; employee_id: number; rights: number }[]>(`/api/v1/employee-access${qs}`);
  },
  setEmployeeAccess: (data: { user_id: number; employee_id: number; rights: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/employee-access', data),
  deleteEmployeeAccess: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/employee-access/${id}`),

  // ─── Group Access ──────────────────────────────────────────
  getGroupAccess: (user_id?: number) => {
    const qs = user_id != null ? `?user_id=${user_id}` : '';
    return fetchJSON<{ id: number; user_id: number; group_id: number; rights: number }[]>(`/api/v1/group-access${qs}`);
  },
  setGroupAccess: (data: { user_id: number; group_id: number; rights: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/group-access', data),
  deleteGroupAccess: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/group-access/${id}`),

  // ─── Carry Forward (Saldo-Übertrag) ──────────────────────
  getCarryForward: (employeeId: number, year: number) =>
    fetchJSON<{ employee_id: number; year: number; hours: number; booking_id: number | null }>(
      `/api/v1/bookings/carry-forward?employee_id=${employeeId}&year=${year}`
    ),
  setCarryForward: (data: { employee_id: number; year: number; hours: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/v1/bookings/carry-forward', data),
  calculateAnnualStatement: (data: { employee_id: number; year: number }) =>
    postJSON<{ ok: boolean; result: { employee_id: number; year: number; saldo: number; carry_in: number; total_saldo: number; should_carry: boolean; next_year: number } }>(
      '/api/v1/bookings/annual-statement', data
    ),

  // ─── Employee Photo ────────────────────────────────────────
  getEmployeePhotoUrl: (id: number): string => `${BASE_URL}/api/v1/employees/${id}/photo`,

  uploadEmployeePhoto: async (
    id: number,
    file: File,
    crop?: { x: number; y: number; width: number; height: number },
  ): Promise<{ ok: boolean; photo_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    if (crop && crop.width > 0 && crop.height > 0) {
      params.set('crop_x', String(Math.round(crop.x)));
      params.set('crop_y', String(Math.round(crop.y)));
      params.set('crop_w', String(Math.round(crop.width)));
      params.set('crop_h', String(Math.round(crop.height)));
    }
    const qs = params.toString();
    const url = `${BASE_URL}/api/v1/employees/${id}/photo${qs ? '?' + qs : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(detail.detail || res.statusText);
    }
    return res.json();
  },

  // ─── Change Password ───────────────────────────────────────
  changePassword: (userId: number, newPassword: string) =>
    postJSON<{ ok: boolean }>(`/api/v1/users/${userId}/change-password`, { new_password: newPassword }),

  // ─── Self-Service Password Change ─────────────────────────
  changeOwnPassword: (oldPassword: string, newPassword: string) =>
    postJSON<{ ok: boolean; sessions_revoked: number }>('/api/v1/auth/change-password', { old_password: oldPassword, new_password: newPassword }),

  // ─── Admin Password Reset (generates temp password) ───────
  resetUserPassword: (userId: number) =>
    postJSON<{ ok: boolean; temp_password: string; sessions_revoked: number; email_sent: boolean }>(`/api/v1/users/${userId}/reset-password`, {}),

  // ─── Holiday Bans ─────────────────────────────────────────
  getHolidayBans: (groupId?: number) =>
    fetchJSON<{ id: number; group_id: number; group_name: string; start_date: string; end_date: string; restrict: number; reason: string }[]>(
      `/api/v1/holiday-bans${groupId != null ? `?group_id=${groupId}` : ''}`
    ),

  // ─── Backup / Restore ─────────────────────────────────────
  getBackupUrl: (): string => `${BASE_URL}/api/v1/backup/download`,

  restoreBackup: async (file: File): Promise<{ restored: number; files: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/api/v1/backup/restore`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(detail.detail || res.statusText);
    }
    return res.json();
  },

  listBackups: async (): Promise<{ backups: BackupEntry[]; backup_dir: string | null }> => {
    const res = await safeFetch(`${BASE_URL}/api/v1/admin/backups`, { headers: authHeaders() });
    await handleResponseError(res);
    return res.json();
  },

  getBackupDownloadUrl: (filename: string): string =>
    `${BASE_URL}/api/v1/admin/backups/${encodeURIComponent(filename)}/download`,

  deleteBackup: async (filename: string): Promise<void> => {
    const res = await safeFetch(`${BASE_URL}/api/v1/admin/backups/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    await handleResponseError(res);
  },

  // ─── Burnout-Radar ─────────────────────────────────────────
  getBurnoutRadar: (params: {
    year: number;
    month: number;
    streak_threshold?: number;
    overtime_threshold_pct?: number;
    group_id?: number;
  }) => {
    const qs = new URLSearchParams({ year: String(params.year), month: String(params.month) });
    if (params.streak_threshold != null) qs.set('streak_threshold', String(params.streak_threshold));
    if (params.overtime_threshold_pct != null) qs.set('overtime_threshold_pct', String(params.overtime_threshold_pct));
    if (params.group_id != null) qs.set('group_id', String(params.group_id));
    return fetchJSON<BurnoutRadarEntry[]>(`/api/v1/burnout-radar?${qs.toString()}`);
  },

// ─── Changelog / Aktivitätsprotokoll ──────────────────────
  getChangelog: (params: {
    limit?: number;
    user?: string;
    entity_type?: string;
    date_from?: string;
    date_to?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.user) qs.set('user', params.user);
    if (params.entity_type) qs.set('entity_type', params.entity_type);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    const q = qs.toString();
    return fetchJSON<ChangelogEntry[]>(`/api/v1/changelog${q ? '?' + q : ''}`);
  },

  logAction: (data: { user: string; action: string; entity: string; entity_id: number; details?: string }) =>
    postJSON<ChangelogEntry>('/api/v1/changelog', data),

  // ─── Überstunden Summary ───────────────────────────────────
  getOvertimeSummary: (year: number, groupId?: number) => {
    const qs = new URLSearchParams({ year: String(year) });
    if (groupId != null) qs.set('group_id', String(groupId));
    return fetchJSON<{ year: number; group_id: number | null; employees: OvertimeRow[]; summary: OvertimeSummary }>(
      `/api/v1/overtime-summary?${qs.toString()}`
    );
  },

  // ─── Overtime Dashboard (Q071) ────────────────────────────
  getOvertimeDashboard: (year: number, month: number, groupId?: number) => {
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    if (groupId != null) qs.set('group_id', String(groupId));
    return fetchJSON<OvertimeDashboardResponse>(
      `/api/v1/overtime/summary?${qs.toString()}`
    );
  },

  // ─── Dashboard: Today ──────────────────────────────────────
  getDashboardToday: () => fetchJSON<DashboardToday>('/api/v1/dashboard/today'),

  // ─── Dashboard: Upcoming ───────────────────────────────────
  getDashboardUpcoming: () => fetchJSON<DashboardUpcoming>('/api/v1/dashboard/upcoming'),

  // ─── Dashboard: Stats ──────────────────────────────────────
  getDashboardStats: (year?: number, month?: number) =>
    fetchJSON<DashboardStats>(`/api/v1/dashboard/stats${year && month ? `?year=${year}&month=${month}` : ''}`),

  // ─── Schedule Coverage (Personalbedarf-Ampel) ──────────────
  getCoverage: (year: number, month: number, groupId?: number) =>
    fetchJSON<CoverageDay[]>(`/api/v1/schedule/coverage?year=${year}&month=${month}${groupId != null ? `&group_id=${groupId}` : ''}`),

  // ─── Global Search (Spotlight) ─────────────────────────────
  search: (query: string) =>
    fetchJSON<{ results: SearchResult[]; query: string }>(`/api/v1/search?q=${encodeURIComponent(query)}`),

  // ─── Monthly Closing Report (Monatsabschluss) ──────────────
  getMonthlyReportUrl: (year: number, month: number, format: 'csv' | 'pdf', groupId?: number, title?: string, footer?: string): string => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), format });
    if (groupId != null) qs.set('group_id', String(groupId));
    if (title && title.trim()) qs.set('title', title.trim());
    if (footer && footer.trim()) qs.set('footer', footer.trim());
    return `${BASE_URL}/api/v1/reports/monthly?${qs.toString()}`;
  },

  downloadMonthlyReport: async (year: number, month: number, format: 'csv' | 'pdf', groupId?: number, title?: string, footer?: string): Promise<void> => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), format });
    if (groupId != null) qs.set('group_id', String(groupId));
    if (title && title.trim()) qs.set('title', title.trim());
    if (footer && footer.trim()) qs.set('footer', footer.trim());
    const url = `${BASE_URL}/api/v1/reports/monthly?${qs.toString()}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((data as { detail?: string }).detail || res.statusText);
    }
    const blob = await res.blob();
    const dlUrl = URL.createObjectURL(blob);
    const ext = format === 'pdf' ? 'pdf' : 'csv';
    const filename = `monatsabschluss_${year}_${String(month).padStart(2, '0')}.${ext}`;
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
  },

  // ─── Sickness/Krankenstand Statistics ─────────────────────
  getSicknessStatistics: (year: number) =>
    fetchJSON<SicknessStatistics>(`/api/v1/statistics/sickness?year=${year}`),

  getShiftStatistics: (year: number, months: number, groupId?: number) =>
    fetchJSON<ShiftStatisticsData>(`/api/v1/statistics/shifts?year=${year}&months=${months}${groupId ? `&group_id=${groupId}` : ''}`),

  getYearSummary: (year: number, groupId?: number | null) =>
    fetchJSON<YearSummaryData>(`/api/v1/statistics/year-summary?year=${year}${groupId ? `&group_id=${groupId}` : ''}`),

  // ─── Schedule Templates (Schicht-Vorlagen) ─────────────────
  getScheduleTemplates: () =>
    fetchJSON<ScheduleTemplate[]>('/api/v1/schedule/templates'),

  createScheduleTemplate: (body: TemplateCreate) =>
    postJSON<ScheduleTemplate>('/api/v1/schedule/templates', body),

  captureScheduleTemplate: (body: TemplateCaptureRequest) =>
    postJSON<ScheduleTemplate>('/api/v1/schedule/templates/capture', body),

  deleteScheduleTemplate: (templateId: number) =>
    deleteReq<{ deleted: boolean; id: number }>(`/api/v1/schedule/templates/${templateId}`),

  applyScheduleTemplate: (templateId: number, body: TemplateApplyRequest) =>
    postJSON<TemplateApplyResult>(`/api/v1/schedule/templates/${templateId}/apply`, body),

  // ─── Week Copy (Woche kopieren) ────────────────────────────
  copyWeek: (body: {
    source_employee_id: number;
    dates: string[];
    target_employee_ids: number[];
    skip_existing: boolean;
  }) =>
    postJSON<{ ok: boolean; created: number; skipped: number; errors: string[]; message: string }>(
      '/api/v1/schedule/copy-week',
      body,
    ),

  swapShifts: (body: {
    employee_id_1: number;
    employee_id_2: number;
    dates: string[];
  }) =>
    postJSON<{ ok: boolean; swapped_days: number; errors: string[]; message: string }>(
      '/api/v1/schedule/swap',
      body,
    ),

  // ─── Schicht-Wünsche & Sperrtage ─────────────────────────
  getWishes: (params: { employee_id?: number; year?: number; month?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.employee_id != null) q.set('employee_id', String(params.employee_id));
    if (params.year != null) q.set('year', String(params.year));
    if (params.month != null) q.set('month', String(params.month));
    return fetchJSON<Wish[]>(`/api/v1/wishes?${q}`);
  },

  createWish: (body: {
    employee_id: number;
    date: string;
    wish_type: 'WUNSCH' | 'SPERRUNG';
    shift_id?: number | null;
    note?: string;
  }) => postJSON<Wish>('/api/v1/wishes', body),

  deleteWish: (wishId: number) =>
    deleteReq<{ deleted: number }>(`/api/v1/wishes/${wishId}`),

  // ─── Schicht-Tauschbörse ─────────────────────────────────
  getSwapRequests: (params: { status?: string; employee_id?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.employee_id != null) q.set('employee_id', String(params.employee_id));
    return fetchJSON<SwapRequest[]>(`/api/v1/swap-requests?${q}`);
  },

  createSwapRequest: (body: {
    requester_id: number;
    requester_date: string;
    partner_id: number;
    partner_date: string;
    note?: string;
  }) => postJSON<SwapRequest>('/api/v1/swap-requests', body),

  resolveSwapRequest: (swapId: number, body: {
    action: 'approve' | 'reject';
    resolved_by?: string;
    reject_reason?: string;
  }) => patchJSON<SwapRequest>(`/api/v1/swap-requests/${swapId}/resolve`, body),

  deleteSwapRequest: (swapId: number) =>
    deleteReq<{ ok: boolean }>(`/api/v1/swap-requests/${swapId}`),

  // ─── Self-Service Swap Requests ──────────────────────────
  createSelfSwapRequest: (body: {
    partner_id: number;
    requester_date: string;
    partner_date: string;
    note?: string;
  }) => postJSON<SwapRequest>('/api/v1/self/swap-requests', body),

  respondSwapRequest: (swapId: number, accept: boolean) =>
    patchJSON<SwapRequest>(`/api/v1/self/swap-requests/${swapId}/respond`, { accept }),

  cancelSelfSwapRequest: (swapId: number) =>
    deleteReq<{ ok: boolean }>(`/api/v1/self/swap-requests/${swapId}`),

  // ─── Annual Close (Jahresabschluss) ──────────────────────
  getAnnualClosePreview: (params: { year: number; max_carry_forward_days: number; group_id?: number }) => {
    const p = new URLSearchParams({
      year: String(params.year),
      max_carry_forward_days: String(params.max_carry_forward_days),
    });
    if (params.group_id != null) p.set('group_id', String(params.group_id));
    return fetchJSON<unknown>(`/api/v1/annual-close/preview?${p}`);
  },
  runAnnualClose: (data: { year: number; max_carry_forward_days: number; group_id?: number }) =>
    postJSON<unknown>('/api/v1/annual-close', data),

  // ─── Self-Service (Leser) ─────────────────────────────────
  getMyEmployee: () =>
    fetchJSON<{ employee: Record<string, unknown> | null; user_id: number }>('/api/v1/me/employee'),

  createSelfWish: (body: {
    date: string;
    wish_type: 'WUNSCH' | 'SPERRUNG';
    shift_id?: number | null;
    note?: string;
  }) => postJSON<Wish>('/api/v1/self/wishes', body),

  deleteSelfWish: (wishId: number) =>
    deleteReq<{ deleted: number }>(`/api/v1/self/wishes/${wishId}`),

  getMySchedule: (year: number, month: number) =>
    fetchJSON<ScheduleEntry[]>(`/api/v1/self/schedule?year=${year}&month=${month}`),

  getMyWishes: (year: number, month: number) =>
    fetchJSON<Wish[]>(`/api/v1/self/wishes?year=${year}&month=${month}`),

  createSelfAbsence: (body: {
    date: string;
    leave_type_id: number;
    note?: string;
  }) => postJSON<{ id: number; employee_id: number; date: string; leave_type_id: number }>('/api/v1/self/absences', body),

  // ─── Notifications ─────────────────────────────────────────
  getNotifications: (params: { employee_id?: number; unread_only?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.employee_id != null) q.set('employee_id', String(params.employee_id));
    if (params.unread_only) q.set('unread_only', 'true');
    const qs = q.toString();
    return fetchJSON<{ notifications: NotificationItem[] }>(`/api/v1/notifications${qs ? `?${qs}` : ''}`);
  },
  getAllNotifications: (employeeId: number) =>
    fetchJSON<{ notifications: NotificationItem[] }>(`/api/v1/notifications/all?employee_id=${employeeId}`),
  markNotificationRead: (id: number) =>
    patchJSON<{ ok: boolean }>(`/api/v1/notifications/${id}/read`, {}),
  markAllNotificationsRead: (employeeId?: number) => {
    const qs = employeeId != null ? `?employee_id=${employeeId}` : '';
    return patchJSON<{ ok: boolean; updated: number }>(`/api/v1/notifications/read-all${qs}`, {});
  },
  deleteNotification: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/notifications/${id}`),

  // ─── Warnings ──────────────────────────────────────────────
  getWarnings: (year: number, month: number) =>
    fetchJSON<unknown>(`/api/v1/warnings?year=${year}&month=${month}`),

  // ─── Quality Report ────────────────────────────────────────
  getQualityReport: (year: number, month: number) =>
    fetchJSON<unknown>(`/api/v1/quality-report?year=${year}&month=${month}`),

  // ─── Fairness Score ────────────────────────────────────────
  getFairnessScore: (year: number, month?: number, groupId?: number) => {
    const p = new URLSearchParams({ year: String(year) });
    if (month != null) p.set('month', String(month));
    if (groupId != null) p.set('group_id', String(groupId));
    return fetchJSON<unknown>(`/api/v1/fairness?${p}`);
  },

  // ─── Capacity Forecast ─────────────────────────────────────
  getCapacityForecast: (params: Record<string, string>) =>
    fetchJSON<unknown>(`/api/v1/capacity-forecast?${new URLSearchParams(params)}`),
  getCapacityYear: (params: Record<string, string>) =>
    fetchJSON<unknown>(`/api/v1/capacity-year?${new URLSearchParams(params)}`),

  // ─── Skills / Kompetenz Matrix ─────────────────────────────
  getSkillsMatrix: () => fetchJSON<unknown>('/api/v1/skills/matrix'),
  getSkills: () => fetchJSON<unknown[]>('/api/v1/skills'),
  createSkill: (data: { name: string; description?: string; category?: string }) =>
    postJSON<unknown>('/api/v1/skills', data),
  updateSkill: (id: string, data: { name?: string; description?: string; category?: string }) =>
    putJSON<unknown>(`/api/v1/skills/${id}`, data),
  deleteSkill: (id: string) =>
    deleteReq<unknown>(`/api/v1/skills/${id}`),
  getSkillAssignments: (params?: { employee_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.employee_id != null) q.set('employee_id', String(params.employee_id));
    const qs = q.toString();
    return fetchJSON<unknown[]>(`/api/v1/skills/assignments${qs ? `?${qs}` : ''}`);
  },
  createSkillAssignment: (data: { employee_id: number; skill_id: string; level: number }) =>
    postJSON<unknown>('/api/v1/skills/assignments', data),
  deleteSkillAssignment: (id: string) =>
    deleteReq<unknown>(`/api/v1/skills/assignments/${id}`),

  // ─── Availability ──────────────────────────────────────────
  getAvailability: (empId: number) =>
    fetchJSON<unknown>(`/api/v1/employees/${empId}/availability`),
  setAvailability: (empId: number, data: { days: unknown[] }) =>
    postJSON<unknown>(`/api/v1/employees/${empId}/availability`, data),

  // ─── Simulation ────────────────────────────────────────────
  runSimulation: (data: unknown) =>
    postJSON<unknown>('/api/v1/simulation', data),

  // ─── Handover / Übergabe ───────────────────────────────────
  getHandover: (params: { date?: string; shift_id?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.date) q.set('date', params.date);
    if (params.shift_id != null) q.set('shift_id', String(params.shift_id));
    const qs = q.toString();
    return fetchJSON<unknown[]>(`/api/v1/handover${qs ? `?${qs}` : ''}`);
  },
  createHandover: (data: { date: string; shift_id: number; text: string; author?: string }) =>
    postJSON<unknown>('/api/v1/handover', data),
  updateHandover: (id: number, data: Record<string, unknown>) =>
    patchJSON<unknown>(`/api/v1/handover/${id}`, data),
  deleteHandover: (id: number) =>
    deleteReq<unknown>(`/api/v1/handover/${id}`),

  // ─── Leave Balance ─────────────────────────────────────────
  getLeaveBalance: (year: number, employeeId: number) =>
    fetchJSON<unknown>(`/api/v1/leave-balance?year=${year}&employee_id=${employeeId}`),
  getLeaveBalanceGroup: (year: number, groupId: number) =>
    fetchJSON<unknown>(`/api/v1/leave-balance/group?year=${year}&group_id=${groupId}`),

  // ─── Holiday Bans Write ────────────────────────────────────
  createHolidayBan: (data: { group_id: number; start_date: string; end_date: string; restrict?: number; reason?: string }) =>
    postJSON<unknown>('/api/v1/holiday-bans', data),
  deleteHolidayBan: (id: number) =>
    deleteReq<unknown>(`/api/v1/holiday-bans/${id}`),

  // ─── Absence Statistics (Q074) ────────────────────────────
  getAbsenceStatsEmployee: (employeeId: number, year: number) =>
    fetchJSON<import('../pages/AbsenceStats').AbsenceEmployeeStats>(
      `/api/v1/absences/stats/employee/${employeeId}?year=${year}`
    ),

  getAbsenceStatsGroup: (groupId: number, year: number) =>
    fetchJSON<import('../pages/AbsenceStats').AbsenceGroupStats>(
      `/api/v1/absences/stats/group/${groupId}?year=${year}`
    ),

  getAbsenceStatsOverview: (year: number) =>
    fetchJSON<import('../pages/AbsenceStats').AbsenceOverview>(
      `/api/v1/absences/stats/overview?year=${year}`
    ),

  // ─── Absence Status ────────────────────────────────────────
  setAbsenceStatus: (absenceId: number, data: { status: string; reject_reason?: string }) =>
    putJSON<unknown>(`/api/v1/absences/${absenceId}/status`, data),

  // ─── Leave Entitlements Write ──────────────────────────────
  createLeaveEntitlement: (data: { employee_id: number; year: number; leave_type_id: number; entitlement: number; carry_forward?: number }) =>
    postJSON<unknown>('/api/v1/leave-entitlements', data),

  // ─── Stichtags-Verfall (Resturlaub-Kürzung zum Stichtag) ──────────
  /** Kürzt je Mitarbeiter den Resturlaub des Stichtagsjahres auf den Verbrauch
   *  bis einschließlich Stichtag; dry_run=true liefert nur die Vorschau. Admin-Rolle. */
  forfeitLeaveEntitlements: (data: { cutoff_date: string; group_id?: number; dry_run?: boolean }) =>
    postJSON<LeaveForfeitResult>('/api/v1/leave-entitlements/forfeit', data),

  // ─── Admin: ORM Mirror ─────────────────────────────────────
  getOrmMirrorStatus: () =>
    fetchJSON<OrmMirrorStatus>('/api/admin/orm/status'),
  syncOrmMirror: () =>
    postJSON<OrmMirrorSyncResult>('/api/admin/orm/sync', {}),

  // ─── Admin: Compact / Import ───────────────────────────────
  compactData: () =>
    postJSON<unknown>('/api/v1/admin/compact', {}),

  importData: async (endpoint: string, file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await safeFetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    await handleResponseError(res);
    return res.json();
  },

  // ─── Druckvorschau (generic fetch for report pages) ────────
  fetchReportData: <T>(path: string) => fetchJSON<T>(path),

  // ─── Download with auth (for backup downloads etc.) ────────
  downloadWithAuth: async (url: string): Promise<Blob> => {
    const res = await safeFetch(url, { headers: authHeaders() });
    await handleResponseError(res);
    return res.blob();
  },

  // ─── Error Reporting ───────────────────────────────────────
  reportError: (data: { message: string; stack?: string; component?: string }) =>
    postJSON<unknown>('/api/v1/errors', data),

  // ─── iCal Export & Feed ─────────────────────────────────────
  getIcalToken: async (): Promise<{ token: string | null; feed_url: string | null; webcal_url: string | null }> => {
    const res = await safeFetch(`${BASE_URL}/api/v1/ical/token`, { headers: authHeaders() });
    await handleResponseError(res);
    return res.json();
  },

  createIcalToken: async (): Promise<{ token: string; feed_url: string; webcal_url: string }> => {
    const res = await safeFetch(`${BASE_URL}/api/v1/ical/token`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    });
    await handleResponseError(res);
    return res.json();
  },

  revokeIcalToken: async (): Promise<{ ok: boolean; message: string }> => {
    const res = await safeFetch(`${BASE_URL}/api/v1/ical/token`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    await handleResponseError(res);
    return res.json();
  },

  downloadIcal: async (year: number, month: number): Promise<void> => {
    const res = await safeFetch(
      `${BASE_URL}/api/v1/ical/my-schedule.ics?year=${year}&month=${month}`,
      { headers: authHeaders() },
    );
    await handleResponseError(res);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schichtplan-${year}-${String(month).padStart(2, '0')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadEmployeeIcal: async (employeeId: number, year: number, month: number): Promise<void> => {
    const res = await safeFetch(
      `${BASE_URL}/api/v1/ical/schedule/${employeeId}.ics?year=${year}&month=${month}`,
      { headers: authHeaders() },
    );
    await handleResponseError(res);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schichtplan-${employeeId}-${year}-${String(month).padStart(2, '0')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ── Webhooks ──────────────────────────────────────────────────
  getWebhooks: () => fetchJSON<WebhookEntry[]>('/api/v1/webhooks'),
  getWebhook: (id: number) => fetchJSON<WebhookEntry>(`/api/v1/webhooks/${id}`),
  createWebhook: (data: { url: string; name: string; events: string[]; active?: boolean }) =>
    postJSON<{ ok: boolean; record: WebhookEntry }>('/api/v1/webhooks', data),
  updateWebhook: (id: number, data: { url?: string; name?: string; events?: string[]; active?: boolean }) =>
    putJSON<{ ok: boolean; record: WebhookEntry }>(`/api/v1/webhooks/${id}`, data),
  deleteWebhook: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/webhooks/${id}`),
  testWebhook: (id: number) =>
    postJSON<{ ok: boolean; delivery: WebhookDeliveryResult }>(`/api/v1/webhooks/${id}/test`, {}),
  getWebhookEvents: () => fetchJSON<{ events: string[] }>('/api/v1/webhooks/events/list'),

  // ── Companies (Multi-Tenant) ─────────────────────────────────
  getCompanies: () => fetchJSON<{ id: number; name: string; slug: string; is_active: boolean; employee_count: number; group_count: number }[]>('/api/v1/companies'),
  getCompany: (id: number) => fetchJSON<{ id: number; name: string; slug: string; is_active: boolean; employee_count: number; group_count: number }>(`/api/v1/companies/${id}`),
  createCompany: (data: { name: string; slug?: string }) =>
    postJSON<{ id: number; name: string; slug: string; is_active: boolean }>('/api/v1/companies', data),
  updateCompany: (id: number, data: { name?: string; slug?: string; is_active?: boolean }) =>
    putJSON<{ id: number; name: string; slug: string; is_active: boolean }>(`/api/v1/companies/${id}`, data),
  deleteCompany: (id: number) =>
    deleteReq<{ ok: boolean; deactivated: number }>(`/api/v1/companies/${id}`),

  // ── 2FA / TOTP ──────────────────────────────────────────────
  get2FAStatus: () => fetchJSON<{ enabled: boolean }>('/api/v1/auth/2fa/status'),
  setup2FA: () => postJSON<{ secret: string; qr_code: string; otpauth_uri: string }>('/api/v1/auth/2fa/setup', {}),
  enable2FA: (code: string) => postJSON<{ ok: boolean; backup_codes: string[] }>('/api/v1/auth/2fa/enable', { code }),
  disable2FA: (password: string) => postJSON<{ ok: boolean }>('/api/v1/auth/2fa/disable', { password }),
  adminDisable2FA: (userId: number) => postJSON<{ ok: boolean }>(`/api/v1/auth/2fa/admin-disable/${userId}`, {}),

  // ── Release Notes ──────────────────────────────────────────
  getReleaseNotes: () => fetchJSON<{ content: string }>('/api/v1/release-notes'),

  // ── Recurring Shifts (Q066 / Q073) ─────────────────────────
  getRecurringShifts: (params: { employee_id?: number; group_id?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.employee_id != null) q.set('employee_id', String(params.employee_id));
    if (params.group_id != null) q.set('group_id', String(params.group_id));
    const qs = q.toString();
    return fetchJSON<RecurringShift[]>(`/api/v1/shifts/recurring${qs ? `?${qs}` : ''}`);
  },
  createRecurringShift: (data: RecurringShiftCreate) =>
    postJSON<RecurringShift>('/api/v1/shifts/recurring', data),
  deleteRecurringShift: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/shifts/recurring/${id}`),
  generateRecurringShift: (id: number, fromDate: string, toDate: string) =>
    postJSON<RecurringShiftGenerateResult>(`/api/v1/shifts/recurring/${id}/generate`, { from_date: fromDate, to_date: toDate }),

  // ─── Export Scheduler (Q070 / Q075) ──────────────────────────
  getExportSchedules: () =>
    fetchJSON<ExportSchedule[]>('/api/v1/export-scheduler/schedules'),

  createExportSchedule: (data: ExportScheduleCreate) =>
    postJSON<ExportSchedule>('/api/v1/export-scheduler/schedules', data),

  updateExportSchedule: (id: number, data: ExportScheduleUpdate) =>
    putJSON<ExportSchedule>(`/api/v1/export-scheduler/schedules/${id}`, data),

  deleteExportSchedule: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/export-scheduler/schedules/${id}`),

  runExportSchedule: (id: number) =>
    postJSON<ExportRunResult>(`/api/v1/export-scheduler/schedules/${id}/run`, {}),

  // ── Schedule Comments (Q069) ────────────────────────────────
  getScheduleComments: (params: { group_id?: number; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params.group_id !== undefined) q.set('group_id', String(params.group_id));
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    return fetchJSON<ScheduleComment[]>(`/api/v1/schedule/comments${q.toString() ? `?${q}` : ''}`);
  },
  createScheduleComment: (body: { date: string; group_id: number; text: string }) =>
    postJSON<ScheduleComment>('/api/v1/schedule/comments', body),
  deleteScheduleComment: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/v1/schedule/comments/${id}`),

  // ── Notification Settings (Q080) ────────────────────────────────
  getNotificationSettings: () =>
    fetchJSON<NotificationSettingsResponse>('/api/v1/notifications/settings'),
  updateNotificationSettings: (settings: NotificationSettings) =>
    putJSON<NotificationSettingsResponse>('/api/v1/notifications/settings', settings),

  // ── Work Time Rules (Q079 / Q081) ─────────────────────────────────
  getWorkTimeRules: () =>
    fetchJSON<WorkTimeRulesConfig>('/api/v1/work-time-rules'),
  updateWorkTimeRules: (data: WorkTimeRulesConfig) =>
    putJSON<WorkTimeRulesConfig>('/api/v1/work-time-rules', data),
  checkWorkTimeRules: (params: { employee_id: number; date_from: string; date_to: string }) =>
    postJSON<WorkTimeCheckResult>('/api/v1/work-time-rules/check', params),
  checkAllWorkTimeRules: (params: { group_id?: number; date_from: string; date_to: string }) =>
    postJSON<WorkTimeCheckAllResult>('/api/v1/work-time-rules/check-all', params),

  // ── Conflict Report (Q083) ─────────────────────────────────────────
  getConflictReport: (params: { group_id?: number; from: string; to: string }) => {
    const p = new URLSearchParams();
    if (params.group_id !== undefined) p.set('group_id', String(params.group_id));
    p.set('from', params.from);
    p.set('to', params.to);
    return fetchJSON<ConflictReportResult>(`/api/v1/reports/conflicts?${p}`);
  },
  getConflictReportExportUrl: (params: { group_id?: number; from: string; to: string; format: 'csv' | 'xlsx' }): string => {
    const p = new URLSearchParams();
    if (params.group_id !== undefined) p.set('group_id', String(params.group_id));
    p.set('from', params.from);
    p.set('to', params.to);
    p.set('format', params.format);
    return `${BASE_URL}/api/v1/reports/conflicts/export?${p}`;
  },
};

// ─── Work Time Rules (Q079 / Q081) ────────────────────────────────
export interface WorkTimeRulesConfig {
  max_hours_per_day: number;
  max_hours_per_week: number;
  min_rest_hours_between_shifts: number;
  max_consecutive_days: number;
  enabled: boolean;
  updated_at?: string;
}

export interface WorkTimeViolation {
  rule_type: string;
  severity: 'warning' | 'error';
  date: string;
  message: string;
  value?: number;
  limit?: number;
}

export interface WorkTimeCheckResult {
  employee_id: number;
  employee_name: string;
  date_from: string;
  date_to: string;
  violation_count: number;
  violations: WorkTimeViolation[];
}

export interface WorkTimeCheckAllResult {
  date_from: string;
  date_to: string;
  employee_count: number;
  total_violations: number;
  results: WorkTimeCheckResult[];
}

// ─── Notification Settings (Q080) ────────────────────────────────
export interface NotificationSettings {
  shift_assigned: boolean;
  shift_changed: boolean;
  swap_requested: boolean;
  swap_approved: boolean;
  swap_rejected: boolean;
  vacation_approved: boolean;
  vacation_rejected: boolean;
  schedule_comment_added: boolean;
}

export interface NotificationSettingsResponse {
  user_id: number;
  settings: NotificationSettings;
  updated?: boolean;
}

// ─── Conflict Report Types (Q083) ────────────────────────────────
export type ConflictType = 'overlap' | 'double_booked' | 'understaffed';
export type ConflictSeverity = 'warning' | 'error';

export interface ConflictReportEntry {
  type: ConflictType;
  date: string;
  employee_id: number | null;
  employee_name: string | null;
  group_id: number | null;
  description: string;
  severity: ConflictSeverity;
}

export interface ConflictReportSummary {
  overlaps: number;
  double_booked: number;
  understaffed: number;
  total: number;
}

export interface ConflictReportResult {
  from: string;
  to: string;
  group_id: number | null;
  summary: ConflictReportSummary;
  conflicts: ConflictReportEntry[];
}
