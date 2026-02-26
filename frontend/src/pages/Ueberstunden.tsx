import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import type { OvertimeRow, OvertimeSummary } from '../api/client';
import type { Group } from '../types';

type SortKey = 'name' | 'soll' | 'ist' | 'delta';
type SortDir = 'asc' | 'desc';

function DeltaBadge({ value }: { value: number }) {
  const isPos = value >= 0;
  return (
    <span className={`px-2 py-0.5 rounded font-semibold text-sm whitespace-nowrap ${
      isPos ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
    }`}>
      {isPos ? '+' : ''}{value.toFixed(1)}h
    </span>
  );
}

function DeltaBar({ value, max }: { value: number; max: number }) {
  const clamp = Math.min(Math.abs(value) / (max || 1), 1);
  const width = `${(clamp * 48).toFixed(1)}%`;
  const isPos = value >= 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex h-3 rounded overflow-hidden bg-gray-100 min-w-[90px]">
        {isPos ? (
          <>
            <div className="flex-1" />
            <div className="w-px bg-gray-400" />
            <div className="flex-1 relative">
              <div className="absolute left-0 top-0 h-full bg-green-500 rounded-r" style={{ width }} />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 relative">
              <div className="absolute right-0 top-0 h-full bg-red-500 rounded-l" style={{ width }} />
            </div>
            <div className="w-px bg-gray-400" />
            <div className="flex-1" />
          </>
        )}
      </div>
      <DeltaBadge value={value} />
    </div>
  );
}

export default function Ueberstunden() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [groups, setGroups] = useState<Group[]>([]);
  const [rows, setRows] = useState<OvertimeRow[]>([]);
  const [summary, setSummary] = useState<OvertimeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getOvertimeSummary(year, groupId)
      .then(data => {
        setRows(data.employees);
        setSummary(data.summary);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [year, groupId]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  const maxDelta = useMemo(() => Math.max(...rows.map(r => Math.abs(r.delta)), 1), [rows]);

  const sorted = useMemo(() => {
    const searchLow = search.toLowerCase();
    return [...rows]
      .filter(r => !searchLow || r.name.toLowerCase().includes(searchLow) || (r.shortname || '').toLowerCase().includes(searchLow))
      .sort((a, b) => {
        let av: number | string, bv: number | string;
        switch (sortKey) {
          case 'name':  av = a.name;  bv = b.name;  break;
          case 'soll':  av = a.soll;  bv = b.soll;  break;
          case 'ist':   av = a.ist;   bv = b.ist;   break;
          case 'delta': av = a.delta; bv = b.delta; break;
          default:      av = ''; bv = '';
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [rows, sortKey, sortDir, search]);

  const SortTh = ({
    label, skey, align = 'right',
  }: { label: string; skey: SortKey; align?: 'left' | 'right' | 'center' }) => (
    <th
      className={`px-3 py-2 text-${align} border border-gray-200 cursor-pointer hover:bg-slate-200 select-none whitespace-nowrap`}
      onClick={() => handleSort(skey)}
    >
      {label}{sortIcon(skey)}
    </th>
  );

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">⏰ Überstunden</h1>

        {/* Year navigation */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">‹</button>
          <span className="font-semibold text-gray-700 min-w-[50px] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">›</button>
        </div>

        {/* Group filter */}
        <select
          value={groupId ?? ''}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-1.5 bg-white border rounded shadow-sm text-sm"
        >
          <option value="">Alle Mitarbeiter</option>
          {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border rounded shadow-sm text-sm w-44 bg-white"
        />

        {loading && <span className="text-sm text-blue-500 animate-pulse">Lade...</span>}
        {error && <span className="text-sm text-red-500">Fehler: {error}</span>}
        <span className="text-sm text-gray-500 ml-auto">{sorted.length} Mitarbeiter</span>
        <button
          onClick={() => window.print()}
          className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
          title="Seite drucken"
        >
          🖨️ <span className="hidden sm:inline">Drucken</span>
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
            <div className="text-xl font-bold text-gray-600">{summary.total_soll.toFixed(0)}h</div>
            <div className="text-xs text-gray-400">Gesamt Soll</div>
          </div>
          <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
            <div className="text-xl font-bold text-blue-700">{summary.total_ist.toFixed(0)}h</div>
            <div className="text-xs text-gray-400">Gesamt Ist</div>
          </div>
          <div className={`rounded-lg border p-3 shadow-sm text-center ${summary.total_delta >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`text-xl font-bold ${summary.total_delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {summary.total_delta >= 0 ? '+' : ''}{summary.total_delta.toFixed(0)}h
            </div>
            <div className={`text-xs ${summary.total_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>Gesamtdifferenz</div>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-3 shadow-sm text-center">
            <div className="text-xl font-bold text-green-700">{summary.plus_count}</div>
            <div className="text-xs text-green-600">MA mit Plusstunden</div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-3 shadow-sm text-center">
            <div className="text-xl font-bold text-red-700">{summary.minus_count}</div>
            <div className="text-xs text-red-600">MA mit Minusstunden</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="border-collapse text-sm w-full min-w-[600px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              <th
                className="px-3 py-2 text-left border border-gray-200 cursor-pointer hover:bg-slate-200 select-none sticky left-0 bg-slate-100 z-10 min-w-[200px]"
                onClick={() => handleSort('name')}
              >
                Mitarbeiter{sortIcon('name')}
              </th>
              <th className="px-3 py-2 text-left border border-gray-200 font-semibold text-xs">Kürzel</th>
              <SortTh label="Soll-Std" skey="soll" />
              <SortTh label="Ist-Std" skey="ist" />
              <SortTh label="Differenz" skey="delta" align="center" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.employee_id}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
              >
                <td className="sticky left-0 bg-inherit px-3 py-2 border border-gray-100 font-medium whitespace-nowrap">
                  {r.name}
                </td>
                <td className="px-3 py-2 border border-gray-100 text-xs text-gray-500 font-mono">
                  {r.shortname || '—'}
                </td>
                <td className="px-3 py-2 border border-gray-100 text-right text-gray-500">
                  {r.soll.toFixed(1)}h
                </td>
                <td className="px-3 py-2 border border-gray-100 text-right font-semibold text-gray-700">
                  {r.ist.toFixed(1)}h
                </td>
                <td className="px-3 py-2 border border-gray-100">
                  <DeltaBar value={r.delta} max={maxDelta} />
                </td>
              </tr>
            ))}

            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">
                  {search ? 'Keine Mitarbeiter gefunden' : 'Keine Daten für dieses Jahr / diese Gruppe'}
                </td>
              </tr>
            )}
          </tbody>

          {sorted.length > 0 && summary && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-gray-300">
                <td className="sticky left-0 bg-slate-100 px-3 py-2 border border-gray-200" colSpan={2}>
                  Gesamt ({sorted.length} MA)
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">
                  {summary.total_soll.toFixed(1)}h
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">
                  {summary.total_ist.toFixed(1)}h
                </td>
                <td className="px-3 py-2 border border-gray-200">
                  <DeltaBar value={summary.total_delta} max={Math.max(Math.abs(summary.total_delta), 1)} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
