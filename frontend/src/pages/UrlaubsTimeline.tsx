import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import type { Employee, LeaveType, Group } from '../types';

const BASE_URL = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';

async function fetchRaw<T>(path: string): Promise<T> {
  const raw = localStorage.getItem('sp5_session');
  const session = raw ? (JSON.parse(raw) as { token?: string; devMode?: boolean }) : null;
  const token = session?.devMode ? '__dev_mode__' : (session?.token ?? null);
  const headers: Record<string, string> = {};
  if (token) headers['X-Auth-Token'] = token;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface Absence {
  id: number;
  employee_id: number;
  date: string;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_short: string;
}

// ─── Helpers ─────────────────────────────────────────────
function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year: number) {
  return isLeapYear(year) ? 366 : 365;
}

function dayOfYear(dateStr: string): number {
  const date = new Date(dateStr);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function monthBoundaries(year: number): { month: number; day: number; label: string }[] {
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const result = [];
  for (let m = 0; m < 12; m++) {
    result.push({ month: m, day: dayOfYear(`${year}-${String(m + 1).padStart(2, '0')}-01`), label: months[m] });
  }
  return result;
}

// Group consecutive dates of same leave_type into spans
interface AbsenceSpan {
  employee_id: number;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_short: string;
  startDate: string;
  endDate: string;
  days: number;
}

function groupToSpans(absences: Absence[]): AbsenceSpan[] {
  // sort by employee_id, leave_type_id, date
  const sorted = [...absences].sort((a, b) => {
    if (a.employee_id !== b.employee_id) return a.employee_id - b.employee_id;
    if (a.leave_type_id !== b.leave_type_id) return a.leave_type_id - b.leave_type_id;
    return a.date.localeCompare(b.date);
  });

  const spans: AbsenceSpan[] = [];
  let i = 0;
  while (i < sorted.length) {
    const cur = sorted[i];
    let j = i + 1;
    let endDate = cur.date;
    while (j < sorted.length) {
      const next = sorted[j];
      if (next.employee_id !== cur.employee_id || next.leave_type_id !== cur.leave_type_id) break;
      // check consecutive day
      const curD = new Date(endDate);
      const nextD = new Date(next.date);
      const diffMs = nextD.getTime() - curD.getTime();
      if (diffMs <= 86400000 * 3) { // allow weekends (up to 3 days gap)
        endDate = next.date;
        j++;
      } else {
        break;
      }
    }
    spans.push({
      employee_id: cur.employee_id,
      leave_type_id: cur.leave_type_id,
      leave_type_name: cur.leave_type_name,
      leave_type_short: cur.leave_type_short,
      startDate: cur.date,
      endDate,
      days: j - i,
    });
    i = j;
  }
  return spans;
}

// ─── Tooltip ─────────────────────────────────────────────
interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: AbsenceSpan | null;
  employeeName: string;
}

