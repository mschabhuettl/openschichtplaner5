import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { MonthSummary } from '../api/client';
import type { Employee, Group, ShiftType, LeaveType } from '../types';

// Map: SHORTNAME → { bk, text }
type ShiftColorMap = Map<string, { bk: string; text: string }>;

function buildShiftColorMap(shifts: ShiftType[], leaveTypes: LeaveType[]): ShiftColorMap {
  const m = new Map<string, { bk: string; text: string }>();
  for (const s of shifts) {
    m.set(s.SHORTNAME, { bk: s.COLORBK_HEX || '#64748b', text: s.COLORTEXT_HEX || '#fff' });
  }
  for (const lt of leaveTypes) {
    m.set(lt.SHORTNAME, { bk: lt.COLORBK_HEX || '#fbbf24', text: '#333' });
  }
  return m;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
// ── Print helper ───────────────────────────────────────────────
function buildJahresuebersichtHTML(
  employees: Employee[],
  dataMap: Map<number, MonthSummary[]>,
  year: number,
  groupLabel: string,
): string {
  const thStyle = 'border:1px solid #aaa;padding:4px 6px;background:#334155;color:#fff;font-size:11px;text-align:center;white-space:nowrap;';
  const tdNameStyle = 'border:1px solid #ddd;padding:3px 8px;font-size:11px;white-space:nowrap;font-weight:500;';
  const tdStyle = 'border:1px solid #ddd;padding:3px 4px;font-size:10px;text-align:center;min-width:70px;vertical-align:top;';

  let headerCells = `<th style="${thStyle}min-width:160px;text-align:left">Mitarbeiter</th>`;
  for (const m of MONTH_ABBR) {
    headerCells += `<th style="${thStyle}">${m}</th>`;
  }
  headerCells += `<th style="${thStyle}background:#1e293b">Gesamt</th>`;

  let bodyRows = '';
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const empData = dataMap.get(emp.ID) || [];
    const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const totalShifts = empData.reduce((a, m) => a + m.shifts, 0);
    const totalActual = empData.reduce((a, m) => a + m.actual_hours, 0);
    const totalTarget = empData.reduce((a, m) => a + m.target_hours, 0);
    const totalOT = totalActual - totalTarget;

    let cells = `<td style="${tdNameStyle}background:${rowBg}">${emp.NAME}, ${emp.FIRSTNAME}</td>`;
    for (let mi = 0; mi < 12; mi++) {
      const m = empData[mi];
      if (!m || (m.shifts === 0 && m.absences === 0)) {
        cells += `<td style="${tdStyle}background:${rowBg};color:#ccc">—</td>`;
      } else {
        const ot = m.actual_hours - m.target_hours;
        const otColor = ot >= 0 ? '#16a34a' : '#dc2626';
        const labels = Object.entries(m.label_counts)
          .sort((a, b) => b[1] - a[1]).slice(0, 4)
          .map(([l, c]) => `${l}${c > 1 ? `×${c}` : ''}`)
          .join(' ');
        cells += `<td style="${tdStyle}background:${rowBg}">
          <div style="font-family:monospace;font-size:9px;color:#374151">${labels}</div>
          <div style="margin-top:2px">
            ${m.shifts > 0 ? `<span style="background:#dbeafe;color:#1d4ed8;border-radius:3px;padding:0 3px;font-size:9px">${m.shifts}S</span> ` : ''}
            ${m.absences > 0 ? `<span style="background:#fef3c7;color:#b45309;border-radius:3px;padding:0 3px;font-size:9px">${m.absences}A</span>` : ''}
          </div>
          <div style="font-size:9px;font-weight:600;color:${otColor}">${ot >= 0 ? '+' : ''}${ot.toFixed(1)}h</div>
        </td>`;
      }
    }
    // Totals cell
    const otColor = totalOT >= 0 ? '#16a34a' : '#dc2626';
    cells += `<td style="${tdStyle}background:#f1f5f9;font-weight:bold">
      <div style="color:#1d4ed8;font-size:10px">${totalShifts}S</div>
      <div style="color:${otColor};font-size:10px">${totalOT >= 0 ? '+' : ''}${totalOT.toFixed(0)}h</div>
    </td>`;

    bodyRows += `<tr>${cells}</tr>`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Jahresübersicht ${year}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 12px; }
  h1 { font-size: 15px; margin-bottom: 2px; }
  .subtitle { font-size: 11px; color: #555; margin-bottom: 10px; }
  table { border-collapse: collapse; }
  @media print {
    @page { size: landscape; margin: 6mm; }
    body { margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
<h1>Jahresübersicht ${year}</h1>
<div class="subtitle">Gruppe: ${groupLabel} &nbsp;|&nbsp; ${employees.length} Mitarbeiter &nbsp;|&nbsp; Erstellt: ${new Date().toLocaleString('de-AT')}</div>
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
}

function openPrintWindowJ(html: string) {
  const w = window.open('', '_blank', 'width=1400,height=900');
  if (!w) { alert('Popup-Fenster blockiert! Bitte den Popup-Blocker für diese Seite deaktivieren.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}


function ShiftBadge({ label, count, colorMap }: { label: string; count: number; colorMap: ShiftColorMap }) {
  const col = colorMap.get(label);
  const text = count > 1 ? `${label}×${count}` : label;
  if (col) {
    return (
      <span
        className="inline-block px-1 rounded font-bold leading-tight"
        style={{ backgroundColor: col.bk, color: col.text, fontSize: '9px' }}
      >{text}</span>
    );
  }
  return <span className="font-mono text-gray-600" style={{ fontSize: '9px' }}>{text}</span>;
}

function MonthCell({ summary, colorMap }: { summary: MonthSummary; colorMap: ShiftColorMap }) {
  const topLabels = Object.entries(summary.label_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hasData = summary.shifts > 0 || summary.absences > 0;
  const overtime = summary.actual_hours - summary.target_hours;

  return (
    <td className={`border border-gray-200 p-1.5 align-top text-xs min-w-[90px] ${hasData ? '' : 'bg-gray-50'}`}>
      {hasData ? (
        <div className="space-y-0.5">
          {topLabels.length > 0 && (
            <div className="flex flex-wrap gap-0.5 leading-tight">
              {topLabels.map(([label, count]) => (
                <ShiftBadge key={label} label={label} count={count} colorMap={colorMap} />
              ))}
            </div>
          )}
          <div className="flex gap-1 text-[10px]">
            {summary.shifts > 0 && (
              <span className="px-1 bg-blue-100 text-blue-700 rounded">{summary.shifts}S</span>
            )}
            {summary.absences > 0 && (
              <span className="px-1 bg-amber-100 text-amber-700 rounded">{summary.absences}A</span>
            )}
          </div>
          <div className={`text-[10px] font-medium ${overtime >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {overtime >= 0 ? '+' : ''}{overtime.toFixed(1)}h
          </div>
        </div>
      ) : (
        <div className="text-gray-300 text-center">—</div>
      )}
    </td>
  );
}

// Single employee view (detailed)
function SingleEmployeeView({
  employee,
  year,
  colorMap,
}: {
  employee: Employee;
  year: number;
  colorMap: ShiftColorMap;
}) {
  const [data, setData] = useState<MonthSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getScheduleYear(year, employee.ID)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Fehler beim Laden'); setLoading(false); });
  }, [year, employee.ID]);

  const totalShifts = data.reduce((a, m) => a + m.shifts, 0);
  const totalAbsences = data.reduce((a, m) => a + m.absences, 0);
  const totalActual = data.reduce((a, m) => a + m.actual_hours, 0);
  const totalTarget = data.reduce((a, m) => a + m.target_hours, 0);
  const totalOvertime = totalActual - totalTarget;

  // Collect all shift labels used
  const allLabels = new Map<string, number>();
  for (const m of data) {
    for (const [label, count] of Object.entries(m.label_counts)) {
      allLabels.set(label, (allLabels.get(label) || 0) + count);
    }
  }

  if (loading) return <div className="text-gray-400 animate-pulse">Lade...</div>;
  if (error) return <div className="text-red-500 text-sm p-2">⚠️ {error}</div>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{totalShifts}</div>
          <div className="text-xs text-blue-600">Schichten</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">{totalAbsences}</div>
          <div className="text-xs text-amber-600">Abwesenheiten</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-700">{totalActual.toFixed(0)}h</div>
          <div className="text-xs text-gray-600">Ist-Stunden</div>
        </div>
        <div className={`rounded-lg p-3 text-center ${totalOvertime >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`text-2xl font-bold ${totalOvertime >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totalOvertime >= 0 ? '+' : ''}{totalOvertime.toFixed(1)}h
          </div>
          <div className={`text-xs ${totalOvertime >= 0 ? 'text-green-600' : 'text-red-600'}`}>Überstunden</div>
        </div>
      </div>

      {/* Month-by-month table */}
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm w-full min-w-[640px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="px-3 py-2 text-left border border-gray-200">Monat</th>
              <th className="px-3 py-2 text-right border border-gray-200">Schichten</th>
              <th className="px-3 py-2 text-right border border-gray-200">Abwesend</th>
              <th className="px-3 py-2 text-right border border-gray-200">Soll-Std</th>
              <th className="px-3 py-2 text-right border border-gray-200">Ist-Std</th>
              <th className="px-3 py-2 text-right border border-gray-200">Über/Unter</th>
              <th className="px-3 py-2 text-left border border-gray-200">Schichtarten</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => {
              const ot = m.actual_hours - m.target_hours;
              const labelEntries = Object.entries(m.label_counts).sort((a, b) => b[1] - a[1]);
              return (
                <tr key={m.month} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-1.5 border border-gray-200 font-medium">
                    {MONTH_ABBR[m.month - 1]} {year}
                  </td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right text-blue-700 font-semibold">
                    {m.shifts > 0 ? m.shifts : '—'}
                  </td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right text-amber-700">
                    {m.absences > 0 ? m.absences : '—'}
                  </td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right text-gray-600">
                    {m.target_hours.toFixed(1)}h
                  </td>
                  <td className="px-3 py-1.5 border border-gray-200 text-right text-gray-700 font-medium">
                    {m.actual_hours.toFixed(1)}h
                  </td>
                  <td className={`px-3 py-1.5 border border-gray-200 text-right font-semibold ${ot >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {ot >= 0 ? '+' : ''}{ot.toFixed(1)}h
                  </td>
                  <td className="px-3 py-1.5 border border-gray-200">
                    {labelEntries.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {labelEntries.map(([l, c]) => (
                          <ShiftBadge key={l} label={l} count={c} colorMap={colorMap} />
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="bg-slate-100 font-bold">
              <td className="px-3 py-2 border border-gray-300">Gesamt</td>
              <td className="px-3 py-2 border border-gray-300 text-right text-blue-700">{totalShifts}</td>
              <td className="px-3 py-2 border border-gray-300 text-right text-amber-700">{totalAbsences}</td>
              <td className="px-3 py-2 border border-gray-300 text-right">{totalTarget.toFixed(1)}h</td>
              <td className="px-3 py-2 border border-gray-300 text-right">{totalActual.toFixed(1)}h</td>
              <td className={`px-3 py-2 border border-gray-300 text-right ${totalOvertime >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalOvertime >= 0 ? '+' : ''}{totalOvertime.toFixed(1)}h
              </td>
              <td className="px-3 py-2 border border-gray-300">
                <div className="flex flex-wrap gap-1">
                  {Array.from(allLabels.entries()).sort((a, b) => b[1] - a[1]).map(([l, c]) => (
                    <ShiftBadge key={l} label={l} count={c} colorMap={colorMap} />
                  ))}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// All employees compact view
function AllEmployeesView({
  employees,
  year,
  groupId,
  colorMap,
}: {
  employees: Employee[];
  year: number;
  groupId: number | undefined;
  colorMap: ShiftColorMap;
}) {
  const [dataMap, setDataMap] = useState<Map<number, MonthSummary[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredEmps = employees; // already filtered by parent

  useEffect(() => {
    if (filteredEmps.length === 0) return;
    setLoading(true);
    setError(null);
    Promise.all(filteredEmps.map(e => api.getScheduleYear(year, e.ID).then(d => [e.ID, d] as [number, MonthSummary[]])))
      .then(results => {
        const map = new Map<number, MonthSummary[]>();
        results.forEach(([id, d]) => map.set(id, d));
        setDataMap(map);
        setLoading(false);
      })
      .catch(() => { setError('Fehler beim Laden der Jahresübersicht'); setLoading(false); });
  }, [year, filteredEmps.length, groupId]);

  if (loading) return <div className="text-gray-400 animate-pulse py-8 text-center">Lade Jahresübersicht...</div>;
  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">⚠️ {error}</div>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs min-w-[900px]">
        <thead>
          <tr className="bg-slate-700 text-white">
            <th className="sticky left-0 z-10 bg-slate-700 px-3 py-2 text-left min-w-[160px] border-r border-slate-600">
              Mitarbeiter
            </th>
            {MONTH_ABBR.map((m, i) => (
              <th key={i} className="px-1 py-2 text-center min-w-[90px] border-r border-slate-600">
                {m}
              </th>
            ))}
            <th className="px-2 py-2 text-center min-w-[80px] border-l border-slate-500 bg-slate-600">
              Gesamt
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredEmps.map((emp, idx) => {
            const empData = dataMap.get(emp.ID) || [];
            const totalShifts = empData.reduce((a, m) => a + m.shifts, 0);
            const totalActual = empData.reduce((a, m) => a + m.actual_hours, 0);
            const totalTarget = empData.reduce((a, m) => a + m.target_hours, 0);
            const totalOvertime = totalActual - totalTarget;

            return (
              <tr key={emp.ID} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="sticky left-0 z-10 bg-inherit px-3 py-1 border-r border-gray-200 font-medium whitespace-nowrap border-b border-b-gray-100">
                  {emp.NAME}, {emp.FIRSTNAME}
                </td>
                {empData.length > 0 ? (
                  empData.map(m => <MonthCell key={m.month} summary={m} colorMap={colorMap} />)
                ) : (
                  Array.from({ length: 12 }, (_, i) => (
                    <td key={i} className="border border-gray-200 p-1.5 bg-gray-50 text-center text-gray-300 text-xs">—</td>
                  ))
                )}
                <td className="border border-gray-200 p-1.5 text-center bg-slate-50">
                  <div className="text-xs font-bold text-blue-700">{totalShifts}S</div>
                  <div className={`text-xs font-semibold ${totalOvertime >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalOvertime >= 0 ? '+' : ''}{totalOvertime.toFixed(0)}h
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Jahresuebersicht() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | undefined>(undefined);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [printLoading, setPrintLoading] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<Set<number>>(new Set());
  const [colorMap, setColorMap] = useState<ShiftColorMap>(new Map());

  useEffect(() => {
    api.getEmployees().then(emps => {
      setEmployees(emps);
      if (emps.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(emps[0].ID);
      }
    }).catch(() => {});
    api.getGroups().then(setGroups).catch(() => {});
    Promise.all([api.getShifts(), api.getLeaveTypes()]).then(([shifts, leaveTypes]) => {
      setColorMap(buildShiftColorMap(shifts, leaveTypes));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!groupId) {
      setGroupMembers(new Set());
      return;
    }
    api.getGroupMembers(groupId).then(members => setGroupMembers(new Set(members.map(m => m.ID))));
  }, [groupId]);

  const filteredEmployees = groupId
    ? employees.filter(e => groupMembers.has(e.ID))
    : employees;

  const selectedEmployee = employees.find(e => e.ID === selectedEmployeeId);

  const handlePrint = async () => {
    setPrintLoading(true);
    try {
      const emps = filteredEmployees.length > 0 ? filteredEmployees : employees;
      const results = await Promise.all(
        emps.map(e => api.getScheduleYear(year, e.ID).then(d => [e.ID, d] as [number, MonthSummary[]])),
      );
      const dataMap = new Map<number, MonthSummary[]>(results);
      const groupLabel = groupId
        ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`)
        : 'Alle Gruppen';
      const html = buildJahresuebersichtHTML(emps, dataMap, year, groupLabel);
      openPrintWindowJ(html);
    } catch (e) {
      alert('Fehler beim Laden der Druckdaten: ' + (e as Error).message);
    } finally {
      setPrintLoading(false);
    }
  };

  return (
    <div className="p-2 sm:p-4 lg:p-6 h-full flex flex-col">
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 8mm; }
          body { font-size: 9px !important; background: white !important; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { border-collapse: collapse; font-size: 9px; }
          th, td { padding: 1px 3px !important; }
          tr { break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">📆 Jahresübersicht</h1>

        {/* Year navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">‹</button>
          <span className="font-bold text-gray-700 min-w-[60px] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">›</button>
        </div>

        {/* View mode */}
        <div className="flex rounded overflow-hidden border border-gray-300 text-sm">
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 ${viewMode === 'all' ? 'bg-slate-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Alle MA
          </button>
          <button
            onClick={() => setViewMode('single')}
            className={`px-3 py-1.5 border-l ${viewMode === 'single' ? 'bg-slate-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Einzelansicht
          </button>
        </div>

        {/* Group filter */}
        <select
          value={groupId ?? ''}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-1.5 bg-white border rounded shadow-sm text-sm"
        >
          <option value="">Alle Gruppen</option>
          {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
        </select>

        {/* Employee selector (always visible) */}
        <select
          value={selectedEmployeeId ?? ''}
          onChange={e => setSelectedEmployeeId(Number(e.target.value))}
          className="px-3 py-1.5 bg-white border rounded shadow-sm text-sm min-w-[200px]"
        >
          {filteredEmployees.map(e => (
            <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>
          ))}
        </select>

        {/* Print button */}
        <button
          onClick={handlePrint}
          disabled={printLoading}
          className="no-print ml-auto px-3 py-1.5 bg-slate-600 hover:bg-slate-700 disabled:opacity-60 text-white text-sm rounded shadow-sm flex items-center gap-1.5"
          title="Jahresübersicht in neuem Fenster drucken"
        >
          {printLoading ? '⏳ Lade...' : '🖨️ Drucken'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow border border-gray-200 p-4">
        {viewMode === 'single' && selectedEmployee ? (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {selectedEmployee.NAME}, {selectedEmployee.FIRSTNAME} — {year}
            </h2>
            <SingleEmployeeView employee={selectedEmployee} year={year} colorMap={colorMap} />
          </div>
        ) : (
          <AllEmployeesView employees={filteredEmployees} year={year} groupId={groupId} colorMap={colorMap} />
        )}
      </div>
    </div>
  );
}
