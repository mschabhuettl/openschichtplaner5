import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { MonthSummary, EmployeeYearStats } from '../api/client';
import type { Employee, Group, ShiftType, LeaveType } from '../types/index';

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

type ShiftColorMap = Map<string, { bk: string; text: string }>;

function buildColorMap(shifts: ShiftType[], leaveTypes: LeaveType[]): ShiftColorMap {
  const m = new Map<string, { bk: string; text: string }>();
  for (const s of shifts) m.set(s.SHORTNAME, { bk: s.COLORBK_HEX || '#64748b', text: s.COLORTEXT_HEX || '#fff' });
  for (const lt of leaveTypes) m.set(lt.SHORTNAME, { bk: lt.COLORBK_HEX || '#fbbf24', text: '#333' });
  return m;
}

function StatBar({ label, val1, val2, max, fmt }: {
  label: string; val1: number; val2: number; max: number;
  fmt?: (v: number) => string;
}) {
  const f = fmt || ((v: number) => v.toFixed(0));
  const pct1 = max > 0 ? Math.min(100, (val1 / max) * 100) : 0;
  const pct2 = max > 0 ? Math.min(100, (val2 / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span className="font-medium text-blue-600">{f(val1)}</span>
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-emerald-600">{f(val2)}</span>
      </div>
      <div className="flex gap-1 items-center">
        {/* Left bar grows from center */}
        <div className="flex-1 flex justify-end h-4 bg-gray-100 rounded-l overflow-hidden">
          <div className="h-full bg-blue-400 rounded-l transition-all duration-500"
            style={{ width: `${pct1}%` }} />
        </div>
        <div className="w-1 h-5 bg-gray-300 rounded" />
        <div className="flex-1 h-4 bg-gray-100 rounded-r overflow-hidden">
          <div className="h-full bg-emerald-400 rounded-r transition-all duration-500"
            style={{ width: `${pct2}%` }} />
        </div>
      </div>
    </div>
  );
}

function MonthCell({ data, colorMap, side }: { data?: MonthSummary; colorMap: ShiftColorMap; side: 'left' | 'right' }) {
  if (!data || (data.shifts === 0 && data.absences === 0)) {
    return (
      <div className={`p-2 rounded text-center text-gray-300 text-xs bg-gray-50 h-full ${side === 'left' ? 'text-right' : 'text-left'}`}>
        —
      </div>
    );
  }
  const ot = data.actual_hours - data.target_hours;
  const otColor = ot >= 0 ? 'text-green-600' : 'text-red-500';
  const labels = Object.entries(data.label_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className={`p-2 rounded bg-white border border-gray-100 h-full text-xs space-y-1 ${side === 'right' ? '' : ''}`}>
      <div className="flex flex-wrap gap-1">
        {labels.map(([label, count]) => {
          const col = colorMap.get(label);
          return (
            <span key={label}
              className="px-1 rounded font-mono text-xs"
              style={{ background: col?.bk || '#e2e8f0', color: col?.text || '#333' }}>
              {label}{count > 1 ? `×${count}` : ''}
            </span>
          );
        })}
      </div>
      <div className="flex gap-2 flex-wrap">
        {data.shifts > 0 && (
          <span className="bg-blue-100 text-blue-700 px-1 rounded">{data.shifts}S</span>
        )}
        {data.absences > 0 && (
          <span className="bg-amber-100 text-amber-700 px-1 rounded">{data.absences}A</span>
        )}
        <span className={`font-semibold ${otColor}`}>{ot >= 0 ? '+' : ''}{ot.toFixed(1)}h</span>
      </div>
    </div>
  );
}

export default function MitarbeiterVergleich() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [_shifts, setShifts] = useState<ShiftType[]>([]);
  const [_leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [emp1Id, setEmp1Id] = useState<number | null>(null);
  const [emp2Id, setEmp2Id] = useState<number | null>(null);
  const [data1, setData1] = useState<MonthSummary[] | null>(null);
  const [data2, setData2] = useState<MonthSummary[] | null>(null);
  const [stats1, setStats1] = useState<EmployeeYearStats | null>(null);
  const [stats2, setStats2] = useState<EmployeeYearStats | null>(null);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [colorMap, setColorMap] = useState<ShiftColorMap>(new Map());
  const [filterGroup, setFilterGroup] = useState<number | null>(null);
  const [groupMembers, setGroupMembers] = useState<Set<number> | null>(null);

  useEffect(() => {
    Promise.all([
      api.getEmployees(),
      api.getGroups(),
      api.getShifts(),
      api.getLeaveTypes(),
    ]).then(([emps, grps, sh, lt]) => {
      setEmployees(emps);
      setGroups(grps);
      setShifts(sh);
      setLeaveTypes(lt);
      setColorMap(buildColorMap(sh, lt));
    });
  }, []);

  useEffect(() => {
    if (emp1Id) {
      setLoading1(true);
      setData1(null);
      setStats1(null);
      Promise.all([
        api.getScheduleYear(year, emp1Id),
        api.getEmployeeStatsYear(emp1Id, year),
      ]).then(([d, s]) => {
        setData1(d);
        setStats1(s);
      }).finally(() => setLoading1(false));
    }
  }, [emp1Id, year]);

  useEffect(() => {
    if (emp2Id) {
      setLoading2(true);
      setData2(null);
      setStats2(null);
      Promise.all([
        api.getScheduleYear(year, emp2Id),
        api.getEmployeeStatsYear(emp2Id, year),
      ]).then(([d, s]) => {
        setData2(d);
        setStats2(s);
      }).finally(() => setLoading2(false));
    }
  }, [emp2Id, year]);

  useEffect(() => {
    if (filterGroup) {
      api.getGroupMembers(filterGroup).then(members => setGroupMembers(new Set(members.map(m => m.ID))));
    } else {
      setGroupMembers(null);
    }
  }, [filterGroup]);

  const filteredEmployees = groupMembers
    ? employees.filter(e => groupMembers.has(e.ID))
    : employees;

  const emp1 = employees.find(e => e.ID === emp1Id);
  const emp2 = employees.find(e => e.ID === emp2Id);

  // Shared label analysis
  const sharedLabels: Record<string, { count1: number; count2: number }> = {};
  if (data1 && data2) {
    for (const m of data1) {
      for (const [label, count] of Object.entries(m.label_counts)) {
        if (!sharedLabels[label]) sharedLabels[label] = { count1: 0, count2: 0 };
        sharedLabels[label].count1 += count;
      }
    }
    for (const m of data2) {
      for (const [label, count] of Object.entries(m.label_counts)) {
        if (!sharedLabels[label]) sharedLabels[label] = { count1: 0, count2: 0 };
        sharedLabels[label].count2 += count;
      }
    }
  }
  const sortedLabels = Object.entries(sharedLabels)
    .filter(([, v]) => v.count1 > 0 || v.count2 > 0)
    .sort((a, b) => (b[1].count1 + b[1].count2) - (a[1].count1 + a[1].count2))
    .slice(0, 12);

  const maxStats = {
    shifts: Math.max((stats1?.totals.shifts_count || 0), (stats2?.totals.shifts_count || 0), 1),
    actual_hours: Math.max((stats1?.totals.actual_hours || 0), (stats2?.totals.actual_hours || 0), 1),
    weekend: Math.max((stats1?.totals.weekend_shifts || 0), (stats2?.totals.weekend_shifts || 0), 1),
    night: Math.max((stats1?.totals.night_shifts || 0), (stats2?.totals.night_shifts || 0), 1),
    vacation: Math.max((stats1?.totals.vacation_days || 0), (stats2?.totals.vacation_days || 0), 1),
    absence: Math.max((stats1?.totals.absence_days || 0), (stats2?.totals.absence_days || 0), 1),
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⚖️ Mitarbeiter-Vergleich</h1>
          <p className="text-sm text-gray-500 mt-0.5">Zwei Mitarbeiter im Jahres-Überblick nebeneinander vergleichen</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filterGroup || ''}
            onChange={e => setFilterGroup(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
          </select>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee Selectors */}
      <div className="grid grid-cols-2 gap-4">
        {/* Employee 1 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded-full bg-blue-400" />
            <span className="font-semibold text-blue-800">Mitarbeiter 1</span>
          </div>
          <select
            className="border rounded px-2 py-1 text-sm w-full"
            value={emp1Id || ''}
            onChange={e => setEmp1Id(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Mitarbeiter wählen —</option>
            {filteredEmployees
              .filter(e => e.ID !== emp2Id)
              .map(e => <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>)}
          </select>
          {emp1 && (
            <div className="mt-2 text-xs text-blue-700">
              Kürzel: <strong>{emp1.SHORTNAME}</strong>
            </div>
          )}
        </div>

        {/* Employee 2 */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded-full bg-emerald-400" />
            <span className="font-semibold text-emerald-800">Mitarbeiter 2</span>
          </div>
          <select
            className="border rounded px-2 py-1 text-sm w-full"
            value={emp2Id || ''}
            onChange={e => setEmp2Id(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Mitarbeiter wählen —</option>
            {filteredEmployees
              .filter(e => e.ID !== emp1Id)
              .map(e => <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>)}
          </select>
          {emp2 && (
            <div className="mt-2 text-xs text-emerald-700">
              Kürzel: <strong>{emp2.SHORTNAME}</strong>
            </div>
          )}
        </div>
      </div>

      {(!emp1Id || !emp2Id) && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">👥</div>
          <p className="text-lg">Bitte zwei Mitarbeiter auswählen, um den Vergleich zu starten.</p>
        </div>
      )}

      {emp1Id && emp2Id && (
        <>
          {/* Stats Comparison */}
          {(stats1 || stats2) && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span>📊</span>
                <span>Statistik-Vergleich {year}</span>
                <div className="ml-auto flex gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-400" />
                    <span className="text-blue-700 font-medium">{emp1?.SHORTNAME}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-emerald-700 font-medium">{emp2?.SHORTNAME}</span>
                  </span>
                </div>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <div>
                  <StatBar label="Schichten" val1={stats1?.totals.shifts_count || 0} val2={stats2?.totals.shifts_count || 0} max={maxStats.shifts} />
                  <StatBar label="Ist-Stunden" val1={stats1?.totals.actual_hours || 0} val2={stats2?.totals.actual_hours || 0} max={maxStats.actual_hours} fmt={v => v.toFixed(1) + 'h'} />
                  <StatBar label="Wochenendschichten" val1={stats1?.totals.weekend_shifts || 0} val2={stats2?.totals.weekend_shifts || 0} max={maxStats.weekend} />
                </div>
                <div>
                  <StatBar label="Nachtschichten" val1={stats1?.totals.night_shifts || 0} val2={stats2?.totals.night_shifts || 0} max={maxStats.night} />
                  <StatBar label="Urlaubstage" val1={stats1?.totals.vacation_days || 0} val2={stats2?.totals.vacation_days || 0} max={maxStats.vacation} />
                  <StatBar label="Abwesenheitstage" val1={stats1?.totals.absence_days || 0} val2={stats2?.totals.absence_days || 0} max={maxStats.absence} />
                </div>
              </div>

              {/* Overtime summary */}
              <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                {[{ stats: stats1, emp: emp1, color: 'blue' }, { stats: stats2, emp: emp2, color: 'emerald' }].map(({ stats, emp, color }, i) => {
                  if (!stats) return <div key={i} />;
                  const ot = stats.totals.actual_hours - stats.totals.target_hours;
                  const otColor = ot >= 0 ? 'text-green-600' : 'text-red-500';
                  return (
                    <div key={i} className={`bg-${color}-50 rounded-lg p-3`}>
                      <div className={`font-semibold text-${color}-800 mb-2`}>{emp?.NAME}, {emp?.FIRSTNAME}</div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                        <span>Soll:</span><span className="font-medium">{stats.totals.target_hours.toFixed(1)}h</span>
                        <span>Ist:</span><span className="font-medium">{stats.totals.actual_hours.toFixed(1)}h</span>
                        <span>Differenz:</span><span className={`font-bold ${otColor}`}>{ot >= 0 ? '+' : ''}{ot.toFixed(1)}h</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shift Type Distribution */}
          {sortedLabels.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-700 mb-4">🏷️ Schichtarten-Verteilung</h2>
              <div className="space-y-2">
                {sortedLabels.map(([label, { count1, count2 }]) => {
                  const col = colorMap.get(label);
                  const maxCount = Math.max(count1, count2, 1);
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold w-12 text-center"
                        style={{ background: col?.bk || '#e2e8f0', color: col?.text || '#333' }}>
                        {label}
                      </span>
                      <div className="flex-1 flex gap-1 items-center">
                        <div className="flex-1 flex justify-end h-5">
                          <div className="h-full bg-blue-400 rounded-l transition-all duration-500 flex items-center justify-end pr-1"
                            style={{ width: `${(count1 / maxCount) * 100}%`, minWidth: count1 > 0 ? '24px' : '0' }}>
                            {count1 > 0 && <span className="text-white text-xs font-bold">{count1}</span>}
                          </div>
                        </div>
                        <div className="w-1 h-6 bg-gray-200 rounded" />
                        <div className="flex-1 h-5">
                          <div className="h-full bg-emerald-400 rounded-r transition-all duration-500 flex items-center pl-1"
                            style={{ width: `${(count2 / maxCount) * 100}%`, minWidth: count2 > 0 ? '24px' : '0' }}>
                            {count2 > 0 && <span className="text-white text-xs font-bold">{count2}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Side-by-Side Grid */}
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">📅 Monatsübersicht {year}</h2>
            {(loading1 || loading2) && (
              <div className="text-center py-8 text-gray-400">
                <div className="animate-spin text-2xl mb-2">⏳</div>
                <p>Lade Daten…</p>
              </div>
            )}
            {!loading1 && !loading2 && (
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-xs font-semibold text-gray-500 px-1">
                  <div>Monat</div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />{emp1?.SHORTNAME}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />{emp2?.SHORTNAME}
                  </div>
                </div>

                {MONTH_NAMES.map((_monthName, mi) => {
                  const m1 = data1?.[mi];
                  const m2 = data2?.[mi];
                  const bothHaveData = (m1?.shifts || 0) + (m1?.absences || 0) + (m2?.shifts || 0) + (m2?.absences || 0) > 0;
                  return (
                    <div key={mi}
                      className={`grid grid-cols-[120px_1fr_1fr] gap-2 rounded-lg ${bothHaveData ? '' : 'opacity-50'}`}>
                      <div className="flex items-center">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded px-2 py-1 w-full text-center">
                          {MONTH_ABBR[mi]}
                        </span>
                      </div>
                      <div className="border-l-2 border-blue-300 pl-2">
                        <MonthCell data={m1} colorMap={colorMap} side="left" />
                      </div>
                      <div className="border-l-2 border-emerald-300 pl-2">
                        <MonthCell data={m2} colorMap={colorMap} side="right" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
