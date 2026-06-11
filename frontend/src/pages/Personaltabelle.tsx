import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import type { PersonnelTableRow, PersonnelTableResponse } from '../api/client';
import { useT } from '../i18n';

type SortDir = 'asc' | 'desc';
type PeriodMode = 'month' | 'range';

interface ColDef {
  key: string;
  label: string;
  /** Volltext-Tooltip für gekürzte dynamische Spalten */
  title?: string;
  kind: 'text' | 'hours' | 'saldo' | 'count' | 'days' | 'leave';
  leaveId?: number;
  align?: 'right' | 'center';
  width?: string;
  value: (r: PersonnelTableRow) => number | string;
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

/** Tageswerte: ganzzahlig ohne Nachkommastelle, sonst eine (0,5-Schritte). */
function fmtDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function SaldoCell({ hours }: { hours: number }) {
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

function LeaveAccountCell({ taken, remaining }: { taken: number; remaining: number }) {
  return (
    <span className="font-mono text-xs whitespace-nowrap">
      {fmtDays(taken)}
      {' / '}
      <span className={remaining < 0 ? 'text-red-600 font-semibold' : 'text-slate-700'}>
        {fmtDays(remaining)}
      </span>
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>;
  return <span className="ml-1 text-blue-600">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function csvValue(col: ColDef, row: PersonnelTableRow): string {
  if (col.kind === 'leave') {
    const acc = row.leave_accounts?.[String(col.leaveId)];
    if (acc) return `${fmtDays(acc.taken)} / ${fmtDays(acc.remaining)}`;
  }
  const v = col.value(row);
  if (typeof v !== 'number') return String(v);
  if (col.kind === 'hours' || col.kind === 'saldo') return fmt(v);
  return fmtDays(v);
}

function exportCSV(columns: ColDef[], rows: PersonnelTableRow[], from: string, to: string) {
  const header = columns.map(c => c.label).join(';');
  const lines = rows.map(r => columns.map(c => csvValue(c, r)).join(';'));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `personaltabelle_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Personaltabelle() {
  const t = useT();
  const now = new Date();
  const [mode, setMode] = useState<PeriodMode>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rangeFrom, setRangeFrom] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
  const [rangeTo, setRangeTo] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`
  );
  const [groupId, setGroupId] = useState<number | ''>('');
  const [data, setData] = useState<PersonnelTableResponse | null>(null);
  const [groups, setGroups] = useState<{ ID: number; NAME: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('employee_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  // Auswertungszeitraum [von, bis] (Spec 3.9.1): Monatsmodus oder freier Von/Bis-Zeitraum
  const { from, to } = useMemo(() => {
    if (mode === 'range') return { from: rangeFrom, to: rangeTo };
    const lastDay = new Date(year, month, 0).getDate();
    return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` };
  }, [mode, year, month, rangeFrom, rangeTo]);

  const invalidRange = !from || !to || from > to;

  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (invalidRange) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPersonnelTable(from, to, groupId || undefined);
      setData(res);
    } catch (_e) {
      setError(t.personaltabelle.loadError);
    } finally {
      setLoading(false);
    }
  }, [from, to, groupId, invalidRange, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Standardspalten (Spec 3.9.2) + dynamische Spalten je Schicht-/Abwesenheitsart (Spec 3.9.3)
  const columns = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
      { key: 'employee_name', label: t.personaltabelle.colName, kind: 'text', width: 'min-w-[160px]', value: r => r.employee_name },
      { key: 'employee_short', label: t.personaltabelle.colShort, kind: 'text', align: 'center', width: 'w-20', value: r => r.employee_short },
      { key: 'iststunden', label: t.personaltabelle.colActual, kind: 'hours', align: 'right', width: 'w-24', value: r => r.iststunden },
      { key: 'sollstunden', label: t.personaltabelle.colTarget, kind: 'hours', align: 'right', width: 'w-24', value: r => r.sollstunden },
      { key: 'saldo', label: t.personaltabelle.colSaldo, kind: 'saldo', align: 'right', width: 'w-24', value: r => r.saldo },
      { key: 'arbeitszeit', label: t.personaltabelle.colWorkTime, kind: 'hours', align: 'right', width: 'w-28', value: r => r.arbeitszeit },
      { key: 'abwesenheit_bezahlt', label: t.personaltabelle.colPaidAbsence, kind: 'hours', align: 'right', width: 'w-28', value: r => r.abwesenheit_bezahlt },
      { key: 'sonntag', label: t.personaltabelle.colSunday, kind: 'count', align: 'right', width: 'w-24', value: r => r.sonntag },
      { key: 'feiertag', label: t.personaltabelle.colHoliday, kind: 'count', align: 'right', width: 'w-24', value: r => r.feiertag },
      { key: 'sonderdienste', label: t.personaltabelle.colSpecial, kind: 'count', align: 'right', width: 'w-24', value: r => r.sonderdienste },
    ];
    if (data) {
      for (const s of data.columns.shifts) {
        cols.push({
          key: `shift_${s.id}`,
          label: s.short || s.name,
          title: s.name,
          kind: 'count',
          align: 'right',
          value: r => r.shift_counts[String(s.id)] ?? 0,
        });
      }
      for (const lt of data.columns.leave_types) {
        // Urlaubs-Doppelwert „verbraucht / Rest" nur bei genau einem Kalenderjahr (Spec 3.9.3 Nr. 6)
        const isAccount = data.one_year && lt.entitled;
        cols.push({
          key: `leave_${lt.id}`,
          label: lt.short || lt.name,
          title: lt.name,
          kind: isAccount ? 'leave' : 'days',
          leaveId: lt.id,
          align: 'right',
          value: r => r.absence_days_by_type[String(lt.id)] ?? 0,
        });
      }
    }
    return cols;
  }, [data, t]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let rows = data?.rows ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        r => r.employee_name.toLowerCase().includes(q) || r.employee_short.toLowerCase().includes(q)
      );
    }
    const col = columns.find(c => c.key === sortKey) ?? columns[0];
    return [...rows].sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''), 'de');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, columns, search, sortKey, sortDir]);

  const renderCell = (col: ColDef, row: PersonnelTableRow) => {
    if (col.kind === 'text') {
      const v = String(col.value(row));
      return v || '—';
    }
    if (col.kind === 'saldo') return <SaldoCell hours={row.saldo} />;
    if (col.kind === 'leave') {
      const acc = row.leave_accounts?.[String(col.leaveId)];
      if (acc) return <LeaveAccountCell taken={acc.taken} remaining={acc.remaining} />;
    }
    const v = Number(col.value(row));
    if (col.kind === 'hours') return <span className="font-mono">{fmt(v)}</span>;
    return v !== 0 ? fmtDays(v) : '—';
  };

  const renderTotal = (col: ColDef) => {
    const sum = filtered.reduce((a, r) => a + (Number(col.value(r)) || 0), 0);
    if (col.kind === 'hours') return <span className="font-mono">{fmt(sum)}</span>;
    if (col.kind === 'saldo') return <SaldoCell hours={sum} />;
    if (col.kind === 'leave') {
      const remaining = filtered.reduce(
        (a, r) => a + (r.leave_accounts?.[String(col.leaveId)]?.remaining ?? 0),
        0
      );
      return <LeaveAccountCell taken={sum} remaining={remaining} />;
    }
    return sum !== 0 ? fmtDays(sum) : '—';
  };

  const periodLabel =
    mode === 'month'
      ? new Date(year, month - 1, 1).toLocaleString('de-AT', { month: 'long', year: 'numeric' })
      : `${from} – ${to}`;

  const segBtn = (active: boolean) =>
    `px-3 py-1.5 text-sm transition ${active ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`;

  return (
    <div className="p-2 sm:p-4 lg:p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-800">👤 {t.personaltabelle.title}</h1>
        <span className="text-slate-600 text-sm no-print">{t.personaltabelle.subtitle}</span>
        <div className="ml-auto flex gap-2 no-print">
          <button
            onClick={() => exportCSV(columns, filtered, from, to)}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
          >
            ⬇️ CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-sm bg-slate-600 text-white rounded hover:bg-slate-700 transition"
          >
            🖨️ {t.personaltabelle.print}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 no-print">
        {/* Zeitraum-Modus: Monat ⟷ freier Von/Bis-Zeitraum (Spec 3.9.1) */}
        <div className="flex rounded border border-slate-300 overflow-hidden">
          <button onClick={() => setMode('month')} className={segBtn(mode === 'month')}>
            {t.personaltabelle.modeMonth}
          </button>
          <button onClick={() => setMode('range')} className={segBtn(mode === 'range')}>
            {t.personaltabelle.modeRange}
          </button>
        </div>
        {mode === 'month' ? (
          <>
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
          </>
        ) : (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">{t.personaltabelle.from}</label>
            <input
              type="date"
              aria-label={t.personaltabelle.from}
              value={rangeFrom}
              onChange={e => setRangeFrom(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
            />
            <label className="text-sm text-slate-600">{t.personaltabelle.to}</label>
            <input
              type="date"
              aria-label={t.personaltabelle.to}
              value={rangeTo}
              onChange={e => setRangeTo(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
            />
          </div>
        )}
        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value === '' ? '' : Number(e.target.value))}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white min-w-[160px]"
        >
          <option value="">{t.personaltabelle.allGroups}</option>
          {groups.map(g => (
            <option key={g.ID} value={g.ID}>{g.NAME}</option>
          ))}
        </select>
        <div className="relative">
          <input
            type="text"
            placeholder={t.personaltabelle.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white w-48"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-700"
            >
              ×
            </button>
          )}
        </div>
        <span className="self-center text-sm text-slate-500">
          {loading ? t.personaltabelle.loading : `${filtered.length} ${t.personaltabelle.employees}`}
        </span>
      </div>

      {/* Error / invalid range */}
      {invalidRange && mode === 'range' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded px-4 py-2 text-sm">
          {t.personaltabelle.invalidRange}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 text-sm">{error}</div>
      )}

      {/* Print heading */}
      <div className="hidden print:block mb-4">
        <h2 className="text-lg font-bold">{t.personaltabelle.title} — {periodLabel}</h2>
        {groupId && <p className="text-sm">{groups.find(g => g.ID === groupId)?.NAME}</p>}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-100 z-10">
            <tr>
              {columns.map(col => (
                <th scope="col"
                  key={col.key}
                  title={col.title}
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
                <td colSpan={columns.length} className="text-center py-12 text-slate-600">
                  {search ? t.personaltabelle.noResults : t.personaltabelle.noData}
                </td>
              </tr>
            )}
            {filtered.map((row, idx) => (
              <tr
                key={row.employee_id}
                className={`border-b border-slate-100 hover:bg-blue-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${
                      col.key === 'employee_name'
                        ? 'font-medium text-slate-800'
                        : col.key === 'employee_short'
                        ? 'text-center text-slate-500 font-mono text-xs'
                        : 'text-right text-slate-700'
                    }`}
                  >
                    {renderCell(col, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {filtered.length > 1 && (
            <tfoot className="sticky bottom-0 bg-slate-100 border-t-2 border-slate-300">
              <tr className="font-semibold text-slate-700">
                <td className="px-3 py-2" colSpan={2}>
                  {t.personaltabelle.total} ({filtered.length} MA)
                </td>
                {columns.slice(2).map(col => (
                  <td key={col.key} className="px-3 py-2 text-right">
                    {renderTotal(col)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 no-print">
        <span><span className="text-green-700 font-semibold">+x,x</span> / <span className="text-red-700 font-semibold">−x,x</span> = {t.personaltabelle.legendSaldo}</span>
        {data?.one_year && (
          <span>
            <span className="font-semibold">x / y</span> = {t.personaltabelle.legendLeave}{' '}
            (<span className="text-red-600 font-semibold">{t.personaltabelle.legendLeaveNegative}</span>)
          </span>
        )}
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
