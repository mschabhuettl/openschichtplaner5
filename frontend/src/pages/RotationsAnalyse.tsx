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
}

function intToHex(n: number): string {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Shannon entropy-based rotation score
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'dominant'>('score');

  const [viewMode, setViewMode] = useState<'table' | 'bars'>('table');
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
      for (const e of allEntries) {
        if (e.kind !== 'shift' || !e.shift_name) continue;
        if (!byEmp[e.employee_id]) byEmp[e.employee_id] = {};
        byEmp[e.employee_id][e.shift_name] = (byEmp[e.employee_id][e.shift_name] || 0) + 1;
      }

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
        };
      }).filter(r => r.totalShifts > 0);

      setRotations(result);
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
    if (sortBy === 'score') return a.rotationScore - b.rotationScore; // lowest first (most monoton at top)
    return b.dominantPct - a.dominantPct;
  });

  const shiftColorMap: Record<string, { bg: string; text: string }> = {};
  for (const s of shiftDefs) {
    shiftColorMap[s.NAME] = { bg: intToHex(s.COLORBK), text: intToHex(s.COLORTEXT) };
  }

  const details = selectedMA !== null ? rotations.find(r => r.employee.ID === selectedMA) : null;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🔄 Schicht-Rotations-Analyse
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Wie abwechslungsreich sind die Schichteinsätze? 100 = perfekte Rotation, 0 = immer dieselbe Schicht
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
            onChange={e => setSortBy(e.target.value as 'name' | 'score' | 'dominant')}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="score">Sortierung: Monotonie ↑</option>
            <option value="dominant">Sortierung: Dominanz ↓</option>
            <option value="name">Sortierung: Name</option>
          </select>
          <div className="flex rounded border overflow-hidden text-sm">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
            >Tabelle</button>
            <button
              onClick={() => setViewMode('bars')}
              className={`px-3 py-1 ${viewMode === 'bars' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
            >Balken</button>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            {
              label: 'Mitarbeiter analysiert',
              value: rotations.length,
              icon: '👤',
              sub: `aus ${employees.length} gesamt`,
            },
            {
              label: 'Ø Rotations-Score',
              value: Math.round(rotations.reduce((a, r) => a + r.rotationScore, 0) / rotations.length),
              icon: '🔄',
              sub: 'über alle MAs',
              color: scoreColor(Math.round(rotations.reduce((a, r) => a + r.rotationScore, 0) / rotations.length)),
            },
            {
              label: 'Monoton (<40)',
              value: rotations.filter(r => r.rotationScore < 40).length,
              icon: '🔴',
              sub: 'MAs mit wenig Abwechslung',
            },
            {
              label: 'Gut rotiert (≥70)',
              value: rotations.filter(r => r.rotationScore >= 70).length,
              icon: '🟢',
              sub: 'MAs mit guter Rotation',
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

      {/* TABLE VIEW */}
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

      {/* BAR VIEW */}
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
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold" style={{ color: scoreColor(r.rotationScore) }}>
                    {r.rotationScore}
                  </span>
                  <span className="text-xs text-gray-400">/ 100</span>
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

      {/* Detail Panel */}
      {details && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-blue-400 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">
              🔍 {details.employee.NAME}, {details.employee.FIRSTNAME}
            </h2>
            <button onClick={() => setSelectedMA(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
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
