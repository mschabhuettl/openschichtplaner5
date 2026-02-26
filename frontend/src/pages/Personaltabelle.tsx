import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import type { EmployeeStats } from '../api/client';

type SortKey = keyof EmployeeStats;
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; align?: 'right' | 'center'; width?: string }[] = [
  { key: 'employee_name', label: 'Name', width: 'min-w-[160px]' },
  { key: 'employee_short', label: 'Kürzel', align: 'center', width: 'w-20' },
  { key: 'group_name', label: 'Gruppe', width: 'min-w-[120px]' },
  { key: 'target_hours', label: 'Soll (h)', align: 'right', width: 'w-24' },
  { key: 'actual_hours', label: 'Ist (h)', align: 'right', width: 'w-24' },
  { key: 'overtime_hours', label: 'Differenz (h)', align: 'right', width: 'w-28' },
  { key: 'shifts_count', label: 'Schichten', align: 'right', width: 'w-24' },
  { key: 'vacation_used', label: 'Urlaub (T)', align: 'right', width: 'w-24' },
  { key: 'sick_days', label: 'Krank (T)', align: 'right', width: 'w-24' },
  { key: 'absence_days', label: 'Abw. ges. (T)', align: 'right', width: 'w-28' },
];

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function OvertimeCell({ hours }: { hours: number }) {
  const abs = Math.abs(hours);
  const label = hours >= 0 ? `+${fmt(abs)}` : `−${fmt(abs)}`;
  const color =
    hours > 0.5
      ? 'text-green-700 bg-green-50'
      : hours < -0.5
      ? 'text-red-700 bg-red-50'
      : 'text-slate-500';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>
      {label}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>;
  return <span className="ml-1 text-blue-600">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function exportCSV(rows: EmployeeStats[], year: number, month: number) {
  const header = COLUMNS.map(c => c.label).join(';');
  const lines = rows.map(r =>
    [
      r.employee_name,
      r.employee_short,
      r.group_name,
      fmt(r.target_hours),
      fmt(r.actual_hours),
      fmt(r.overtime_hours),
      r.shifts_count,
      r.vacation_used,
      r.sick_days,
      r.absence_days,
    ].join(';')
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `personaltabelle_${year}_${String(month).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Personaltabelle() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groupId, setGroupId] = useState<number | ''>('');
  const [stats, setStats] = useState<EmployeeStats[]>([]);
  const [groups, setGroups] = useState<{ ID: number; NAME: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('employee_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStatistics(year, month, groupId || undefined);
      setStats(data);
    } catch (e) {
      setError('Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  }, [year, month, groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let rows = stats;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        r =>
          r.employee_name.toLowerCase().includes(q) ||
          r.employee_short.toLowerCase().includes(q) ||
          r.group_name.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''), 'de');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [stats, search, sortKey, sortDir]);

  // Summary totals
  const totals = useMemo(() => {
    const t = filtered.reduce(
      (acc, r) => ({
        target_hours: acc.target_hours + r.target_hours,
        actual_hours: acc.actual_hours + r.actual_hours,
        overtime_hours: acc.overtime_hours + r.overtime_hours,
        shifts_count: acc.shifts_count + r.shifts_count,
        vacation_used: acc.vacation_used + r.vacation_used,
        sick_days: acc.sick_days + r.sick_days,
        absence_days: acc.absence_days + r.absence_days,
      }),
      { target_hours: 0, actual_hours: 0, overtime_hours: 0, shifts_count: 0, vacation_used: 0, sick_days: 0, absence_days: 0 }
    );
    return t;
  }, [filtered]);

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('de-AT', { month: 'long', year: 'numeric' });

  return (
    <div className="p-2 sm:p-4 lg:p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-800">👤 Personaltabelle</h1>
        <span className="text-slate-400 text-sm no-print">Kompakte Übersicht aller Mitarbeiter</span>
        <div className="ml-auto flex gap-2 no-print">
          <button
            onClick={() => exportCSV(filtered, year, month)}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
          >
            ⬇️ CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-sm bg-slate-600 text-white rounded hover:bg-slate-700 transition"
          >
            🖨️ Drucken
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 no-print">
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>
              {new Date(year, m - 1, 1).toLocaleString('de-AT', { month: 'long' })}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
        >
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value === '' ? '' : Number(e.target.value))}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white min-w-[160px]"
        >
          <option value="">Alle Gruppen</option>
          {groups.map(g => (
            <option key={g.ID} value={g.ID}>{g.NAME}</option>
          ))}
        </select>
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white w-48"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              ×
            </button>
          )}
        </div>
        <span className="self-center text-sm text-slate-500">
          {loading ? '⏳ Lädt…' : `${filtered.length} Mitarbeiter`}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 text-sm">{error}</div>
      )}

      {/* Print heading */}
      <div className="hidden print:block mb-4">
        <h2 className="text-lg font-bold">Personaltabelle — {monthLabel}</h2>
        {groupId && <p className="text-sm">{groups.find(g => g.ID === groupId)?.NAME}</p>}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-100 z-10">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap border-b border-slate-200 hover:bg-slate-200 transition ${col.width ?? ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {col.label}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-12 text-slate-400">
                  {search ? 'Keine Ergebnisse für die Suchanfrage.' : 'Keine Mitarbeiterdaten für diesen Zeitraum.'}
                </td>
              </tr>
            )}
            {filtered.map((row, idx) => (
              <tr
                key={row.employee_id}
                className={`border-b border-slate-100 hover:bg-blue-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
              >
                <td className="px-3 py-2 font-medium text-slate-800">{row.employee_name}</td>
                <td className="px-3 py-2 text-center text-slate-500 font-mono text-xs">{row.employee_short || '—'}</td>
                <td className="px-3 py-2 text-slate-600">
                  {row.group_name ? (
                    <span className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded">{row.group_name}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-700">{fmt(row.target_hours)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700">{fmt(row.actual_hours)}</td>
                <td className="px-3 py-2 text-right">
                  <OvertimeCell hours={row.overtime_hours} />
                </td>
                <td className="px-3 py-2 text-right text-slate-700">{row.shifts_count}</td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {row.vacation_used > 0 ? (
                    <span className="text-blue-700">{row.vacation_used}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {row.sick_days > 0 ? (
                    <span className="text-amber-600">{row.sick_days}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-500">{row.absence_days || '—'}</td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 1 && (
            <tfoot className="sticky bottom-0 bg-slate-100 border-t-2 border-slate-300">
              <tr className="font-semibold text-slate-700">
                <td className="px-3 py-2" colSpan={3}>
                  Gesamt ({filtered.length} MA)
                </td>
                <td className="px-3 py-2 text-right font-mono">{fmt(totals.target_hours)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmt(totals.actual_hours)}</td>
                <td className="px-3 py-2 text-right">
                  <OvertimeCell hours={totals.overtime_hours} />
                </td>
                <td className="px-3 py-2 text-right">{totals.shifts_count}</td>
                <td className="px-3 py-2 text-right text-blue-700">{totals.vacation_used || '—'}</td>
                <td className="px-3 py-2 text-right text-amber-600">{totals.sick_days || '—'}</td>
                <td className="px-3 py-2 text-right">{totals.absence_days || '—'}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-400 no-print">
        <span><span className="text-green-700 font-semibold">+x,x h</span> = Überstunden</span>
        <span><span className="text-red-700 font-semibold">−x,x h</span> = Minderstunden</span>
        <span><span className="text-blue-700 font-semibold">Urlaub</span> = Urlaubstage</span>
        <span><span className="text-amber-600 font-semibold">Krank</span> = Erkrankungstage</span>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; }
          @page { size: A4 landscape; margin: 10mm; }
          table { border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 4px 6px; }
          thead { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
