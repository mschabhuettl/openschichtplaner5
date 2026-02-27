import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { ZeitkontoRow, ZeitkontoDetail, ZeitkontoMonthDetail, ZeitkontoSummary } from '../api/client';
import type { Group } from '../types';

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

const MONTH_NAMES_FULL = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

type SortKey = 'name' | 'target' | 'actual' | 'diff' | 'saldo';
type SortDir = 'asc' | 'desc';

/** Format hours with German decimal comma: 167.5 → "167,5" */
function fmtH(h: number, decimals = 1): string {
  return h.toLocaleString('de-AT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function SaldoBadge({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const pos = value >= 0;
  const cls = pos
    ? 'bg-green-100 text-green-700 border border-green-200'
    : 'bg-red-100 text-red-700 border border-red-200';
  const textCls = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-0.5';
  return (
    <span className={`rounded font-semibold whitespace-nowrap ${cls} ${textCls}`}>
      {pos ? '+' : ''}{fmtH(value)}h
    </span>
  );
}

function SaldoBar({ value, max }: { value: number; max: number }) {
  const clamp = Math.min(Math.abs(value) / (max || 1), 1);
  const width = `${(clamp * 50).toFixed(1)}%`;
  const isPos = value >= 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex h-3 rounded overflow-hidden bg-gray-100 min-w-[100px]">
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
      <SaldoBadge value={value} size="sm" />
    </div>
  );
}

// ── Annual Statement Result Modal ──────────────────────────
interface AnnualStatementResult {
  employee_id: number;
  year: number;
  saldo: number;
  carry_in: number;
  total_saldo: number;
  should_carry: boolean;
  next_year: number;
}