// ─── Main Component ───────────────────────────────────────
export default function UrlaubsTimeline() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterLeaveType, setFilterLeaveType] = useState<number | 'all'>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [groups, setGroups] = useState<Group[]>([]);
  const [empGroups, setEmpGroups] = useState<Record<number, number[]>>({});
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: null, employeeName: '' });

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [emps, lts, abs, grps] = await Promise.all([
          api.getEmployees(),
          api.getLeaveTypes(),
          fetchRaw<Absence[]>(`/api/absences?year=${year}`),
          api.getGroups(),
        ]);
        setEmployees(emps.filter(e => !e.HIDE));
        setLeaveTypes(lts);
        setAbsences(abs);
        setGroups(grps);

        // load group memberships
        const gdata = grps;
        const map: Record<number, number[]> = {};
        await Promise.all(gdata.map(async (g) => {
          try {
            const gdetail = await fetchRaw<{ members?: { employee_id: number }[] }>(`/api/groups/${g.ID}`);
            if (gdetail.members) {
              gdetail.members.forEach((m: { employee_id: number }) => {
                if (!map[m.employee_id]) map[m.employee_id] = [];
                map[m.employee_id].push(g.ID);
              });
            }
          } catch {
            // ignore
          }
        }));
        setEmpGroups(map);
      } catch (e) {
        setError('Fehler beim Laden der Daten');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [year]);

  const ltMap = useMemo(() => {
    const m: Record<number, LeaveType> = {} as Record<number, LeaveType>;
    leaveTypes.forEach(lt => { m[lt.ID] = lt; });
    return m;
  }, [leaveTypes]);

  const totalDays = daysInYear(year);
  const months = useMemo(() => monthBoundaries(year), [year]);

  // Filter employees by group
  const filteredEmployees = useMemo(() => {
    if (filterGroup === 'all') return employees;
    const gid = parseInt(filterGroup);
    return employees.filter(e => (empGroups[e.ID] ?? []).includes(gid));
  }, [employees, filterGroup, empGroups]);

  // Filter absences
  const filteredAbsences = useMemo(() => {
    let abs = absences;
    if (filterLeaveType !== 'all') {
      abs = abs.filter(a => a.leave_type_id === filterLeaveType);
    }
    return abs;
  }, [absences, filterLeaveType]);

  // Build spans per employee
  const spansByEmployee = useMemo(() => {
    const spans = groupToSpans(filteredAbsences);
    const map: Record<number, AbsenceSpan[]> = {};
    spans.forEach(s => {
      if (!map[s.employee_id]) map[s.employee_id] = [];
      map[s.employee_id].push(s);
    });
    return map;
  }, [filteredAbsences]);

  // Stats: days per employee
  const empDays = useMemo(() => {
    const map: Record<number, number> = {};
    filteredAbsences.forEach(a => {
      map[a.employee_id] = (map[a.employee_id] ?? 0) + 1;
    });
    return map;
  }, [filteredAbsences]);

  // "Überschneidungs-Heatmap": how many people are absent on each day
  const overlapByDay = useMemo(() => {
    const arr = new Array(totalDays + 1).fill(0);
    filteredAbsences.forEach(a => {
      const d = dayOfYear(a.date);
      if (d >= 1 && d <= totalDays) arr[d]++;
    });
    return arr;
  }, [filteredAbsences, totalDays]);

  const maxOverlap = useMemo(() => Math.max(...overlapByDay, 1), [overlapByDay]);

  // Today marker
  const todayDoy = useMemo(() => {
    const today = new Date();
    if (today.getFullYear() !== year) return null;
    return dayOfYear(today.toISOString().slice(0, 10));
  }, [year]);

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
  };

  function pct(day: number) {
    return ((day - 1) / totalDays) * 100;
  }

  return (
    <div className="p-4 space-y-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🏖️ Urlaubs-Timeline
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-600">Gantt-Übersicht aller Abwesenheiten</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          {/* Year selector */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setYear(y => y - 1)}
              className="px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
            >◀</button>
            <span className="px-3 py-1 bg-indigo-600 text-white rounded font-semibold text-sm">{year}</span>
            <button
              onClick={() => setYear(y => y + 1)}
              className="px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
            >▶</button>
          </div>

          {/* Leave type filter */}
          <select
            value={filterLeaveType}
            onChange={e => setFilterLeaveType(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          >
            <option value="all">Alle Abwesenheiten</option>
            {leaveTypes.map(lt => (
              <option key={lt.ID} value={lt.ID}>{lt.NAME}</option>
            ))}
          </select>

          {/* Group filter */}
          <select
            value={filterGroup}
            onChange={e => setFilterGroup(e.target.value)}
            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          >
            <option value="all">Alle Gruppen</option>
            {groups.map(g => (
              <option key={g.ID} value={g.ID}>{g.NAME}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {leaveTypes
          .filter(lt => filterLeaveType === 'all' || lt.ID === filterLeaveType)
          .map(lt => (
            <span
              key={lt.ID}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: lt.COLORBAR_HEX, color: (() => { const h=lt.COLORBAR_HEX.replace('#',''); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return (0.299*r+0.587*g+0.114*b)/255>0.5?'#1f2937':'#fff'; })() }}
            >
              {lt.NAME}
            </span>
          ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-3 rounded">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          {/* Timeline Grid */}
          <div className="overflow-x-auto">
            <div style={{ minWidth: '900px' }}>
              {/* Month header */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                {/* Name column */}
                <div className="w-36 flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-600 border-r border-gray-200 dark:border-gray-700">
                  Mitarbeiter
                </div>
                {/* Timeline header */}
                <div className="flex-1 relative h-8">
                  {months.map((m) => (
                    <div
                      key={m.month}
                      className="absolute top-0 h-full flex items-center justify-start px-1"
                      style={{ left: `${pct(m.day)}%`, width: `${pct(m.day + (m.month < 11 ? months[m.month + 1].day - m.day : totalDays - m.day + 1))}%` }}
                    >
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{m.label}</span>
                    </div>
                  ))}
                  {/* Month dividers */}
                  {months.slice(1).map((m) => (
                    <div
                      key={`div-${m.month}`}
                      className="absolute top-0 h-full border-l border-gray-200 dark:border-gray-700 opacity-60"
                      style={{ left: `${pct(m.day)}%` }}
                    />
                  ))}
                  {/* Today marker */}
                  {todayDoy && (
                    <div
                      className="absolute top-0 h-full border-l-2 border-red-400 z-10"
                      style={{ left: `${pct(todayDoy)}%` }}
                    />
                  )}
                </div>
                {/* Days column */}
                <div className="w-10 flex-shrink-0 px-1 py-2 text-xs font-semibold text-gray-500 dark:text-gray-600 border-l border-gray-200 dark:border-gray-700 text-center">
                  Tage
                </div>
              </div>

              {/* Overlap heatmap row */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/10">
                <div className="w-36 flex-shrink-0 px-3 py-1 text-xs text-amber-700 dark:text-amber-400 font-medium border-r border-gray-200 dark:border-gray-700 flex items-center">
                  Überschneidungen
                </div>
                <div className="flex-1 relative h-5">
                  {/* Render heatmap bars per day */}
                  {months.map((m, mi) => {
                    const startDay = m.day;
                    const endDay = mi < 11 ? months[mi + 1].day - 1 : totalDays;
                    const daysInMonth = endDay - startDay + 1;
                    const maxInMonth = Math.max(...Array.from({ length: daysInMonth }, (_, i) => overlapByDay[startDay + i] ?? 0), 0);
                    const avgInMonth = daysInMonth > 0
                      ? Array.from({ length: daysInMonth }, (_, i) => overlapByDay[startDay + i] ?? 0).reduce((a, b) => a + b, 0) / daysInMonth
                      : 0;
                    const opacity = maxInMonth > 0 ? Math.min(0.9, 0.15 + (avgInMonth / maxOverlap) * 0.75) : 0;
                    return (
                      <div
                        key={`heat-${m.month}`}
                        className="absolute top-0 h-full"
                        style={{
                          left: `${pct(startDay)}%`,
                          width: `${pct(endDay + 1) - pct(startDay)}%`,
                          backgroundColor: `rgba(245, 158, 11, ${opacity})`,
                        }}
                        title={`${m.label}: max ${maxInMonth} gleichzeitig`}
                      />
                    );
                  })}
                  {/* Month dividers */}
                  {months.slice(1).map((m) => (
                    <div
                      key={`hdiv-${m.month}`}
                      className="absolute top-0 h-full border-l border-gray-200 dark:border-gray-700 opacity-40"
                      style={{ left: `${pct(m.day)}%` }}
                    />
                  ))}
                  {/* Today */}
                  {todayDoy && (
                    <div
                      className="absolute top-0 h-full border-l-2 border-red-400 z-10"
                      style={{ left: `${pct(todayDoy)}%` }}
                    />
                  )}
                </div>
                <div className="w-10 flex-shrink-0 border-l border-gray-200 dark:border-gray-700" />
              </div>

              {/* Employee rows */}
              {filteredEmployees.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-600 py-8 text-sm">
                  Keine Mitarbeiter gefunden
                </div>
              )}
              {filteredEmployees.map((emp, idx) => {
                const spans = spansByEmployee[emp.ID] ?? [];
                const totalEmpDays = empDays[emp.ID] ?? 0;
                return (
                  <div
                    key={emp.ID}
                    className={`flex border-b border-gray-100 dark:border-gray-700/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}
                    style={{ height: '32px' }}
                  >
                    {/* Name */}
                    <div className="w-36 flex-shrink-0 px-3 flex items-center border-r border-gray-100 dark:border-gray-700">
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={`${emp.FIRSTNAME} ${emp.NAME}`}>
                        {emp.FIRSTNAME ? `${emp.FIRSTNAME.charAt(0)}. ${emp.NAME}` : emp.NAME}
                      </span>
                    </div>
                    {/* Timeline bar */}
                    <div className="flex-1 relative">
                      {/* Month dividers */}
                      {months.slice(1).map((m) => (
                        <div
                          key={`rdiv-${m.month}`}
                          className="absolute top-0 h-full border-l border-gray-100 dark:border-gray-700/40 opacity-50"
                          style={{ left: `${pct(m.day)}%` }}
                        />
                      ))}
                      {/* Today */}
                      {todayDoy && (
                        <div
                          className="absolute top-0 h-full border-l-2 border-red-400 z-10 opacity-70"
                          style={{ left: `${pct(todayDoy)}%` }}
                        />
                      )}
                      {/* Absence spans */}
                      {spans.map((span, si) => {
                        const lt = ltMap[span.leave_type_id];
                        const color = lt?.COLORBAR_HEX ?? '#6366f1';
                        // Determine text color based on background luminance
                        const hex = color.replace('#', '');
                        const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
                        const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
                        const textColor = lum > 0.5 ? '#1f2937' : '#fff';
                        const startDoy = dayOfYear(span.startDate);
                        const endDoy = dayOfYear(span.endDate);
                        const leftPct = pct(startDoy);
                        const widthPct = Math.max(pct(endDoy + 1) - leftPct, 0.3); // min visible width
                        return (
                          <div
                            key={si}
                            className="absolute top-1 bottom-1 rounded cursor-pointer hover:opacity-90 hover:shadow-md transition-all flex items-center justify-center overflow-hidden"
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              backgroundColor: color,
                              color: textColor,
                            }}
                            onMouseEnter={(e) => {
                              setTooltip({
                                visible: true,
                                x: e.clientX,
                                y: e.clientY,
                                content: span,
                                employeeName: `${emp.FIRSTNAME} ${emp.NAME}`,
                              });
                            }}
                            onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                            onMouseMove={(e) => {
                              setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }));
                            }}
                          >
                            {widthPct > 3 && (
                              <span className="text-xs font-semibold px-1 truncate select-none">
                                {span.leave_type_short}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Days count */}
                    <div className="w-10 flex-shrink-0 flex items-center justify-center border-l border-gray-100 dark:border-gray-700">
                      {totalEmpDays > 0 ? (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{totalEmpDays}</span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {filteredAbsences.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-600 mt-1">Abwesenheitstage gesamt</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {Object.values(empDays).filter(d => d > 0).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-600 mt-1">Mitarbeiter mit Abwesenheit</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {Math.max(...overlapByDay)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-600 mt-1">Max. gleichzeitig abwesend</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {filteredEmployees.length > 0 && Object.values(empDays).length > 0
                ? Math.round(filteredAbsences.length / filteredEmployees.filter(e => (empDays[e.ID] ?? 0) > 0).length || 0)
                : 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-600 mt-1">Ø Tage pro MA</div>
          </div>
        </div>
      )}

      {/* Top absentees */}
      {!loading && !error && filteredEmployees.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🏆 Top Abwesenheiten</h3>
          <div className="space-y-2">
            {[...filteredEmployees]
              .filter(e => (empDays[e.ID] ?? 0) > 0)
              .sort((a, b) => (empDays[b.ID] ?? 0) - (empDays[a.ID] ?? 0))
              .slice(0, 5)
              .map((emp, i) => {
                const days = empDays[emp.ID] ?? 0;
                const maxDays = Math.max(...Object.values(empDays), 1);
                return (
                  <div key={emp.ID} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 dark:text-gray-500 w-4 text-right">{i + 1}.</span>
                    <span className="text-sm text-gray-800 dark:text-gray-200 w-32 truncate">
                      {emp.FIRSTNAME} {emp.NAME}
                    </span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-4 rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all"
                        style={{ width: `${(days / maxDays) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 w-12 text-right">
                      {days}d
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip.visible && tooltip.content && (
        <div
          className="fixed z-50 pointer-events-none bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 text-sm"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-semibold text-gray-900 dark:text-white">{tooltip.employeeName}</div>
          <div className="text-indigo-600 dark:text-indigo-400 font-medium">{tooltip.content.leave_type_name}</div>
          <div className="text-gray-600 dark:text-gray-600 text-xs mt-1">
            {formatDate(tooltip.content.startDate)} – {formatDate(tooltip.content.endDate)}
          </div>
          <div className="text-gray-500 dark:text-gray-500 text-xs">
            {tooltip.content.days} Tag{tooltip.content.days !== 1 ? 'e' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
