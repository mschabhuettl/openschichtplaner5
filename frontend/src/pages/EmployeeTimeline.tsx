/**
 * EmployeeTimeline.tsx — Q078
 * Horizontal timeline view for a single employee showing shifts and absences.
 * Route: /employees/:id/timeline
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Employee } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';

// ─── Types ─────────────────────────────────────────────────────

interface ShiftEntry {
  id: number;
  employee_id: number;
  date: string;
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
  startend?: string;
}

interface AbsenceEntry {
  id: number;
  employee_id: number;
  date: string;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_short: string;
}

type Period = '1w' | '2w' | '1m' | '3m';

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  label: string;
  sub: string;
  group: string;
  time: string;
  color: string;
}

// ─── Helpers ───────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateDE(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatWeekday(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleDateString('de-AT', { weekday: 'short' });
}

function isWeekend(iso: string): boolean {
  const d = parseDate(iso).getDay();
  return d === 0 || d === 6;
}

function isToday(iso: string): boolean {
  return iso === toISODate(new Date());
}

function periodToDays(period: Period): number {
  switch (period) {
    case '1w': return 7;
    case '2w': return 14;
    case '1m': return 30;
    case '3m': return 90;
  }
}

function getAbsenceColor(leaveTypeName: string): string {
  const lower = leaveTypeName.toLowerCase();
  if (lower.includes('urlaub') || lower.includes('vacation') || lower.includes('ferien')) return '#3b82f6'; // blue
  if (lower.includes('krank') || lower.includes('sick')) return '#f97316'; // orange
  return '#9ca3af'; // gray for other
}

function luminance(hex: string): number {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function textOnBg(hex: string): string {
  return luminance(hex) > 0.5 ? '#1f2937' : '#ffffff';
}

// Generate all dates in [from, to] inclusive
function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cur = parseDate(from);
  const end = parseDate(to);
  while (cur <= end) {
    dates.push(toISODate(cur));
    cur = addDays(cur, 1);
  }
  return dates;
}

// ─── Employee Selector ─────────────────────────────────────────

interface EmployeeSelectorProps {
  employees: Employee[];
  selectedId: number | null;
  onChange: (id: number) => void;
}

function EmployeeSelector({ employees, selectedId, onChange }: EmployeeSelectorProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = employees.find(e => e.ID === selectedId);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return employees.slice(0, 20);
    return employees.filter(e =>
      e.NAME.toLowerCase().includes(q) ||
      e.FIRSTNAME?.toLowerCase().includes(q) ||
      e.SHORTNAME?.toLowerCase().includes(q) ||
      e.NUMBER?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [employees, query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[180px]"
      >
        <span className="text-lg">👤</span>
        <span className="flex-1 text-left truncate">
          {selected ? `${selected.FIRSTNAME ?? ''} ${selected.NAME}`.trim() : 'Mitarbeiter wählen…'}
        </span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              type="text"
              placeholder="Suchen…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-gray-400">Keine Ergebnisse</div>
            ) : (
              filtered.map(emp => (
                <button
                  key={emp.ID}
                  type="button"
                  onClick={() => { onChange(emp.ID); setOpen(false); setQuery(''); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-left ${emp.ID === selectedId ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-200'}`}
                >
                  <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300 shrink-0">
                    {(emp.SHORTNAME || emp.NAME.slice(0, 2)).toUpperCase().slice(0, 2)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{emp.FIRSTNAME} {emp.NAME}</div>
                    <div className="text-xs text-gray-400 truncate">{emp.SHORTNAME} · #{emp.NUMBER}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeline Row (one day) ────────────────────────────────────

interface DayRowProps {
  date: string;
  dateLabel: string;
  shifts: ShiftEntry[];
  absences: AbsenceEntry[];
  onTooltip: (state: TooltipState | ((prev: TooltipState) => TooltipState)) => void;
}

function DayRow({ date, dateLabel, shifts, absences, onTooltip }: DayRowProps) {
  const today = isToday(date);
  const weekend = isWeekend(date);

  return (
    <div
      className={`flex items-center border-b border-gray-100 dark:border-gray-700/50 min-h-[36px] transition-colors
        ${today ? 'bg-amber-50/60 dark:bg-amber-900/10' : weekend ? 'bg-gray-50/70 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-800'}
        hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10`}
    >
      {/* Date column */}
      <div
        className={`w-24 shrink-0 px-3 flex items-center gap-1.5 border-r border-gray-100 dark:border-gray-700 h-full py-1
          ${today ? 'font-bold text-amber-700 dark:text-amber-400' : weekend ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}
      >
        <span className="text-xs w-7 shrink-0">{formatWeekday(date)}</span>
        <span className="text-xs">{dateLabel}</span>
        {today && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
      </div>

      {/* Timeline content */}
      <div className="flex-1 px-2 py-1 flex flex-wrap gap-1 items-center">
        {/* Absence blocks (shown as background overlays) */}
        {absences.map((ab, i) => {
          const color = getAbsenceColor(ab.leave_type_name);
          const txtColor = textOnBg(color);
          return (
            <div
              key={`ab-${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: color, color: txtColor, opacity: 0.85 }}
              onMouseEnter={e => onTooltip({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                date: formatDateDE(date),
                label: ab.leave_type_name,
                sub: ab.leave_type_short,
                group: '',
                time: '',
                color,
              })}
              onMouseLeave={() => onTooltip({ visible: false, x: 0, y: 0, date: '', label: '', sub: '', group: '', time: '', color: '' })}
              onMouseMove={e => onTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
            >
              <span>🏖️</span>
              <span>{ab.leave_type_short}</span>
            </div>
          );
        })}

        {/* Shift blocks */}
        {shifts.filter(s => s.kind === 'shift' || s.kind === 'special_shift' || (s.shift_id != null && !s.kind)).map((sh, i) => {
          const color = sh.color_bk || '#6366f1';
          const txtColor = sh.color_text || textOnBg(color);
          return (
            <div
              key={`sh-${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold cursor-pointer hover:opacity-80 hover:shadow-sm transition-all"
              style={{ backgroundColor: color, color: txtColor }}
              onMouseEnter={e => onTooltip({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                date: formatDateDE(date),
                label: sh.shift_name || sh.display_name,
                sub: sh.shift_short,
                group: sh.workplace_name || '',
                time: sh.startend || '',
                color,
              })}
              onMouseLeave={() => onTooltip({ visible: false, x: 0, y: 0, date: '', label: '', sub: '', group: '', time: '', color: '' })}
              onMouseMove={e => onTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
            >
              {sh.shift_short && <span>{sh.shift_short}</span>}
              {sh.startend && <span className="opacity-80">{sh.startend}</span>}
            </div>
          );
        })}

        {shifts.length === 0 && absences.length === 0 && (
          <span className="text-xs text-gray-300 dark:text-gray-600 italic">–</span>
        )}
      </div>

      {/* Total day indicator */}
      <div className="w-6 shrink-0 flex items-center justify-center border-l border-gray-100 dark:border-gray-700 h-full py-1">
        {(shifts.length > 0 || absences.length > 0) && (
          <span className={`w-2 h-2 rounded-full ${absences.length > 0 ? 'bg-blue-400' : 'bg-green-400'}`} />
        )}
      </div>
    </div>
  );
}

// ─── Timeline Compact View (horizontal, for longer periods) ───

interface HorizontalTimelineProps {
  dates: string[];
  shiftsByDate: Record<string, ShiftEntry[]>;
  absencesByDate: Record<string, AbsenceEntry[]>;
  onTooltip: (state: TooltipState | ((prev: TooltipState) => TooltipState)) => void;
}

function HorizontalTimeline({ dates, shiftsByDate, absencesByDate, onTooltip }: HorizontalTimelineProps) {
  const totalDays = dates.length;

  // Build month groups
  const monthGroups = useMemo(() => {
    const groups: { label: string; dates: string[] }[] = [];
    let curGroup: string[] = [];
    let curMonth = '';
    for (const date of dates) {
      const m = date.slice(0, 7);
      if (m !== curMonth) {
        if (curGroup.length > 0) {
          const d = parseDate(curGroup[0]);
          groups.push({ label: d.toLocaleDateString('de-AT', { month: 'short', year: '2-digit' }), dates: curGroup });
        }
        curGroup = [date];
        curMonth = m;
      } else {
        curGroup.push(date);
      }
    }
    if (curGroup.length > 0) {
      const d = parseDate(curGroup[0]);
      groups.push({ label: d.toLocaleDateString('de-AT', { month: 'short', year: '2-digit' }), dates: curGroup });
    }
    return groups;
  }, [dates]);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${totalDays * 28}px` }}>
        {/* Month header */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
          {monthGroups.map((grp, i) => (
            <div
              key={i}
              className="border-r border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300"
              style={{ width: `${(grp.dates.length / totalDays) * 100}%` }}
            >
              {grp.label}
            </div>
          ))}
        </div>

        {/* Day columns header */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {dates.map(date => {
            const today = isToday(date);
            const weekend = isWeekend(date);
            const day = date.slice(8);
            return (
              <div
                key={date}
                className={`shrink-0 flex flex-col items-center justify-center py-1 border-r border-gray-100 dark:border-gray-700/50 text-xs
                  ${today ? 'bg-amber-100 dark:bg-amber-900/30 font-bold text-amber-700 dark:text-amber-400' : weekend ? 'bg-gray-50 dark:bg-gray-800/40 text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}
                style={{ width: `${100 / totalDays}%` }}
              >
                <span>{formatWeekday(date).slice(0, 1)}</span>
                <span>{day}</span>
              </div>
            );
          })}
        </div>

        {/* Content row */}
        <div className="flex min-h-[48px] relative">
          {/* Today vertical line */}
          {dates.map((date, idx) => isToday(date) ? (
            <div
              key={`today-${date}`}
              className="absolute top-0 bottom-0 border-l-2 border-amber-400 z-10 pointer-events-none"
              style={{ left: `${(idx / totalDays) * 100}%` }}
            />
          ) : null)}

          {dates.map(date => {
            const shifts = shiftsByDate[date] ?? [];
            const absences = absencesByDate[date] ?? [];
            const today = isToday(date);
            const weekend = isWeekend(date);
            const hasShift = shifts.length > 0;
            const hasAbsence = absences.length > 0;

            // Pick color for cell
            let cellColor = '';
            let cellLabel = '';
            let tooltip: TooltipState | null = null;

            if (hasAbsence) {
              const ab = absences[0];
              cellColor = getAbsenceColor(ab.leave_type_name);
              cellLabel = ab.leave_type_short;
              tooltip = {
                visible: true, x: 0, y: 0,
                date: formatDateDE(date),
                label: ab.leave_type_name,
                sub: ab.leave_type_short,
                group: '', time: '', color: cellColor,
              };
            } else if (hasShift) {
              const sh = shifts[0];
              cellColor = sh.color_bk || '#6366f1';
              cellLabel = sh.shift_short || sh.display_name;
              tooltip = {
                visible: true, x: 0, y: 0,
                date: formatDateDE(date),
                label: sh.shift_name || sh.display_name,
                sub: sh.shift_short,
                group: sh.workplace_name || '',
                time: sh.startend || '',
                color: cellColor,
              };
            }

            return (
              <div
                key={date}
                className={`shrink-0 flex items-center justify-center border-r border-gray-100 dark:border-gray-700/50 py-1 cursor-default
                  ${today ? 'ring-inset ring-1 ring-amber-400' : ''}
                  ${weekend && !hasShift && !hasAbsence ? 'opacity-60' : ''}`}
                style={{
                  width: `${100 / totalDays}%`,
                  backgroundColor: cellColor ? cellColor + '33' : weekend ? '' : '',
                }}
                onMouseEnter={e => tooltip && onTooltip({ ...tooltip, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => onTooltip({ visible: false, x: 0, y: 0, date: '', label: '', sub: '', group: '', time: '', color: '' })}
                onMouseMove={e => onTooltip(prev => prev.visible ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
              >
                {cellColor && (
                  <div
                    className="w-full mx-0.5 rounded flex items-center justify-center text-xs font-semibold truncate px-0.5"
                    style={{ backgroundColor: cellColor, color: textOnBg(cellColor), height: '28px' }}
                    title={cellLabel}
                  >
                    {cellLabel}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function EmployeeTimeline() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(id ? parseInt(id) : null);
  const [period, setPeriod] = useState<Period>('1m');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  });

  const [scheduleData, setScheduleData] = useState<ShiftEntry[]>([]);
  const [absenceData, setAbsenceData] = useState<AbsenceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, date: '', label: '', sub: '', group: '', time: '', color: '',
  });

  // Calculate end date from period
  const endDate = useMemo(() => {
    const days = periodToDays(period);
    return toISODate(addDays(parseDate(startDate), days - 1));
  }, [startDate, period]);

  const dates = useMemo(() => dateRange(startDate, endDate), [startDate, endDate]);
  const totalDays = dates.length;

  // Load employees on mount
  useEffect(() => {
    api.getEmployees().then(emps => {
      setEmployees(emps.filter(e => !e.HIDE));
    }).catch(() => {});
  }, []);

  // Load schedule + absences when employee or date range changes
  const loadData = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      // Load schedule entries: use year/month approach for each month in range
      const months = new Set<string>();
      for (const date of dates) months.add(date.slice(0, 7));

      const scheduleEntries: ShiftEntry[] = [];
      await Promise.all(Array.from(months).map(async ym => {
        const [y, m] = ym.split('-').map(Number);
        try {
          const data = await api.getSchedule(y, m);
          const empEntries = (data as unknown as Array<Record<string, unknown>>)
            .filter((e) => e.employee_id === selectedId)
            .map((e) => ({
              id: (e.id as number) ?? 0,
              employee_id: e.employee_id as number,
              date: (e.date as string) ?? `${ym}-01`,
              shift_id: (e.shift_id as number | null) ?? null,
              shift_name: (e.shift_name as string) ?? '',
              shift_short: (e.shift_short as string) ?? '',
              color_bk: (e.color_bk as string) ?? '#6366f1',
              color_text: (e.color_text as string) ?? '#ffffff',
              workplace_id: (e.workplace_id as number | null) ?? null,
              workplace_name: (e.workplace_name as string) ?? '',
              kind: (e.kind as ShiftEntry['kind']) ?? 'shift',
              leave_name: (e.leave_name as string) ?? '',
              display_name: (e.display_name as string) ?? (e.shift_name as string) ?? '',
              startend: (e.startend as string) ?? '',
            }));
          scheduleEntries.push(...empEntries);
        } catch {
          // Month may not exist — ignore
        }
      }));

      // Load absences
      const absences = await api.getAbsences({ employee_id: selectedId });
      const filteredAbsences = absences.filter((a) => {
        return a.date >= startDate && a.date <= endDate;
      });

      // Filter schedule to date range
      const filteredSchedule = scheduleEntries.filter(e => e.date >= startDate && e.date <= endDate);

      setScheduleData(filteredSchedule);
      setAbsenceData(filteredAbsences);
    } catch (e) {
      setError('Fehler beim Laden der Daten');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedId, startDate, endDate, dates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync URL with selected employee
  useEffect(() => {
    if (selectedId && id !== String(selectedId)) {
      navigate(`/employees/${selectedId}/timeline`, { replace: true });
    }
  }, [selectedId, navigate, id]);

  // Build lookup maps
  const shiftsByDate = useMemo(() => {
    const map: Record<string, ShiftEntry[]> = {};
    for (const s of scheduleData) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [scheduleData]);

  const absencesByDate = useMemo(() => {
    const map: Record<string, AbsenceEntry[]> = {};
    for (const a of absenceData) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [absenceData]);

  // Stats
  const stats = useMemo(() => {
    const shiftDays = new Set(scheduleData.map(s => s.date)).size;
    const absenceDays = new Set(absenceData.map(a => a.date)).size;
    const workingDays = dates.filter(d => !isWeekend(d)).length;
    const coveredDays = new Set([...scheduleData.map(s => s.date), ...absenceData.map(a => a.date)]).size;
    return { shiftDays, absenceDays, workingDays, coveredDays };
  }, [scheduleData, absenceData, dates]);

  const selectedEmployee = employees.find(e => e.ID === selectedId);

  // Period navigation
  function goBack() {
    const days = periodToDays(period);
    setStartDate(toISODate(addDays(parseDate(startDate), -days)));
  }

  function goForward() {
    const days = periodToDays(period);
    setStartDate(toISODate(addDays(parseDate(startDate), days)));
  }

  function goToday() {
    const days = periodToDays(period);
    const offset = Math.floor(days / 2);
    setStartDate(toISODate(addDays(new Date(), -offset)));
  }

  // Choose view mode: list view for <= 2 weeks, horizontal for larger periods
  const useHorizontalView = totalDays > 14;

  const handleTooltip = useCallback((state: TooltipState | ((prev: TooltipState) => TooltipState)) => {
    if (typeof state === 'function') {
      setTooltip(prev => (state as (prev: TooltipState) => TooltipState)(prev));
    } else {
      setTooltip(state);
    }
  }, []);

  return (
    <div className="p-4 space-y-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            📅 Mitarbeiter-Timeline
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Schichten und Abwesenheiten im Überblick
          </p>
        </div>

        {/* Employee selector */}
        <div className="ml-auto">
          <EmployeeSelector
            employees={employees}
            selectedId={selectedId}
            onChange={id => setSelectedId(id)}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 rounded-xl shadow p-3">
        {/* Period selector */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
          {(['1w', '2w', '1m', '3m'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${period === p ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {p === '1w' ? '1 Woche' : p === '2w' ? '2 Wochen' : p === '1m' ? '1 Monat' : '3 Monate'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goBack}
            className="px-2 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
          >◀</button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >Heute</button>
          <button
            onClick={goForward}
            className="px-2 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
          >▶</button>
        </div>

        {/* Date range display */}
        <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          {formatDateDE(startDate)} – {formatDateDE(endDate)}
        </div>

        {/* Custom start date */}
        <input
          type="date"
          value={startDate}
          onChange={e => e.target.value && setStartDate(e.target.value)}
          className="px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 ml-auto"
          aria-label="Startdatum"
        />
      </div>

      {/* Stats cards */}
      {selectedEmployee && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.shiftDays}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Schichttage</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">{stats.absenceDays}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Abwesenheitstage</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.workingDays}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Arbeitstage (Mo–Fr)</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.workingDays > 0 ? Math.round((stats.coveredDays / stats.workingDays) * 100) : 0}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Abdeckung</div>
          </div>
        </div>
      )}

      {/* Main timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {!selectedId && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
            <div className="text-4xl mb-3">👤</div>
            <p className="text-sm">Bitte einen Mitarbeiter auswählen</p>
          </div>
        )}

        {selectedId && selectedEmployee && (
          <div className="border-b border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-300">
              {(selectedEmployee.SHORTNAME || selectedEmployee.NAME.slice(0, 2)).toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {selectedEmployee.FIRSTNAME} {selectedEmployee.NAME}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {selectedEmployee.SHORTNAME} · #{selectedEmployee.NUMBER} · {totalDays} Tage angezeigt
              </div>
            </div>
            <button
              onClick={() => navigate(`/mitarbeiter/${selectedId}`)}
              className="ml-auto text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Profil →
            </button>
          </div>
        )}

        {loading && (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {selectedId && !loading && !error && (
          <>
            {useHorizontalView ? (
              <HorizontalTimeline
                dates={dates}
                shiftsByDate={shiftsByDate}
                absencesByDate={absencesByDate}
                onTooltip={handleTooltip}
              />
            ) : (
              <div>
                {/* Column header */}
                <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  <div className="w-24 shrink-0 px-3 py-2 border-r border-gray-200 dark:border-gray-700">Datum</div>
                  <div className="flex-1 px-3 py-2">Dienste / Abwesenheiten</div>
                  <div className="w-6 shrink-0 border-l border-gray-200 dark:border-gray-700" />
                </div>

                {/* Day rows */}
                {dates.map(date => (
                  <DayRow
                    key={date}
                    date={date}
                    dateLabel={date.slice(8) + '.' + date.slice(5, 7) + '.'}
                    shifts={shiftsByDate[date] ?? []}
                    absences={absencesByDate[date] ?? []}
                    onTooltip={handleTooltip}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      {selectedId && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-400" />
            Heute
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
            Urlaub
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }} />
            Krankenstand
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#9ca3af' }} />
            Sonstige Abwesenheit
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-indigo-500" />
            Schicht
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip.visible && tooltip.label && (
        <div
          className="fixed z-50 pointer-events-none bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 text-sm max-w-[220px]"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <div className="flex items-center gap-2 mb-1">
            {tooltip.color && (
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tooltip.color }} />
            )}
            <div className="font-semibold text-gray-900 dark:text-white truncate">{tooltip.label}</div>
          </div>
          {tooltip.sub && tooltip.sub !== tooltip.label && (
            <div className="text-indigo-600 dark:text-indigo-400 text-xs font-medium">{tooltip.sub}</div>
          )}
          {tooltip.date && (
            <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">{tooltip.date}</div>
          )}
          {tooltip.time && (
            <div className="text-gray-600 dark:text-gray-300 text-xs">🕐 {tooltip.time}</div>
          )}
          {tooltip.group && (
            <div className="text-gray-500 dark:text-gray-400 text-xs">📍 {tooltip.group}</div>
          )}
        </div>
      )}
    </div>
  );
}
