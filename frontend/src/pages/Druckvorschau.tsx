import { useState, useEffect, useMemo, useRef } from 'react';
import type { Employee, Group, ScheduleEntry, ShiftType } from '../types';

// ── Constants ─────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL ?? '';
function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const WD_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// ── API helpers ───────────────────────────────────────────
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Types ─────────────────────────────────────────────────
interface Holiday {
  id: number;
  date: string;
  name: string;
}

interface PrintConfig {
  showWeekdays: boolean;
  showLegend: boolean;
  showHeader: boolean;
  showSummary: boolean;
  orientation: 'portrait' | 'landscape';
  fontSize: 'small' | 'medium' | 'large';
  colorMode: 'color' | 'grayscale' | 'minimal';
  showOnlyWorkdays: boolean;
}

// ── Color utilities ───────────────────────────────────────
function toGrayscale(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const h = gray.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

function applyColorMode(hex: string, mode: PrintConfig['colorMode']): string {
  if (!hex || hex === '#FFFFFF' || hex === '#ffffff') return hex;
  if (mode === 'grayscale') return toGrayscale(hex);
  if (mode === 'minimal') return '#ffffff';
  return hex;
}

// ── Schedule print grid ────────────────────────────────────
function PrintGrid({
  employees,
  days,
  entryMap,
  holidays,
  year,
  month,
  shifts: _shifts,
  config,
}: {
  employees: Employee[];
  days: number[];
  entryMap: Map<string, ScheduleEntry>;
  holidays: Set<string>;
  year: number;
  month: number;
  shifts: ShiftType[];
  config: PrintConfig;
}) {
  const pad = (n: number) => String(n).padStart(2, '0');

  const visibleDays = config.showOnlyWorkdays
    ? days.filter(d => {
        const wd = new Date(year, month - 1, d).getDay();
        return wd !== 0 && wd !== 6;
      })
    : days;

  const fontSizeClass = config.fontSize === 'small' ? 'text-[9px]' : config.fontSize === 'large' ? 'text-[12px]' : 'text-[10px]';
  const headerFontClass = config.fontSize === 'small' ? 'text-[8px]' : config.fontSize === 'large' ? 'text-[11px]' : 'text-[9px]';

  // Shift summary per employee
  const shiftCounts = useMemo(() => {
    const counts = new Map<number, Map<string, number>>();
    for (const emp of employees) {
      const m = new Map<string, number>();
      for (const day of visibleDays) {
        const e = entryMap.get(`${emp.ID}-${day}`);
        if (e?.display_name) {
          m.set(e.display_name, (m.get(e.display_name) ?? 0) + 1);
        }
      }
      counts.set(emp.ID, m);
    }
    return counts;
  }, [employees, visibleDays, entryMap]);

  return (
    <div className={`print-grid ${fontSizeClass}`}>
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: config.showSummary ? '120px' : '140px' }} />
          {visibleDays.map(d => (
            <col key={d} style={{ width: `${Math.max(22, Math.floor(560 / visibleDays.length))}px` }} />
          ))}
          {config.showSummary && <col style={{ width: '80px' }} />}
        </colgroup>
        <thead>
          <tr>
            <th className="border border-gray-400 bg-slate-700 text-white px-1 py-1 text-left font-semibold">
              Mitarbeiter
            </th>
            {visibleDays.map(day => {
              const dateStr = `${year}-${pad(month)}-${pad(day)}`;
              const wd = new Date(year, month - 1, day).getDay();
              const isHol = holidays.has(dateStr);
              const isWe = wd === 0 || wd === 6;
              return (
                <th
                  key={day}
                  className={`border border-gray-400 text-center font-semibold px-0.5 py-1 ${
                    isHol ? 'bg-red-700 text-white' : isWe ? 'bg-slate-500 text-white' : 'bg-slate-700 text-white'
                  }`}
                >
                  <div>{day}</div>
                  {config.showWeekdays && (
                    <div className={`${headerFontClass} opacity-80`}>{WD_ABBR[wd]}</div>
                  )}
                </th>
              );
            })}
            {config.showSummary && (
              <th className="border border-gray-400 bg-slate-700 text-white px-1 py-1 text-center font-semibold">
                Schichten
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, idx) => {
            const empBg = emp.CBKLABEL != null && emp.CBKLABEL !== 16777215 && emp.CBKLABEL !== 0 && emp.CBKLABEL_HEX
              ? emp.CBKLABEL_HEX : (idx % 2 === 0 ? '#ffffff' : '#f8fafc');
            const empColor = emp.CFGLABEL_HEX || '#000000';
            const empBgApplied = applyColorMode(empBg, config.colorMode);

            return (
              <tr key={emp.ID}>
                <td
                  className="border border-gray-300 px-1 py-0.5 font-medium whitespace-nowrap overflow-hidden"
                  style={{
                    background: empBgApplied,
                    color: empColor,
                    fontWeight: emp.BOLD ? 700 : 500,
                    maxWidth: config.showSummary ? '120px' : '140px',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {emp.NAME}, {emp.FIRSTNAME}
                </td>
                {visibleDays.map(day => {
                  const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                  const wd = new Date(year, month - 1, day).getDay();
                  const isHol = holidays.has(dateStr);
                  const isWe = wd === 0 || wd === 6;
                  const entry = entryMap.get(`${emp.ID}-${day}`);
                  const cellBg = entry?.color_bk
                    ? applyColorMode(entry.color_bk, config.colorMode)
                    : isHol ? '#fee2e2' : isWe ? '#f1f5f9' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc');
                  const cellColor = entry?.color_text || '#000000';
                  return (
                    <td
                      key={day}
                      className="border border-gray-200 text-center px-0 py-0.5"
                      style={{ background: cellBg }}
                    >
                      {entry?.display_name ? (
                        <span style={{ color: cellColor, fontWeight: 700 }}>
                          {entry.display_name}
                        </span>
                      ) : null}
                    </td>
                  );
                })}
                {config.showSummary && (
                  <td className="border border-gray-300 px-1 py-0.5 text-center text-gray-600">
                    {Array.from(shiftCounts.get(emp.ID)?.entries() ?? []).map(([name, cnt]) => (
                      <span key={name} className="inline-block mr-0.5">{name}:{cnt}</span>
                    ))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────
export default function Druckvorschau() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [_shifts, setShifts] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<PrintConfig>({
    showWeekdays: true,
    showLegend: true,
    showHeader: true,
    showSummary: true,
    orientation: 'landscape',
    fontSize: 'small',
    colorMode: 'color',
    showOnlyWorkdays: false,
  });
  const printRef = useRef<HTMLDivElement>(null);

  // Load static data
  useEffect(() => {
    Promise.all([
      apiFetch<Group[]>('/api/groups'),
      apiFetch<ShiftType[]>('/api/shifts'),
    ]).then(([g, s]) => {
      setGroups(g);
      setShifts(s);
    }).catch(() => {});
  }, []);

  // Load schedule data
  useEffect(() => {
    setLoading(true);
    setError(null);
    const groupParam = groupId ? `&group_id=${groupId}` : '';
    Promise.all([
      apiFetch<ScheduleEntry[]>(`/api/schedule?year=${year}&month=${month}${groupParam}`),
      apiFetch<Employee[]>(`/api/employees`),
      apiFetch<Holiday[]>(`/api/holidays?year=${year}`),
    ])
      .then(([sched, emps, hols]) => {
        setScheduleEntries(sched);
        // Filter employees by group if needed
        let filteredEmps = emps.filter(e => !e.HIDE);
        if (groupId) {
          // Get IDs from schedule entries
          const empIds = new Set(sched.map(s => s.employee_id));
          filteredEmps = filteredEmps.filter(e => empIds.has(e.ID));
        }
        setEmployees(filteredEmps);
        setHolidays(new Set(hols.map((h: Holiday) => h.date)));
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [year, month, groupId]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const entryMap = useMemo(() => {
    const m = new Map<string, ScheduleEntry>();
    for (const e of scheduleEntries) {
      const day = parseInt(e.date.split('-')[2]);
      m.set(`${e.employee_id}-${day}`, e);
    }
    return m;
  }, [scheduleEntries]);

  // Sort employees by position/name
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      if (a.POSITION !== b.POSITION) return (a.POSITION ?? 0) - (b.POSITION ?? 0);
      return a.NAME.localeCompare(b.NAME);
    });
  }, [employees]);

  function handlePrint() {
    // Apply orientation to page before printing
    const style = document.createElement('style');
    style.id = 'print-orientation-style';
    style.textContent = `@page { size: ${config.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'}; margin: 10mm; }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const el = document.getElementById('print-orientation-style');
      if (el) el.remove();
    }, 1000);
  }

  const groupLabel = groupId ? (groups.find(g => g.ID === groupId)?.NAME ?? '') : 'Alle Gruppen';

  const shiftColors = useMemo(() => {
    const map = new Map<string, { bg: string; color: string }>();
    for (const entry of scheduleEntries) {
      if (entry.display_name && entry.color_bk && !map.has(entry.display_name)) {
        map.set(entry.display_name, { bg: entry.color_bk, color: entry.color_text || '#000' });
      }
    }
    return map;
  }, [scheduleEntries]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Sidebar: print settings ─────────────────────────── */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto p-4 print:hidden">
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          🖨️ Druckvorschau
        </h2>

        {/* Period */}
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monat</label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jahr</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {[year - 2, year - 1, year, year + 1, year + 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Gruppe</label>
            <select
              value={groupId ?? ''}
              onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Alle Gruppen</option>
              {groups.filter(g => !g.HIDE).map(g => (
                <option key={g.ID} value={g.ID}>{g.NAME}</option>
              ))}
            </select>
          </div>
        </div>

        <hr className="my-3 border-gray-200" />

        {/* Layout options */}
        <div className="space-y-3 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Layout</p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ausrichtung</label>
            <div className="flex gap-2">
              {(['portrait', 'landscape'] as const).map(o => (
                <button
                  key={o}
                  onClick={() => setConfig(c => ({ ...c, orientation: o }))}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    config.orientation === o
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {o === 'portrait' ? '📄 Hoch' : '📄 Quer'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Schriftgröße</label>
            <div className="flex gap-1">
              {(['small', 'medium', 'large'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setConfig(c => ({ ...c, fontSize: s }))}
                  className={`flex-1 py-1 text-xs rounded-lg border transition-colors ${
                    config.fontSize === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s === 'small' ? 'Klein' : s === 'medium' ? 'Mittel' : 'Groß'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Farbmodus</label>
            <div className="flex gap-1">
              {(['color', 'grayscale', 'minimal'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setConfig(c => ({ ...c, colorMode: m }))}
                  className={`flex-1 py-1 text-xs rounded-lg border transition-colors ${
                    config.colorMode === m
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m === 'color' ? '🎨' : m === 'grayscale' ? '⬜' : '◻️'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <hr className="my-3 border-gray-200" />

        {/* Checkboxes */}
        <div className="space-y-2 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Inhalt</p>
          {[
            { key: 'showHeader', label: '📋 Kopfzeile' },
            { key: 'showWeekdays', label: '📅 Wochentage' },
            { key: 'showLegend', label: '🏷️ Legende' },
            { key: 'showSummary', label: '📊 Schicht-Zähler' },
            { key: 'showOnlyWorkdays', label: '🗓️ Nur Werktage' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config[key as keyof PrintConfig] as boolean}
                onChange={e => setConfig(c => ({ ...c, [key]: e.target.checked }))}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>

        <hr className="my-3 border-gray-200" />

        {/* Stats */}
        <div className="text-xs text-gray-500 space-y-1 mb-5">
          <p>📋 {sortedEmployees.length} Mitarbeiter</p>
          <p>📅 {config.showOnlyWorkdays
            ? days.filter(d => { const wd = new Date(year, month - 1, d).getDay(); return wd !== 0 && wd !== 6; }).length
            : days.length} Tage
          </p>
          <p>🗓️ {MONTHS[month - 1]} {year}</p>
        </div>

        {/* Print button */}
        <button
          onClick={handlePrint}
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          🖨️ Drucken
        </button>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Strg+P funktioniert ebenfalls
        </p>
      </aside>

      {/* ── Main: print preview ───────────────────────────── */}
      <main className="flex-1 overflow-auto bg-gray-100 p-4 print:p-0 print:bg-white">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-sm animate-pulse">Lade Daten…</div>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            Fehler: {error}
          </div>
        )}
        {!loading && !error && (
          <div
            ref={printRef}
            className={`bg-white shadow-lg mx-auto print:shadow-none print:mx-0 ${
              config.orientation === 'landscape' ? 'max-w-6xl' : 'max-w-3xl'
            }`}
            style={{ minHeight: '297mm', padding: '10mm' }}
          >
            {/* ── Header ─────────────────────────── */}
            {config.showHeader && (
              <div className="flex items-start justify-between mb-4 pb-3 border-b-2 border-slate-700">
                <div>
                  <h1 className="text-xl font-bold text-slate-800">
                    Dienstplan — {MONTHS[month - 1]} {year}
                  </h1>
                  {groupLabel && (
                    <p className="text-sm text-slate-500 mt-0.5">{groupLabel}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>OpenSchichtplaner5</p>
                  <p>Stand: {new Date().toLocaleDateString('de-AT')}</p>
                </div>
              </div>
            )}

            {/* ── Grid ───────────────────────────── */}
            {sortedEmployees.length === 0 ? (
              <div className="text-center text-gray-400 py-16 text-sm">
                Keine Mitarbeiter für den gewählten Zeitraum
              </div>
            ) : (
              <PrintGrid
                employees={sortedEmployees}
                days={days}
                entryMap={entryMap}
                holidays={holidays}
                year={year}
                month={month}
                shifts={_shifts}
                config={config}
              />
            )}

            {/* ── Legend ─────────────────────────── */}
            {config.showLegend && shiftColors.size > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Legende</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(shiftColors.entries()).map(([name, { bg, color }]) => (
                    <div
                      key={name}
                      className="flex items-center gap-1 border border-gray-200 rounded px-2 py-0.5 text-xs"
                      style={{
                        background: applyColorMode(bg, config.colorMode),
                        color,
                      }}
                    >
                      <span className="font-bold">{name}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 border border-gray-200 rounded px-2 py-0.5 text-xs bg-red-100 text-red-800">
                    <span>Feiertag</span>
                  </div>
                  <div className="flex items-center gap-1 border border-gray-200 rounded px-2 py-0.5 text-xs bg-slate-100 text-slate-700">
                    <span>Wochenende</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Footer ─────────────────────────── */}
            <div className="mt-6 pt-2 border-t border-gray-200 flex justify-between items-center text-xs text-gray-400 print:block">
              <span>Unterschrift Leitung: ___________________________</span>
              <span>Datum: _______________</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
