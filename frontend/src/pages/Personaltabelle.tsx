import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import type { PersonnelTableRow, PersonnelTableResponse } from '../api/client';
import { useT } from '../i18n';
import { groupTreeOptions } from '../utils/groupTree';

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
  // Taktwerk: negative Salden in Signal, sonst neutral (Ink2)
  const color = hours < -0.5 ? 'text-signal' : 'text-schrift-2';
  return (
    <span className={`inline-block font-mono tabular-nums text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  );
}

function LeaveAccountCell({ taken, remaining }: { taken: number; remaining: number }) {
  return (
    <span className="font-mono tabular-nums text-[11px] whitespace-nowrap">
      {fmtDays(taken)}
      {' / '}
      <span className={remaining < 0 ? 'text-signal font-semibold' : 'text-schrift-2'}>
        {fmtDays(remaining)}
      </span>
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-schrift-3 opacity-50">↕</span>;
  return <span className="ml-1 text-glut">{dir === 'asc' ? '▴' : '▾'}</span>;
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
    `px-3 py-1.5 text-sm transition ${active ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene text-schrift-2 hover:bg-wash'}`;

  return (
    <div className="p-2 sm:p-4 lg:p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold tracking-[-0.02em] text-schrift">👤 {t.personaltabelle.title}</h1>
        <span className="text-schrift-2 text-sm no-print">{t.personaltabelle.subtitle}</span>
        <div className="ml-auto flex gap-2 no-print">
          <button
            onClick={() => exportCSV(columns, filtered, from, to)}
            className="px-3 py-1.5 text-sm font-semibold bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui hover:opacity-90 transition-opacity"
          >
            ⬇️ CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-sm text-schrift bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui hover:bg-wash transition-colors"
          >
            🖨️ {t.personaltabelle.print}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 no-print">
        {/* Zeitraum-Modus: Monat ⟷ freier Von/Bis-Zeitraum (Spec 3.9.1) */}
        <div className="flex rounded-ui border border-kontur overflow-hidden">
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
              className="border border-kontur rounded-ui px-3 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift"
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
              className="border border-kontur rounded-ui px-3 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <label className="text-sm text-schrift-2">{t.personaltabelle.from}</label>
            <input
              type="date"
              aria-label={t.personaltabelle.from}
              value={rangeFrom}
              onChange={e => setRangeFrom(e.target.value)}
              className="border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift font-mono tabular-nums"
            />
            <label className="text-sm text-schrift-2">{t.personaltabelle.to}</label>
            <input
              type="date"
              aria-label={t.personaltabelle.to}
              value={rangeTo}
              onChange={e => setRangeTo(e.target.value)}
              className="border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift font-mono tabular-nums"
            />
          </div>
        )}
        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value === '' ? '' : Number(e.target.value))}
          className="border border-kontur rounded-ui px-3 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift min-w-[160px]"
        >
          <option value="">{t.personaltabelle.allGroups}</option>
          {groupTreeOptions(groups).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <div className="relative">
          <input
            type="text"
            placeholder={t.personaltabelle.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-kontur rounded-ui px-3 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift placeholder:text-schrift-3 w-48"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-schrift-2 hover:text-schrift"
            >
              ×
            </button>
          )}
        </div>
        <span className="self-center text-sm text-schrift-2">
          {loading ? t.personaltabelle.loading : `${filtered.length} ${t.personaltabelle.employees}`}
        </span>
      </div>

      {/* Error / invalid range */}
      {invalidRange && mode === 'range' && (
        <div className="bg-signal-flaeche border border-[#eecfcf] dark:border-[#5a2626] text-signal rounded-ui px-4 py-2 text-sm">
          {t.personaltabelle.invalidRange}
        </div>
      )}
      {error && (
        <div className="bg-signal-flaeche border border-[#eecfcf] dark:border-[#5a2626] text-signal rounded-ui px-4 py-2 text-sm">{error}</div>
      )}

      {/* Print heading */}
      <div className="hidden print:block mb-4">
        <h2 className="text-lg font-bold">{t.personaltabelle.title} — {periodLabel}</h2>
        {groupId && <p className="text-sm">{groups.find(g => g.ID === groupId)?.NAME}</p>}
      </div>

      {/* Table — Taktwerk-Datentabelle: 28px-Zeilen, UPPERCASE-Kopf auf Fläche 2, Zahlen mono rechtsbündig */}
      <div className="flex-1 overflow-auto rounded-panel border border-kontur bg-ebene">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 bg-[#fafbfc] dark:bg-[#0e1522] z-10">
            <tr>
              {columns.map(col => (
                <th scope="col"
                  key={col.key}
                  title={col.title}
                  onClick={() => handleSort(col.key)}
                  className={`px-2.5 py-[6px] text-[9px] font-bold uppercase tracking-[.08em] cursor-pointer select-none whitespace-nowrap border-b border-kontur hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)] ${
                    sortKey === col.key ? 'text-schrift' : 'text-schrift-3'
                  } ${col.width ?? ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
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
                <td colSpan={columns.length} className="text-center py-12 text-schrift-2 text-sm">
                  {search ? t.personaltabelle.noResults : t.personaltabelle.noData}
                </td>
              </tr>
            )}
            {filtered.map(row => (
              <tr
                key={row.employee_id}
                className="h-[28px] border-b border-kontur-soft hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)]"
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`px-2.5 py-0 ${
                      col.key === 'employee_name'
                        ? 'text-[11.5px] font-semibold text-schrift'
                        : col.key === 'employee_short'
                        ? 'text-center text-schrift-2 font-mono'
                        : 'text-right text-schrift font-mono tabular-nums'
                    }`}
                  >
                    {renderCell(col, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {filtered.length > 1 && (
            <tfoot className="sticky bottom-0 bg-[#fafbfc] dark:bg-[#0e1522] border-t border-kontur">
              <tr className="h-[28px] font-semibold text-schrift">
                <td className="px-2.5 py-0" colSpan={2}>
                  {t.personaltabelle.total} ({filtered.length} MA)
                </td>
                {columns.slice(2).map(col => (
                  <td key={col.key} className="px-2.5 py-0 text-right font-mono tabular-nums">
                    {renderTotal(col)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-schrift-2 no-print">
        <span><span className="font-mono font-semibold">+x,x</span> / <span className="text-signal font-mono font-semibold">−x,x</span> = {t.personaltabelle.legendSaldo}</span>
        {data?.one_year && (
          <span>
            <span className="font-mono font-semibold">x / y</span> = {t.personaltabelle.legendLeave}{' '}
            (<span className="text-signal font-semibold">{t.personaltabelle.legendLeaveNegative}</span>)
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
