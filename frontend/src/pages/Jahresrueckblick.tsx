import { useState, useEffect } from 'react';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

const MONTH_NAMES_FULL = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

interface MonthSummary {
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

interface EmployeeYear {
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

interface YearTotals {
  actual_hours: number;
  target_hours: number;
  absence_days: number;
  vacation_days: number;
  sick_days: number;
  shifts_count: number;
  overtime: number;
}

interface YearSummary {
  year: number;
  monthly: MonthSummary[];
  employees: EmployeeYear[];
  totals: YearTotals;
}

interface Group {
  ID: number;
  NAME: string;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ── Mini sparkline SVG ─────────────────────────────────────────
function Sparkline({ values, color = '#3b82f6', height = 32, width = 96 }: {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - (v / max) * height * 0.9 - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - (v / max) * height * 0.9 - 2;
        return <circle key={i} cx={x} cy={y} r="2" fill={color} />;
      })}
    </svg>
  );
}

// ── Bar chart (12 months) ──────────────────────────────────────
function MonthBarChart({ monthly, metric, color }: {
  monthly: MonthSummary[];
  metric: 'actual_hours' | 'absence_days' | 'vacation_days' | 'sick_days';
  color: string;
}) {
  const values = monthly.map(m => m[metric] as number);
  const max = Math.max(...values, 1);
  const chartH = 120;
  const barW = 18;
  const gap = 6;
  const totalW = 12 * (barW + gap) - gap;

  return (
    <svg width={totalW} height={chartH + 20} viewBox={`0 0 ${totalW} ${chartH + 20}`} className="overflow-visible">
      {monthly.map((m, i) => {
        const val = m[metric] as number;
        const barH = max > 0 ? (val / max) * chartH : 0;
        const x = i * (barW + gap);
        const y = chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill={color} rx="3" opacity="0.85" />
            <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">
              {MONTH_NAMES[i]}
            </text>
            {val > 0 && barH > 14 && (
              <text x={x + barW / 2} y={y + 12} textAnchor="middle" fontSize="8" fill="white" fontWeight="600">
                {val % 1 === 0 ? val : val.toFixed(0)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Heatmap: employees × months ────────────────────────────────
function EmployeeHeatmap({ employees, maxShow = 15 }: { employees: EmployeeYear[]; maxShow?: number }) {
  const shown = employees.slice(0, maxShow);
  const allVals = shown.flatMap(e => e.monthly_hours);
  const maxVal = Math.max(...allVals, 1);

  function heatColor(v: number): string {
    if (v === 0) return '#f1f5f9';
    const ratio = v / maxVal;
    if (ratio < 0.25) return '#bfdbfe';
    if (ratio < 0.5) return '#60a5fa';
    if (ratio < 0.75) return '#3b82f6';
    return '#1d4ed8';
  }

  const cellW = 30;
  const cellH = 22;
  const labelW = 130;
  const svgW = labelW + 12 * cellW + 4;
  const svgH = (shown.length + 1) * cellH + 4;

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        {/* Month headers */}
        {MONTH_NAMES.map((mn, i) => (
          <text key={i} x={labelW + i * cellW + cellW / 2} y={14} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6" fontWeight="600">
            {mn}
          </text>
        ))}
        {/* Employee rows */}
        {shown.map((emp, row) => (
          <g key={emp.employee_id}>
            <text
              x={labelW - 4}
              y={cellH * (row + 1) + cellH / 2 + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              opacity="0.8"
            >
              {emp.name.length > 18 ? emp.name.slice(0, 17) + '…' : emp.name}
            </text>
            {emp.monthly_hours.map((val, col) => (
              <g key={col}>
                <rect
                  x={labelW + col * cellW + 1}
                  y={cellH * (row + 1) + 1}
                  width={cellW - 2}
                  height={cellH - 2}
                  fill={heatColor(val)}
                  rx="2"
                >
                  <title>{`${emp.name} — ${MONTH_NAMES_FULL[col]}: ${val}h`}</title>
                </rect>
                {val > 0 && (
                  <text
                    x={labelW + col * cellW + cellW / 2}
                    y={cellH * (row + 1) + cellH / 2 + 4}
                    textAnchor="middle"
                    fontSize="8"
                    fill={val / maxVal > 0.4 ? 'white' : '#1e40af'}
                    fontWeight="500"
                  >
                    {val.toFixed(0)}
                  </text>
                )}
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-4 border ${color} flex flex-col gap-1`}>
      <div className="text-2xl">{icon}</div>
      <div className="text-xs font-medium opacity-60 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function Jahresrueckblick() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [data, setData] = useState<YearSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmap' | 'ranking'>('overview');

  useEffect(() => {
    fetch(`${BASE_URL}/api/groups`)
      .then(r => r.json())
      .then(setGroups)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ year: String(year) });
    if (groupId) params.set('group_id', String(groupId));
    fetch(`${BASE_URL}/api/statistics/year-summary?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Fehler beim Laden der Daten'); setLoading(false); });
  }, [year, groupId]);

  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  const totals = data?.totals;
  const monthly = data?.monthly ?? [];
  const employees = data?.employees ?? [];

  // For ranking
  const topHours = [...employees].sort((a, b) => b.actual_hours - a.actual_hours).slice(0, 10);
  const topOvertime = [...employees].sort((a, b) => b.overtime - a.overtime).slice(0, 5);
  const topVacation = [...employees].sort((a, b) => b.vacation_days - a.vacation_days).slice(0, 5);
  const topSick = [...employees].sort((a, b) => b.sick_days - a.sick_days).slice(0, 5);

  // Best/worst month for hours
  const sortedByHours = [...monthly].sort((a, b) => b.actual_hours - a.actual_hours);
  const bestMonth = sortedByHours[0];
  const worstMonth = sortedByHours[sortedByHours.length - 1];

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">🏆 Jahresrückblick {year}</h1>
          <p className="text-sm opacity-60 mt-0.5">Statistiken & Trends für das gesamte Jahr</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={groupId ?? ''}
            onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 opacity-50">⏳ Daten werden geladen…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Summary Cards */}
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              <StatCard icon="⏱️" label="Ist-Stunden" value={`${totals.actual_hours.toLocaleString('de')}h`} sub="gesamt" color="bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-100" />
              <StatCard icon="🎯" label="Soll-Stunden" value={`${totals.target_hours.toLocaleString('de')}h`} sub="geplant" color="bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100" />
              <StatCard
                icon={totals.overtime >= 0 ? '📈' : '📉'}
                label="Überstunden"
                value={`${totals.overtime >= 0 ? '+' : ''}${totals.overtime.toLocaleString('de')}h`}
                sub={totals.overtime >= 0 ? 'Mehrarbeit' : 'Minusstunden'}
                color={totals.overtime >= 0
                  ? 'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-700 dark:text-green-100'
                  : 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-100'}
              />
              <StatCard icon="🏖️" label="Urlaubstage" value={totals.vacation_days} sub="genommen" color="bg-teal-50 border-teal-200 text-teal-900 dark:bg-teal-900/20 dark:border-teal-700 dark:text-teal-100" />
              <StatCard icon="🤒" label="Kranktage" value={totals.sick_days} sub="gesamt" color="bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-700 dark:text-red-100" />
              <StatCard icon="📋" label="Abwesenheiten" value={totals.absence_days} sub="Tage gesamt" color="bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-100" />
              <StatCard icon="👥" label="Mitarbeiter" value={employees.length} sub={`Gruppe: ${groupId ? groups.find(g => g.ID === groupId)?.NAME ?? '?' : 'Alle'}`} color="bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-100" />
            </div>
          )}

          {/* Best / Worst month highlight */}
          {monthly.some(m => m.actual_hours > 0) && bestMonth && worstMonth && bestMonth !== worstMonth && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3 flex gap-3 items-center">
                <span className="text-3xl">🌟</span>
                <div>
                  <div className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">Stärkster Monat</div>
                  <div className="font-bold text-green-900 dark:text-green-100">{MONTH_NAMES_FULL[bestMonth.month - 1]}</div>
                  <div className="text-sm text-green-700 dark:text-green-300">{bestMonth.actual_hours}h geleistet</div>
                </div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-3 flex gap-3 items-center">
                <span className="text-3xl">📉</span>
                <div>
                  <div className="text-xs font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide">Schwächster Monat</div>
                  <div className="font-bold text-orange-900 dark:text-orange-100">{MONTH_NAMES_FULL[worstMonth.month - 1]}</div>
                  <div className="text-sm text-orange-700 dark:text-orange-300">{worstMonth.actual_hours}h geleistet</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab navigation */}
          <div className="flex gap-1 border-b">
            {(['overview', 'heatmap', 'ranking'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                {tab === 'overview' && '📊 Monatsverlauf'}
                {tab === 'heatmap' && '🔥 Heatmap'}
                {tab === 'ranking' && '🏆 Ranking'}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hours bar chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 space-y-3">
                <div className="font-semibold text-sm">⏱️ Geleistete Stunden pro Monat</div>
                <MonthBarChart monthly={monthly} metric="actual_hours" color="#3b82f6" />
              </div>

              {/* Vacation bar chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 space-y-3">
                <div className="font-semibold text-sm">🏖️ Urlaubstage pro Monat</div>
                <MonthBarChart monthly={monthly} metric="vacation_days" color="#0d9488" />
              </div>

              {/* Sick days bar chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 space-y-3">
                <div className="font-semibold text-sm">🤒 Kranktage pro Monat</div>
                <MonthBarChart monthly={monthly} metric="sick_days" color="#ef4444" />
              </div>

              {/* Absence bar chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 space-y-3">
                <div className="font-semibold text-sm">📋 Abwesenheitstage pro Monat</div>
                <MonthBarChart monthly={monthly} metric="absence_days" color="#8b5cf6" />
              </div>

              {/* Monthly table */}
              <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold uppercase tracking-wide">
                      <th className="px-3 py-2 text-left">Monat</th>
                      <th className="px-3 py-2 text-right">Ist-h</th>
                      <th className="px-3 py-2 text-right">Soll-h</th>
                      <th className="px-3 py-2 text-right">ÜSt</th>
                      <th className="px-3 py-2 text-right">Urlaub</th>
                      <th className="px-3 py-2 text-right">Krank</th>
                      <th className="px-3 py-2 text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m, i) => {
                      const ot = m.overtime;
                      return (
                        <tr key={m.month} className={`border-t hover:bg-slate-50 dark:hover:bg-slate-700/30 ${i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-800/40'}`}>
                          <td className="px-3 py-2 font-medium">{MONTH_NAMES_FULL[m.month - 1]}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{m.actual_hours}h</td>
                          <td className="px-3 py-2 text-right tabular-nums opacity-60">{m.target_hours}h</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${ot > 0 ? 'text-green-600' : ot < 0 ? 'text-orange-500' : 'opacity-40'}`}>
                            {ot > 0 ? '+' : ''}{ot}h
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-teal-600">{m.vacation_days || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-red-500">{m.sick_days || '—'}</td>
                          <td className="px-3 py-2">
                            {i > 0 && (
                              <span className="text-xs">
                                {m.actual_hours > monthly[i - 1].actual_hours ? '↑' : m.actual_hours < monthly[i - 1].actual_hours ? '↓' : '→'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: Heatmap */}
          {activeTab === 'heatmap' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="font-semibold text-sm">🔥 Stunden-Heatmap: Mitarbeiter × Monat</div>
                <div className="flex items-center gap-1 text-xs opacity-60">
                  <span className="inline-block w-4 h-3 rounded" style={{ background: '#f1f5f9' }}></span> 0
                  <span className="inline-block w-4 h-3 rounded ml-1" style={{ background: '#bfdbfe' }}></span> wenig
                  <span className="inline-block w-4 h-3 rounded ml-1" style={{ background: '#60a5fa' }}></span> mittel
                  <span className="inline-block w-4 h-3 rounded ml-1" style={{ background: '#1d4ed8' }}></span> viel
                </div>
              </div>
              {employees.length > 0
                ? <EmployeeHeatmap employees={employees} maxShow={20} />
                : <div className="text-sm opacity-50 py-4 text-center">Keine Daten für {year}</div>
              }
            </div>
          )}

          {/* Tab: Ranking */}
          {activeTab === 'ranking' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top 10 by hours */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 space-y-2 md:col-span-2">
                <div className="font-semibold text-sm mb-2">⏱️ Top 10 — Meiste Stunden im Jahr</div>
                <div className="space-y-1.5">
                  {topHours.map((emp, i) => {
                    const pct = topHours[0].actual_hours > 0 ? (emp.actual_hours / topHours[0].actual_hours) * 100 : 0;
                    return (
                      <div key={emp.employee_id} className="flex items-center gap-2">
                        <div className="w-6 text-right text-xs font-bold opacity-50">{i + 1}.</div>
                        <div className="w-36 text-sm truncate">{emp.name}</div>
                        <div className="text-xs opacity-50 w-20 truncate">{emp.group}</div>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-1"
                            style={{ width: `${pct}%` }}
                          >
                            {pct > 20 && <span className="text-white text-[9px] font-bold">{emp.actual_hours}h</span>}
                          </div>
                        </div>
                        {pct <= 20 && <div className="text-xs font-semibold w-12 text-right">{emp.actual_hours}h</div>}
                        <Sparkline values={emp.monthly_hours} color="#3b82f6" width={72} height={24} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top overtime */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
                <div className="font-semibold text-sm mb-3">📈 Meiste Überstunden</div>
                <div className="space-y-2">
                  {topOvertime.map((emp, i) => (
                    <div key={emp.employee_id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-bold opacity-40 w-4">{i + 1}.</span>
                      <span className="flex-1 truncate">{emp.name}</span>
                      <span className={`font-semibold tabular-nums ${emp.overtime > 0 ? 'text-green-600' : 'text-orange-500'}`}>
                        {emp.overtime > 0 ? '+' : ''}{emp.overtime}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Most vacation */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
                <div className="font-semibold text-sm mb-3">🏖️ Meiste Urlaubstage</div>
                <div className="space-y-2">
                  {topVacation.map((emp, i) => (
                    <div key={emp.employee_id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-bold opacity-40 w-4">{i + 1}.</span>
                      <span className="flex-1 truncate">{emp.name}</span>
                      <span className="font-semibold tabular-nums text-teal-600">{emp.vacation_days} Tage</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Most sick days */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
                <div className="font-semibold text-sm mb-3">🤒 Meiste Kranktage</div>
                <div className="space-y-2">
                  {topSick.map((emp, i) => (
                    <div key={emp.employee_id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-bold opacity-40 w-4">{i + 1}.</span>
                      <span className="flex-1 truncate">{emp.name}</span>
                      <span className="font-semibold tabular-nums text-red-500">{emp.sick_days} Tage</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* All employees overview table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-x-auto md:col-span-2">
                <div className="px-4 py-3 font-semibold text-sm border-b">👥 Alle Mitarbeiter — Jahresübersicht</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 font-semibold uppercase tracking-wide text-[10px]">
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Gruppe</th>
                      <th className="px-3 py-2 text-right">Ist-h</th>
                      <th className="px-3 py-2 text-right">Soll-h</th>
                      <th className="px-3 py-2 text-right">ÜSt</th>
                      <th className="px-3 py-2 text-right">Urlaub</th>
                      <th className="px-3 py-2 text-right">Krank</th>
                      <th className="px-3 py-2 text-right">Schichten</th>
                      <th className="px-3 py-2 text-center">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, i) => {
                      const ot = emp.overtime;
                      return (
                        <tr key={emp.employee_id} className={`border-t hover:bg-slate-50 dark:hover:bg-slate-700/30 ${i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-800/40'}`}>
                          <td className="px-3 py-1.5 font-medium">{emp.name}</td>
                          <td className="px-3 py-1.5 opacity-60">{emp.group}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{emp.actual_hours}h</td>
                          <td className="px-3 py-1.5 text-right tabular-nums opacity-60">{emp.target_hours}h</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${ot > 0 ? 'text-green-600' : ot < 0 ? 'text-orange-500' : 'opacity-40'}`}>
                            {ot > 0 ? '+' : ''}{ot}h
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-teal-600">{emp.vacation_days || '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-red-500">{emp.sick_days || '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{emp.shifts_count || '—'}</td>
                          <td className="px-3 py-1.5">
                            <Sparkline values={emp.monthly_hours} color="#6366f1" width={60} height={20} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
