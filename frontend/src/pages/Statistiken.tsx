import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { EmployeeStats, ExtraChargeSummary, EmployeeYearStats, SicknessStatistics } from '../api/client';
import type { Employee, Group } from '../types';

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

// ── CSV Export for employee yearly view ────────────────────
function exportEmployeeCSV(data: EmployeeYearStats) {
  const monthNames = [
    '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
  ];
  const header = [
    'Monat', 'Soll-Stunden', 'Ist-Stunden', 'Differenz',
    'Schichten', 'Wochenend-Schichten', 'Nacht-Schichten',
    'Urlaubstage', 'Abwesenheitstage',
  ].join(';');

  const rows = data.months.map(m =>
    [
      monthNames[m.month],
      m.target_hours.toFixed(2).replace('.', ','),
      m.actual_hours.toFixed(2).replace('.', ','),
      m.difference.toFixed(2).replace('.', ','),
      m.shifts_count,
      m.weekend_shifts,
      m.night_shifts,
      m.vacation_days,
      m.absence_days,
    ].join(';')
  );

  const t = data.totals;
  const totalRow = [
    'GESAMT',
    t.target_hours.toFixed(2).replace('.', ','),
    t.actual_hours.toFixed(2).replace('.', ','),
    t.difference.toFixed(2).replace('.', ','),
    t.shifts_count,
    t.weekend_shifts,
    t.night_shifts,
    t.vacation_days,
    t.absence_days,
  ].join(';');

  const csv = [
    `Mitarbeiter-Stundenauswertung ${data.year}`,
    `${data.employee_name} (${data.employee_short || data.employee_number || ''})`,
    '',
    header,
    ...rows,
    totalRow,
  ].join('\r\n');

  const bom = '\uFEFF'; // UTF-8 BOM for Excel
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Stundenauswertung_${data.employee_short || data.employee_id}_${data.year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

  // ── Tabs ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'group' | 'employee' | 'sickness'>('group');

  // ── Group-view state ────────────────────────────────────
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

  // ── Employee-view state ─────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empYear, setEmpYear] = useState(now.getFullYear());
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [empStats, setEmpStats] = useState<EmployeeYearStats | null>(null);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);

  // ── Sickness/Krankenstand state ─────────────────────────
  const [sickYear, setSickYear] = useState(now.getFullYear());
  const [sickData, setSickData] = useState<SicknessStatistics | null>(null);
  const [sickLoading, setSickLoading] = useState(false);
  const [sickError, setSickError] = useState<string | null>(null);

  // Load groups + employees once
  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
    api.getEmployees().then(emps => {
      setEmployees(emps);
      if (emps.length > 0 && selectedEmpId === null) {
        setSelectedEmpId(emps[0].ID);
      }
    }).catch(() => {});
  }, []);

  // Load group statistics
  useEffect(() => {
    if (activeTab !== 'group') return;
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
  }, [year, month, groupId, activeTab]);

  // Load employee yearly stats
  const loadEmpStats = useCallback(() => {
    if (selectedEmpId === null) return;
    setEmpLoading(true);
    setEmpError(null);
    api.getEmployeeStatsYear(selectedEmpId, empYear)
      .then(data => { setEmpStats(data); setEmpLoading(false); })
      .catch(e => { setEmpError(e.message); setEmpLoading(false); });
  }, [selectedEmpId, empYear]);

  useEffect(() => {
    if (activeTab !== 'employee') return;
    loadEmpStats();
  }, [activeTab, loadEmpStats]);

  // Load sickness statistics
  useEffect(() => {
    if (activeTab !== 'sickness') return;
    setSickLoading(true);
    setSickError(null);
    api.getSicknessStatistics(sickYear)
      .then(data => { setSickData(data); setSickLoading(false); })
      .catch(e => { setSickError(e.message); setSickLoading(false); });
  }, [activeTab, sickYear]);

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
      {/* Page header + tab switcher */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">📈 Statistiken</h1>
        <div className="flex rounded-lg border overflow-x-auto shadow-sm text-sm min-w-0">
          <button
            className={`px-4 py-1.5 transition-colors ${activeTab === 'group' ? 'bg-slate-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
            onClick={() => setActiveTab('group')}
          >
            Gruppenauswertung
          </button>
          <button
            className={`px-4 py-1.5 transition-colors ${activeTab === 'employee' ? 'bg-slate-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
            onClick={() => setActiveTab('employee')}
          >
            👤 Mitarbeiter-Auswertung
          </button>
          <button
            className={`px-4 py-1.5 transition-colors ${activeTab === 'sickness' ? 'bg-red-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
            onClick={() => setActiveTab('sickness')}
          >
            🏥 Krankenstand
          </button>
        </div>
      </div>

      {/* ── EMPLOYEE VIEW ──────────────────────────────────── */}
      {activeTab === 'employee' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Controls */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select
              value={selectedEmpId ?? ''}
              onChange={e => setSelectedEmpId(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 bg-white border rounded shadow-sm text-sm min-w-[200px]"
            >
              <option value="">— Mitarbeiter wählen —</option>
              {employees.map(e => (
                <option key={e.ID} value={e.ID}>
                  {e.NAME}{e.FIRSTNAME ? `, ${e.FIRSTNAME}` : ''} {e.SHORTNAME ? `(${e.SHORTNAME})` : ''}
                </option>
              ))}
            </select>

            {/* Year selector */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEmpYear(y => y - 1)}
                className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
              >‹</button>
              <span className="font-semibold text-gray-700 min-w-[50px] text-center">{empYear}</span>
              <button
                onClick={() => setEmpYear(y => y + 1)}
                className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
              >›</button>
            </div>

            {empLoading && <span className="text-sm text-blue-500 animate-pulse">Lade...</span>}
            {empError && <span className="text-sm text-red-500">Fehler: {empError}</span>}

            {/* CSV Export */}
            {empStats && (
              <button
                onClick={() => exportEmployeeCSV(empStats)}
                className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded shadow-sm flex items-center gap-1.5"
                title="Persönliche Stundenübersicht als CSV exportieren"
              >
                ⬇️ CSV exportieren
              </button>
            )}
          </div>

          {/* Employee info banner */}
          {empStats && (
            <div className="mb-3 px-4 py-2 bg-slate-100 rounded-lg border text-sm text-gray-700 flex flex-wrap gap-4">
              <span className="font-semibold text-gray-900">{empStats.employee_name}</span>
              {empStats.employee_short && <span className="text-gray-500">Kürzel: {empStats.employee_short}</span>}
              {empStats.employee_number && <span className="text-gray-500">Nr.: {empStats.employee_number}</span>}
              <span className="text-gray-500">Jahr: {empStats.year}</span>
            </div>
          )}

          {/* Summary cards */}
          {empStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-3">
              {[
                { label: 'Soll-Std', value: `${empStats.totals.target_hours.toFixed(0)}h`, color: 'text-gray-700' },
                { label: 'Ist-Std', value: `${empStats.totals.actual_hours.toFixed(0)}h`, color: 'text-blue-700' },
                {
                  label: 'Differenz',
                  value: `${empStats.totals.difference >= 0 ? '+' : ''}${empStats.totals.difference.toFixed(0)}h`,
                  color: empStats.totals.difference >= 0 ? 'text-green-700' : 'text-red-700',
                },
                { label: 'Schichten', value: String(empStats.totals.shifts_count), color: 'text-gray-700' },
                { label: 'Wochenende', value: String(empStats.totals.weekend_shifts), color: 'text-orange-700' },
                { label: 'Nachtschichten', value: String(empStats.totals.night_shifts), color: 'text-indigo-700' },
                { label: 'Urlaubstage', value: String(empStats.totals.vacation_days), color: 'text-sky-700' },
                { label: 'Abwesenheit', value: String(empStats.totals.absence_days), color: 'text-amber-700' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-lg border p-2 shadow-sm text-center">
                  <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Month-by-month table */}
          <div className="flex-1 overflow-auto bg-white rounded-lg shadow border border-gray-200">
            {!empStats && !empLoading && (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                {selectedEmpId ? 'Lade Daten...' : 'Bitte einen Mitarbeiter auswählen'}
              </div>
            )}
            {empStats && (
              <table className="border-collapse text-sm w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 text-xs">
                    <th className="px-3 py-2 text-left border border-gray-200 font-semibold">Monat</th>
                    <th className="px-3 py-2 text-right border border-gray-200 whitespace-nowrap">Soll-Std</th>
                    <th className="px-3 py-2 text-right border border-gray-200 whitespace-nowrap">Ist-Std</th>
                    <th className="px-3 py-2 text-right border border-gray-200 whitespace-nowrap">Differenz</th>
                    <th className="px-3 py-2 text-right border border-gray-200 whitespace-nowrap">Schichten</th>
                    <th className="px-3 py-2 text-right border border-gray-200 whitespace-nowrap">🌅 Wochenende</th>
                    <th className="px-3 py-2 text-right border border-gray-200 whitespace-nowrap">🌙 Nacht</th>
                    <th className="px-3 py-2 text-right border border-gray-200 whitespace-nowrap">🏖️ Urlaub</th>
                    <th className="px-3 py-2 text-right border border-gray-200 whitespace-nowrap">Abwesend</th>
                  </tr>
                </thead>
                <tbody>
                  {empStats.months.map((m, i) => {
                    const diff = m.difference;
                    const isCurrentMonth =
                      empStats.year === now.getFullYear() && m.month === now.getMonth() + 1;
                    const rowBg = isCurrentMonth
                      ? 'bg-blue-50'
                      : i % 2 === 0
                      ? 'bg-white'
                      : 'bg-gray-50';
                    return (
                      <tr key={m.month} className={`${rowBg} hover:bg-blue-50/70 transition-colors`}>
                        <td className={`px-3 py-2 border border-gray-100 font-medium ${isCurrentMonth ? 'text-blue-700' : 'text-gray-800'}`}>
                          {MONTH_NAMES[m.month]}
                          {isCurrentMonth && <span className="ml-1 text-xs text-blue-400">(aktuell)</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-right text-gray-600">
                          {m.target_hours > 0 ? `${m.target_hours.toFixed(1)}h` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-right font-semibold text-gray-800">
                          {m.actual_hours > 0 ? `${m.actual_hours.toFixed(1)}h` : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-right">
                          {m.target_hours > 0 ? (
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {diff >= 0 ? '+' : ''}{diff.toFixed(1)}h
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-right text-gray-600">
                          {m.shifts_count > 0 ? m.shifts_count : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-right">
                          {m.weekend_shifts > 0 ? (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-semibold">
                              {m.weekend_shifts}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-right">
                          {m.night_shifts > 0 ? (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                              {m.night_shifts}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-right">
                          {m.vacation_days > 0 ? (
                            <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-xs font-semibold">
                              {m.vacation_days}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-right">
                          {m.absence_days > 0 ? (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                              {m.absence_days}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-gray-300 text-sm">
                    <td className="px-3 py-2 border border-gray-200">Gesamt {empYear}</td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-gray-700">
                      {empStats.totals.target_hours.toFixed(1)}h
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-blue-700">
                      {empStats.totals.actual_hours.toFixed(1)}h
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-right">
                      <span className={`font-bold ${empStats.totals.difference >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {empStats.totals.difference >= 0 ? '+' : ''}{empStats.totals.difference.toFixed(1)}h
                      </span>
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-gray-700">
                      {empStats.totals.shifts_count}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-orange-700">
                      {empStats.totals.weekend_shifts}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-indigo-700">
                      {empStats.totals.night_shifts}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-sky-700">
                      {empStats.totals.vacation_days}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-amber-700">
                      {empStats.totals.absence_days}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── GROUP VIEW ─────────────────────────────────────── */}
      {activeTab === 'group' && (<>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
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
        <button
          onClick={() => window.print()}
          className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
          title="Seite drucken"
        >
          🖨️ <span className="hidden sm:inline">Drucken</span>
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
      </>)}

      {/* ── SICKNESS / KRANKENSTAND VIEW ────────────────────── */}
      {activeTab === 'sickness' && (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSickYear(y => y - 1)}
                className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
              >‹</button>
              <span className="font-semibold text-gray-700 min-w-[50px] text-center">{sickYear}</span>
              <button
                onClick={() => setSickYear(y => y + 1)}
                className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
              >›</button>
            </div>

            {sickLoading && <span className="text-sm text-blue-500 animate-pulse">Lade...</span>}
            {sickError && <span className="text-sm text-red-500">Fehler: {sickError}</span>}

            {/* CSV Export */}
            {sickData && (
              <button
                onClick={() => exportSicknessCSV(sickData)}
                className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded shadow-sm flex items-center gap-1.5"
                title="Krankenstand-Auswertung als CSV exportieren"
              >
                ⬇️ CSV exportieren
              </button>
            )}
          </div>

          {/* No data / loading state */}
          {!sickData && !sickLoading && (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              Keine Daten verfügbar
            </div>
          )}

          {sickData && (
            <>
              {/* Summary KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg border shadow-sm p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{sickData.total_sick_days}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Gesamt Krankheitstage</div>
                </div>
                <div className="bg-white rounded-lg border shadow-sm p-3 text-center">
                  <div className="text-2xl font-bold text-orange-600">{sickData.affected_employees}</div>
                  <div className="text-xs text-gray-500 mt-0.5">betroffene Mitarbeiter</div>
                </div>
                <div className="bg-white rounded-lg border shadow-sm p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700">
                    {sickData.total_employees > 0
                      ? ((sickData.total_sick_days / sickData.total_employees)).toFixed(1)
                      : '0'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Ø Tage / Mitarbeiter</div>
                </div>
                <div className="bg-white rounded-lg border shadow-sm p-3 text-center">
                  <div className="text-2xl font-bold text-purple-700">
                    {sickData.per_employee.reduce((s, e) => s + e.sick_episodes, 0)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Krankmeldungen gesamt</div>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Chart 1: Monats-Trend */}
                <div className="bg-white rounded-lg border shadow-sm p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-3">📅 Krankheitstage pro Monat</div>
                  {sickData.total_sick_days === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-6">Keine Krankmeldungen im Jahr {sickYear}</div>
                  ) : (
                    <div className="flex items-end gap-1 h-32">
                      {sickData.per_month.map(m => {
                        const maxDays = Math.max(...sickData.per_month.map(x => x.sick_days), 1);
                        const heightPct = m.sick_days > 0 ? Math.max((m.sick_days / maxDays) * 100, 8) : 0;
                        const shortNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
                        const isCurrentMonth = m.month === now.getMonth() + 1 && sickYear === now.getFullYear();
                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="text-xs font-semibold text-red-700 leading-none">
                              {m.sick_days > 0 ? m.sick_days : ''}
                            </div>
                            <div className="w-full flex items-end justify-center" style={{ height: '96px' }}>
                              <div
                                className={`w-full rounded-t transition-all ${isCurrentMonth ? 'bg-red-500' : 'bg-red-300 hover:bg-red-400'}`}
                                style={{ height: `${heightPct}%`, minHeight: m.sick_days > 0 ? '4px' : '0' }}
                                title={`${shortNames[m.month - 1]}: ${m.sick_days} Tag${m.sick_days !== 1 ? 'e' : ''}`}
                              />
                            </div>
                            <div className={`text-xs leading-none ${isCurrentMonth ? 'font-bold text-red-600' : 'text-gray-500'}`}>
                              {shortNames[m.month - 1]}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Chart 2: Wochentag-Verteilung */}
                <div className="bg-white rounded-lg border shadow-sm p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-3">📊 Krankheitstage nach Wochentag</div>
                  {sickData.total_sick_days === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-6">Keine Krankmeldungen im Jahr {sickYear}</div>
                  ) : (
                    <div className="flex items-end gap-1 h-32">
                      {sickData.per_weekday.map(wd => {
                        const maxDays = Math.max(...sickData.per_weekday.map(x => x.sick_days), 1);
                        const heightPct = wd.sick_days > 0 ? Math.max((wd.sick_days / maxDays) * 100, 8) : 0;
                        const isMonday = wd.weekday === 0;
                        const shortNames = ['Mo','Di','Mi','Do','Fr','Sa','So'];
                        const isWeekend = wd.weekday >= 5;
                        const barColor = isMonday
                          ? 'bg-orange-500 hover:bg-orange-600'
                          : isWeekend
                          ? 'bg-gray-300 hover:bg-gray-400'
                          : 'bg-blue-400 hover:bg-blue-500';
                        return (
                          <div key={wd.weekday} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className={`text-xs font-semibold leading-none ${isMonday ? 'text-orange-600' : 'text-blue-700'}`}>
                              {wd.sick_days > 0 ? wd.sick_days : ''}
                            </div>
                            <div className="w-full flex items-end justify-center" style={{ height: '96px' }}>
                              <div
                                className={`w-full rounded-t transition-all ${barColor}`}
                                style={{ height: `${heightPct}%`, minHeight: wd.sick_days > 0 ? '4px' : '0' }}
                                title={`${wd.weekday_name}: ${wd.sick_days} Tag${wd.sick_days !== 1 ? 'e' : ''}`}
                              />
                            </div>
                            <div className={`text-xs leading-none font-medium ${isMonday ? 'text-orange-600 font-bold' : isWeekend ? 'text-gray-400' : 'text-gray-600'}`}>
                              {shortNames[wd.weekday]}
                              {isMonday && <span className="ml-0.5">⚠️</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {sickData.total_sick_days > 0 && sickData.per_weekday[0].sick_days > 0 && (
                    <div className="mt-2 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">
                      ⚠️ Montags-Phänomen: {sickData.per_weekday[0].sick_days} Krankmeldungen am Montag
                      {sickData.per_weekday[4].sick_days > 0 && ` | Freitag: ${sickData.per_weekday[4].sick_days}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 3: Mitarbeiter-Balken + Bradford-Tabelle */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* MA Bar Chart */}
                <div className="bg-white rounded-lg border shadow-sm p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-3">👤 Krankheitstage pro Mitarbeiter</div>
                  {sickData.per_employee.filter(e => e.sick_days > 0).length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-6">Alle Mitarbeiter ohne Krankmeldungen</div>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {(() => {
                        const withSick = sickData.per_employee.filter(e => e.sick_days > 0);
                        const maxDays = Math.max(...withSick.map(e => e.sick_days), 1);
                        return withSick.map(e => (
                          <div key={e.employee_id} className="flex items-center gap-2">
                            <div className="text-xs text-gray-600 w-28 truncate shrink-0 text-right" title={e.employee_name}>
                              {e.employee_short || e.employee_name.split(',')[0]}
                            </div>
                            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                              <div
                                className="h-full bg-red-400 rounded hover:bg-red-500 transition-colors"
                                style={{ width: `${(e.sick_days / maxDays) * 100}%` }}
                                title={`${e.employee_name}: ${e.sick_days} Tag${e.sick_days !== 1 ? 'e' : ''}`}
                              />
                            </div>
                            <div className="text-xs font-semibold text-red-700 w-6 text-right shrink-0">{e.sick_days}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                {/* Bradford Factor Table */}
                <div className="bg-white rounded-lg border shadow-sm p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-1">📋 Bradford-Faktor</div>
                  <div className="text-xs text-gray-500 mb-3">B = S² × D &nbsp;|&nbsp; S = Episoden, D = Tage &nbsp;|&nbsp; Hoch = viele Kurzabsenzen</div>
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-xs">
                          <th className="px-2 py-1.5 text-left border border-gray-200 font-semibold">Mitarbeiter</th>
                          <th className="px-2 py-1.5 text-right border border-gray-200">Tage</th>
                          <th className="px-2 py-1.5 text-right border border-gray-200">Episoden</th>
                          <th className="px-2 py-1.5 text-right border border-gray-200">Bradford</th>
                          <th className="px-2 py-1.5 text-left border border-gray-200">Risiko</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sickData.per_employee
                          .filter(e => e.sick_days > 0)
                          .sort((a, b) => b.bradford_factor - a.bradford_factor)
                          .map((e, i) => {
                            const bf = e.bradford_factor;
                            const risk = bf >= 500 ? { label: '🔴 Hoch', cls: 'text-red-700 bg-red-50' }
                              : bf >= 200 ? { label: '🟠 Mittel', cls: 'text-orange-700 bg-orange-50' }
                              : bf >= 50  ? { label: '🟡 Gering', cls: 'text-yellow-700 bg-yellow-50' }
                              : { label: '🟢 OK', cls: 'text-green-700 bg-green-50' };
                            return (
                              <tr key={e.employee_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-2 py-1 border border-gray-100 font-medium" title={e.employee_name}>
                                  {e.employee_name.length > 18 ? e.employee_name.slice(0, 17) + '…' : e.employee_name}
                                </td>
                                <td className="px-2 py-1 border border-gray-100 text-right text-red-600 font-semibold">{e.sick_days}</td>
                                <td className="px-2 py-1 border border-gray-100 text-right text-gray-600">{e.sick_episodes}</td>
                                <td className="px-2 py-1 border border-gray-100 text-right font-bold text-purple-700">{bf}</td>
                                <td className="px-2 py-1 border border-gray-100">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${risk.cls}`}>{risk.label}</span>
                                </td>
                              </tr>
                            );
                          })}
                        {sickData.per_employee.filter(e => e.sick_days > 0).length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-gray-400">Keine Krankmeldungen</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Schwellenwerte: 🟢 &lt;50 &nbsp; 🟡 50–199 &nbsp; 🟠 200–499 &nbsp; 🔴 ≥500
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── CSV export for sickness statistics ───────────────────
function exportSicknessCSV(data: SicknessStatistics) {
  const MONTH_NAMES_CSV = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  const header = 'Mitarbeiter;Kürzel;Gruppe;Krankheitstage;Episoden;Bradford-Faktor;Risiko';
  const rows = data.per_employee.map(e => {
    const bf = e.bradford_factor;
    const risk = bf >= 500 ? 'Hoch' : bf >= 200 ? 'Mittel' : bf >= 50 ? 'Gering' : 'OK';
    return [
      e.employee_name,
      e.employee_short,
      e.group_name,
      e.sick_days,
      e.sick_episodes,
      bf,
      risk,
    ].join(';');
  });

  const monthSection = '\r\n\r\nMonats-Übersicht\r\nMonat;Krankheitstage\r\n' +
    data.per_month.map(m => `${MONTH_NAMES_CSV[m.month]};${m.sick_days}`).join('\r\n');

  const wdSection = '\r\n\r\nWochentag-Verteilung\r\nWochentag;Krankheitstage\r\n' +
    data.per_weekday.map(w => `${w.weekday_name};${w.sick_days}`).join('\r\n');

  const summary = [
    `Krankenstand-Auswertung ${data.year}`,
    `Gesamt: ${data.total_sick_days} Krankheitstage bei ${data.affected_employees} von ${data.total_employees} Mitarbeitern`,
    '',
    header,
    ...rows,
    monthSection,
    wdSection,
  ].join('\r\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + summary], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Krankenstand_${data.year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
