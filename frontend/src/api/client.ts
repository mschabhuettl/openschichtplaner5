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
export interface CoverageDay {
  day: number;
  scheduled_count: number;
  required_count: number;
  status: 'ok' | 'low' | 'critical';
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
  user: {
    ID: number;
    NAME: string;
    DESCRIP: string;
    ADMIN: boolean;
    RIGHTS: number;
    role: string;
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

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

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
  '/api/employees',
  '/api/groups',
  '/api/shifts',
  '/api/leave-types',
  '/api/workplaces',
  '/api/holidays',
]);

function isCacheable(path: string): boolean {
  // Also cache holidays with year query param
  if (path.startsWith('/api/holidays')) return true;
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

/** Read auth token from localStorage (set by AuthContext). */
function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return null;
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    return session.devMode ? '__dev_mode__' : (session.token ?? null);
  } catch {
    return null;
  }
}

/** Build auth headers, injecting X-Auth-Token when a session token exists. */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return token ? { ...extra, 'X-Auth-Token': token } : extra;
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

async function handleResponseError(res: Response): Promise<void> {
  if (res.status === 401) {
    dispatchUnauthorized();
    throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
  }
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new Error(msg);
  }
}

/** Wrap fetch calls with auto-retry (2 attempts, exponential backoff) on network errors.
 *  Only network-level errors are retried; HTTP 4xx/5xx are NOT retried. */
