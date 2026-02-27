import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Group } from '../types';

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni',
                     'Juli','August','September','Oktober','November','Dezember'];

// ── Types ──────────────────────────────────────────────────────
interface MonthData {
  month: number;
  actual_hours: number;
  target_hours: number;
  absence_days: number;
  vacation_days: number;
  sick_days: number;
  shifts_count: number;
  employee_count: number;
  overtime: number;
}

interface EmployeeYearData {
  employee_id: number;
  name: string;
  group: string;
  actual_hours: number;
  target_hours: number;
  absence_days: number;
  vacation_days: number;
  sick_days: number;
  shifts_count: number;
  monthly_hours: number[];
  overtime: number;
}

interface YearSummary {
  year: number;
  monthly: MonthData[];
  employees: EmployeeYearData[];
  totals: {
    actual_hours: number;
    target_hours: number;
    absence_days: number;
    vacation_days: number;
    sick_days: number;
    shifts_count: number;
    overtime: number;
  };
}

// ── SVG Bar Chart ──────────────────────────────────────────────
function BarChart({
  data,
  color = '#3b82f6',
  negColor = '#ef4444',
  height = 100,
  showValues = false,
  formatVal,
}: {
  data: { label: string; value: number }[];
  color?: string;
  negColor?: string;
  height?: number;
  showValues?: boolean;
  formatVal?: (v: number) => string;
}) {
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const w = 100 / data.length;

  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none">
      {data.map((d, i) => {
        const barH = (Math.abs(d.value) / max) * (height - 20);
        const isNeg = d.value < 0;
        const x = i * w + w * 0.1;
        const bw = w * 0.8;
        const y = height - 16 - barH;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={bw} height={barH}
              fill={isNeg ? negColor : color}
              rx="1"
              opacity="0.85"
            />
            {showValues && barH > 8 && (
              <text
                x={x + bw / 2} y={y + barH - 3}
                textAnchor="middle"
                fontSize="4"
                fill="white"
                fontWeight="bold"
              >
                {formatVal ? formatVal(d.value) : d.value}
              </text>
            )}
            <text
              x={x + bw / 2} y={height - 3}
              textAnchor="middle"
              fontSize="4.5"
              fill="#94a3b8"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Sparkline ──────────────────────────────────────────────────
function Sparkline({ values, color = '#3b82f6' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100 / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * w;
    const y = 30 - ((v - min) / range) * 28;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 30" className="w-full h-8" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={i * w} cy={30 - ((v - min) / range) * 28} r="2" fill={color} />
      ))}
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({
  icon, label, value, sub, color = 'blue', trend,
}: {
  icon: string; label: string; value: string; sub?: string;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'slate';
  trend?: number[];
}) {
  const colors = {
    blue:   'from-blue-500/10 to-blue-500/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    green:  'from-green-500/10 to-green-500/5 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    red:    'from-red-500/10 to-red-500/5 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    amber:  'from-amber-500/10 to-amber-500/5 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
    slate:  'from-slate-500/10 to-slate-500/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
  };
  const trendColors = {
    blue: '#3b82f6', green: '#22c55e', red: '#ef4444',
    amber: '#f59e0b', purple: '#a855f7', slate: '#64748b',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-sm font-medium opacity-80">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
      {trend && trend.length > 1 && (
        <div className="mt-2">
          <Sparkline values={trend} color={trendColors[color]} />
        </div>
      )}
    </div>
  );
}

// ── Best/Worst Month finder ────────────────────────────────────
function findPeak(monthly: MonthData[], key: keyof MonthData) {
  let maxIdx = 0, minIdx = 0;
  for (let i = 1; i < monthly.length; i++) {
    if ((monthly[i][key] as number) > (monthly[maxIdx][key] as number)) maxIdx = i;
    if ((monthly[i][key] as number) < (monthly[minIdx][key] as number)) minIdx = i;
  }
  return { maxIdx, minIdx };
}

// ── Main Page ─────────────────────────────────────────────────
export default function Jahresrueckblick() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [data, setData] = useState<YearSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'monthly' | 'employees'>('overview');
  const [sortKey, setSortKey] = useState<keyof EmployeeYearData>('actual_hours');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [empSearch, setEmpSearch] = useState('');

  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/statistics/year-summary?year=${year}${groupId ? `&group_id=${groupId}` : ''}`;
      const res = await fetch((import.meta.env.VITE_API_URL || '') + url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Fehler beim Laden');
      const d = await res.json() as YearSummary;
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [year, groupId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ──────────────────────────────────────────
  const monthly = data?.monthly ?? [];
  const totals = data?.totals;
  const employees = (data?.employees ?? [])
    .filter(e => !empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] as number, bv = b[sortKey] as number;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const hoursPerMonth = monthly.map(m => m.actual_hours);
  const shiftsPerMonth = monthly.map(m => m.shifts_count);

  const peakHours = findPeak(monthly, 'actual_hours');
  const peakShifts = findPeak(monthly, 'shifts_count');

  const utilizationPct = totals && totals.target_hours > 0
    ? Math.round((totals.actual_hours / totals.target_hours) * 100)
    : 0;

  const avgHoursPerEmployee = data && data.employees.length > 0
    ? Math.round(totals!.actual_hours / data.employees.length)
    : 0;

  const topEmp = data?.employees[0];
  const bottomEmp = data?.employees.length
    ? [...data.employees].sort((a, b) => a.actual_hours - b.actual_hours)[0]
    : null;

  function sortBy(key: keyof EmployeeYearData) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ k }: { k: keyof EmployeeYearData }) {
    if (sortKey !== k) return <span className="ml-1 opacity-20">↕</span>;
    return <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            🗓️ Jahresrückblick {year}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Jahresstatistik auf einen Blick — Trends, Highlights & MA-Übersicht
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
            <button
              onClick={() => setYear(y => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
            >‹</button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 w-12 text-center">{year}</span>
            <button
              onClick={() => setYear(y => y + 1)}
              disabled={year >= currentYear}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold disabled:opacity-30"
            >›</button>
          </div>
          {/* Group filter */}
          <select
            value={groupId ?? ''}
            onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => (
              <option key={g.ID} value={g.ID}>{g.NAME || `Gruppe ${g.ID}`}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            🔄 Laden
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <div className="text-4xl mb-3 animate-spin">⏳</div>
          <p>Lade Jahresstatistik…</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            {(['overview', 'monthly', 'employees'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab
                    ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {tab === 'overview' ? '📊 Übersicht' : tab === 'monthly' ? '📅 Monatstrend' : '👥 Mitarbeiter'}
              </button>
            ))}
          </div>

          {/* ── TAB: Overview ─────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard
                  icon="⏱️" label="Ist-Stunden" color="blue"
                  value={`${(totals?.actual_hours ?? 0).toLocaleString('de-AT')}h`}
                  sub={`Soll: ${(totals?.target_hours ?? 0).toLocaleString('de-AT')}h`}
                  trend={hoursPerMonth}
                />
                <KpiCard
                  icon="📈" label="Auslastung" color={utilizationPct >= 95 ? 'green' : utilizationPct >= 80 ? 'amber' : 'red'}
                  value={`${utilizationPct}%`}
                  sub="Ist / Soll"
                />
                <KpiCard
                  icon="🔀" label="Schichten" color="purple"
                  value={(totals?.shifts_count ?? 0).toLocaleString('de-AT')}
                  sub="gesamt"
                  trend={shiftsPerMonth}
                />
                <KpiCard
                  icon="🏖️" label="Urlaub" color="green"
                  value={(totals?.vacation_days ?? 0).toLocaleString('de-AT')}
                  sub="Tage"
                  trend={monthly.map(m => m.vacation_days)}
                />
                <KpiCard
                  icon="🤒" label="Krankenstand" color="red"
                  value={(totals?.sick_days ?? 0).toLocaleString('de-AT')}
                  sub="Tage"
                  trend={monthly.map(m => m.sick_days)}
                />
                <KpiCard
                  icon="👥" label="Ø Stunden/MA" color="slate"
                  value={`${avgHoursPerEmployee}h`}
                  sub={`${data.employees.length} Mitarbeiter`}
                />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Hours chart */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                    ⏱️ Ist-Stunden pro Monat
                  </h3>
                  <BarChart
                    data={monthly.map((m, i) => ({ label: MONTH_NAMES_SHORT[i], value: m.actual_hours }))}
                    color="#3b82f6"
                    height={120}
                    showValues
                    formatVal={v => v > 0 ? `${Math.round(v)}` : '0'}
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    {monthly.map((m, i) => (
                      <div
                        key={i}
                        className={`text-center w-8 text-xs rounded px-0.5 ${
                          i === peakHours.maxIdx ? 'text-blue-600 dark:text-blue-400 font-bold' :
                          i === peakHours.minIdx && m.actual_hours > 0 ? 'text-red-500 dark:text-red-400' : ''
                        }`}
                        title={`${MONTH_NAMES[i]}: ${m.actual_hours}h`}
                      />
                    ))}
                  </div>
                  {monthly[peakHours.maxIdx]?.actual_hours > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        🏆 Spitze: {MONTH_NAMES[peakHours.maxIdx]} ({monthly[peakHours.maxIdx].actual_hours}h)
                      </span>
                    </div>
                  )}
                </div>

                {/* Absence chart */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                    📋 Abwesenheiten pro Monat
                  </h3>
                  <BarChart
                    data={monthly.map((m, i) => ({ label: MONTH_NAMES_SHORT[i], value: m.vacation_days + m.sick_days }))}
                    color="#f59e0b"
                    height={120}
                    showValues
                    formatVal={v => v > 0 ? String(v) : '0'}
                  />
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      🏖️ Urlaub: {totals?.vacation_days ?? 0} Tage
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                      🤒 Krank: {totals?.sick_days ?? 0} Tage
                    </span>
                  </div>
                </div>
              </div>

              {/* Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topEmp && topEmp.actual_hours > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">🏆 Top-Mitarbeiter</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{topEmp.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{topEmp.group}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{topEmp.actual_hours}h</div>
                        <div className="text-xs text-slate-500">{topEmp.shifts_count} Schichten</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Sparkline values={topEmp.monthly_hours} color="#f59e0b" />
                    </div>
                  </div>
                )}

                {/* Monthly shift distribution */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">📊 Schichten pro Monat</h3>
                  <BarChart
                    data={monthly.map((m, i) => ({ label: MONTH_NAMES_SHORT[i], value: m.shifts_count }))}
                    color="#8b5cf6"
                    height={100}
                    showValues
                    formatVal={v => v > 0 ? String(v) : ''}
                  />
                  {monthly[peakShifts.maxIdx]?.shifts_count > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        🏆 Aktivster Monat: {MONTH_NAMES[peakShifts.maxIdx]} ({monthly[peakShifts.maxIdx].shifts_count} Schichten)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* No data state */}
              {totals?.shifts_count === 0 && totals?.actual_hours === 0 && (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <div className="text-5xl mb-4">📭</div>
                  <p className="text-lg font-medium">Keine Schichtdaten für {year} vorhanden</p>
                  <p className="text-sm mt-1">Wähle ein anderes Jahr oder eine andere Gruppe</p>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Monthly Trend ────────────────────────────── */}
          {activeTab === 'monthly' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthly.map((m, i) => {
                  const isActive = m.shifts_count > 0 || m.actual_hours > 0 || m.absence_days > 0;
                  const utilPct = m.target_hours > 0
                    ? Math.round((m.actual_hours / m.target_hours) * 100) : 0;
                  return (
                    <div
                      key={m.month}
                      className={`rounded-xl border p-4 ${
                        isActive
                          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200">
                          {MONTH_NAMES[i]}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          utilPct >= 95 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                          utilPct >= 80 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {utilPct}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      {m.target_hours > 0 && (
                        <div className="mb-3">
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                utilPct >= 95 ? 'bg-green-500' : utilPct >= 80 ? 'bg-amber-500' : 'bg-blue-400'
                              }`}
                              style={{ width: `${Math.min(utilPct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-slate-400">Ist-Stunden</div>
                          <div className="font-semibold text-blue-600 dark:text-blue-400">{m.actual_hours}h</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Schichten</div>
                          <div className="font-semibold text-purple-600 dark:text-purple-400">{m.shifts_count}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Urlaub</div>
                          <div className="font-semibold text-green-600 dark:text-green-400">{m.vacation_days} T</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Krank</div>
                          <div className="font-semibold text-red-500 dark:text-red-400">{m.sick_days} T</div>
                        </div>
                      </div>

                      {m.overtime !== 0 && (
                        <div className={`mt-2 text-xs font-medium ${m.overtime > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {m.overtime > 0 ? '▲' : '▼'} Überstunden: {m.overtime > 0 ? '+' : ''}{m.overtime}h
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Year totals summary */}
              {totals && (
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-700 dark:to-slate-600 text-white rounded-xl p-5">
                  <h3 className="font-semibold mb-3 text-slate-200">📊 Jahressumme {year}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Ist-Stunden', value: `${totals.actual_hours}h`, icon: '⏱️' },
                      { label: 'Schichten', value: totals.shifts_count.toString(), icon: '🔀' },
                      { label: 'Urlaub', value: `${totals.vacation_days} Tage`, icon: '🏖️' },
                      { label: 'Krankenstand', value: `${totals.sick_days} Tage`, icon: '🤒' },
                    ].map(item => (
                      <div key={item.label} className="text-center">
                        <div className="text-2xl">{item.icon}</div>
                        <div className="text-xl font-bold mt-1">{item.value}</div>
                        <div className="text-xs text-slate-400">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Employees ───────────────────────────────── */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="🔍 Mitarbeiter suchen…"
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  className="flex-1 min-w-[200px] max-w-xs text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {employees.length} Mitarbeiter
                </span>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs">
                        <th className="text-left px-4 py-3 font-medium">Mitarbeiter</th>
                        <th
                          className="text-right px-3 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                          onClick={() => sortBy('actual_hours')}
                        >
                          Ist-h <SortIcon k="actual_hours" />
                        </th>
                        <th
                          className="text-right px-3 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                          onClick={() => sortBy('target_hours')}
                        >
                          Soll-h <SortIcon k="target_hours" />
                        </th>
                        <th
                          className="text-right px-3 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                          onClick={() => sortBy('overtime')}
                        >
                          ÜS <SortIcon k="overtime" />
                        </th>
                        <th
                          className="text-right px-3 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                          onClick={() => sortBy('shifts_count')}
                        >
                          Schichten <SortIcon k="shifts_count" />
                        </th>
                        <th
                          className="text-right px-3 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                          onClick={() => sortBy('vacation_days')}
                        >
                          Urlaub <SortIcon k="vacation_days" />
                        </th>
                        <th
                          className="text-right px-3 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                          onClick={() => sortBy('sick_days')}
                        >
                          Krank <SortIcon k="sick_days" />
                        </th>
                        <th className="px-3 py-3 font-medium text-center">Verlauf</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, i) => {
                        const ot = emp.overtime;
                        const maxMonthly = Math.max(...emp.monthly_hours, 1);
                        return (
                          <tr
                            key={emp.employee_id}
                            className={`border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                              i === 0 && sortKey === 'actual_hours' && sortDir === 'desc' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-slate-800 dark:text-slate-100">{emp.name}</div>
                              <div className="text-xs text-slate-400">{emp.group}</div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">
                              {emp.actual_hours}h
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400">
                              {emp.target_hours}h
                            </td>
                            <td className={`px-3 py-2.5 text-right font-medium ${
                              ot > 0 ? 'text-green-600 dark:text-green-400' :
                              ot < 0 ? 'text-red-500 dark:text-red-400' :
                              'text-slate-400'
                            }`}>
                              {ot > 0 ? '+' : ''}{ot}h
                            </td>
                            <td className="px-3 py-2.5 text-right text-purple-600 dark:text-purple-400 font-medium">
                              {emp.shifts_count}
                            </td>
                            <td className="px-3 py-2.5 text-right text-green-600 dark:text-green-400">
                              {emp.vacation_days > 0 ? `${emp.vacation_days}T` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-red-500 dark:text-red-400">
                              {emp.sick_days > 0 ? `${emp.sick_days}T` : '—'}
                            </td>
                            <td className="px-3 py-2.5 w-24">
                              {/* Mini sparkline */}
                              <svg viewBox="0 0 48 16" className="w-16 h-4">
                                {emp.monthly_hours.map((h, mi) => {
                                  const bh = maxMonthly > 0 ? (h / maxMonthly) * 14 : 0;
                                  return (
                                    <rect
                                      key={mi}
                                      x={mi * 4}
                                      y={14 - bh}
                                      width="3"
                                      height={bh}
                                      fill={h > 0 ? '#3b82f6' : '#e2e8f0'}
                                      rx="0.5"
                                    />
                                  );
                                })}
                              </svg>
                            </td>
                          </tr>
                        );
                      })}
                      {employees.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                            Keine Mitarbeiter gefunden
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {employees.length > 0 && totals && (
                      <tfoot>
                        <tr className="bg-slate-50 dark:bg-slate-700/50 border-t-2 border-slate-200 dark:border-slate-600 font-semibold text-sm">
                          <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                            Gesamt ({data.employees.length} MA)
                          </td>
                          <td className="px-3 py-2.5 text-right text-blue-700 dark:text-blue-300">
                            {totals.actual_hours}h
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500">
                            {totals.target_hours}h
                          </td>
                          <td className={`px-3 py-2.5 text-right ${totals.overtime > 0 ? 'text-green-600' : totals.overtime < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {totals.overtime > 0 ? '+' : ''}{totals.overtime}h
                          </td>
                          <td className="px-3 py-2.5 text-right text-purple-600 dark:text-purple-400">
                            {totals.shifts_count}
                          </td>
                          <td className="px-3 py-2.5 text-right text-green-600 dark:text-green-400">
                            {totals.vacation_days > 0 ? `${totals.vacation_days}T` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-red-500">
                            {totals.sick_days > 0 ? `${totals.sick_days}T` : '—'}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Bottom performers note (only if we have data) */}
              {bottomEmp && bottomEmp.actual_hours === 0 && data.employees.filter(e => e.actual_hours > 0).length < data.employees.length && (
                <div className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  💡 Mitarbeiter ohne Ist-Stunden werden ganz unten angezeigt. Möglicherweise fehlen Schichtdaten.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