function AnnualStatementModal({
  result,
  onApply,
  onClose,
}: {
  result: AnnualStatementResult;
  onApply: () => void;
  onClose: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      await api.setCarryForward({
        employee_id: result.employee_id,
        year: result.next_year,
        hours: result.saldo,
      });
      setApplied(true);
      onApply();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Fehler beim Übertragen');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">📊 Jahresabschluss {result.year}</h2>
        <div className="space-y-3 mb-5">
          {result.carry_in !== 0 && (
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
              <span className="text-sm text-gray-600">Übertrag aus Vorjahr</span>
              <span className={`font-semibold text-sm ${result.carry_in >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {result.carry_in >= 0 ? '+' : ''}{fmtH(result.carry_in)}h
              </span>
            </div>
          )}
          <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span className="text-sm text-gray-600">Jahressaldo gesamt</span>
            <span className={`font-semibold ${result.total_saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {result.total_saldo >= 0 ? '+' : ''}{fmtH(result.total_saldo)}h
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-semibold text-gray-700">Übertrag für {result.next_year}</span>
            <span className={`text-lg font-bold ${result.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {result.saldo >= 0 ? '+' : ''}{fmtH(result.saldo)}h
            </span>
          </div>
        </div>
        {applyError && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{applyError}</div>}
        {applied ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mb-3">
            ✓ Übertrag von {fmtH(result.saldo)}h wurde für {result.next_year} eingetragen.
          </div>
        ) : null}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
            Schließen
          </button>
          {!applied && result.should_carry && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {applying ? 'Übertrage...' : `→ Als Übertrag für ${result.next_year} buchen`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Monthly detail panel ────────────────────────────────────
function DetailPanel({
  detail,
  year,
  onClose,
}: {
  detail: ZeitkontoDetail;
  year: number;
  onClose: () => void;
}) {
  const maxVal = Math.max(...detail.months.map(m => Math.abs(m.difference)), 1);
  const [carryForward, setCarryForward] = useState<number | null>(null);
  const [annualResult, setAnnualResult] = useState<AnnualStatementResult | null>(null);
  const [runningAnnual, setRunningAnnual] = useState(false);
  const [annualError, setAnnualError] = useState<string | null>(null);

  useEffect(() => {
    api.getCarryForward(detail.employee_id, year)
      .then(r => setCarryForward(r.hours))
      .catch(() => setCarryForward(null));
  }, [detail.employee_id, year]);

  const handleJahresabschluss = async () => {
    setRunningAnnual(true);
    setAnnualError(null);
    try {
      const res = await api.calculateAnnualStatement({ employee_id: detail.employee_id, year });
      setAnnualResult(res.result);
    } catch (e) {
      setAnnualError(e instanceof Error ? e.message : 'Fehler beim Berechnen');
    } finally {
      setRunningAnnual(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              ⏱️ {detail.employee_name}
            </h2>
            <p className="text-sm text-gray-500">Zeitkonto {detail.year}</p>
          </div>
          <div className="flex items-center gap-2">
            {carryForward !== null && carryForward !== 0 && (
              <span className={`text-sm px-2 py-0.5 rounded font-semibold ${carryForward >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                Übertrag: {carryForward >= 0 ? '+' : ''}{fmtH(carryForward)}h
              </span>
            )}
            <button
              onClick={handleJahresabschluss}
              disabled={runningAnnual}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              title={`Jahresabschluss ${year} berechnen`}
            >
              {runningAnnual ? '⟳' : '📊'} Jahresabschluss
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl font-bold px-2"
            >
              ✕
            </button>
          </div>
        </div>
        {annualError && (
          <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">⚠️ {annualError}</div>
        )}
        {annualResult && (
          <AnnualStatementModal
            result={annualResult}
            onApply={() => { /* result logged */ }}
            onClose={() => setAnnualResult(null)}
          />
        )}

        {/* Summary row */}
        <div className="grid grid-cols-4 gap-3 p-4 border-b border-gray-100 bg-gray-50">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-600">{fmtH(detail.total_target_hours, 0)}h</div>
            <div className="text-xs text-gray-400">Soll</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-700">{fmtH(detail.total_actual_hours, 0)}h</div>
            <div className="text-xs text-gray-400">Ist</div>
          </div>
          {carryForward !== null && carryForward !== 0 ? (
            <div className="text-center">
              <div className={`text-lg font-bold ${carryForward >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {carryForward >= 0 ? '+' : ''}{fmtH(carryForward)}h
              </div>
              <div className="text-xs text-blue-400">Übertrag (inkl.)</div>
            </div>
          ) : (
            <div className="text-center">
              <div className={`text-lg font-bold ${detail.total_difference >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {detail.total_difference >= 0 ? '+' : ''}{fmtH(detail.total_difference)}h
              </div>
              <div className="text-xs text-gray-400">Differenz</div>
            </div>
          )}
          <div className="text-center">
            <div className={`text-lg font-bold ${detail.total_saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {detail.total_saldo >= 0 ? '+' : ''}{fmtH(detail.total_saldo)}h
            </div>
            <div className="text-xs text-gray-400">Jahressaldo</div>
          </div>
        </div>

        {/* Monthly table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold">Monat</th>
                <th className="text-right px-3 py-2 border border-gray-200 font-semibold">Soll-Std</th>
                <th className="text-right px-3 py-2 border border-gray-200 font-semibold">Ist-Std</th>
                <th className="text-right px-3 py-2 border border-gray-200 font-semibold">Fehlhd</th>
                <th className="text-center px-3 py-2 border border-gray-200 font-semibold min-w-[160px]">Differenz</th>
                <th className="text-right px-3 py-2 border border-gray-200 font-semibold">Anpassg</th>
                <th className="text-right px-3 py-2 border border-gray-200 font-semibold">Saldo kum.</th>
              </tr>
            </thead>
            <tbody>
              {detail.months.map((mo: ZeitkontoMonthDetail, idx: number) => (
                <tr
                  key={mo.month}
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                >
                  <td className="px-3 py-2 border border-gray-100 font-medium">
                    {MONTH_NAMES_FULL[mo.month]}
                  </td>
                  <td className="px-3 py-2 border border-gray-100 text-right text-gray-500">
                    {fmtH(mo.target_hours)}h
                  </td>
                  <td className="px-3 py-2 border border-gray-100 text-right font-semibold text-gray-700">
                    {fmtH(mo.actual_hours)}h
                  </td>
                  <td className="px-3 py-2 border border-gray-100 text-right">
                    {mo.absence_days > 0 ? (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                        {mo.absence_days}T
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 border border-gray-100">
                    <SaldoBar value={mo.difference} max={maxVal} />
                  </td>
                  <td className="px-3 py-2 border border-gray-100 text-right">
                    {mo.adjustment !== 0 ? (
                      <span className={`text-xs font-semibold ${mo.adjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {mo.adjustment >= 0 ? '+' : ''}{fmtH(mo.adjustment)}h
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 border border-gray-100 text-right">
                    <SaldoBadge value={mo.running_saldo} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-gray-300">
                <td className="px-3 py-2 border border-gray-200">Gesamt</td>
                <td className="px-3 py-2 border border-gray-200 text-right">{fmtH(detail.total_target_hours)}h</td>
                <td className="px-3 py-2 border border-gray-200 text-right">{fmtH(detail.total_actual_hours)}h</td>
                <td className="px-3 py-2 border border-gray-200" />
                <td className="px-3 py-2 border border-gray-200">
                  <SaldoBar value={detail.total_difference} max={Math.max(Math.abs(detail.total_difference), 1)} />
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">
                  {detail.total_adjustment !== 0 ? (
                    <span className={`text-sm font-bold ${detail.total_adjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {detail.total_adjustment >= 0 ? '+' : ''}{fmtH(detail.total_adjustment)}h
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">
                  <SaldoBadge value={detail.total_saldo} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 text-xs text-gray-400 flex justify-between items-center">
          <span>Differenz = Ist − Soll | Kum. Saldo = laufender Jahressaldo inkl. Anpassungen + Übertrag</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-200 rounded hover:bg-slate-300 text-gray-700 text-sm"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────
export default function Zeitkonto() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [groupId, setGroupId] = useState<number | undefined>(undefined);

  const [groups, setGroups] = useState<Group[]>([]);
  const [rows, setRows] = useState<ZeitkontoRow[]>([]);
  const [summary, setSummary] = useState<ZeitkontoSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Detail panel state
  const [selectedDetail, setSelectedDetail] = useState<ZeitkontoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.getGroups().then(setGroups);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getZeitkonto(year, groupId),
      api.getZeitkontoSummary(year, groupId),
    ])
      .then(([r, s]) => {
        setRows(r);
        setSummary(s);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [year, groupId]);

  const handleRowClick = (row: ZeitkontoRow) => {
    setDetailLoading(true);
    api.getZeitkontoDetail(year, row.employee_id)
      .then(d => {
        setSelectedDetail(d);
        setDetailLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setDetailLoading(false);
      });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  const sorted = [...rows].sort((a, b) => {
    let av: number | string, bv: number | string;
    switch (sortKey) {
      case 'name':   av = a.employee_name; bv = b.employee_name; break;
      case 'target': av = a.total_target_hours; bv = b.total_target_hours; break;
      case 'actual': av = a.total_actual_hours; bv = b.total_actual_hours; break;
      case 'diff':   av = a.total_difference; bv = b.total_difference; break;
      case 'saldo':  av = a.total_saldo; bv = b.total_saldo; break;
      default: av = ''; bv = '';
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const maxSaldo = Math.max(...rows.map(r => Math.abs(r.total_saldo)), 1);

  const SortTh = ({ label, skey, align = 'right' }: { label: string; skey: SortKey; align?: 'left' | 'right' }) => (
    <th
      className={`px-3 py-2 text-${align} border border-gray-200 cursor-pointer hover:bg-slate-200 select-none whitespace-nowrap`}
      onClick={() => handleSort(skey)}
    >
      {label} {sortKey === skey ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  // Monthly spark mini-bar for inline display
  const MonthBars = ({ empId }: { empId: number }) => {
    const row = rows.find(r => r.employee_id === empId);
    if (!row) return null;
    return null; // would need month data per row — skip for now
  };
  void MonthBars; // suppress unused warning

  return (
    <div className="p-2 sm:p-4 lg:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">⏱️ Zeitkonto</h1>

        {/* Year nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(y => y - 1)}
            className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
          >
            ‹
          </button>
          <span className="font-semibold text-gray-700 min-w-[60px] text-center">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
          >
            ›
          </button>
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

        {(loading || detailLoading) && (
          <span className="text-sm text-blue-500 animate-pulse">Lade...</span>
        )}
        {error && <span className="text-sm text-red-500">Fehler: {error}</span>}
        <span className="text-sm text-gray-500">{rows.length} Mitarbeiter</span>
        <span className="text-xs text-gray-400 italic">Klick auf MA → Monatsdetails</span>
        <button
          onClick={() => window.print()}
          className="no-print ml-auto px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
          title="Seite drucken"
        >
          🖨️ <span className="hidden sm:inline">Drucken</span>
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
            <div className="text-xl font-bold text-gray-600">{fmtH(summary.total_target_hours, 0)}h</div>
            <div className="text-xs text-gray-400">Gesamt Soll</div>
          </div>
          <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
            <div className="text-xl font-bold text-blue-700">{fmtH(summary.total_actual_hours, 0)}h</div>
            <div className="text-xs text-gray-400">Gesamt Ist</div>
          </div>
          <div className={`rounded-lg border p-3 shadow-sm text-center ${summary.total_saldo >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-xl font-bold ${summary.total_saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {summary.total_saldo >= 0 ? '+' : ''}{fmtH(summary.total_saldo, 0)}h
            </div>
            <div className={`text-xs ${summary.total_saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>Gesamtsaldo</div>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-3 shadow-sm text-center">
            <div className="text-xl font-bold text-green-700">{summary.positive_count}</div>
            <div className="text-xs text-green-600">Plusstunden MA</div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-3 shadow-sm text-center">
            <div className="text-xl font-bold text-red-700">{summary.negative_count}</div>
            <div className="text-xs text-red-600">Minusstunden MA</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="border-collapse text-sm w-full min-w-[700px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              <th
                className="px-3 py-2 text-left border border-gray-200 cursor-pointer hover:bg-slate-200 select-none sticky left-0 bg-slate-100 z-10 min-w-[200px]"
                onClick={() => handleSort('name')}
              >
                Mitarbeiter {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <SortTh label="Soll-Std" skey="target" />
              <SortTh label="Ist-Std" skey="actual" />
              <SortTh label="Differenz" skey="diff" />
              <th className="px-3 py-2 text-center border border-gray-200 min-w-[200px] whitespace-nowrap cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort('saldo')}>
                Überstunden-Saldo {sortKey === 'saldo' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-3 py-2 text-center border border-gray-200 whitespace-nowrap text-xs">
                {MONTH_NAMES.slice(1).join(' · ')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.employee_id}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer transition-colors`}
                onClick={() => handleRowClick(r)}
                title="Klicken für Monatsdetails"
              >
                <td className="sticky left-0 bg-inherit px-3 py-2 border border-gray-100 font-medium whitespace-nowrap">
                  {r.employee_name}
                </td>
                <td className="px-3 py-2 border border-gray-100 text-right text-gray-500">
                  {fmtH(r.total_target_hours)}h
                </td>
                <td className="px-3 py-2 border border-gray-100 text-right font-semibold text-gray-700">
                  {fmtH(r.total_actual_hours)}h
                </td>
                <td className="px-3 py-2 border border-gray-100 text-right">
                  <span className={`font-semibold text-sm ${r.total_difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {r.total_difference >= 0 ? '+' : ''}{fmtH(r.total_difference)}h
                  </span>
                </td>
                <td className="px-3 py-2 border border-gray-100">
                  <SaldoBar value={r.total_saldo} max={maxSaldo} />
                </td>
                <td className="px-3 py-2 border border-gray-100">
                  {/* Mini monthly saldo sparkbar */}
                  <div className="flex gap-0.5 items-end h-5">
                    {Array.from({ length: 12 }, (_, mi) => {
                      // We don't have per-month data at this level — show placeholder dots
                      const active = mi < (now.getMonth() + 1) || year < now.getFullYear();
                      return (
                        <div
                          key={mi}
                          className={`flex-1 rounded-sm ${active ? (r.total_saldo >= 0 ? 'bg-green-300' : 'bg-red-300') : 'bg-gray-200'}`}
                          style={{ height: active ? '60%' : '20%' }}
                          title={MONTH_NAMES[mi + 1]}
                        />
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Lade Zeitkonto…</div>
                  ) : (
                    <div><div className="text-3xl mb-2">⏱️</div><div className="font-medium">Keine Daten gefunden</div><div className="text-xs mt-1">Wähle einen Zeitraum und klicke auf Laden.</div></div>
                  )}
                </td>
              </tr>
            )}
          </tbody>

          {sorted.length > 0 && summary && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-gray-300">
                <td className="sticky left-0 bg-slate-100 px-3 py-2 border border-gray-200">
                  Gesamt ({sorted.length} MA)
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">
                  {fmtH(summary.total_target_hours)}h
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">
                  {fmtH(summary.total_actual_hours)}h
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">
                  <span className={`font-bold text-sm ${(summary.total_actual_hours - summary.total_target_hours) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(summary.total_actual_hours - summary.total_target_hours) >= 0 ? '+' : ''}
                    {fmtH((summary.total_actual_hours - summary.total_target_hours))}h
                  </span>
                </td>
                <td className="px-3 py-2 border border-gray-200">
                  <SaldoBadge value={summary.total_saldo} />
                </td>
                <td className="px-3 py-2 border border-gray-200 text-xs text-gray-400 text-center">
                  {summary.positive_count} ▲ / {summary.negative_count} ▼
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Detail modal */}
      {selectedDetail && (
        <DetailPanel
          detail={selectedDetail}
          year={year}
          onClose={() => setSelectedDetail(null)}
        />
      )}
    </div>
  );
}
