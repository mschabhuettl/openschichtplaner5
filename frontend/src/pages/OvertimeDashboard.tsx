/**
 * OvertimeDashboard — Q071
 *
 * Visual Überstunden-Dashboard (Soll vs. Ist pro Mitarbeiter)
 * - Monat/Jahr-Selektor
 * - Gruppen-Filter
 * - CSS-Balkendiagramm (Soll vs. Ist)
 * - Farbkodierung: Rot = >10% Minus, Orange = leicht unter Soll, Grün = on track, Blau = Überstunden
 * - Summary-Karten oben
 * - Sortierbare Tabelle + CSV-Export
 * - Nur Admin / Planer
 */

import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import type { OvertimeDashboardRow, OvertimeDashboardResponse } from '../api/client';
import type { Group } from '../types';

// ── Colour helpers ────────────────────────────────────────────────────────────

function barColor(actual: number, expected: number): string {
  if (expected === 0) return 'bg-gray-400';
  const diff = actual - expected;
  const pct = diff / expected;
  if (diff > 0) return 'bg-blue-500';          // Überstunden
  if (pct >= -0.05) return 'bg-green-500';      // ≤ 5% unter Soll → on track
  if (pct >= -0.1) return 'bg-orange-400';      // 5–10% unter Soll
  return 'bg-red-500';                           // > 10% unter Soll
}

