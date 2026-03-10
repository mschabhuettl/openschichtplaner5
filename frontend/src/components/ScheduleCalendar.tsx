import { useMemo, memo } from 'react';
import type { Employee, ScheduleEntry, ShiftType } from '../types';

// ── Types ─────────────────────────────────────────────────────

interface ScheduleCalendarProps {
  year: number;
  month: number;
  employees: Employee[];
  entryMap: Map<string, ScheduleEntry>;
  holidays: Set<string>;
  shifts: ShiftType[];
  onDayClick?: (day: number, dateStr: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────

const WEEKDAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Get the day-of-week for the 1st of the month, Mon=0 .. Sun=6 */
function getFirstDayOffset(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0
}

const pad = (n: number) => String(n).padStart(2, '0');

// ── Shift Chip ────────────────────────────────────────────────

const ShiftChip = memo(function ShiftChip({
  label,
  bgColor,
  textColor,
  count,
}: {
  label: string;
  bgColor: string;
  textColor: string;
  count: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-bold leading-tight whitespace-nowrap flex-shrink-0"
      style={{ backgroundColor: bgColor, color: textColor }}
      title={`${label}: ${count} MA`}
    >
      {label}
      {count > 1 && (
        <span className="text-[8px] opacity-80">×{count}</span>
      )}
    </span>
  );
});

// ── Calendar Day Cell ─────────────────────────────────────────

interface DayCellProps {
  day: number;
  dateStr: string;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  shiftGroups: Array<{ label: string; bgColor: string; textColor: string; count: number }>;
  totalAssigned: number;
  totalEmployees: number;
  onDayClick?: (day: number, dateStr: string) => void;
}

const DayCell = memo(function DayCell({
  day, dateStr, isToday, isWeekend, isHoliday,
  shiftGroups, totalAssigned, totalEmployees, onDayClick,
}: DayCellProps) {
  const bgClass = isHoliday
    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
    : isToday
    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700'
    : isWeekend
    ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

  const dayNumberClass = isHoliday
    ? 'text-red-600 dark:text-red-400'
    : isToday
    ? 'text-blue-600 dark:text-blue-400 font-bold'
    : isWeekend
    ? 'text-slate-500 dark:text-slate-400'
    : 'text-gray-700 dark:text-gray-300';

  return (
    <div
      className={`border rounded-lg p-1.5 min-h-[80px] flex flex-col cursor-pointer hover:shadow-md transition-shadow ${bgClass}`}
      onClick={() => onDayClick?.(day, dateStr)}
      title={`${dateStr} — ${totalAssigned}/${totalEmployees} MA eingeteilt · Klick für Tagesübersicht`}
    >
      {/* Day number header */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-semibold ${dayNumberClass}`}>
          {day}
          {isHoliday && <span className="ml-0.5 text-[9px]">★</span>}
        </span>
        {totalAssigned > 0 && (
          <span className="text-[9px] text-gray-400 dark:text-gray-500">
            {totalAssigned}/{totalEmployees}
          </span>
        )}
      </div>

      {/* Shift chips */}
      <div className="flex flex-wrap gap-0.5 flex-1">
        {shiftGroups.slice(0, 6).map((sg, i) => (
          <ShiftChip key={i} label={sg.label} bgColor={sg.bgColor} textColor={sg.textColor} count={sg.count} />
        ))}
        {shiftGroups.length > 6 && (
          <span className="text-[8px] text-gray-400 self-end">
            +{shiftGroups.length - 6}
          </span>
        )}
      </div>
    </div>
  );
});

// ── Empty Day Cell (outside current month) ────────────────────

function EmptyDayCell() {
  return <div className="min-h-[80px]" />;
}

// ── Main Calendar Component ───────────────────────────────────

const ScheduleCalendar = memo(function ScheduleCalendar({
  year,
  month,
  employees,
  entryMap,
  holidays,
  shifts: _shifts,
  onDayClick,
}: ScheduleCalendarProps) {
  void _shifts; // available for future shift-type legend
  const now = new Date();
  const todayDay = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : -1;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOffset(year, month);
  const totalEmployees = employees.length;

  // Precompute per-day data
  const dayData = useMemo(() => {
    const result: Array<{
      day: number;
      dateStr: string;
      isWeekend: boolean;
      isHoliday: boolean;
      shiftGroups: Array<{ label: string; bgColor: string; textColor: string; count: number }>;
      totalAssigned: number;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      const jsWd = new Date(year, month - 1, d).getDay();
      const isWeekend = jsWd === 0 || jsWd === 6;
      const isHoliday = holidays.has(dateStr);

      // Gather all entries for this day, grouped by display_name
      const groupMap = new Map<string, { label: string; bgColor: string; textColor: string; count: number }>();
      let totalAssigned = 0;

      for (const emp of employees) {
        const entry = entryMap.get(`${emp.ID}-${d}`);
        if (!entry) continue;
        totalAssigned++;
        const key = entry.display_name || '?';
        const existing = groupMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          groupMap.set(key, {
            label: entry.display_name || '?',
            bgColor: entry.color_bk || '#e5e7eb',
            textColor: entry.color_text || '#111',
            count: 1,
          });
        }
      }

      // Sort shift groups by count descending
      const shiftGroups = Array.from(groupMap.values())
        .sort((a, b) => b.count - a.count);

      result.push({ day: d, dateStr, isWeekend, isHoliday, shiftGroups, totalAssigned });
    }

    return result;
  }, [year, month, daysInMonth, employees, entryMap, holidays]);

  // Build grid cells: leading empties + day cells + trailing empties
  const totalCells = firstDayOffset + daysInMonth;
  const trailingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-3">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_HEADERS.map((wd, i) => (
          <div
            key={wd}
            className={`text-center text-xs font-semibold py-1 rounded ${
              i >= 5
                ? 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells */}
        {Array.from({ length: firstDayOffset }, (_, i) => (
          <EmptyDayCell key={`pre-${i}`} />
        ))}

        {/* Day cells */}
        {dayData.map(dd => (
          <DayCell
            key={dd.day}
            day={dd.day}
            dateStr={dd.dateStr}
            isToday={dd.day === todayDay}
            isWeekend={dd.isWeekend}
            isHoliday={dd.isHoliday}
            shiftGroups={dd.shiftGroups}
            totalAssigned={dd.totalAssigned}
            totalEmployees={totalEmployees}
            onDayClick={onDayClick}
          />
        ))}

        {/* Trailing empty cells */}
        {Array.from({ length: trailingCells }, (_, i) => (
          <EmptyDayCell key={`post-${i}`} />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-gray-100 dark:border-gray-700 pt-2">
        <span className="text-[10px] text-gray-400">
          Klicke auf einen Tag für die Tagesübersicht
        </span>
        <span className="text-[10px] text-gray-400 ml-auto">
          {MONTH_NAMES[month]} {year} · {employees.length} Mitarbeiter
        </span>
      </div>
    </div>
  );
});

export default ScheduleCalendar;
