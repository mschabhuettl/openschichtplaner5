/**
 * Teamkalender — Monatskalender-Ansicht (Google-Calendar-Style)
 * Zeigt alle Schichten aller Mitarbeiter in einem monatlichen Kalender-Grid.
 * Jeder Tag zeigt farbige Badges für jeden eingeteilten Mitarbeiter.
 */
import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import type { Employee, Group, ScheduleEntry, Holiday } from '../types';

const WEEKDAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function pad(n: number) { return String(n).padStart(2, '0'); }

/** Returns day-of-week where 0=Mon … 6=Sun */
function jsWdToMon(jsWd: number) { return (jsWd + 6) % 7; }

interface DayCell {
  date: string; // YYYY-MM-DD
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

interface EntryWithEmp extends ScheduleEntry {
  emp?: Employee;
}

export default function Teamkalender() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [maxBadgesPerDay, setMaxBadgesPerDay] = useState(8);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);

  // Day popup
  const [popup, setPopup] = useState<{ date: string; x: number; y: number } | null>(null);

  useEffect(() => {
    api.getEmployees().then(setEmployees).catch(() => {});
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getSchedule(year, month, groupId),
      api.getHolidays(year),
    ]).then(([sched, hols]) => {
      setEntries(sched);
      setHolidays(hols);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [year, month, groupId]);

  // Filtered employees by group
  const filteredEmployees = useMemo(() => {
    if (!groupId) return employees.filter(e => !e.HIDE);
    // We need group membership – for simplicity, show all and filter by entry
    return employees.filter(e => !e.HIDE);
  }, [employees, groupId]);

  const empMap = useMemo(() => {
    const m = new Map<number, Employee>();
    filteredEmployees.forEach(e => m.set(e.ID, e));
    return m;
  }, [filteredEmployees]);

  const holidaySet = useMemo(() => {
    const s = new Map<string, string>();
    holidays.forEach(h => s.set(h.DATE, h.NAME));
    return s;
  }, [holidays]);

  // Build calendar grid: weeks of the month, padded with prev/next month days
  const calendarDays = useMemo<DayCell[][]>(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startWd = jsWdToMon(firstDay.getDay()); // 0=Mon

    const _today = new Date();
    const todayStr = `${_today.getFullYear()}-${pad(_today.getMonth() + 1)}-${pad(_today.getDate())}`;

    const cells: DayCell[] = [];

    // Pad with previous month days
    for (let i = 0; i < startWd; i++) {
      const d = new Date(year, month - 1, -startWd + 1 + i);
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const wd = jsWdToMon(d.getDay());
      cells.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, isToday: false, isWeekend: wd >= 5, isHoliday: false });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${pad(month)}-${pad(day)}`;
      const wd = jsWdToMon(new Date(year, month - 1, day).getDay());
      cells.push({
        date: dateStr,
        day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend: wd >= 5,
        isHoliday: holidaySet.has(dateStr),
        holidayName: holidaySet.get(dateStr),
      });
    }

    // Pad to multiple of 7
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month, cells.length - daysInMonth - startWd + 1);
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const wd = jsWdToMon(d.getDay());
      cells.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, isToday: false, isWeekend: wd >= 5, isHoliday: false });
    }

    // Chunk into weeks
    const weeks: DayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [year, month, holidaySet]);

  // Build date → entries map
  const dateEntryMap = useMemo(() => {
    const m = new Map<string, EntryWithEmp[]>();
    for (const e of entries) {
      const list = m.get(e.date) ?? [];
      list.push({ ...e, emp: empMap.get(e.employee_id) });
      m.set(e.date, list);
    }
    return m;
  }, [entries, empMap]);

  // Popup entries
  const popupEntries = useMemo(() => {
    if (!popup) return [];
    return dateEntryMap.get(popup.date) ?? [];
  }, [popup, dateEntryMap]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm flex-wrap">
        <span className="text-xl">📅</span>
        <h1 className="text-lg font-bold text-gray-800">Team-Kalender</h1>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={prevMonth} className="px-2 py-1 rounded hover:bg-gray-100 text-gray-600">‹</button>
          <span className="font-semibold text-gray-700 min-w-[160px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="px-2 py-1 rounded hover:bg-gray-100 text-gray-600">›</button>
        </div>
        <button onClick={goToday} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm">Heute</button>

        {/* Group filter */}
        <select
          className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm bg-white"
          value={groupId ?? ''}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Alle Gruppen</option>
          {groups.filter(g => !g.HIDE).map(g => (
            <option key={g.ID} value={g.ID}>{g.NAME}</option>
          ))}
        </select>

        {/* Max badges */}
        <label className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
          Max Badges/Tag:
          <input
            type="number" min={3} max={30} value={maxBadgesPerDay}
            onChange={e => setMaxBadgesPerDay(Number(e.target.value))}
            className="w-14 px-1 py-0.5 border border-gray-300 rounded text-xs"
          />
        </label>

        {loading && <span className="text-xs text-gray-600 animate-pulse">Laden…</span>}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_NAMES.map(wd => (
            <div key={wd} className={`text-center text-xs font-semibold py-1 rounded
              ${wd === 'Sa' || wd === 'So' ? 'text-slate-400' : 'text-slate-600'}`}>
              {wd}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="flex flex-col gap-1">
          {calendarDays.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map(cell => {
                const dayEntries = dateEntryMap.get(cell.date) ?? [];
                const shown = dayEntries.slice(0, maxBadgesPerDay);
                const overflow = dayEntries.length - shown.length;

                return (
                  <div
                    key={cell.date}
                    className={`min-h-[90px] rounded-lg border p-1.5 flex flex-col cursor-pointer transition-shadow hover:shadow-md
                      ${!cell.isCurrentMonth ? 'bg-gray-100 border-gray-200 opacity-50' : ''}
                      ${cell.isCurrentMonth && !cell.isWeekend && !cell.isHoliday ? 'bg-white border-gray-200' : ''}
                      ${cell.isWeekend && cell.isCurrentMonth ? 'bg-slate-50 border-slate-200' : ''}
                      ${cell.isHoliday && cell.isCurrentMonth ? 'bg-red-50 border-red-200' : ''}
                      ${cell.isToday ? '!border-blue-400 !bg-blue-50 shadow-sm' : ''}
                    `}
                    onClick={e => {
                      if (dayEntries.length > 0) {
                        setPopup({ date: cell.date, x: e.clientX, y: e.clientY });
                      }
                    }}
                  >
                    {/* Day number */}
                    <div className="flex items-start justify-between mb-1">
                      <span className={`text-xs font-bold leading-none
                        ${cell.isToday ? 'bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center' : ''}
                        ${!cell.isToday && cell.isHoliday ? 'text-red-600' : ''}
                        ${!cell.isToday && !cell.isHoliday && cell.isWeekend ? 'text-slate-400' : ''}
                        ${!cell.isToday && !cell.isHoliday && !cell.isWeekend ? 'text-slate-700' : ''}
                      `}>
                        {cell.day}
                      </span>
                      {cell.isHoliday && (
                        <span className="text-[8px] text-red-500 font-semibold truncate max-w-[60%] leading-none text-right" title={cell.holidayName}>
                          {cell.holidayName}
                        </span>
                      )}
                    </div>

                    {/* Shift badges */}
                    <div className="flex flex-col gap-0.5 flex-1">
                      {shown.map((e, i) => {
                        const name = e.emp
                          ? `${e.emp.FIRSTNAME} ${e.emp.NAME}`
                          : `MA #${e.employee_id}`;
                        const shortName = e.emp?.SHORTNAME || e.display_name;
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] leading-none truncate"
                            style={{
                              background: e.color_bk || '#e2e8f0',
                              color: e.color_text || '#1e293b',
                            }}
                            title={`${name} · ${e.display_name}`}
                          >
                            <span className="font-bold shrink-0">{e.display_name}</span>
                            <span className="truncate opacity-80 ml-0.5">{shortName !== e.display_name ? shortName : name.split(' ')[0]}</span>
                          </div>
                        );
                      })}
                      {overflow > 0 && (
                        <div className="text-[9px] text-gray-600 pl-1">+{overflow} weitere…</div>
                      )}
                    </div>

                    {/* Summary dot */}
                    {dayEntries.length > 0 && (
                      <div className="flex items-center justify-end mt-0.5">
                        <span className="text-[9px] text-gray-600">{dayEntries.length} 👤</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-white border-t border-gray-200 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-400 inline-block" /> Heute</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" /> Feiertag</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-50 border border-slate-200 inline-block" /> Wochenende</span>
        <span className="ml-auto text-gray-600">Auf Tag klicken für Details</span>
      </div>

      {/* Day detail popup */}
      {popup && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setPopup(null)}
        >
          <div
            className="absolute bg-white rounded-xl shadow-xl border border-gray-200 w-80 max-h-96 flex flex-col overflow-hidden"
            style={{
              top: Math.min(popup.y, window.innerHeight - 400),
              left: Math.min(popup.x, window.innerWidth - 340),
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-700 text-white flex items-center justify-between rounded-t-xl">
              <div>
                <div className="font-bold text-sm">{popup.date}</div>
                <div className="text-xs text-slate-300">{popupEntries.length} Einträge</div>
              </div>
              <button aria-label="Schließen" onClick={() => setPopup(null)} className="text-slate-300 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="overflow-y-auto p-3 flex flex-col gap-2">
              {popupEntries.length === 0 && (
                <div className="text-gray-600 text-sm text-center py-4">Keine Einträge</div>
              )}
              {popupEntries.map((e, i) => {
                const name = e.emp
                  ? `${e.emp.FIRSTNAME} ${e.emp.NAME}`
                  : `Mitarbeiter #${e.employee_id}`;
                const kindIcon = e.kind === 'absence' ? '🏖️' : e.kind === 'special_shift' ? '⭐' : '🔧';
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100"
                    style={{ background: e.color_bk ? e.color_bk + '22' : '#f8fafc' }}
                  >
                    <span
                      className="flex-shrink-0 px-2 py-1 rounded font-bold text-xs"
                      style={{ background: e.color_bk || '#e2e8f0', color: e.color_text || '#1e293b' }}
                    >
                      {e.display_name}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700 truncate">{name}</div>
                      {(e.shift_name || e.leave_name) && (
                        <div className="text-[10px] text-gray-600 truncate">{e.shift_name || e.leave_name}</div>
                      )}
                    </div>
                    <span className="text-xs">{kindIcon}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
