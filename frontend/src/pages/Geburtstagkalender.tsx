import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import type { Employee } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BirthdayEntry {
  employee: Employee;
  month: number;        // 1–12
  day: number;          // 1–31
  birthYear: number | null;
  daysUntil: number;    // days until next birthday (0 = today)
  age: number | null;   // age they will turn this year (null if no year)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function computeDaysUntil(month: number, day: number, today: Date): number {
  const thisYear = today.getFullYear();
  const next = new Date(thisYear, month - 1, day);
  if (next < today) {
    next.setFullYear(thisYear + 1);
  }
  const diff = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  return diff;
}

function parseBirthday(str: string): { month: number; day: number; year: number | null } | null {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  // SP5 stores dummy year 1899/1900 to indicate "no year"
  const validYear = year >= 1900 && year <= new Date().getFullYear() - 1 ? year : null;
  return { month: d.getMonth() + 1, day: d.getDate(), year: validYear };
}

// ─── Badge: days-until chip ───────────────────────────────────────────────────

function DaysUntilBadge({ days }: { days: number }) {
  if (days === 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900 animate-pulse">
      🎂 Heute!
    </span>
  );
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
      🎉 in {days} Tag{days > 1 ? 'en' : ''}
    </span>
  );
  if (days <= 30) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
      in {days} Tagen
    </span>
  );
  return null;
}

// ─── Avatar initial ───────────────────────────────────────────────────────────

