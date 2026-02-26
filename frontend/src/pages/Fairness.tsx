import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Group } from '../types';

// ── Types ──────────────────────────────────────────────────────
interface FairnessEmployee {
  employee_id: number;
  name: string;
  shortname: string;
  total: number;
  weekend: number;
  night: number;
  holiday: number;
}

interface FairnessMetrics {
  weekend_score: number;
  night_score: number;
  holiday_score: number;
  total_score: number;
  overall: number;
  avg_weekend: number;
  avg_night: number;
  avg_holiday: number;
  avg_total: number;
}

interface FairnessResponse {
  year: number;
  employees: FairnessEmployee[];
  fairness: FairnessMetrics;
}

// ── Score badge ────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? 'bg-green-100 text-green-800 border-green-300'
    : score >= 70 ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
    : 'bg-red-100 text-red-800 border-red-300';
  const emoji = score >= 90 ? '✅' : score >= 70 ? '⚠️' : '🔴';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${color}`}>
      {emoji} {score.toFixed(1)}
    </span>
  );
}

// ── Mini bar chart cell ────────────────────────────────────────
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs w-5 text-right tabular-nums">{value}</span>
    </div>
  );
}

// ── Deviation indicator ────────────────────────────────────────
function DeviationDot({ value, avg }: { value: number; avg: number }) {
  if (avg === 0) return <span className="text-gray-400">—</span>;
  const diff = value - avg;
  const pct = Math.round((diff / avg) * 100);
  if (Math.abs(pct) < 10) return <span className="text-gray-500 text-xs">≈</span>;
  const color = diff > 0 ? 'text-red-600' : 'text-green-600';
  return <span className={`text-xs font-medium ${color}`}>{diff > 0 ? '+' : ''}{pct}%</span>;
}

// ── Main component ─────────────────────────────────────────────
export default function Fairness() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [data, setData] = useState<FairnessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'weekend' | 'night' | 'holiday'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Load groups once
  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/fairness?year=${year}${groupId ? `&group_id=${groupId}` : ''}`
      );
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [year, groupId]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(a => !a);
    else { setSortBy(col); setSortAsc(true); }
  };

  const employees = data?.employees ?? [];
  const metrics = data?.fairness;

  const sorted = [...employees].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'name') diff = a.name.localeCompare(b.name);
    else diff = (a[sortBy] as number) - (b[sortBy] as number);
    return sortAsc ? diff : -diff;
  });

  const maxTotal   = Math.max(...employees.map(e => e.total), 1);
  const maxWeekend = Math.max(...employees.map(e => e.weekend), 1);
  const maxNight   = Math.max(...employees.map(e => e.night), 1);
  const maxHoliday = Math.max(...employees.map(e => e.holiday), 1);

  const SortTh = ({ col, label }: { col: typeof sortBy; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      {label}
      {sortBy === col && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
    </th>
  );

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            ⚖️ Fairness-Score
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Wie gleichmäßig sind Wochenend-, Nacht- und Feiertagsschichten verteilt?
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Year picker */}
          <select
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {/* Group picker */}
          <select
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={groupId ?? ''}
            onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => (
              <option key={g.ID} value={g.ID}>{g.NAME}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Gesamt', score: metrics.total_score, avg: metrics.avg_total, icon: '📋', unit: 'Schichten' },
            { label: 'Wochenende', score: metrics.weekend_score, avg: metrics.avg_weekend, icon: '📅', unit: 'Sa/So-Schichten' },
            { label: 'Nachtschichten', score: metrics.night_score, avg: metrics.avg_night, icon: '🌙', unit: 'Nachtschichten' },
            { label: 'Feiertage', score: metrics.holiday_score, avg: metrics.avg_holiday, icon: '🎉', unit: 'Feiertagsschichten' },
          ].map(({ label, score, avg, icon, unit }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{icon}</span>
                <span className="text-sm font-medium text-gray-600">{label}</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-800">{score.toFixed(0)}</div>
                  <div className="text-xs text-gray-400">/ 100 Punkte</div>
                </div>
                <ScoreBadge score={score} />
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <div className="mt-1.5 text-xs text-gray-500">Ø {avg.toFixed(1)} {unit}/MA</div>
            </div>
          ))}
        </div>
      )}

      {/* Overall score banner */}
      {metrics && (
        <div className={`rounded-xl p-4 border-2 flex items-center gap-4 ${
          metrics.overall >= 90 ? 'bg-green-50 border-green-300'
          : metrics.overall >= 70 ? 'bg-yellow-50 border-yellow-300'
          : 'bg-red-50 border-red-300'
        }`}>
          <div className="text-4xl">
            {metrics.overall >= 90 ? '🏆' : metrics.overall >= 70 ? '⚠️' : '🚨'}
          </div>
          <div>
            <div className="text-lg font-bold text-gray-800">
              Gesamt-Fairness: {metrics.overall.toFixed(1)} / 100
            </div>
            <div className="text-sm text-gray-600">
              {metrics.overall >= 90
                ? 'Ausgezeichnete Verteilung — die Schichten sind sehr gleichmäßig aufgeteilt.'
                : metrics.overall >= 70
                ? 'Moderate Verteilung — es gibt noch Verbesserungspotenzial.'
                : 'Ungleiche Verteilung — einige Mitarbeiter tragen deutlich mehr Belastung.'}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-gray-500">{employees.length} Mitarbeiter · {year}</div>
          </div>
        </div>
      )}

      {/* Employee table */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Lade Daten…
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-1">
          <span className="text-3xl">📭</span>
          <span>Keine Schichtdaten für {year} gefunden.</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">👥 Mitarbeiter-Übersicht</span>
            <span className="ml-auto text-xs text-gray-400">{employees.length} Einträge · Klick auf Spalte zum Sortieren</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <SortTh col="name" label="Mitarbeiter" />
                  <SortTh col="total" label="Gesamt" />
                  <SortTh col="weekend" label="Wochenende" />
                  <SortTh col="night" label="Nacht" />
                  <SortTh col="holiday" label="Feiertag" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Abweichung</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((emp, i) => (
                  <tr key={emp.employee_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      <span className="inline-block bg-gray-200 text-gray-600 rounded text-xs px-1.5 py-0.5 mr-2 font-mono">
                        {emp.shortname}
                      </span>
                      {emp.name}
                    </td>
                    <td className="px-3 py-2">
                      <Bar value={emp.total} max={maxTotal} color="bg-blue-400" />
                    </td>
                    <td className="px-3 py-2">
                      <Bar value={emp.weekend} max={maxWeekend} color="bg-purple-400" />
                    </td>
                    <td className="px-3 py-2">
                      <Bar value={emp.night} max={maxNight} color="bg-indigo-500" />
                    </td>
                    <td className="px-3 py-2">
                      <Bar value={emp.holiday} max={maxHoliday} color="bg-orange-400" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-500">Σ</span>
                        <DeviationDot value={emp.total} avg={metrics?.avg_total ?? 0} />
                        <span className="text-xs text-gray-500">🌙</span>
                        <DeviationDot value={emp.night} avg={metrics?.avg_night ?? 0} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-400 inline-block"/>&nbsp;Gesamt-Schichten</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-400 inline-block"/>&nbsp;Wochenend-Schichten (Sa+So)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500 inline-block"/>&nbsp;Nachtschichten (ab 20:00)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-400 inline-block"/>&nbsp;Feiertagsschichten</span>
            <span className="ml-auto">Abweichung: % über/unter Durchschnitt</span>
          </div>
        </div>
      )}

      {/* How is the score calculated? */}
      <details className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
        <summary className="font-semibold cursor-pointer text-gray-700 select-none">
          ℹ️ Wie wird der Score berechnet?
        </summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>Der Fairness-Score basiert auf dem <strong>Variationskoeffizienten (CV)</strong> der Schichtverteilung:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>CV = Standardabweichung / Mittelwert</strong> — misst die relative Streuung</li>
            <li>Score = max(0, 100 − CV × 100)</li>
            <li>100 = perfekte Gleichverteilung, 0 = maximale Ungleichheit</li>
            <li>Es werden nur aktive Mitarbeiter mit mindestens einer Schicht berücksichtigt</li>
          </ul>
          <p className="text-gray-500 italic">Nachtschichten: Schichtbeginn ≥ 20:00 Uhr</p>
        </div>
      </details>
    </div>
  );
}
