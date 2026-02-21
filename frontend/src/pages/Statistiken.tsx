import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { EmployeeStats, ExtraChargeSummary } from '../api/client';
import type { Group } from '../types';

const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

// ── HTML Export helper ─────────────────────────────────────────
function exportStatisticsHTML(
  stats: EmployeeStats[],
  year: number,
  month: number,
  groupLabel: string,
) {
  const monthName = MONTH_NAMES[month];
  const now = new Date().toLocaleString('de-AT');

  const totalTarget = stats.reduce((a, s) => a + s.target_hours, 0);
  const totalActual = stats.reduce((a, s) => a + s.actual_hours, 0);
  const totalOT = totalActual - totalTarget;
  const totalAbsences = stats.reduce((a, s) => a + s.absence_days, 0);
  const totalVacation = stats.reduce((a, s) => a + s.vacation_used, 0);

  const thStyle = 'border:1px solid #aaa;padding:5px 8px;background:#334155;color:#fff;font-size:12px;text-align:left;white-space:nowrap;';
  const thRStyle = thStyle.replace('text-align:left', 'text-align:right');
  const tdStyle = 'border:1px solid #ddd;padding:4px 8px;font-size:12px;';
  const tdRStyle = tdStyle + 'text-align:right;';
  const tfStyle = 'border:1px solid #aaa;padding:5px 8px;font-size:12px;font-weight:bold;background:#f1f5f9;';
  const tfRStyle = tfStyle + 'text-align:right;';

  let rows = '';
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    const ot = s.overtime_hours;
    const otColor = ot >= 0 ? '#16a34a' : '#dc2626';
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    rows += `<tr>
      <td style="${tdStyle}background:${bg};font-weight:500">${s.employee_name}</td>
      <td style="${tdRStyle}background:${bg};color:#374151">${s.target_hours.toFixed(1)}h</td>
      <td style="${tdRStyle}background:${bg};font-weight:600;color:#1d4ed8">${s.actual_hours.toFixed(1)}h</td>
      <td style="${tdRStyle}background:${bg};font-weight:600;color:${otColor}">${ot >= 0 ? '+' : ''}${ot.toFixed(1)}h</td>
      <td style="${tdRStyle}background:${bg};color:#b45309">${s.absence_days > 0 ? s.absence_days : '—'}</td>
      <td style="${tdRStyle}background:${bg};color:#1d4ed8">${s.vacation_used > 0 ? s.vacation_used : '—'}</td>
    </tr>`;
  }

  const otColor = totalOT >= 0 ? '#16a34a' : '#dc2626';

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Statistiken ${monthName} ${year}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 16px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  .subtitle { font-size: 11px; color: #555; margin-bottom: 12px; }
  .summary { display: flex; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
  .card { border: 1px solid #ddd; border-radius: 6px; padding: 8px 14px; min-width: 110px; text-align: center; }
  .card-val { font-size: 20px; font-weight: bold; }
  .card-lbl { font-size: 10px; color: #666; }
  table { border-collapse: collapse; width: 100%; }
  @media print {
    @page { size: portrait; margin: 10mm; }
    body { margin: 0; }
    .summary { break-inside: avoid; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
<h1>📈 Statistiken – ${monthName} ${year}</h1>
<div class="subtitle">Gruppe: ${groupLabel} &nbsp;|&nbsp; ${stats.length} Mitarbeiter &nbsp;|&nbsp; Erstellt: ${now}</div>

<div class="summary">
  <div class="card">
    <div class="card-val" style="color:#374151">${totalTarget.toFixed(0)}h</div>
    <div class="card-lbl">Gesamt Soll</div>
  </div>
  <div class="card">
    <div class="card-val" style="color:#1d4ed8">${totalActual.toFixed(0)}h</div>
    <div class="card-lbl">Gesamt Ist</div>
  </div>
  <div class="card">
    <div class="card-val" style="color:${otColor}">${totalOT >= 0 ? '+' : ''}${totalOT.toFixed(0)}h</div>
    <div class="card-lbl">Überstunden</div>
  </div>
  <div class="card">
    <div class="card-val" style="color:#b45309">${totalAbsences}</div>
    <div class="card-lbl">Abwesenheitstage</div>
  </div>
  <div class="card">
    <div class="card-val" style="color:#1d4ed8">${totalVacation}</div>
    <div class="card-lbl">Urlaub genutzt</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="${thStyle}min-width:180px">Mitarbeiter</th>
      <th style="${thRStyle}">Soll-Std</th>
      <th style="${thRStyle}">Ist-Std</th>
      <th style="${thRStyle}">Über-/Unterstunden</th>
      <th style="${thRStyle}">Abwesend (Tage)</th>
      <th style="${thRStyle}">Urlaub genutzt</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr>
      <td style="${tfStyle}">Gesamt (${stats.length} MA)</td>
      <td style="${tfRStyle}">${totalTarget.toFixed(1)}h</td>
      <td style="${tfRStyle}">${totalActual.toFixed(1)}h</td>
      <td style="${tfRStyle}color:${otColor}">${totalOT >= 0 ? '+' : ''}${totalOT.toFixed(1)}h</td>
      <td style="${tfRStyle}">${totalAbsences}</td>
      <td style="${tfRStyle}">${totalVacation}</td>
    </tr>
  </tfoot>
</table>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) { alert('Popup-Fenster blockiert! Bitte den Popup-Blocker für diese Seite deaktivieren.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

type SortKey = 'name' | 'overtime' | 'actual_hours' | 'target_hours' | 'absences' | 'vacation';
type SortDir = 'asc' | 'desc';

function OvertimeBar({ value, max }: { value: number; max: number }) {
  const clamp = Math.min(Math.abs(value) / (max || 1), 1);
  const width = `${(clamp * 50).toFixed(1)}%`;
  const isPos = value >= 0;
  return (
    <div className="flex items-center gap-1 min-w-[100px]">
      <div className="flex-1 flex h-3 rounded overflow-hidden bg-gray-100">
        {isPos ? (
          <>
            <div className="flex-1" />
            <div className="w-px bg-gray-400" />
            <div className="flex-1 relative">
              <div
                className="absolute left-0 top-0 h-full bg-green-500 rounded-r"
                style={{ width }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 relative">
              <div
                className="absolute right-0 top-0 h-full bg-red-500 rounded-l"
                style={{ width }}
              />
            </div>
            <div className="w-px bg-gray-400" />
            <div className="flex-1" />
          </>
        )}
      </div>
      <span className={`text-xs font-semibold min-w-[48px] text-right ${isPos ? 'text-green-600' : 'text-red-600'}`}>
        {value >= 0 ? '+' : ''}{value.toFixed(1)}h
      </span>
    </div>
  );
}

export default function Statistiken() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);

  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<EmployeeStats[]>([]);
  const [extraSummary, setExtraSummary] = useState<ExtraChargeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getStatistics(year, month, groupId),
      api.getExtraChargesSummary(year, month),
    ])
      .then(([statsData, extraData]) => {
        setStats(statsData);
        setExtraSummary(extraData.filter((e: ExtraChargeSummary) => e.hours > 0));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [year, month, groupId]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sorted = [...stats].sort((a, b) => {
    let av: number | string, bv: number | string;
    switch (sortKey) {
      case 'name': av = a.employee_name; bv = b.employee_name; break;
      case 'overtime': av = a.overtime_hours; bv = b.overtime_hours; break;
      case 'actual_hours': av = a.actual_hours; bv = b.actual_hours; break;
      case 'target_hours': av = a.target_hours; bv = b.target_hours; break;
      case 'absences': av = a.absence_days; bv = b.absence_days; break;
      case 'vacation': av = a.vacation_used; bv = b.vacation_used; break;
      default: av = ''; bv = '';
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const maxOvertime = Math.max(...stats.map(s => Math.abs(s.overtime_hours)), 1);
  const totalTarget = stats.reduce((a, s) => a + s.target_hours, 0);
  const totalActual = stats.reduce((a, s) => a + s.actual_hours, 0);
  const totalOvertime = totalActual - totalTarget;
  const totalAbsences = stats.reduce((a, s) => a + s.absence_days, 0);
  const totalVacation = stats.reduce((a, s) => a + s.vacation_used, 0);

  const SortHeader = ({ label, skey }: { label: string; skey: SortKey }) => (
    <th
      className="px-3 py-2 text-right border border-gray-200 cursor-pointer hover:bg-slate-200 select-none whitespace-nowrap"
      onClick={() => handleSort(skey)}
    >
      {label} {sortKey === skey ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="p-2 sm:p-4 lg:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">📈 Statistiken</h1>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">‹</button>
          <span className="font-semibold text-gray-700 min-w-[150px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">›</button>
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

        {loading && <span className="text-sm text-blue-500 animate-pulse">Lade...</span>}
        {error && <span className="text-sm text-red-500">Fehler: {error}</span>}

        <span className="text-sm text-gray-500">{stats.length} Mitarbeiter</span>

        {/* HTML Export button */}
        <button
          onClick={() => {
            const groupLabel = groupId
              ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`)
              : 'Alle Mitarbeiter';
            exportStatisticsHTML(sorted, year, month, groupLabel);
          }}
          disabled={sorted.length === 0 || loading}
          className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded shadow-sm flex items-center gap-1.5"
          title="Statistiken als HTML öffnen und drucken"
        >
          📊 HTML exportieren
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-gray-700">{totalTarget.toFixed(0)}h</div>
          <div className="text-xs text-gray-500">Gesamt Soll</div>
        </div>
        <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-blue-700">{totalActual.toFixed(0)}h</div>
          <div className="text-xs text-gray-500">Gesamt Ist</div>
        </div>
        <div className={`rounded-lg border p-3 shadow-sm text-center ${totalOvertime >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`text-xl font-bold ${totalOvertime >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totalOvertime >= 0 ? '+' : ''}{totalOvertime.toFixed(0)}h
          </div>
          <div className={`text-xs ${totalOvertime >= 0 ? 'text-green-600' : 'text-red-600'}`}>Überstunden</div>
        </div>
        <div className="bg-amber-50 rounded-lg border p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-amber-700">{totalAbsences}</div>
          <div className="text-xs text-amber-600">Abwesenheitstage</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="border-collapse text-sm w-full min-w-[640px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              <th
                className="px-3 py-2 text-left border border-gray-200 cursor-pointer hover:bg-slate-200 select-none sticky left-0 bg-slate-100 z-10 min-w-[180px]"
                onClick={() => handleSort('name')}
              >
                Mitarbeiter {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <SortHeader label="Soll-Std" skey="target_hours" />
              <SortHeader label="Ist-Std" skey="actual_hours" />
              <th className="px-3 py-2 text-center border border-gray-200 min-w-[180px] whitespace-nowrap cursor-pointer hover:bg-slate-200 select-none" onClick={() => handleSort('overtime')}>
                Überstunden {sortKey === 'overtime' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <SortHeader label="Abwesend (Tage)" skey="absences" />
              <SortHeader label="Urlaub genutzt" skey="vacation" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr
                key={s.employee_id}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
              >
                <td className="sticky left-0 bg-inherit px-3 py-2 border border-gray-100 font-medium whitespace-nowrap">
                  {s.employee_name}
                </td>
                <td className="px-3 py-2 border border-gray-100 text-right text-gray-600">
                  {s.target_hours.toFixed(1)}h
                </td>
                <td className="px-3 py-2 border border-gray-100 text-right font-semibold text-gray-700">
                  {s.actual_hours.toFixed(1)}h
                </td>
                <td className="px-3 py-2 border border-gray-100">
                  <OvertimeBar value={s.overtime_hours} max={maxOvertime} />
                </td>
                <td className="px-3 py-2 border border-gray-100 text-right">
                  {s.absence_days > 0 ? (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                      {s.absence_days}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 border border-gray-100 text-right">
                  {s.vacation_used > 0 ? (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                      {s.vacation_used}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">
                  {loading ? 'Lade Statistiken...' : 'Keine Daten gefunden'}
                </td>
              </tr>
            )}
          </tbody>

          {sorted.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-gray-300">
                <td className="sticky left-0 bg-slate-100 px-3 py-2 border border-gray-200">
                  Gesamt ({sorted.length} MA)
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">{totalTarget.toFixed(1)}h</td>
                <td className="px-3 py-2 border border-gray-200 text-right">{totalActual.toFixed(1)}h</td>
                <td className="px-3 py-2 border border-gray-200">
                  <span className={`text-sm font-bold ${totalOvertime >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalOvertime >= 0 ? '+' : ''}{totalOvertime.toFixed(1)}h
                  </span>
                </td>
                <td className="px-3 py-2 border border-gray-200 text-right">{totalAbsences}</td>
                <td className="px-3 py-2 border border-gray-200 text-right">{totalVacation}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Zeitzuschlag Summary */}
      {extraSummary.length > 0 && (
        <div className="mt-4 bg-white rounded-lg shadow border border-gray-200">
          <div className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-t-lg flex items-center gap-2">
            <span>⏱️ Zeitzuschläge – {MONTH_NAMES[month]} {year}</span>
            <span className="text-slate-300 font-normal text-xs">(Alle Mitarbeiter)</span>
          </div>
          <div className="flex flex-wrap gap-3 p-4">
            {extraSummary.map(e => (
              <div
                key={e.charge_id}
                className="flex flex-col items-center bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 min-w-[130px] shadow-sm"
              >
                <div className="text-lg font-bold text-indigo-700">{e.hours.toFixed(1)}h</div>
                <div className="text-xs font-semibold text-indigo-600 mt-0.5 text-center">{e.charge_name}</div>
                <div className="text-xs text-gray-400 mt-1">{e.shift_count} Schicht{e.shift_count !== 1 ? 'en' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
