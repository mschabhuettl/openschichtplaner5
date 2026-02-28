import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────
interface ScheduleEntry {
  employee_id: number;
  date: string;
  kind: string;
  shift_id: number | null;
  shift_name: string;
  display_name: string;
  color_bk: string;
  color_text: string;
}

interface Employee {
  ID: number;
  NAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
}

interface ShiftDef {
  ID: number;
  NAME: string;
  SHORTNAME: string;
  COLORBK: number;
  COLORTEXT: number;
}

interface MaRotation {
  employee: Employee;
  shiftCounts: Record<string, number>;
  totalShifts: number;
  rotationScore: number; // 0–100, 100 = perfect rotation
  dominantShift: string;
  dominantPct: number;
  weekendShifts: number;
  weekendDays: number; // total weekend days in period
}

interface ShiftFairness {
  shiftName: string;
  gini: number; // 0 = perfectly fair, 1 = completely unfair
  fairnessScore: number; // 0–100
  counts: Array<{ emp: Employee; count: number }>;
  idealCount: number; // average
}

interface BalanceSuggestion {
  employee: Employee;
  shiftName: string;
  deficit: number; // how many shifts below average
  reason: string;
}

function intToHex(n: number): string {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Shannon entropy-based rotation score (per individual)
function calcRotationScore(counts: Record<string, number>, total: number): number {
  if (total === 0) return 0;
  const n = Object.keys(counts).length;
  if (n <= 1) return 0;
  let entropy = 0;
  for (const cnt of Object.values(counts)) {
    const p = cnt / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(n);
  return maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
}

// Gini coefficient: 0 = perfectly equal, 1 = maximally unequal
function giniCoefficient(values: number[]): number {
  const nonZero = values.filter(v => v >= 0);
  if (nonZero.length === 0) return 0;
  const sorted = [...nonZero].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  let giniSum = 0;
  for (let i = 0; i < n; i++) {
    giniSum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return Math.max(0, Math.min(1, giniSum / (n * sum)));
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Gut rotiert';
  if (score >= 40) return 'Mäßig';
  return 'Monoton';
}

function fairnessColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function fairnessLabel(score: number): string {
  if (score >= 75) return 'Fair';
  if (score >= 50) return 'Unausgewogen';
  return 'Unfair';
}

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


const _MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
void _MONTHS;

export default function RotationsAnalyse() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftDefs, setShiftDefs] = useState<ShiftDef[]>([]);
  const [rotations, setRotations] = useState<MaRotation[]>([]);
  const [shiftFairness, setShiftFairness] = useState<ShiftFairness[]>([]);
  const [suggestions, setSuggestions] = useState<BalanceSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'dominant' | 'weekend'>('score');

  const [viewMode, setViewMode] = useState<'table' | 'bars' | 'fairness' | 'weekend'>('table');
  const [months, setMonths] = useState(() => 6);
  const [selectedMA, setSelectedMA] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, shiftRes] = await Promise.all([
        fetch(`${BASE_URL}/api/employees`, { headers: getAuthHeaders() }),
        fetch(`${BASE_URL}/api/shifts`, { headers: getAuthHeaders() }),
      ]);
      const emps: Employee[] = await empRes.json();
      const shifts: ShiftDef[] = await shiftRes.json();
      setEmployees(emps);
      setShiftDefs(shifts);

      // Load schedule for last N months
      const now = new Date();
      const periods: { year: number; month: number }[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
      }

      const scheduleResults = await Promise.all(
        periods.map(p =>
          fetch(`${BASE_URL}/api/schedule?year=${p.year}&month=${p.month}`, { headers: getAuthHeaders() })
            .then(r => r.json() as Promise<ScheduleEntry[]>)
        )
      );
      const allEntries: ScheduleEntry[] = scheduleResults.flat();

      // Aggregate per employee + shift_name
      const byEmp: Record<number, Record<string, number>> = {};
      const weekendByEmp: Record<number, number> = {};

      // Collect all weekend dates in the period
      const allWeekendDates = new Set<string>();
      for (const e of allEntries) {
        if (isWeekend(e.date)) allWeekendDates.add(e.date);
      }

      for (const e of allEntries) {
        if (e.kind !== 'shift' || !e.shift_name) continue;
        if (!byEmp[e.employee_id]) byEmp[e.employee_id] = {};
        byEmp[e.employee_id][e.shift_name] = (byEmp[e.employee_id][e.shift_name] || 0) + 1;

        if (isWeekend(e.date)) {
          weekendByEmp[e.employee_id] = (weekendByEmp[e.employee_id] || 0) + 1;
        }
      }

      const totalWeekendDays = allWeekendDates.size;

      const result: MaRotation[] = emps.map(emp => {
        const shiftCounts = byEmp[emp.ID] || {};
        const totalShifts = Object.values(shiftCounts).reduce((a, b) => a + b, 0);
        const rotationScore = calcRotationScore(shiftCounts, totalShifts);
        const dominant = Object.entries(shiftCounts).sort((a, b) => b[1] - a[1])[0];
        return {
          employee: emp,
          shiftCounts,
          totalShifts,
          rotationScore,
          dominantShift: dominant ? dominant[0] : '—',
          dominantPct: dominant && totalShifts > 0 ? Math.round(dominant[1] / totalShifts * 100) : 0,
          weekendShifts: weekendByEmp[emp.ID] || 0,
          weekendDays: totalWeekendDays,
        };
      }).filter(r => r.totalShifts > 0);

      setRotations(result);

      // ─── Compute per-shift Gini (fairness across employees) ───
      const allShiftNames = Array.from(new Set(result.flatMap(r => Object.keys(r.shiftCounts)))).sort();
      const fairnessData: ShiftFairness[] = allShiftNames.map(sn => {
        const counts = result.map(r => ({ emp: r.employee, count: r.shiftCounts[sn] || 0 }));
        const values = counts.map(c => c.count);
        const gini = giniCoefficient(values);
        const fairnessScore = Math.round((1 - gini) * 100);
        const idealCount = values.reduce((a, b) => a + b, 0) / values.filter(v => v > 0).length || 0;
        return { shiftName: sn, gini, fairnessScore, counts, idealCount };
      });
      setShiftFairness(fairnessData);

      // ─── Auto-Balance Suggestions ───
      const newSuggestions: BalanceSuggestion[] = [];
      for (const sf of fairnessData) {
        if (sf.gini < 0.15) continue; // already fair enough
        // Find employees most below average
        const sorted = [...sf.counts].sort((a, b) => a.count - b.count);
        for (const { emp, count } of sorted.slice(0, 2)) {
          const deficit = Math.round(sf.idealCount - count);
          if (deficit > 0) {
            newSuggestions.push({
              employee: emp,
              shiftName: sf.shiftName,
              deficit,
              reason: `${Math.round(sf.idealCount)} Ø, hat nur ${count} → Gini ${(sf.gini * 100).toFixed(0)}%`,
            });
          }
        }
      }
      // Also flag weekend imbalance
      const weekendCounts = result.map(r => r.weekendShifts);
      const weekendGini = giniCoefficient(weekendCounts);
      if (weekendGini > 0.15) {
        const avgWeekend = weekendCounts.reduce((a, b) => a + b, 0) / weekendCounts.filter(v => v > 0).length;
        const worstWeekend = [...result].sort((a, b) => a.weekendShifts - b.weekendShifts).slice(0, 2);
        for (const r of worstWeekend) {
          const deficit = Math.round(avgWeekend - r.weekendShifts);
          if (deficit > 0) {
            newSuggestions.push({
              employee: r.employee,
              shiftName: '🗓️ Wochenende',
              deficit,
              reason: `Ø ${Math.round(avgWeekend)} WE-Schichten, hat nur ${r.weekendShifts}`,
            });
          }
        }
      }
      setSuggestions(newSuggestions.slice(0, 8));

    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => { load(); }, [load]);

  // Collect all unique shift names for columns
  const allShiftNames = Array.from(
    new Set(rotations.flatMap(r => Object.keys(r.shiftCounts)))
  ).sort();

  // Sort + filter
  const sorted = [...rotations].sort((a, b) => {
    if (sortBy === 'name') return `${a.employee.NAME} ${a.employee.FIRSTNAME}`.localeCompare(`${b.employee.NAME} ${b.employee.FIRSTNAME}`);
    if (sortBy === 'score') return a.rotationScore - b.rotationScore;
    if (sortBy === 'weekend') return b.weekendShifts - a.weekendShifts;
    return b.dominantPct - a.dominantPct;
  });

  const shiftColorMap: Record<string, { bg: string; text: string }> = {};
  for (const s of shiftDefs) {
    shiftColorMap[s.NAME] = { bg: intToHex(s.COLORBK), text: intToHex(s.COLORTEXT) };
  }

  const details = selectedMA !== null ? rotations.find(r => r.employee.ID === selectedMA) : null;

  // Team-level stats
  const avgScore = rotations.length > 0
    ? Math.round(rotations.reduce((a, r) => a + r.rotationScore, 0) / rotations.length)
    : 0;
  const avgTeamFairness = shiftFairness.length > 0
    ? Math.round(shiftFairness.reduce((a, sf) => a + sf.fairnessScore, 0) / shiftFairness.length)
    : 0;
  const weekendGini = giniCoefficient(rotations.map(r => r.weekendShifts));
  const weekendFairness = Math.round((1 - weekendGini) * 100);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🔄 Schicht-Rotations-Analyse
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Rotations-Score (Individuum) · Team-Fairness (Gini) · Wochenend-Verteilung · Auto-Balance
          </p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <select
            value={months}
            onChange={e => setMonths(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          >
            <option value={3}>Letzte 3 Monate</option>
            <option value={6}>Letzte 6 Monate</option>
            <option value={12}>Letztes Jahr</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="score">Sortierung: Monotonie ↑</option>
            <option value="dominant">Sortierung: Dominanz ↓</option>
            <option value="weekend">Sortierung: Wochenende ↓</option>
            <option value="name">Sortierung: Name</option>
          </select>
          <div className="flex rounded border overflow-hidden text-sm">
            {(['table', 'bars', 'fairness', 'weekend'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 ${viewMode === m ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
              >
                {m === 'table' ? 'Tabelle' : m === 'bars' ? 'Balken' : m === 'fairness' ? '⚖️ Fairness' : '🗓️ Wochenende'}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ↺ Laden
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {!loading && rotations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
          {[
            {
              label: 'Mitarbeiter',
              value: rotations.length,
              icon: '👤',
              sub: `aus ${employees.length} gesamt`,
            },
            {
              label: 'Ø Rotations-Score',
              value: avgScore,
              icon: '🔄',
              sub: 'Shannon-Entropie',
              color: scoreColor(avgScore),
            },
            {
              label: 'Team-Fairness',
              value: `${avgTeamFairness}%`,
              icon: '⚖️',
              sub: 'Gini über alle Schichten',
              color: fairnessColor(avgTeamFairness),
            },
            {
              label: 'Wochenend-Fairness',
              value: `${weekendFairness}%`,
              icon: '🗓️',
              sub: 'Gleichm. WE-Verteilung',
              color: fairnessColor(weekendFairness),
            },
            {
              label: 'Monoton (<40)',
              value: rotations.filter(r => r.rotationScore < 40).length,
              icon: '🔴',
              sub: 'MAs wenig Abwechslung',
            },
            {
              label: 'Balance-Vorschläge',
              value: suggestions.length,
              icon: '💡',
              sub: 'Auto-Balance Aktionen',
              color: suggestions.length > 0 ? '#f59e0b' : '#22c55e',
            },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">{kpi.icon} {kpi.label}</div>
              <div className="text-2xl font-bold mt-1" style={kpi.color ? { color: kpi.color } : {}}>{kpi.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <span className="animate-spin mr-2">⏳</span> Lade Schichtdaten…
        </div>
      )}
      {error && <div className="text-red-500 p-4">{error}</div>}

      {/* ═══ TABLE VIEW ═══ */}
      {!loading && !error && viewMode === 'table' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
                <th className="text-left px-3 py-2 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">Mitarbeiter</th>
                <th className="px-3 py-2 text-center">Score</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Schichten</th>
                <th className="px-3 py-2 text-center">Dominant</th>
                <th className="px-3 py-2 text-center" title="Wochenendschichten">🗓️ WE</th>
                {allShiftNames.map(sn => (
                  <th key={sn} className="px-2 py-2 text-center min-w-[60px]">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: shiftColorMap[sn]?.bg ?? '#e5e7eb',
                        color: shiftColorMap[sn]?.text ?? '#111827',
                      }}
                    >
                      {sn.length > 8 ? sn.slice(0, 7) + '…' : sn}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => {
                const isSelected = selectedMA === r.employee.ID;
                return (
                  <tr
                    key={r.employee.ID}
                    onClick={() => setSelectedMA(isSelected ? null : r.employee.ID)}
                    className={`border-b dark:border-gray-700 cursor-pointer transition-colors
                      ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850'}
                      ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50 dark:hover:bg-gray-700'}`}
                  >
                    <td className={`px-3 py-2 font-medium sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850'}`}>
                      {r.employee.NAME}, {r.employee.FIRSTNAME}
                      <span className="ml-1 text-xs text-gray-400">({r.employee.SHORTNAME})</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${r.rotationScore}%`, backgroundColor: scoreColor(r.rotationScore) }}
                          />
                        </div>
                        <span className="font-bold text-xs" style={{ color: scoreColor(r.rotationScore) }}>
                          {r.rotationScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: scoreColor(r.rotationScore) + '20', color: scoreColor(r.rotationScore) }}
                      >
                        {scoreLabel(r.rotationScore)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">{r.totalShifts}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: shiftColorMap[r.dominantShift]?.bg ?? '#e5e7eb',
                          color: shiftColorMap[r.dominantShift]?.text ?? '#111827',
                        }}
                      >
                        {r.dominantShift}
                      </span>
                      <span className="ml-1 text-xs text-gray-400">{r.dominantPct}%</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-semibold ${r.weekendShifts === 0 ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {r.weekendShifts}
                      </span>
                    </td>
                    {allShiftNames.map(sn => {
                      const cnt = r.shiftCounts[sn] || 0;
                      const pct = r.totalShifts > 0 ? cnt / r.totalShifts : 0;
                      return (
                        <td key={sn} className="px-2 py-2 text-center">
                          {cnt > 0 ? (
                            <div
                              className="inline-flex flex-col items-center"
                              title={`${cnt} Schichten (${Math.round(pct * 100)}%)`}
                            >
                              <div
                                className="w-8 rounded-sm"
                                style={{
                                  height: `${Math.max(4, Math.round(pct * 32))}px`,
                                  backgroundColor: shiftColorMap[sn]?.bg ?? '#93c5fd',
                                  opacity: 0.4 + pct * 0.6,
                                }}
                              />
                              <span className="text-xs text-gray-500 mt-0.5">{cnt}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ BAR VIEW ═══ */}
      {!loading && !error && viewMode === 'bars' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(r => (
            <div
              key={r.employee.ID}
              onClick={() => setSelectedMA(selectedMA === r.employee.ID ? null : r.employee.ID)}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow border p-3 cursor-pointer transition-all
                ${selectedMA === r.employee.ID ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-sm">{r.employee.NAME}, {r.employee.FIRSTNAME}</span>
                  <span className="ml-1 text-xs text-gray-400">({r.employee.SHORTNAME})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-500" title="Wochenendschichten">🗓️ {r.weekendShifts}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold" style={{ color: scoreColor(r.rotationScore) }}>
                      {r.rotationScore}
                    </span>
                    <span className="text-xs text-gray-400">/ 100</span>
                  </div>
                </div>
              </div>
              {/* Stacked bar */}
              <div className="flex h-5 rounded overflow-hidden gap-px mb-2">
                {Object.entries(r.shiftCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([sn, cnt]) => {
                    const pct = cnt / r.totalShifts * 100;
                    return (
                      <div
                        key={sn}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: shiftColorMap[sn]?.bg ?? '#93c5fd',
                          minWidth: pct > 3 ? undefined : '2px',
                        }}
                        title={`${sn}: ${cnt} (${Math.round(pct)}%)`}
                        className="transition-all"
                      />
                    );
                  })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(r.shiftCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([sn, cnt]) => (
                    <span
                      key={sn}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: shiftColorMap[sn]?.bg ?? '#e5e7eb',
                        color: shiftColorMap[sn]?.text ?? '#111827',
                      }}
                    >
                      {sn}: {cnt}
                    </span>
                  ))}
                {Object.keys(r.shiftCounts).length > 4 && (
                  <span className="text-xs text-gray-400">+{Object.keys(r.shiftCounts).length - 4} weitere</span>
                )}
              </div>
              <div className="mt-1.5 text-xs text-gray-400">{r.totalShifts} Schichten gesamt</div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ FAIRNESS VIEW ═══ */}
      {!loading && !error && viewMode === 'fairness' && (
        <div className="space-y-4">
          {/* Explanation */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
            <strong>ℹ️ Team-Fairness (Gini-Koeffizient):</strong> Misst wie gleichmäßig jede Schichtart auf alle Mitarbeiter verteilt ist.
            100% = perfekt fair (alle gleich viel), 0% = ein MA macht alle Schichten.
          </div>

          {/* Per-shift fairness bars */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="font-bold text-base mb-3">⚖️ Fairness pro Schichtart</h2>
            <div className="space-y-3">
              {[...shiftFairness].sort((a, b) => a.fairnessScore - b.fairnessScore).map(sf => (
                <div key={sf.shiftName}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium w-24 text-center truncate"
                        style={{
                          backgroundColor: shiftColorMap[sf.shiftName]?.bg ?? '#e5e7eb',
                          color: shiftColorMap[sf.shiftName]?.text ?? '#111827',
                        }}
                      >{sf.shiftName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: fairnessColor(sf.fairnessScore) + '20',
                        color: fairnessColor(sf.fairnessScore),
                      }}>
                        {fairnessLabel(sf.fairnessScore)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Gini: {(sf.gini * 100).toFixed(1)}%</span>
                      <span className="font-bold text-sm" style={{ color: fairnessColor(sf.fairnessScore) }}>
                        {sf.fairnessScore}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${sf.fairnessScore}%`, backgroundColor: fairnessColor(sf.fairnessScore) }}
                    />
                  </div>
                  {/* Distribution across employees */}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {[...sf.counts].filter(c => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 8).map(c => (
                      <span key={c.emp.ID} className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {c.emp.SHORTNAME}: {c.count}
                      </span>
                    ))}
                    {sf.counts.filter(c => c.count > 0).length > 8 && (
                      <span className="text-xs text-gray-400">+{sf.counts.filter(c => c.count > 0).length - 8} weitere</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-Balance Suggestions */}
          {suggestions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="font-bold text-base mb-3">💡 Auto-Balance Vorschläge</h2>
              <p className="text-xs text-gray-500 mb-3">Diese Mitarbeiter sollten bevorzugt für die genannte Schicht eingeplant werden, um die Fairness zu verbessern:</p>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
                    <span className="text-lg">💡</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {s.employee.NAME}, {s.employee.FIRSTNAME}
                        <span className="ml-2 text-xs text-gray-500">({s.employee.SHORTNAME})</span>
                        <span className="ml-2 text-amber-600 dark:text-amber-400 font-bold">→ {s.shiftName}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.reason} · {s.deficit} Schichten Nachholbedarf</div>
                    </div>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded">
                      +{s.deficit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {suggestions.length === 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300 text-center">
              ✅ Keine Balance-Korrekturen nötig — alle Schichten sind fair verteilt!
            </div>
          )}
        </div>
      )}

      {/* ═══ WEEKEND VIEW ═══ */}
      {!loading && !error && viewMode === 'weekend' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">🗓️ Wochenend-Fairness Ranking</h2>
              <div className="text-sm">
                <span className="text-gray-500">Wochenend-Fairness: </span>
                <span className="font-bold" style={{ color: fairnessColor(weekendFairness) }}>{weekendFairness}%</span>
                <span className="ml-2 text-xs text-gray-400">(Gini: {(weekendGini * 100).toFixed(1)}%)</span>
              </div>
            </div>

            {/* Weekend Gini bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Wochenend-Verteilung</span>
                <span>{fairnessLabel(weekendFairness)}</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${weekendFairness}%`, backgroundColor: fairnessColor(weekendFairness) }}
                />
              </div>
            </div>

            {/* Ranking */}
            <div className="space-y-2">
              {(() => {
                const maxWE = Math.max(...rotations.map(r => r.weekendShifts), 1);
                const avgWE = rotations.length > 0
                  ? rotations.reduce((a, r) => a + r.weekendShifts, 0) / rotations.length
                  : 0;
                return [...rotations]
                  .sort((a, b) => b.weekendShifts - a.weekendShifts)
                  .map((r, idx) => {
                    const pct = maxWE > 0 ? (r.weekendShifts / maxWE) * 100 : 0;
                    const aboveAvg = r.weekendShifts > avgWE * 1.2;
                    const belowAvg = r.weekendShifts < avgWE * 0.8;
                    return (
                      <div key={r.employee.ID} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-5 text-right">{idx + 1}.</span>
                        <span className="text-sm font-medium w-36 truncate">{r.employee.NAME}, {r.employee.FIRSTNAME}</span>
                        <span className="text-xs text-gray-400 w-8">{r.employee.SHORTNAME}</span>
                        <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden relative">
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: aboveAvg ? '#ef4444' : belowAvg ? '#f59e0b' : '#22c55e',
                            }}
                          />
                          {/* Average line */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-60"
                            style={{ left: `${(avgWE / maxWE) * 100}%` }}
                            title={`Durchschnitt: ${avgWE.toFixed(1)}`}
                          />
                        </div>
                        <span className={`text-sm font-bold w-8 text-right ${aboveAvg ? 'text-red-500' : belowAvg ? 'text-amber-500' : 'text-green-500'}`}>
                          {r.weekendShifts}
                        </span>
                        <span className="text-xs">
                          {aboveAvg ? '⚠️' : belowAvg ? '📉' : '✅'}
                        </span>
                      </div>
                    );
                  });
              })()}
            </div>

            {/* Legend */}
            <div className="mt-4 flex gap-4 text-xs text-gray-500 border-t dark:border-gray-700 pt-3">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block"/> Im Durchschnitt</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block"/> Unter Ø (20%)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block"/> Über Ø (20%)</span>
              <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-gray-400 inline-block"/> Durchschnitt</span>
            </div>
          </div>

          {/* Weekend auto-balance suggestions */}
          {suggestions.filter(s => s.shiftName.includes('Wochenende')).length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
              <strong className="text-amber-700 dark:text-amber-300">💡 Handlungsbedarf:</strong>
              <ul className="mt-1 space-y-1 text-amber-700 dark:text-amber-300">
                {suggestions.filter(s => s.shiftName.includes('Wochenende')).map((s, i) => (
                  <li key={i}>→ <strong>{s.employee.NAME}, {s.employee.FIRSTNAME}</strong> sollte öfter Wochenendschichten bekommen ({s.reason})</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      {details && viewMode !== 'fairness' && viewMode !== 'weekend' && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-blue-400 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">
              🔍 {details.employee.NAME}, {details.employee.FIRSTNAME}
            </h2>
            <button onClick={() => setSelectedMA(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="text-2xl font-bold" style={{ color: scoreColor(details.rotationScore) }}>{details.rotationScore}</div>
              <div className="text-xs text-gray-500">Rotations-Score</div>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="text-2xl font-bold">{details.totalShifts}</div>
              <div className="text-xs text-gray-500">Schichten gesamt</div>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="text-sm font-bold">{details.dominantShift}</div>
              <div className="text-xs text-gray-500">Dominante Schicht</div>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="text-2xl font-bold text-amber-500">{details.dominantPct}%</div>
              <div className="text-xs text-gray-500">Dominanz-Anteil</div>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{details.weekendShifts}</div>
              <div className="text-xs text-gray-500">🗓️ WE-Schichten</div>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(details.shiftCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([sn, cnt]) => {
                const pct = details.totalShifts > 0 ? cnt / details.totalShifts * 100 : 0;
                return (
                  <div key={sn} className="flex items-center gap-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded w-28 text-center truncate"
                      style={{
                        backgroundColor: shiftColorMap[sn]?.bg ?? '#e5e7eb',
                        color: shiftColorMap[sn]?.text ?? '#111827',
                      }}
                    >{sn}</span>
                    <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: shiftColorMap[sn]?.bg ?? '#93c5fd',
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{cnt}</span>
                    <span className="text-xs text-gray-400 w-8">{Math.round(pct)}%</span>
                  </div>
                );
              })}
          </div>
          {details.rotationScore < 40 && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
              ⚠️ <strong>Handlungsbedarf:</strong> {details.employee.FIRSTNAME} {details.employee.NAME} ist zu{' '}
              <strong>{details.dominantPct}%</strong> in der Schicht "{details.dominantShift}" eingesetzt.
              Eine fairere Rotation würde Burnout reduzieren und die Fairness erhöhen.
            </div>
          )}
          {details.rotationScore >= 70 && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-300">
              ✅ Gute Rotation! {details.employee.FIRSTNAME} {details.employee.NAME} hat eine ausgewogene Schichtverteilung.
            </div>
          )}
          {/* Balance suggestions for this employee */}
          {suggestions.filter(s => s.employee.ID === details.employee.ID).length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm">
              <strong className="text-amber-700 dark:text-amber-300">💡 Auto-Balance:</strong>
              <ul className="mt-1 space-y-0.5 text-amber-700 dark:text-amber-300">
                {suggestions.filter(s => s.employee.ID === details.employee.ID).map((s, i) => (
                  <li key={i}>→ Bevorzugt für <strong>{s.shiftName}</strong> einplanen ({s.reason})</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && rotations.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          Keine Schichtdaten für den gewählten Zeitraum gefunden.
        </div>
      )}
    </div>
  );
}