function badgeClass(actual: number, expected: number): string {
  if (expected === 0) return 'bg-gray-100 text-gray-600';
  const diff = actual - expected;
  const pct = diff / expected;
  if (diff > 0) return 'bg-blue-100 text-blue-700 border border-blue-200';
  if (pct >= -0.05) return 'bg-green-100 text-green-700 border border-green-200';
  if (pct >= -0.1) return 'bg-orange-100 text-orange-700 border border-orange-200';
  return 'bg-red-100 text-red-700 border border-red-200';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SollIstBar({ row, maxHours }: { row: OvertimeDashboardRow; maxHours: number }) {
  const sollPct = maxHours > 0 ? (row.expected_hours / maxHours) * 100 : 0;
  const istPct  = maxHours > 0 ? (row.actual_hours  / maxHours) * 100 : 0;
  const color = barColor(row.actual_hours, row.expected_hours);

  return (
    <div className="flex flex-col gap-0.5" style={{ minWidth: 140 }}>
      {/* Ist-bar (coloured) */}
      <div className="flex items-center gap-1.5 text-xs">
        <div className="w-8 text-right text-gray-500 shrink-0">{row.actual_hours.toFixed(1)}h</div>
        <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden relative">
          <div
            className={`h-full rounded ${color} transition-all duration-300`}
            style={{ width: `${Math.min(istPct, 100)}%` }}
          />
        </div>
        <div className="w-8 text-gray-400 text-xs shrink-0">Ist</div>
      </div>
      {/* Soll-bar (dashed line as gray background) */}
      <div className="flex items-center gap-1.5 text-xs">
        <div className="w-8 text-right text-gray-400 shrink-0">{row.expected_hours.toFixed(1)}h</div>
        <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden relative">
          <div
            className="h-full bg-gray-300 rounded"
            style={{ width: `${Math.min(sollPct, 100)}%` }}
          />
          {/* dashed overlay line at soll position */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-500"
            style={{ left: `${Math.min(sollPct, 100)}%` }}
          />
        </div>
        <div className="w-8 text-gray-400 text-xs shrink-0">Soll</div>
      </div>
    </div>
  );
}

type SortKey = 'name' | 'expected' | 'actual' | 'diff';
type SortDir = 'asc' | 'desc';

const MONTHS = [
  'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(rows: OvertimeDashboardRow[], year: number, month: number) {
  const header = ['Mitarbeiter', 'Kürzel', 'Soll-Std', 'Ist-Std', 'Differenz', 'Schichten'];
  const lines = rows.map(r => [
    `"${r.employee_name}"`,
    r.employee_short,
    r.expected_hours.toFixed(2),
    r.actual_hours.toFixed(2),
    r.difference.toFixed(2),
    r.shifts_count,
  ].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ueberstunden_${year}_${String(month).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OvertimeDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [groups, setGroups] = useState<Group[]>([]);
  const [data, setData] = useState<OvertimeDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('diff');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getOvertimeDashboard(year, month, groupId)
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e?.message ?? 'Unbekannter Fehler');
        setLoading(false);
      });
  }, [year, month, groupId]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  const rows = useMemo(() => data?.employees ?? [], [data]);

  const maxHours = useMemo(() =>
    Math.max(...rows.map(r => Math.max(r.expected_hours, r.actual_hours)), 1),
    [rows]
  );

  // Derived stats
  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const totalExpected = rows.reduce((s, r) => s + r.expected_hours, 0);
    const totalActual   = rows.reduce((s, r) => s + r.actual_hours,   0);
    const totalDiff     = totalActual - totalExpected;
    const overtimeHours = rows.filter(r => r.difference > 0).reduce((s, r) => s + r.difference, 0);
    const underHours    = rows.filter(r => r.difference < 0).reduce((s, r) => s + Math.abs(r.difference), 0);
    const mostOver  = [...rows].sort((a, b) => b.difference - a.difference)[0];
    const mostUnder = [...rows].sort((a, b) => a.difference - b.difference)[0];
    return { totalExpected, totalActual, totalDiff, overtimeHours, underHours, mostOver, mostUnder };
  }, [rows]);

  const sorted = useMemo(() => {
    const lo = search.toLowerCase();
    return [...rows]
      .filter(r => !lo || r.employee_name.toLowerCase().includes(lo) || r.employee_short.toLowerCase().includes(lo))
      .sort((a, b) => {
        let av: number | string, bv: number | string;
        switch (sortKey) {
          case 'name':     av = a.employee_name; bv = b.employee_name; break;
          case 'expected': av = a.expected_hours; bv = b.expected_hours; break;
          case 'actual':   av = a.actual_hours;   bv = b.actual_hours;   break;
          case 'diff':     av = a.difference;      bv = b.difference;     break;
          default: av = bv = '';
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [rows, sortKey, sortDir, search]);

  const SortTh = ({ label, skey, align = 'right' }: { label: string; skey: SortKey; align?: 'left' | 'right' | 'center' }) => (
    <th scope="col"
      className={`px-3 py-2 text-${align} border border-gray-200 cursor-pointer hover:bg-slate-200 select-none whitespace-nowrap`}
      onClick={() => handleSort(skey)}
    >
      {label}{sortIcon(skey)}
    </th>
  );

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-gray-800">📊 Überstunden-Dashboard</h1>

        {/* Month navigation */}
        <div className="flex items-center gap-1">
          <button
            aria-label="Vorheriger Monat"
            onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
          >‹</button>
          <span className="font-semibold text-gray-700 min-w-[110px] text-center text-sm">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            aria-label="Nächster Monat"
            onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
          >›</button>
        </div>

        {/* Group filter */}
        <select
          value={groupId ?? ''}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-1.5 bg-white border rounded shadow-sm text-sm"
          aria-label="Gruppe filtern"
        >
          <option value="">Alle Gruppen</option>
          {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border rounded shadow-sm text-sm w-44 bg-white"
          aria-label="Mitarbeiter suchen"
        />

        {loading && <span className="text-sm text-blue-500 animate-pulse">Lade…</span>}
        {error && <span className="text-sm text-red-500">Fehler: {error}</span>}

        <span className="text-sm text-gray-500 ml-auto">{sorted.length} Mitarbeiter</span>

        {/* CSV Export */}
        <button
          onClick={() => exportCSV(sorted, year, month)}
          disabled={sorted.length === 0}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm rounded shadow-sm flex items-center gap-1"
          aria-label="Als CSV exportieren"
        >
          📥 <span className="hidden sm:inline">CSV Export</span>
        </button>
      </div>

      {/* ── Summary cards ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
            <div className="text-lg font-bold text-gray-600">{stats.totalExpected.toFixed(0)}h</div>
            <div className="text-xs text-gray-500">Gesamt Soll</div>
          </div>
          <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
            <div className="text-lg font-bold text-blue-700">{stats.totalActual.toFixed(0)}h</div>
            <div className="text-xs text-gray-500">Gesamt Ist</div>
          </div>
          <div className={`rounded-lg border p-3 shadow-sm text-center ${stats.totalDiff >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`text-lg font-bold ${stats.totalDiff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {stats.totalDiff >= 0 ? '+' : ''}{stats.totalDiff.toFixed(0)}h
            </div>
            <div className={`text-xs ${stats.totalDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>Saldo</div>
          </div>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 shadow-sm text-center">
            <div className="text-lg font-bold text-blue-700">+{stats.overtimeHours.toFixed(0)}h</div>
            <div className="text-xs text-blue-600">Überstunden total</div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-3 shadow-sm text-center">
            <div className="text-lg font-bold text-red-700">-{stats.underHours.toFixed(0)}h</div>
            <div className="text-xs text-red-600">Minusstunden total</div>
          </div>
          {stats.mostOver && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 shadow-sm text-center col-span-1">
              <div className="text-sm font-bold text-blue-700 truncate" title={stats.mostOver.employee_name}>
                {stats.mostOver.employee_short || stats.mostOver.employee_name.split(',')[0]}
              </div>
              <div className="text-xs font-semibold text-blue-600">+{stats.mostOver.difference.toFixed(1)}h</div>
              <div className="text-xs text-blue-500">Top Überstunden</div>
            </div>
          )}
          {stats.mostUnder && stats.mostUnder.difference < 0 && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-3 shadow-sm text-center col-span-1">
              <div className="text-sm font-bold text-red-700 truncate" title={stats.mostUnder.employee_name}>
                {stats.mostUnder.employee_short || stats.mostUnder.employee_name.split(',')[0]}
              </div>
              <div className="text-xs font-semibold text-red-600">{stats.mostUnder.difference.toFixed(1)}h</div>
              <div className="text-xs text-red-500">Meiste Minusstunden</div>
            </div>
          )}
        </div>
      )}

      {/* ── Bar chart ── */}
      {sorted.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Soll vs. Ist — {MONTHS[month - 1]} {year}</h2>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Überstunden</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> On track (≤5% unter)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> Leicht unter (5–10%)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Stark unter (&gt;10%)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-gray-300 inline-block" /> Soll</span>
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-2" style={{ minWidth: sorted.length * 60 }}>
              {sorted.map(row => {
                const color = barColor(row.actual_hours, row.expected_hours);
                const istPct  = maxHours > 0 ? (row.actual_hours  / maxHours) * 100 : 0;
                const sollPct = maxHours > 0 ? (row.expected_hours / maxHours) * 100 : 0;
                return (
                  <div
                    key={row.employee_id}
                    className="flex flex-col items-center gap-1"
                    style={{ width: 52, minWidth: 52 }}
                    title={`${row.employee_name}\nSoll: ${row.expected_hours.toFixed(1)}h\nIst: ${row.actual_hours.toFixed(1)}h\nDiff: ${row.difference >= 0 ? '+' : ''}${row.difference.toFixed(1)}h`}
                  >
                    {/* Bar column */}
                    <div className="relative w-8 flex flex-col justify-end" style={{ height: 120 }}>
                      {/* Soll marker */}
                      <div
                        className="absolute left-0 right-0 border-t-2 border-dashed border-gray-400"
                        style={{ bottom: `${sollPct}%` }}
                      />
                      {/* Ist bar */}
                      <div
                        className={`w-full rounded-t ${color} transition-all duration-300`}
                        style={{ height: `${Math.max(istPct, 1)}%` }}
                      />
                    </div>
                    {/* Label */}
                    <div className="text-xs text-gray-600 truncate w-full text-center" title={row.employee_name}>
                      {row.employee_short || row.employee_name.split(',')[0].substring(0, 4)}
                    </div>
                    {/* Diff badge */}
                    <div className={`text-xs px-1 rounded font-semibold ${badgeClass(row.actual_hours, row.expected_hours)}`}>
                      {row.difference >= 0 ? '+' : ''}{row.difference.toFixed(0)}h
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="border-collapse text-sm w-full min-w-[650px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              <SortTh label="Mitarbeiter" skey="name" align="left" />
              <th scope="col" className="px-3 py-2 text-left border border-gray-200 text-xs font-semibold text-gray-500">Kürzel</th>
              <SortTh label="Soll-Std" skey="expected" />
              <SortTh label="Ist-Std" skey="actual" />
              <SortTh label="Differenz" skey="diff" align="center" />
              <th scope="col" className="px-3 py-2 text-right border border-gray-200 text-xs font-semibold text-gray-500">Schichten</th>
              <th scope="col" className="px-3 py-2 border border-gray-200 text-xs font-semibold text-gray-500">Balken</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const diff = row.difference;
              return (
                <tr
                  key={row.employee_id}
                  className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                >
                  <td className="px-3 py-2 border border-gray-100 font-medium whitespace-nowrap">{row.employee_name}</td>
                  <td className="px-3 py-2 border border-gray-100 text-xs text-gray-500 font-mono">{row.employee_short || '—'}</td>
                  <td className="px-3 py-2 border border-gray-100 text-right text-gray-500">{row.expected_hours.toFixed(1)}h</td>
                  <td className="px-3 py-2 border border-gray-100 text-right font-semibold text-gray-700">{row.actual_hours.toFixed(1)}h</td>
                  <td className="px-3 py-2 border border-gray-100 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badgeClass(row.actual_hours, row.expected_hours)}`}>
                      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}h
                    </span>
                  </td>
                  <td className="px-3 py-2 border border-gray-100 text-right text-gray-500 tabular-nums">{row.shifts_count}</td>
                  <td className="px-3 py-2 border border-gray-100">
                    <SollIstBar row={row} maxHours={maxHours} />
                  </td>
                </tr>
              );
            })}

            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">
                  {search ? 'Keine Mitarbeiter gefunden.' : 'Keine Daten für diesen Monat / diese Gruppe.'}
                </td>
              </tr>
            )}
          </tbody>

          {sorted.length > 0 && stats && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-gray-300">
                <td className="px-3 py-2 border border-gray-200" colSpan={2}>Gesamt ({sorted.length} MA)</td>
                <td className="px-3 py-2 border border-gray-200 text-right">{stats.totalExpected.toFixed(1)}h</td>
                <td className="px-3 py-2 border border-gray-200 text-right">{stats.totalActual.toFixed(1)}h</td>
                <td className="px-3 py-2 border border-gray-200 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${stats.totalDiff >= 0 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                    {stats.totalDiff >= 0 ? '+' : ''}{stats.totalDiff.toFixed(1)}h
                  </span>
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">
                  {sorted.reduce((s, r) => s + r.shifts_count, 0)}
                </td>
                <td className="px-3 py-2 border border-gray-200" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