function Avatar({ employee, size = 36 }: { employee: Employee; size?: number }) {
  const initials = `${employee.FIRSTNAME?.[0] ?? ''}${employee.NAME?.[0] ?? ''}`.toUpperCase();
  const bg = employee.CBKSCHED_HEX || employee.CBKLABEL_HEX || '#6366f1';
  const color = employee.CFGLABEL_HEX || '#ffffff';
  return (
    <div
      className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-xs"
      style={{ width: size, height: size, background: bg, color, fontSize: size * 0.33 }}
      title={`${employee.FIRSTNAME} ${employee.NAME}`}
    >
      {initials || '?'}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Geburtstagkalender() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [showHidden, setShowHidden] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const currentMonth = today.getMonth() + 1; // 1-based

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getEmployees(),
    ]).then(([emps]) => {
      setEmployees(emps);
      // Default: expand current month
      setExpandedMonths(new Set([currentMonth]));
    }).finally(() => setLoading(false));
  }, [currentMonth]);

  // ── Build birthday entries ──────────────────────────────────────────────────

  const entries: BirthdayEntry[] = useMemo(() => {
    return employees
      .filter(e => !e.HIDE || showHidden)
      .filter(() => {
        if (!groupId) return true;
        return true;
      })
      .filter(e => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          e.NAME.toLowerCase().includes(q) ||
          (e.FIRSTNAME || '').toLowerCase().includes(q) ||
          (e.SHORTNAME || '').toLowerCase().includes(q)
        );
      })
      .flatMap(emp => {
        if (!emp.BIRTHDAY) return [];
        const parsed = parseBirthday(emp.BIRTHDAY);
        if (!parsed) return [];
        const daysUntil = computeDaysUntil(parsed.month, parsed.day, today);
        const age = parsed.year
          ? today.getFullYear() - parsed.year + (
              (parsed.month < currentMonth ||
               (parsed.month === currentMonth && parsed.day <= today.getDate())) ? 0 : -1
            ) + 1
          : null;
        return [{
          employee: emp,
          month: parsed.month,
          day: parsed.day,
          birthYear: parsed.year,
          daysUntil,
          age,
        }];
      })
      .sort((a, b) => {
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
      });
  }, [employees, showHidden, search, today, currentMonth, groupId]);

  // Upcoming birthdays in next 30 days
  const upcoming = useMemo(
    () => entries.filter(e => e.daysUntil <= 30).sort((a, b) => a.daysUntil - b.daysUntil),
    [entries]
  );

  // Grouped by month
  const byMonth = useMemo(() => {
    const map = new Map<number, BirthdayEntry[]>();
    for (const e of entries) {
      if (!map.has(e.month)) map.set(e.month, []);
      map.get(e.month)!.push(e);
    }
    return map;
  }, [entries]);

  const toggleMonth = (m: number) => {
    setExpandedMonths(prev => {
      const s = new Set(prev);
      s.has(m) ? s.delete(m) : s.add(m);
      return s;
    });
  };

  const expandAll = () => setExpandedMonths(new Set([1,2,3,4,5,6,7,8,9,10,11,12]));
  const collapseAll = () => setExpandedMonths(new Set());

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm gap-2">
        <span className="animate-spin text-xl">🔄</span>
        Lade Mitarbeiterdaten…
      </div>
    );
  }

  const totalWithBirthday = entries.length;
  const totalEmployees = employees.filter(e => !e.HIDE || showHidden).length;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            🎂 Geburtstags-Kalender
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {totalWithBirthday} von {totalEmployees} Mitarbeitern haben einen eingetragenen Geburtstag
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <input
            type="text"
            placeholder="Suche Mitarbeiter…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-2 py-1 text-sm dark:bg-gray-700 dark:border-gray-600 w-44"
          />

          {/* View mode */}
          <div className="flex border rounded overflow-hidden text-sm">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 ${viewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
            >
              📅 Kalender
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
            >
              📋 Liste
            </button>
          </div>

          {/* Hidden toggle */}
          <label className="flex items-center gap-1 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => setShowHidden(e.target.checked)}
              className="rounded"
            />
            Inaktive anzeigen
          </label>
        </div>
      </div>

      {/* ── Upcoming birthdays banner ─────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-yellow-800 dark:text-yellow-300 mb-3 flex items-center gap-2">
            🎉 Bevorstehende Geburtstage (nächste 30 Tage)
          </h2>
          <div className="flex flex-wrap gap-3">
            {upcoming.map(e => (
              <div
                key={e.employee.ID}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm border border-yellow-100 dark:border-yellow-800"
              >
                <Avatar employee={e.employee} size={32} />
                <div>
                  <div className="text-sm font-semibold leading-tight">
                    {e.employee.FIRSTNAME} {e.employee.NAME}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {String(e.day).padStart(2, '0')}.{String(e.month).padStart(2, '0')}.
                    {e.age !== null && ` · wird ${e.age}`}
                  </div>
                </div>
                <DaysUntilBadge days={e.daysUntil} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Calendar view ────────────────────────────────────────────────── */}
      {viewMode === 'calendar' && (
        <>
          <div className="flex gap-2 text-sm">
            <button onClick={expandAll} className="text-indigo-600 dark:text-indigo-400 hover:underline">Alle aufklappen</button>
            <span className="text-gray-400">·</span>
            <button onClick={collapseAll} className="text-indigo-600 dark:text-indigo-400 hover:underline">Alle zuklappen</button>
          </div>

          <div className="space-y-2">
            {MONTH_NAMES.map((name, idx) => {
              const month = idx + 1;
              const monthEntries = byMonth.get(month) ?? [];
              const isCurrentMonth = month === currentMonth;
              const isExpanded = expandedMonths.has(month);
              const hasTodayBirthday = monthEntries.some(e => e.daysUntil === 0);

              return (
                <div
                  key={month}
                  className={`border rounded-xl overflow-hidden
                    ${isCurrentMonth
                      ? 'border-indigo-300 dark:border-indigo-600 shadow-md'
                      : 'border-gray-200 dark:border-gray-700'}
                  `}
                >
                  {/* Month header */}
                  <button
                    className={`w-full flex items-center justify-between px-4 py-3 text-left
                      ${isCurrentMonth
                        ? 'bg-indigo-50 dark:bg-indigo-900/30'
                        : 'bg-gray-50 dark:bg-gray-800'}
                      hover:bg-opacity-80 transition-colors`}
                    onClick={() => toggleMonth(month)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl`}>
                        {month === 1 ? '❄️' : month === 2 ? '💕' : month === 3 ? '🌱' :
                         month === 4 ? '🌸' : month === 5 ? '🌻' : month === 6 ? '☀️' :
                         month === 7 ? '🏖️' : month === 8 ? '🌞' : month === 9 ? '🍂' :
                         month === 10 ? '🎃' : month === 11 ? '🌧️' : '🎄'}
                      </span>
                      <div>
                        <span className={`font-semibold ${isCurrentMonth ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
                          {name}
                        </span>
                        {isCurrentMonth && (
                          <span className="ml-2 text-xs bg-indigo-600 text-white rounded-full px-2 py-0.5">
                            aktueller Monat
                          </span>
                        )}
                        {hasTodayBirthday && (
                          <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 rounded-full px-2 py-0.5 animate-pulse">
                            🎂 Heute!
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm px-2 py-0.5 rounded-full
                        ${monthEntries.length > 0
                          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}
                      `}>
                        {monthEntries.length} {monthEntries.length === 1 ? 'Geburtstag' : 'Geburtstage'}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {/* Month entries */}
                  {isExpanded && (
                    <div className="bg-white dark:bg-gray-900">
                      {monthEntries.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-gray-400 italic">
                          Keine Geburtstage in diesem Monat
                        </p>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {monthEntries.map(e => {
                            const isToday = e.daysUntil === 0;
                            return (
                              <div
                                key={e.employee.ID}
                                className={`flex items-center gap-3 px-4 py-2.5
                                  ${isToday ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}
                                  transition-colors`}
                              >
                                {/* Day badge */}
                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm
                                  ${isToday
                                    ? 'bg-yellow-400 text-yellow-900'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}
                                `}>
                                  {String(e.day).padStart(2, '0')}.
                                </div>

                                {/* Avatar */}
                                <Avatar employee={e.employee} size={36} />

                                {/* Name & info */}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">
                                    {e.employee.FIRSTNAME} {e.employee.NAME}
                                    {e.employee.SHORTNAME && (
                                      <span className="ml-1.5 text-xs text-gray-400">
                                        ({e.employee.SHORTNAME})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                                    <span>
                                      {String(e.day).padStart(2, '0')}.{String(e.month).padStart(2, '0')}.
                                      {e.birthYear !== null && e.birthYear > 1900 ? e.birthYear : ''}
                                    </span>
                                    {e.age !== null && (
                                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                        · {e.age} Jahre
                                      </span>
                                    )}
                                    {e.employee.FUNCTION && (
                                      <span className="text-gray-400">· {e.employee.FUNCTION}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Days until badge */}
                                <DaysUntilBadge days={e.daysUntil} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── List view ──────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Mitarbeiter</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Geburtstag</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Alter</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Nächste Feier</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400 italic">
                    Keine Geburtstage gefunden
                  </td>
                </tr>
              )}
              {entries.map(e => (
                <tr
                  key={e.employee.ID}
                  className={`${e.daysUntil === 0
                    ? 'bg-yellow-50 dark:bg-yellow-900/20'
                    : e.daysUntil <= 7
                    ? 'bg-orange-50/50 dark:bg-orange-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'} transition-colors`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar employee={e.employee} size={28} />
                      <div>
                        <span className="font-medium">{e.employee.FIRSTNAME} {e.employee.NAME}</span>
                        {e.employee.SHORTNAME && (
                          <span className="ml-1 text-xs text-gray-400">({e.employee.SHORTNAME})</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                    {String(e.day).padStart(2, '0')}.{String(e.month).padStart(2, '0')}.
                    {e.birthYear !== null && e.birthYear > 1900 ? e.birthYear : ''}
                    <span className="ml-1.5 text-xs text-gray-400">{MONTH_NAMES[e.month - 1]}</span>
                  </td>
                  <td className="px-4 py-2 text-indigo-600 dark:text-indigo-400 font-medium">
                    {e.age !== null ? `${e.age} Jahre` : '–'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">
                    {e.daysUntil === 0
                      ? <span className="font-bold text-yellow-600">🎂 Heute!</span>
                      : `in ${e.daysUntil} Tag${e.daysUntil !== 1 ? 'en' : ''}`
                    }
                  </td>
                  <td className="px-4 py-2">
                    <DaysUntilBadge days={e.daysUntil} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── No birthdays at all ─────────────────────────────────────────── */}
      {entries.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">🎂</div>
          <p className="font-medium">Keine Geburtstage vorhanden</p>
          <p className="text-sm mt-1">
            {search ? 'Keine Übereinstimmung gefunden.' : 'Füge bei Mitarbeitern ein Geburtsdatum ein.'}
          </p>
        </div>
      )}
    </div>
  );
}
