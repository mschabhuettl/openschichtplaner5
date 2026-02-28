import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { WeekSchedule, DayEntry } from '../api/client';
import type { Group } from '../types/index';

// ─── Helpers ──────────────────────────────────────────────

const DE_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DE_MONTHS = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function formatDayHeader(dateStr: string, idx: number): { day: string; date: string; isWeekend: boolean } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: DE_DAYS[idx],
    date: `${d.getDate()}. ${DE_MONTHS[d.getMonth()]}`,
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
  };
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart + 'T00:00:00');
  const e = new Date(weekEnd + 'T00:00:00');
  // ISO week number
  const startOfYear = new Date(s.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((s.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `KW ${weekNo} — ${s.getDate()}. ${DE_MONTHS[s.getMonth()]} bis ${e.getDate()}. ${DE_MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

function isToday(dateStr: string): boolean {
  return toISODate(new Date()) === dateStr;
}

function getMondayOfWeek(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return toISODate(mon);
}

// ─── ShiftCell ─────────────────────────────────────────────

interface ShiftCellProps {
  entry: DayEntry | undefined;
  compact?: boolean;
}

function ShiftCell({ entry, compact }: ShiftCellProps) {
  if (!entry || (!entry.display_name && !entry.shift_short && !entry.leave_name)) {
    return (
      <div className={`${compact ? 'h-7' : 'h-9'} flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs`}>
        –
      </div>
    );
  }

  const label = entry.display_name || entry.shift_short || entry.leave_name || '?';
  const bg = entry.color_bk && entry.color_bk !== '#FFFFFF' ? entry.color_bk : null;
  const fg = entry.color_text || '#000000';

  // Determine style
  const isAbsence = entry.kind === 'absence';
  const isLeave = entry.kind === null && entry.leave_name;

  if (bg) {
    return (
      <div
        className={`${compact ? 'h-7 text-xs' : 'h-9 text-sm'} flex items-center justify-center rounded font-semibold px-1 truncate`}
        style={{ backgroundColor: bg, color: fg }}
        title={entry.shift_name || entry.leave_name || label}
      >
        {label}
      </div>
    );
  }

  if (isAbsence || isLeave) {
    return (
      <div
        className={`${compact ? 'h-7 text-xs' : 'h-9 text-sm'} flex items-center justify-center rounded font-medium px-1 truncate bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700`}
        title={entry.leave_name || label}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      className={`${compact ? 'h-7 text-xs' : 'h-9 text-sm'} flex items-center justify-center rounded font-medium px-1 truncate bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300`}
      title={entry.shift_name || label}
    >
      {label}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────

function buildLegend(data: WeekSchedule): Array<{ label: string; short: string; color: string | null; textColor: string }> {
  const seen = new Map<string, { label: string; short: string; color: string | null; textColor: string }>();
  for (const day of data.days) {
    for (const entry of day.entries) {
      const key = entry.display_name;
      if (key && !seen.has(key)) {
        const name = entry.shift_name || entry.leave_name || key;
        seen.set(key, {
          short: key,
          label: name,
          color: entry.color_bk && entry.color_bk !== '#FFFFFF' ? entry.color_bk : null,
          textColor: entry.color_text || '#000000',
        });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.short.localeCompare(b.short));
}

// ─── Stats row (summary per employee) ─────────────────────

function buildStats(data: WeekSchedule): Map<number, { shifts: number; absences: number }> {
  const stats = new Map<number, { shifts: number; absences: number }>();
  for (const day of data.days) {
    for (const entry of day.entries) {
      const prev = stats.get(entry.employee_id) ?? { shifts: 0, absences: 0 };
      if (entry.kind === 'shift' || entry.kind === 'special_shift') {
        prev.shifts++;
      } else if (entry.kind === 'absence' || entry.leave_name) {
        prev.absences++;
      }
      stats.set(entry.employee_id, prev);
    }
  }
  return stats;
}

// ─── Main Component ───────────────────────────────────────

export default function Wochenansicht() {
  const [weekDate, setWeekDate] = useState<string>(getMondayOfWeek(new Date()));
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [data, setData] = useState<WeekSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [highlightEmployee, setHighlightEmployee] = useState<number | null>(null);

  // Load groups once
  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  // Load week data
  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getScheduleWeek(weekDate, groupId ?? undefined);
      setData(result);
    } catch (_e) {
      setError('Fehler beim Laden der Wochendaten.');
    } finally {
      setLoading(false);
    }
  }, [weekDate, groupId]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  const prevWeek = () => setWeekDate(prev => addDays(prev, -7));
  const nextWeek = () => setWeekDate(prev => addDays(prev, 7));
  const gotoToday = () => setWeekDate(getMondayOfWeek(new Date()));

  // Collect unique employees
  const employees = data
    ? Array.from(
        new Map(
          data.days.flatMap(d => d.entries.map(e => [e.employee_id, { id: e.employee_id, name: e.employee_name, short: e.employee_short }]))
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const filtered = filterText
    ? employees.filter(e => e.name.toLowerCase().includes(filterText.toLowerCase()) || e.short.toLowerCase().includes(filterText.toLowerCase()))
    : employees;

  // Build fast lookup: date -> empId -> entry
  const entryMap = new Map<string, Map<number, DayEntry>>();
  if (data) {
    for (const day of data.days) {
      const m = new Map<number, DayEntry>();
      for (const entry of day.entries) {
        m.set(entry.employee_id, entry);
      }
      entryMap.set(day.date, m);
    }
  }

  const legend = data ? buildLegend(data) : [];
  const stats = data ? buildStats(data) : new Map();

  const dayHeaders = data
    ? data.days.map((d, i) => ({ ...formatDayHeader(d.date, i), date: d.date }))
    : [];

  return (
    <div className="p-4 space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">📅 Wochenansicht</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
          {data ? formatWeekLabel(data.week_start, data.week_end) : '…'}
        </span>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Week nav */}
        <button
          onClick={prevWeek}
          className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition"
        >
          ← Zurück
        </button>
        <button
          onClick={gotoToday}
          className="px-3 py-1.5 rounded bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 text-sm font-medium transition"
        >
          Heute
        </button>
        <button
          onClick={nextWeek}
          className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition"
        >
          Vor →
        </button>

        {/* Date picker */}
        <input
          type="date"
          value={weekDate}
          onChange={e => {
            if (e.target.value) setWeekDate(getMondayOfWeek(new Date(e.target.value + 'T00:00:00')));
          }}
          className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm"
        />

        {/* Group filter */}
        <select
          value={groupId ?? ''}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
          className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm"
        >
          <option value="">Alle Gruppen</option>
          {groups.map(g => (
            <option key={g.ID} value={g.ID}>{g.NAME}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Mitarbeiter suchen…"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm w-44"
        />

        {/* Compact toggle */}
        <button
          onClick={() => setCompact(prev => !prev)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${compact ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
        >
          {compact ? '🔍 Normal' : '⚡ Kompakt'}
        </button>

        {loading && <span className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">Laden…</span>}
      </div>

      {error && (
        <div className="rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ── Grid ── */}
      {data && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                {/* Employee column */}
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap border-r border-gray-200 dark:border-gray-700 w-40">
                  Mitarbeiter
                </th>
                {dayHeaders.map(({ day, date, isWeekend, date: d }) => (
                  <th
                    key={d}
                    className={`px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[70px] ${
                      isToday(d)
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : isWeekend
                        ? 'text-gray-400 dark:text-gray-500 bg-gray-100/50 dark:bg-gray-800/50'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-bold">{day}</div>
                    <div className={`text-xs font-normal ${isToday(d) ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`}>{date}</div>
                    {isToday(d) && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mx-auto mt-0.5" />}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-[60px] border-l border-gray-200 dark:border-gray-700">
                  Schichten
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400 dark:text-gray-500">
                    Keine Mitarbeiter gefunden.
                  </td>
                </tr>
              )}
              {filtered.map((emp, idx) => {
                const empStats = stats.get(emp.id) ?? { shifts: 0, absences: 0 };
                const isHighlighted = highlightEmployee === emp.id;
                return (
                  <tr
                    key={emp.id}
                    className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
                      isHighlighted
                        ? 'bg-yellow-50 dark:bg-yellow-900/10'
                        : idx % 2 === 0
                        ? 'bg-white dark:bg-gray-900'
                        : 'bg-gray-50/50 dark:bg-gray-800/30'
                    } hover:bg-blue-50/50 dark:hover:bg-blue-900/10`}
                    onClick={() => setHighlightEmployee(prev => prev === emp.id ? null : emp.id)}
                  >
                    {/* Name */}
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-1 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {emp.short.slice(0, 2)}
                        </span>
                        <div>
                          <div className={`font-medium text-gray-800 dark:text-gray-100 leading-tight ${compact ? 'text-xs' : 'text-sm'}`}>
                            {emp.name.split(',')[0]}
                          </div>
                          {!compact && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">{emp.short}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Day cells */}
                    {data.days.map(day => {
                      const entry = entryMap.get(day.date)?.get(emp.id);
                      const isWe = new Date(day.date + 'T00:00:00').getDay();
                      return (
                        <td
                          key={day.date}
                          className={`px-1 py-1 ${
                            isToday(day.date)
                              ? 'bg-blue-50/40 dark:bg-blue-900/10'
                              : (isWe === 0 || isWe === 6)
                              ? 'bg-gray-50/60 dark:bg-gray-800/40'
                              : ''
                          }`}
                        >
                          <ShiftCell entry={entry} compact={compact} />
                        </td>
                      );
                    })}
                    {/* Stats */}
                    <td className="px-2 py-1 text-center border-l border-gray-200 dark:border-gray-700">
                      <div className="flex flex-col items-center gap-0.5">
                        {empStats.shifts > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium leading-none">
                            {empStats.shifts}S
                          </span>
                        )}
                        {empStats.absences > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium leading-none">
                            {empStats.absences}A
                          </span>
                        )}
                        {empStats.shifts === 0 && empStats.absences === 0 && (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">–</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Summary bar ── */}
      {data && (
        <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">{filtered.length} Mitarbeiter</span>
          {dayHeaders.map(({ day, date: d, date: dateStr }) => {
            const dayMap = entryMap.get(dateStr);
            const withShift = dayMap
              ? Array.from(dayMap.values()).filter(e => e.kind === 'shift' || e.kind === 'special_shift').length
              : 0;
            return withShift > 0 ? (
              <span key={d} className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs">
                {day}: {withShift}✓
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* ── Legend ── */}
      {legend.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Legende</div>
          <div className="flex flex-wrap gap-2">
            {legend.map(item => (
              <div key={item.short} className="flex items-center gap-1.5">
                {item.color ? (
                  <span
                    className="inline-flex items-center justify-center w-6 h-5 rounded text-xs font-bold"
                    style={{ backgroundColor: item.color, color: item.textColor }}
                  >
                    {item.short}
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center w-6 h-5 rounded text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {item.short}
                  </span>
                )}
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