async function safeFetch(input: string, init?: RequestInit, _attempt = 0): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    // TypeError: Failed to fetch — server unreachable or CORS
    if (_attempt < 2) {
      // Exponential backoff: 500ms, 1500ms
      await new Promise(r => setTimeout(r, 500 * (2 ** _attempt)));
      return safeFetch(input, init, _attempt + 1);
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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
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
  getStats: () => fetchJSON<Stats>('/api/stats'),
  getDashboardSummary: (year: number, month: number) =>
    fetchJSON<DashboardSummary>(`/api/dashboard/summary?year=${year}&month=${month}`),
  getEmployees: () => fetchJSON<Employee[]>('/api/employees'),
  getGroups: () => fetchJSON<Group[]>('/api/groups'),
  getShifts: () => fetchJSON<ShiftType[]>('/api/shifts'),
  getLeaveTypes: () => fetchJSON<LeaveType[]>('/api/leave-types'),
  getWorkplaces: () => fetchJSON<Workplace[]>('/api/workplaces'),
  getHolidays: (year?: number) => fetchJSON<Holiday[]>(`/api/holidays${year ? `?year=${year}` : ''}`),
  getSchedule: (year: number, month: number, groupId?: number) =>
    fetchJSON<ScheduleEntry[]>(`/api/schedule?year=${year}&month=${month}${groupId ? `&group_id=${groupId}` : ''}`),
  getUsers: () => fetchJSON<User[]>('/api/users'),

  // New endpoints
  getScheduleDay: (date: string, groupId?: number) =>
    fetchJSON<DayEntry[]>(`/api/schedule/day?date=${date}${groupId ? `&group_id=${groupId}` : ''}`),

  getStatistics: (year: number, month: number, groupId?: number) =>
    fetchJSON<EmployeeStats[]>(`/api/statistics?year=${year}&month=${month}${groupId ? `&group_id=${groupId}` : ''}`),

  getScheduleYear: (year: number, employeeId: number) =>
    fetchJSON<MonthSummary[]>(`/api/schedule/year?year=${year}&employee_id=${employeeId}`),

  getEmployeeStatsYear: (employeeId: number, year: number) =>
    fetchJSON<EmployeeYearStats>(`/api/statistics/employee/${employeeId}?year=${year}`),

  getEmployeeStatsMonth: (employeeId: number, year: number, month: number) =>
    fetchJSON<EmployeeYearStats>(`/api/statistics/employee/${employeeId}?year=${year}&month=${month}`),

  getScheduleWeek: (date: string, groupId?: number) =>
    fetchJSON<WeekSchedule>(`/api/schedule/week?date=${date}${groupId ? `&group_id=${groupId}` : ''}`),

  getConflicts: (params: { year: number; month: number; group_id?: number }) => {
    const p = new URLSearchParams({ year: String(params.year), month: String(params.month) });
    if (params.group_id != null) p.set('group_id', String(params.group_id));
    return fetchJSON<ScheduleConflicts>(`/api/schedule/conflicts?${p}`);
  },

  getGroupMembers: (groupId: number) =>
    fetchJSON<Employee[]>(`/api/groups/${groupId}/members`),

  createScheduleEntry: (employee_id: number, date: string, shift_id: number) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/schedule', { employee_id, date, shift_id }),

  deleteScheduleEntry: (employee_id: number, date: string) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/schedule/${employee_id}/${date}`),

  bulkSchedule: (
    entries: Array<{ employee_id: number; date: string; shift_id: number | null }>,
    overwrite = true,
  ) => postJSON<{ created: number; updated: number; deleted: number }>(
    '/api/schedule/bulk',
    { entries, overwrite },
  ),

  generateSchedule: (params: {
    year: number;
    month: number;
    employee_ids?: number[];
    force?: boolean;
    dry_run?: boolean;
  }) =>
    postJSON<{
      created: number;
      skipped: number;
      errors: string[];
      preview: Array<{ employee_id: number; employee_name: string; date: string; shift_id: number; shift_name: string; status: 'new' | 'skip' | 'overwrite' }>;
      message: string;
    }>(
      '/api/schedule/generate',
      params,
    ),

  getAbsences: (params?: { year?: number; employee_id?: number; leave_type_id?: number }) => {
    const qs = params ? new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))).toString() : '';
    return fetchJSON<{ id: number; employee_id: number; date: string; leave_type_id: number; leave_type_name: string; leave_type_short: string }[]>(`/api/absences${qs ? `?${qs}` : ''}`);
  },
  createAbsence: (employee_id: number, date: string, leave_type_id: number) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/absences', { employee_id, date, leave_type_id }),
  deleteAbsence: (employee_id: number, date: string) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/absences/${employee_id}/${date}`),

  getGroupAssignments: () =>
    fetchJSON<{ employee_id: number; group_id: number }[]>('/api/group-assignments'),

  getLeaveEntitlements: (params?: { year?: number; employee_id?: number }) => {
    const qs = params ? new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))).toString() : '';
    return fetchJSON<{ id: number; employee_id: number; year: number; leave_type_id: number; leave_type_name: string; entitlement: number; carry_forward: number; in_days: boolean }[]>(`/api/leave-entitlements${qs ? `?${qs}` : ''}`);
  },

  // ─── Shift Cycles ─────────────────────────────────────────
  getShiftCycles: () => fetchJSON<ShiftCycle[]>('/api/shift-cycles'),
  getShiftCycle: (id: number) => fetchJSON<ShiftCycle>(`/api/shift-cycles/${id}`),
  getCycleAssignments: () => fetchJSON<CycleAssignment[]>('/api/shift-cycles/assign'),
  assignCycle: (employee_id: number, cycle_id: number, start_date: string) =>
    postJSON<{ ok: boolean; record: CycleAssignment }>('/api/shift-cycles/assign', { employee_id, cycle_id, start_date }),
  removeCycleAssignment: (employee_id: number) =>
    deleteReq<{ ok: boolean; removed: number }>(`/api/shift-cycles/assign/${employee_id}`),
  createShiftCycle: (name: string, size_weeks: number) =>
    postJSON<{ ok: boolean; cycle: ShiftCycle }>('/api/shift-cycles', { name, size_weeks }),
  updateShiftCycle: (id: number, name: string, size_weeks: number, entries: { index: number; shift_id: number | null }[]) =>
    putJSON<{ ok: boolean; cycle: ShiftCycle }>(`/api/shift-cycles/${id}`, { name, size_weeks, entries }),
  deleteShiftCycle: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/shift-cycles/${id}`),

  // ─── Staffing Requirements ────────────────────────────────
  getStaffingRequirements: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    const qs = params.toString();
    return fetchJSON<StaffingRequirements>(`/api/staffing-requirements${qs ? `?${qs}` : ''}`);
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
    return fetchJSON<Note[]>(`/api/notes${qs ? `?${qs}` : ''}`);
  },
  addNote: (date: string, text: string, employee_id?: number, text2?: string, category?: string) =>
    postJSON<{ ok: boolean; record: Note }>('/api/notes', { date, text, employee_id: employee_id ?? 0, text2: text2 ?? '', category: category ?? '' }),
  updateNote: (id: number, data: NoteUpdate) =>
    putJSON<{ ok: boolean; record: Note }>(`/api/notes/${id}`, data),
  deleteNote: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/notes/${id}`),

  // ─── Periods ──────────────────────────────────────────────
  getPeriods: (group_id?: number) =>
    fetchJSON<Period[]>(`/api/periods${group_id ? `?group_id=${group_id}` : ''}`),
  createPeriod: (data: { group_id: number; start: string; end: string; description?: string }) =>
    postJSON<{ ok: boolean; record: Period }>('/api/periods', data),
  deletePeriod: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/periods/${id}`),

  // ─── Staffing Requirements Write ──────────────────────────
  setStaffingRequirement: (data: { shift_id: number; weekday: number; min: number; max: number; group_id: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/staffing-requirements', data),

  // ─── Zeitkonto ────────────────────────────────────────────
  getZeitkonto: (year: number, groupId?: number, employeeId?: number) => {
    const params = new URLSearchParams({ year: String(year) });
    if (groupId) params.set('group_id', String(groupId));
    if (employeeId) params.set('employee_id', String(employeeId));
    return fetchJSON<ZeitkontoRow[]>(`/api/zeitkonto?${params}`);
  },
  getZeitkontoDetail: (year: number, employeeId: number) =>
    fetchJSON<ZeitkontoDetail>(`/api/zeitkonto/detail?year=${year}&employee_id=${employeeId}`),
  getZeitkontoSummary: (year: number, groupId?: number) => {
    const params = new URLSearchParams({ year: String(year) });
    if (groupId) params.set('group_id', String(groupId));
    return fetchJSON<ZeitkontoSummary>(`/api/zeitkonto/summary?${params}`);
  },
  getBookings: (year?: number, month?: number, employeeId?: number) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    if (employeeId) params.set('employee_id', String(employeeId));
    const qs = params.toString();
    return fetchJSON<Booking[]>(`/api/bookings${qs ? `?${qs}` : ''}`);
  },
  createBooking: (data: { employee_id: number; date: string; type: number; value: number; note?: string }) =>
    postJSON<{ ok: boolean; record: Booking }>('/api/bookings', data),
  deleteBooking: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/bookings/${id}`),

  // ─── CRUD: Employees ──────────────────────────────────────
  createEmployee: (data: Partial<Employee>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/employees', data),
  updateEmployee: (id: number, data: Partial<Employee>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/employees/${id}`, data),
  deleteEmployee: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/employees/${id}`),

  // ─── CRUD: Groups ─────────────────────────────────────────
  createGroup: (data: Partial<Group>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/groups', data),
  updateGroup: (id: number, data: Partial<Group>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/groups/${id}`, data),
  deleteGroup: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/groups/${id}`),
  addGroupMember: (groupId: number, employee_id: number) =>
    postJSON<{ ok: boolean; record: unknown }>(`/api/groups/${groupId}/members`, { employee_id }),
  removeGroupMember: (groupId: number, empId: number) =>
    deleteReq<{ ok: boolean; removed: number }>(`/api/groups/${groupId}/members/${empId}`),

  // ─── CRUD: Shifts ─────────────────────────────────────────
  createShift: (data: Partial<ShiftType>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/shifts', data),
  updateShift: (id: number, data: Partial<ShiftType>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/shifts/${id}`, data),
  deleteShift: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/shifts/${id}`),

  // ─── CRUD: Leave Types ────────────────────────────────────
  createLeaveType: (data: Partial<LeaveType>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/leave-types', data),
  updateLeaveType: (id: number, data: Partial<LeaveType>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/leave-types/${id}`, data),
  deleteLeaveType: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/leave-types/${id}`),

  // ─── CRUD: Holidays ───────────────────────────────────────
  createHoliday: (data: { DATE: string; NAME: string; INTERVAL?: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/holidays', data),
  updateHoliday: (id: number, data: Partial<Holiday>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/holidays/${id}`, data),
  deleteHoliday: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/holidays/${id}`),

  // ─── CRUD: Workplaces ─────────────────────────────────────
  createWorkplace: (data: Partial<Workplace>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/workplaces', data),
  updateWorkplace: (id: number, data: Partial<Workplace>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/workplaces/${id}`, data),
  deleteWorkplace: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/workplaces/${id}`),

  // ─── Workplace ↔ Employee Assignments ─────────────────────
  getWorkplaceEmployees: (workplaceId: number) =>
    fetchJSON<WorkplaceEmployee[]>(`/api/workplaces/${workplaceId}/employees`),
  assignEmployeeToWorkplace: (workplaceId: number, employeeId: number) =>
    postJSON<{ ok: boolean; added: boolean }>(`/api/workplaces/${workplaceId}/employees/${employeeId}`, {}),
  removeEmployeeFromWorkplace: (workplaceId: number, employeeId: number) =>
    deleteReq<{ ok: boolean; removed: boolean }>(`/api/workplaces/${workplaceId}/employees/${employeeId}`),

  // ─── CRUD: Extra Charges ──────────────────────────────────
  getExtraCharges: (include_hidden = false) =>
    fetchJSON<ExtraCharge[]>(`/api/extracharges${include_hidden ? '?include_hidden=true' : ''}`),
  createExtraCharge: (data: Partial<ExtraCharge>) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/extracharges', data),
  updateExtraCharge: (id: number, data: Partial<ExtraCharge>) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/extracharges/${id}`, data),
  deleteExtraCharge: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/extracharges/${id}`),
  getExtraChargesSummary: (year: number, month: number, employeeId?: number) =>
    fetchJSON<ExtraChargeSummary[]>(
      `/api/extracharges/summary?year=${year}&month=${month}${employeeId != null ? `&employee_id=${employeeId}` : ''}`
    ),

  // ─── Auth ─────────────────────────────────────────────────
  login: (username: string, password: string) =>
    postJSON<LoginResponse>('/api/auth/login', { username, password }),

  // ─── CRUD: Users ──────────────────────────────────────────
  createUser: (data: UserCreate) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/users', data),
  updateUser: (id: number, data: UserUpdate) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/users/${id}`, data),
  deleteUser: (id: number) =>
    deleteReq<{ ok: boolean; hidden: number }>(`/api/users/${id}`),

  // ─── Einsatzplan / SPSHI ─────────────────────────────────
  getEinsatzplan: (date: string, groupId?: number) =>
    fetchJSON<SpshiEntry[]>(`/api/einsatzplan?date=${date}${groupId != null ? `&group_id=${groupId}` : ''}`),
  createEinsatzplanEntry: (data: EinsatzplanEntryCreate) =>
    postJSON<{ ok: boolean; record: SpshiEntry }>('/api/einsatzplan', data),
  updateEinsatzplanEntry: (id: number, data: EinsatzplanEntryUpdate) =>
    putJSON<{ ok: boolean; record: unknown }>(`/api/einsatzplan/${id}`, data),
  deleteEinsatzplanEntry: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/einsatzplan/${id}`),
  createDeviation: (data: DeviationCreate) =>
    postJSON<{ ok: boolean; record: SpshiEntry }>('/api/einsatzplan/deviation', data),

  // ─── Restrictions ─────────────────────────────────────────
  getRestrictions: (employeeId?: number) =>
    fetchJSON<Restriction[]>(employeeId != null ? `/api/restrictions?employee_id=${employeeId}` : '/api/restrictions'),
  addRestriction: (data: { employee_id: number; shift_id: number; reason?: string; weekday?: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/restrictions', data),
  removeRestriction: (employeeId: number, shiftId: number, weekday = 0) =>
    deleteReq<{ ok: boolean; removed: number }>(`/api/restrictions/${employeeId}/${shiftId}?weekday=${weekday}`),

  // ─── Settings (USETT) ────────────────────────────────────
  getSettings: () => fetchJSON<UsettSettings>('/api/settings'),
  updateSettings: (data: Partial<UsettSettings>) =>
    putJSON<{ ok: boolean; record: UsettSettings }>('/api/settings', data),

  // ─── Special Staffing Requirements (SPDEM) ───────────────
  getSpecialStaffing: (date?: string, groupId?: number) => {
    const p = new URLSearchParams();
    if (date) p.set('date', date);
    if (groupId != null) p.set('group_id', String(groupId));
    const qs = p.toString();
    return fetchJSON<SpecialStaffingReq[]>(`/api/staffing-requirements/special${qs ? `?${qs}` : ''}`);
  },
  createSpecialStaffing: (data: {
    group_id: number; date: string; shift_id: number;
    workplace_id?: number; min: number; max: number;
  }) => postJSON<{ ok: boolean; record: unknown }>('/api/staffing-requirements/special', data),
  updateSpecialStaffing: (id: number, data: Partial<{
    group_id: number; date: string; shift_id: number;
    workplace_id: number; min: number; max: number;
  }>) => putJSON<{ ok: boolean; record: unknown }>(`/api/staffing-requirements/special/${id}`, data),
  deleteSpecialStaffing: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/staffing-requirements/special/${id}`),

  // ─── Cycle Exceptions ─────────────────────────────────────
  getCycleExceptions: (params?: { employee_id?: number; cycle_assignment_id?: number }) => {
    const qs = params ? new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))).toString() : '';
    return fetchJSON<{ id: number; employee_id: number; cycle_assignment_id: number; date: string; type: number }[]>(
      `/api/cycle-exceptions${qs ? `?${qs}` : ''}`);
  },
  setCycleException: (data: { employee_id: number; cycle_assignment_id: number; date: string; type?: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/cycle-exceptions', data),
  deleteCycleException: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/cycle-exceptions/${id}`),

  // ─── Employee Access ───────────────────────────────────────
  getEmployeeAccess: (user_id?: number) => {
    const qs = user_id != null ? `?user_id=${user_id}` : '';
    return fetchJSON<{ id: number; user_id: number; employee_id: number; rights: number }[]>(`/api/employee-access${qs}`);
  },
  setEmployeeAccess: (data: { user_id: number; employee_id: number; rights: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/employee-access', data),
  deleteEmployeeAccess: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/employee-access/${id}`),

  // ─── Group Access ──────────────────────────────────────────
  getGroupAccess: (user_id?: number) => {
    const qs = user_id != null ? `?user_id=${user_id}` : '';
    return fetchJSON<{ id: number; user_id: number; group_id: number; rights: number }[]>(`/api/group-access${qs}`);
  },
  setGroupAccess: (data: { user_id: number; group_id: number; rights: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/group-access', data),
  deleteGroupAccess: (id: number) =>
    deleteReq<{ ok: boolean; deleted: number }>(`/api/group-access/${id}`),

  // ─── Carry Forward (Saldo-Übertrag) ──────────────────────
  getCarryForward: (employeeId: number, year: number) =>
    fetchJSON<{ employee_id: number; year: number; hours: number; booking_id: number | null }>(
      `/api/bookings/carry-forward?employee_id=${employeeId}&year=${year}`
    ),
  setCarryForward: (data: { employee_id: number; year: number; hours: number }) =>
    postJSON<{ ok: boolean; record: unknown }>('/api/bookings/carry-forward', data),
  calculateAnnualStatement: (data: { employee_id: number; year: number }) =>
    postJSON<{ ok: boolean; result: { employee_id: number; year: number; saldo: number; carry_in: number; total_saldo: number; should_carry: boolean; next_year: number } }>(
      '/api/bookings/annual-statement', data
    ),

  // ─── Employee Photo ────────────────────────────────────────
  getEmployeePhotoUrl: (id: number): string => `${BASE_URL}/api/employees/${id}/photo`,

  uploadEmployeePhoto: async (id: number, file: File): Promise<{ ok: boolean; photo_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/api/employees/${id}/photo`, {
      method: 'POST',
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
    postJSON<{ ok: boolean }>(`/api/users/${userId}/change-password`, { new_password: newPassword }),

  // ─── Holiday Bans ─────────────────────────────────────────
  getHolidayBans: (groupId?: number) =>
    fetchJSON<{ id: number; group_id: number; group_name: string; start_date: string; end_date: string; restrict: number; reason: string }[]>(
      `/api/holiday-bans${groupId != null ? `?group_id=${groupId}` : ''}`
    ),

  // ─── Backup / Restore ─────────────────────────────────────
  getBackupUrl: (): string => `${BASE_URL}/api/backup/download`,

  restoreBackup: async (file: File): Promise<{ restored: number; files: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/api/backup/restore`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(detail.detail || res.statusText);
    }
    return res.json();
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
    return fetchJSON<BurnoutRadarEntry[]>(`/api/burnout-radar?${qs.toString()}`);
  },

// ─── Changelog / Aktivitätsprotokoll ──────────────────────
  getChangelog: (params: {
    limit?: number;
    user?: string;
    date_from?: string;
    date_to?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.user) qs.set('user', params.user);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    const q = qs.toString();
    return fetchJSON<ChangelogEntry[]>(`/api/changelog${q ? '?' + q : ''}`);
  },

  logAction: (data: { user: string; action: string; entity: string; entity_id: number; details?: string }) =>
    postJSON<ChangelogEntry>('/api/changelog', data),

  // ─── Überstunden Summary ───────────────────────────────────
  getOvertimeSummary: (year: number, groupId?: number) => {
    const qs = new URLSearchParams({ year: String(year) });
    if (groupId != null) qs.set('group_id', String(groupId));
    return fetchJSON<{ year: number; group_id: number | null; employees: OvertimeRow[]; summary: OvertimeSummary }>(
      `/api/overtime-summary?${qs.toString()}`
    );
  },

  // ─── Dashboard: Today ──────────────────────────────────────
  getDashboardToday: () => fetchJSON<DashboardToday>('/api/dashboard/today'),

  // ─── Dashboard: Upcoming ───────────────────────────────────
  getDashboardUpcoming: () => fetchJSON<DashboardUpcoming>('/api/dashboard/upcoming'),

  // ─── Dashboard: Stats ──────────────────────────────────────
  getDashboardStats: (year?: number, month?: number) =>
    fetchJSON<DashboardStats>(`/api/dashboard/stats${year && month ? `?year=${year}&month=${month}` : ''}`),

  // ─── Schedule Coverage (Personalbedarf-Ampel) ──────────────
  getCoverage: (year: number, month: number) =>
    fetchJSON<CoverageDay[]>(`/api/schedule/coverage?year=${year}&month=${month}`),

  // ─── Global Search (Spotlight) ─────────────────────────────
  search: (query: string) =>
    fetchJSON<{ results: SearchResult[]; query: string }>(`/api/search?q=${encodeURIComponent(query)}`),

  // ─── Monthly Closing Report (Monatsabschluss) ──────────────
  getMonthlyReportUrl: (year: number, month: number, format: 'csv' | 'pdf', groupId?: number): string => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), format });
    if (groupId != null) qs.set('group_id', String(groupId));
    return `${BASE_URL}/api/reports/monthly?${qs.toString()}`;
  },

  downloadMonthlyReport: async (year: number, month: number, format: 'csv' | 'pdf', groupId?: number): Promise<void> => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), format });
    if (groupId != null) qs.set('group_id', String(groupId));
    const url = `${BASE_URL}/api/reports/monthly?${qs.toString()}`;
    const res = await fetch(url);
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
    fetchJSON<SicknessStatistics>(`/api/statistics/sickness?year=${year}`),

  getYearSummary: (year: number, groupId?: number | null) =>
    fetchJSON<unknown>(`/api/statistics/year-summary?year=${year}${groupId ? `&group_id=${groupId}` : ''}`),

  // ─── Schedule Templates (Schicht-Vorlagen) ─────────────────
  getScheduleTemplates: () =>
    fetchJSON<ScheduleTemplate[]>('/api/schedule/templates'),

  createScheduleTemplate: (body: TemplateCreate) =>
    postJSON<ScheduleTemplate>('/api/schedule/templates', body),

  captureScheduleTemplate: (body: TemplateCaptureRequest) =>
    postJSON<ScheduleTemplate>('/api/schedule/templates/capture', body),

  deleteScheduleTemplate: (templateId: number) =>
    deleteReq<{ deleted: boolean; id: number }>(`/api/schedule/templates/${templateId}`),

  applyScheduleTemplate: (templateId: number, body: TemplateApplyRequest) =>
    postJSON<TemplateApplyResult>(`/api/schedule/templates/${templateId}/apply`, body),

  // ─── Week Copy (Woche kopieren) ────────────────────────────
  copyWeek: (body: {
    source_employee_id: number;
    dates: string[];
    target_employee_ids: number[];
    skip_existing: boolean;
  }) =>
    postJSON<{ ok: boolean; created: number; skipped: number; errors: string[]; message: string }>(
      '/api/schedule/copy-week',
      body,
    ),

  swapShifts: (body: {
    employee_id_1: number;
    employee_id_2: number;
    dates: string[];
  }) =>
    postJSON<{ ok: boolean; swapped_days: number; errors: string[]; message: string }>(
      '/api/schedule/swap',
      body,
    ),

  // ─── Schicht-Wünsche & Sperrtage ─────────────────────────
  getWishes: (params: { employee_id?: number; year?: number; month?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.employee_id != null) q.set('employee_id', String(params.employee_id));
    if (params.year != null) q.set('year', String(params.year));
    if (params.month != null) q.set('month', String(params.month));
    return fetchJSON<Wish[]>(`/api/wishes?${q}`);
  },

  createWish: (body: {
    employee_id: number;
    date: string;
    wish_type: 'WUNSCH' | 'SPERRUNG';
    shift_id?: number | null;
    note?: string;
  }) => postJSON<Wish>('/api/wishes', body),

  deleteWish: (wishId: number) =>
    deleteReq<{ deleted: number }>(`/api/wishes/${wishId}`),

  // ─── Schicht-Tauschbörse ─────────────────────────────────
  getSwapRequests: (params: { status?: string; employee_id?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.employee_id != null) q.set('employee_id', String(params.employee_id));
    return fetchJSON<SwapRequest[]>(`/api/swap-requests?${q}`);
  },

  createSwapRequest: (body: {
    requester_id: number;
    requester_date: string;
    partner_id: number;
    partner_date: string;
    note?: string;
  }) => postJSON<SwapRequest>('/api/swap-requests', body),

  resolveSwapRequest: (swapId: number, body: {
    action: 'approve' | 'reject';
    resolved_by?: string;
    reject_reason?: string;
  }) => patchJSON<SwapRequest>(`/api/swap-requests/${swapId}/resolve`, body),

  deleteSwapRequest: (swapId: number) =>
    deleteReq<{ ok: boolean }>(`/api/swap-requests/${swapId}`),
};
