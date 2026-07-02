import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Group, Employee } from '../types';
import { groupTreeOptions } from '../utils/groupTree';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AbsenceByMonth {
  month: number;
  vacation: number;
  sick: number;
  other: number;
}

export interface AbsenceOverview {
  year: number;
  company_totals: {
    vacation_days: number;
    sick_days: number;
    other_days: number;
    total_days: number;
  };
  groups: Array<{
    group_id: number;
    group_name: string;
    vacation_days: number;
    sick_days: number;
    other_days: number;
    total_days: number;
  }>;
  by_month: AbsenceByMonth[];
}

export interface AbsenceGroupStats {
  group_id: number;
  group_name: string;
  year: number;
  employees: Array<{
    employee_id: number;
    employee_name: string;
    vacation_days: number;
    sick_days: number;
    other_days: number;
    total_days: number;
    pending_requests: number;
  }>;
  group_totals: {
    vacation_days: number;
    sick_days: number;
    other_days: number;
    total_days: number;
  };
  top3_by_sick_days: Array<{ employee_id: number; employee_name: string; sick_days: number }>;
  top3_by_vacation_days: Array<{ employee_id: number; employee_name: string; vacation_days: number }>;
}

export interface AbsenceEmployeeStats {
  employee_id: number;
  employee_name: string;
  year: number;
  vacation_days: number;
  sick_days: number;
  other_days: number;
  total_days: number;
  by_month: Array<{
    month: number;
    vacation: number;
    sick: number;
    other: number;
  }>;
  pending_requests: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const COLORS = {
  vacation: '#3b82f6',   // blue
  sick: '#ef4444',       // red
  other: '#9ca3af',      // gray
};

// ─── CSS Chart Components ─────────────────────────────────────────────────────

function StackedBarChart({ data }: { data: AbsenceByMonth[] }) {
  const maxVal = Math.max(...data.map(d => d.vacation + d.sick + d.other), 1);

  return (
    <div className="w-full">
      <div className="flex gap-4 mb-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.vacation }} />
          Urlaub
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.sick }} />
          Krank
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.other }} />
          Sonstiges
        </span>
      </div>
      <div className="flex items-end gap-1" style={{ height: 160 }}>
        {data.map((d) => {
          const total = d.vacation + d.sick + d.other;
          const totalPct = (total / maxVal) * 100;
          const vacPct = total > 0 ? (d.vacation / total) * 100 : 0;
          const sickPct = total > 0 ? (d.sick / total) * 100 : 0;
          const otherPct = total > 0 ? (d.other / total) * 100 : 0;

          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                style={{ height: `${(totalPct / 100) * 140}px`, minHeight: total > 0 ? 4 : 0 }}
                title={`Urlaub: ${d.vacation}, Krank: ${d.sick}, Sonst: ${d.other}`}
              >
                <div style={{ height: `${vacPct}%`, background: COLORS.vacation }} />
                <div style={{ height: `${sickPct}%`, background: COLORS.sick }} />
                <div style={{ height: `${otherPct}%`, background: COLORS.other }} />
              </div>
              <span className="text-xs text-gray-500">{MONTH_NAMES[d.month - 1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PieChart({ vacation, sick, other }: { vacation: number; sick: number; other: number }) {
  const total = vacation + sick + other;
  if (total === 0) {
    return (
      <div className="flex items-center justify-center w-32 h-32 rounded-full border-4 border-gray-200 text-gray-400 text-xs">
        Keine Daten
      </div>
    );
  }

  const vacPct = (vacation / total) * 100;
  const sickPct = (sick / total) * 100;
  const otherPct = (other / total) * 100;

  // Build conic-gradient
  const grad = `conic-gradient(
    ${COLORS.vacation} 0% ${vacPct}%,
    ${COLORS.sick} ${vacPct}% ${vacPct + sickPct}%,
    ${COLORS.other} ${vacPct + sickPct}% 100%
  )`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-32 h-32 rounded-full"
        style={{ background: grad }}
        title={`Urlaub: ${vacation}, Krank: ${sick}, Sonst: ${other}`}
      />
      <div className="flex flex-col gap-1 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.vacation }} />
          Urlaub: {vacation} Tage ({vacPct.toFixed(0)}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.sick }} />
          Krank: {sick} Tage ({sickPct.toFixed(0)}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.other }} />
          Sonst.: {other} Tage ({otherPct.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ year }: { year: number }) {
  const [data, setData] = useState<AbsenceOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getAbsenceStatsOverview(year)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="text-center py-8 text-gray-500">Lade Daten…</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Company totals */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Urlaub', value: data.company_totals.vacation_days, color: COLORS.vacation },
          { label: 'Krank', value: data.company_totals.sick_days, color: COLORS.sick },
          { label: 'Sonstiges', value: data.company_totals.other_days, color: COLORS.other },
          { label: 'Gesamt', value: data.company_totals.total_days, color: '#6366f1' },
        ].map(item => (
          <div key={item.label} className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
            <div className="text-xs text-gray-500 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Month-by-month chart */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="font-semibold mb-4 text-sm">Monatsverlauf {year}</h3>
        <StackedBarChart data={data.by_month} />
      </div>

      {/* Groups summary */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="font-semibold mb-4 text-sm">Summe nach Gruppe</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-slate-600">
                <th scope="col" className="pb-2 pr-4">Gruppe</th>
                <th scope="col" className="pb-2 pr-4 text-right" style={{ color: COLORS.vacation }}>Urlaub</th>
                <th scope="col" className="pb-2 pr-4 text-right" style={{ color: COLORS.sick }}>Krank</th>
                <th scope="col" className="pb-2 pr-4 text-right" style={{ color: COLORS.other }}>Sonst.</th>
                <th scope="col" className="pb-2 text-right">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map(g => (
                <tr key={g.group_id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="py-2 pr-4 font-medium">{g.group_name}</td>
                  <td className="py-2 pr-4 text-right">{g.vacation_days}</td>
                  <td className="py-2 pr-4 text-right">{g.sick_days}</td>
                  <td className="py-2 pr-4 text-right">{g.other_days}</td>
                  <td className="py-2 text-right font-semibold">{g.total_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Group Tab ────────────────────────────────────────────────────────────────

function GroupTab({ year, groups }: { year: number; groups: Group[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [data, setData] = useState<AbsenceGroupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroup = useCallback((gid: number) => {
    setLoading(true);
    setError(null);
    api.getAbsenceStatsGroup(gid, year)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const gid = Number(e.target.value);
    setSelectedGroupId(gid);
    loadGroup(gid);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gruppe:</label>
        <select
          className="border border-gray-300 dark:border-slate-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-slate-800"
          value={selectedGroupId ?? ''}
          onChange={handleGroupChange}
        >
          <option value="">— Gruppe wählen —</option>
          {groupTreeOptions(groups).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {!selectedGroupId && (
        <div className="text-center py-8 text-gray-400">Bitte eine Gruppe auswählen</div>
      )}

      {loading && <div className="text-center py-8 text-gray-500">Lade Daten…</div>}
      {error && <div className="text-center py-8 text-red-500">{error}</div>}

      {data && !loading && (
        <>
          {/* Group totals */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Urlaub', value: data.group_totals.vacation_days, color: COLORS.vacation },
              { label: 'Krank', value: data.group_totals.sick_days, color: COLORS.sick },
              { label: 'Sonstiges', value: data.group_totals.other_days, color: COLORS.other },
              { label: 'Gesamt', value: data.group_totals.total_days, color: '#6366f1' },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-slate-700">
                <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
                <div className="text-xs text-gray-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Top 3 highlights */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-slate-700">
              <h4 className="font-semibold text-sm mb-3" style={{ color: COLORS.sick }}>
                🏥 Top 3 Krankentage
              </h4>
              <ol className="space-y-1">
                {data.top3_by_sick_days.map((e, i) => (
                  <li key={e.employee_id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-4">{i + 1}.</span>
                    <span className="flex-1 truncate">{e.employee_name}</span>
                    <span className="font-semibold" style={{ color: COLORS.sick }}>{e.sick_days}</span>
                  </li>
                ))}
                {data.top3_by_sick_days.length === 0 && (
                  <li className="text-gray-400 text-sm">Keine Daten</li>
                )}
              </ol>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-slate-700">
              <h4 className="font-semibold text-sm mb-3" style={{ color: COLORS.vacation }}>
                🏖️ Top 3 Urlaubstage
              </h4>
              <ol className="space-y-1">
                {data.top3_by_vacation_days.map((e, i) => (
                  <li key={e.employee_id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-4">{i + 1}.</span>
                    <span className="flex-1 truncate">{e.employee_name}</span>
                    <span className="font-semibold" style={{ color: COLORS.vacation }}>{e.vacation_days}</span>
                  </li>
                ))}
                {data.top3_by_vacation_days.length === 0 && (
                  <li className="text-gray-400 text-sm">Keine Daten</li>
                )}
              </ol>
            </div>
          </div>

          {/* Employee table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-slate-700">
            <h3 className="font-semibold mb-4 text-sm">Mitarbeiter-Übersicht</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b dark:border-slate-600">
                    <th scope="col" className="pb-2 pr-4">Mitarbeiter</th>
                    <th scope="col" className="pb-2 pr-4 text-right" style={{ color: COLORS.vacation }}>Urlaub</th>
                    <th scope="col" className="pb-2 pr-4 text-right" style={{ color: COLORS.sick }}>Krank</th>
                    <th scope="col" className="pb-2 pr-4 text-right" style={{ color: COLORS.other }}>Sonst.</th>
                    <th scope="col" className="pb-2 pr-4 text-right">Gesamt</th>
                    <th scope="col" className="pb-2 text-right text-orange-500">Beantragt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map(e => (
                    <tr key={e.employee_id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-2 pr-4 font-medium">{e.employee_name}</td>
                      <td className="py-2 pr-4 text-right">{e.vacation_days}</td>
                      <td className="py-2 pr-4 text-right">{e.sick_days}</td>
                      <td className="py-2 pr-4 text-right">{e.other_days}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{e.total_days}</td>
                      <td className="py-2 text-right">
                        {e.pending_requests > 0 ? (
                          <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full text-xs">
                            {e.pending_requests}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.employees.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-gray-400">Keine Mitarbeiter in dieser Gruppe</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Employee Tab ─────────────────────────────────────────────────────────────

function EmployeeTab({ year, employees }: { year: number; employees: Employee[] }) {
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [data, setData] = useState<AbsenceEmployeeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmployee = useCallback((eid: number) => {
    setLoading(true);
    setError(null);
    api.getAbsenceStatsEmployee(eid, year)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  const handleEmpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const eid = Number(e.target.value);
    setSelectedEmpId(eid);
    loadEmployee(eid);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mitarbeiter:</label>
        <select
          className="border border-gray-300 dark:border-slate-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-slate-800"
          value={selectedEmpId ?? ''}
          onChange={handleEmpChange}
        >
          <option value="">— Mitarbeiter wählen —</option>
          {employees.map(e => (
            <option key={e.ID} value={e.ID}>
              {e.NAME}{e.FIRSTNAME ? `, ${e.FIRSTNAME}` : ''} ({e.SHORTNAME})
            </option>
          ))}
        </select>
      </div>

      {!selectedEmpId && (
        <div className="text-center py-8 text-gray-400">Bitte einen Mitarbeiter auswählen</div>
      )}

      {loading && <div className="text-center py-8 text-gray-500">Lade Daten…</div>}
      {error && <div className="text-center py-8 text-red-500">{error}</div>}

      {data && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Urlaub', value: data.vacation_days, color: COLORS.vacation },
              { label: 'Krank', value: data.sick_days, color: COLORS.sick },
              { label: 'Sonstiges', value: data.other_days, color: COLORS.other },
              { label: 'Gesamt', value: data.total_days, color: '#6366f1' },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-slate-700">
                <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
                <div className="text-xs text-gray-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Pending requests banner */}
          {data.pending_requests > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-3 text-sm text-orange-700 dark:text-orange-400">
              <span>⏳</span>
              <span><strong>{data.pending_requests}</strong> ausstehende Abwesenheitsanträge</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pie chart */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center">
              <h3 className="font-semibold mb-4 text-sm self-start">Verteilung</h3>
              <PieChart
                vacation={data.vacation_days}
                sick={data.sick_days}
                other={data.other_days}
              />
            </div>

            {/* Monthly breakdown table */}
            <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-slate-700">
              <h3 className="font-semibold mb-4 text-sm">Monatsaufschlüsselung</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b dark:border-slate-600">
                      <th scope="col" className="pb-2 pr-4">Monat</th>
                      <th scope="col" className="pb-2 pr-3 text-right" style={{ color: COLORS.vacation }}>Urlaub</th>
                      <th scope="col" className="pb-2 pr-3 text-right" style={{ color: COLORS.sick }}>Krank</th>
                      <th scope="col" className="pb-2 pr-3 text-right" style={{ color: COLORS.other }}>Sonst.</th>
                      <th scope="col" className="pb-2 text-right">Gesamt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_month.map(m => {
                      const total = m.vacation + m.sick + m.other;
                      return (
                        <tr key={m.month} className={`border-b dark:border-slate-700 ${total === 0 ? 'opacity-40' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                          <td className="py-1.5 pr-4">{MONTH_NAMES[m.month - 1]}</td>
                          <td className="py-1.5 pr-3 text-right">{m.vacation || '—'}</td>
                          <td className="py-1.5 pr-3 text-right">{m.sick || '—'}</td>
                          <td className="py-1.5 pr-3 text-right">{m.other || '—'}</td>
                          <td className="py-1.5 text-right font-semibold">{total || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type TabId = 'overview' | 'group' | 'employee';

export default function AbsenceStats() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [groups, setGroups] = useState<Group[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
    api.getEmployees().then(setEmployees).catch(() => {});
  }, []);

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Übersicht', icon: '🏢' },
    { id: 'group', label: 'Gruppe', icon: '👥' },
    { id: 'employee', label: 'Mitarbeiter', icon: '👤' },
  ];

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📊 Abwesenheits-Statistiken
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Auswertung von Urlaub, Krankenstand und sonstigen Abwesenheiten
          </p>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="absence-stats-year" className="text-sm font-medium text-gray-700 dark:text-gray-300">Jahr:</label>
          <select
            id="absence-stats-year"
            aria-label="Jahr auswählen"
            className="border border-gray-300 dark:border-slate-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-slate-800 font-semibold"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Abwesenheits-Statistik Tabs" className="flex gap-1 mb-6 border-b border-gray-200 dark:border-slate-600"
        onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const ci = tabs.findIndex(t => t.id === activeTab); const ni = e.key === 'ArrowRight' ? (ci + 1) % tabs.length : (ci - 1 + tabs.length) % tabs.length; setActiveTab(tabs[ni].id); (document.querySelector(`[data-tab="${tabs[ni].id}"]`) as HTMLElement)?.focus(); } }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            data-tab={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab year={year} />}
      {activeTab === 'group' && <GroupTab year={year} groups={groups} />}
      {activeTab === 'employee' && <EmployeeTab year={year} employees={employees} />}
    </div>
  );
}
