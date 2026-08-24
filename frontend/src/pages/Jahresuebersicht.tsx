import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { MonthSummary } from '../api/client';
import type { Employee, Group, ShiftType, LeaveType, ScheduleEntry } from '../types';
import { EmptyState, ApiErrorState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { JahresRaster } from '../components/JahresRaster';
import { buildDayMap, daysInMonth, monthStartOffset, toDateStr, MONTH_ABBR, WEEKDAY_ABBR, shortLabel, type JahresAusrichtung } from '../components/jahresRasterUtils';
import { groupTreeOptions } from '../utils/groupTree';
import { shiftCellColorsMemo } from '../utils/shiftColor';

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

// ── Print helper: Jahresraster (V-8, Spec 4.4) ─────────────────
function buildJahresrasterHTML(
  emp: Employee,
  year: number,
  dayMap: Map<string, ScheduleEntry[]>,
  holidays: Set<string>,
  ausrichtung: JahresAusrichtung,
): string {
  // Spaltenausrichtung wie in der Ansicht (Spec 4.11.11-1):
  // Kalendertage 1…31 (31 Spalten) oder Wochentage Mo…So (37 Spalten)
  const isWt = ausrichtung === 'wochentage';
  const colCount = isWt ? 37 : 31;
  const thStyle = 'border:1px solid #aaa;padding:2px 3px;background:#334155;color:#fff;font-size:10px;text-align:center;';
  let headerCells = `<th scope="col" style="${thStyle}text-align:left;min-width:42px">Monat</th>`;
  for (let c = 0; c < colCount; c++) headerCells += `<th scope="col" style="${thStyle}min-width:22px">${isWt ? WEEKDAY_ABBR[c % 7] : c + 1}</th>`;

  let bodyRows = '';
  for (let m = 1; m <= 12; m++) {
    const dim = daysInMonth(year, m);
    const offset = isWt ? monthStartOffset(year, m) : 0;
    let cells = `<th scope="row" style="border:1px solid #ddd;padding:2px 6px;background:#f1f5f9;font-size:10px;text-align:left">${MONTH_ABBR[m - 1]}</th>`;
    for (let c = 0; c < colCount; c++) {
      const d = c - offset + 1;
      if (d < 1 || d > dim) { cells += '<td style="border:1px solid #eee;background:#e2e8f0"></td>'; continue; }
      const dateStr = toDateStr(year, m, d);
      const entries = dayMap.get(dateStr) ?? [];
      const wd = new Date(year, m - 1, d).getDay();
      const tint = holidays.has(dateStr) ? '#fef2f2' : (wd === 0 || wd === 6) ? '#f1f5f9' : '#fff';
      if (entries.length === 0) {
        cells += `<td style="border:1px solid #ddd;background:${tint}"></td>`;
      } else {
        const bk = (entries.length === 1 && entries[0].color_bk) || tint;
        const text = (entries.length === 1 && entries[0].color_text) || '#000';
        const label = entries
          .map(e => `${e.source === 'cycle' ? '↻' : ''}${shortLabel(e.display_name || '?')}`)
          .join(' ');
        cells += `<td style="border:1px solid #ddd;background:${bk};color:${text};font-size:9px;font-weight:bold;text-align:center;padding:1px 2px">${label}</td>`;
      }
    }
    bodyRows += `<tr>${cells}</tr>`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Jahresübersicht ${year} — ${emp.NAME}, ${emp.FIRSTNAME}</title>
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
<h1>Jahresübersicht ${year} — ${emp.NAME}, ${emp.FIRSTNAME}</h1>
<div class="subtitle">Tagesraster (↻ = aus Schichtmodell) &nbsp;|&nbsp; Erstellt: ${new Date().toLocaleString('de-AT')}</div>
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
}

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

  let headerCells = `<th scope="col" style="${thStyle}min-width:160px;text-align:left">Mitarbeiter</th>`;
  for (const m of MONTH_ABBR) {
    headerCells += `<th scope="col" style="${thStyle}">${m}</th>`;
  }
  headerCells += `<th scope="col" style="${thStyle}background:#1e293b">Gesamt</th>`;

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
          .map(([l, c]) => `${shortLabel(l)}${c > 1 ? `×${c}` : ''}`)
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
  // Theme provider-frei, Muster der Menü-Chips in Schedule.tsx
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const col = colorMap.get(label);
  const short = shortLabel(label);
  const text = count > 1 ? `${short}×${count}` : short;
  if (col) {
    // Rohfarbe aus der DBF nie direkt rendern: Hue-Schiene + berechneter
    // Vordergrund (Taktwerk §4)
    const tw = shiftCellColorsMemo(col.bk, isDark ? 'dark' : 'light');
    return (
      <span
        className="inline-block px-1 rounded-cell font-bold leading-tight max-w-full truncate align-top"
        style={{ backgroundColor: tw.background, color: tw.color, fontSize: '9px' }}
        title={label !== short ? label : undefined}
      >{text}</span>
    );
  }
  return (
    <span
      className="font-mono text-schrift-2 inline-block max-w-full truncate align-top"
      style={{ fontSize: '9px' }}
      title={label !== short ? label : undefined}
    >{text}</span>
  );
}

function MonthCell({ summary, colorMap }: { summary: MonthSummary; colorMap: ShiftColorMap }) {
  const topLabels = Object.entries(summary.label_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hasData = summary.shifts > 0 || summary.absences > 0;
  const overtime = summary.actual_hours - summary.target_hours;

  return (
    <td className={`border border-kontur-soft p-1.5 align-top text-xs w-[90px] min-w-[90px] max-w-[90px] ${hasData ? '' : 'bg-wash'}`}>
      {hasData ? (
        <div className="space-y-0.5">
          {topLabels.length > 0 && (
            <div className="flex flex-wrap gap-0.5 leading-tight">
              {topLabels.map(([label, count]) => (
                <ShiftBadge key={label} label={label} count={count} colorMap={colorMap} />
              ))}
            </div>
          )}
          <div className="flex gap-1 text-[10px] font-mono tabular-nums">
            {summary.shifts > 0 && (
              <span className="px-1 bg-wash text-schrift-2 rounded-cell">{summary.shifts}S</span>
            )}
            {summary.absences > 0 && (
              <span className="px-1 bg-wash text-schrift-2 rounded-cell">{summary.absences}A</span>
            )}
          </div>
          <div className={`text-[10px] font-medium font-mono tabular-nums ${overtime < 0 ? 'text-signal' : 'text-schrift-2'}`}>
            {overtime >= 0 ? '+' : ''}{overtime.toFixed(1)}h
          </div>
        </div>
      ) : (
        <div className="text-schrift-3 text-center">—</div>
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

  if (loading) return (
    <LoadingSpinner />
  );
  if (error) return <ApiErrorState message={error} />;

  return (
    <div className="space-y-4">
      {/* Summary cards — neutrale Kacheln, negative Salden in Signal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-ebene border border-kontur rounded-panel p-3 text-center">
          <div className="text-2xl font-bold font-mono tabular-nums text-schrift">{totalShifts}</div>
          <div className="text-[10px] font-bold uppercase tracking-[.08em] text-schrift-3">Schichten</div>
        </div>
        <div className="bg-ebene border border-kontur rounded-panel p-3 text-center">
          <div className="text-2xl font-bold font-mono tabular-nums text-schrift">{totalAbsences}</div>
          <div className="text-[10px] font-bold uppercase tracking-[.08em] text-schrift-3">Abwesenheiten</div>
        </div>
        <div className="bg-ebene border border-kontur rounded-panel p-3 text-center">
          <div className="text-2xl font-bold font-mono tabular-nums text-schrift">{totalActual.toFixed(0)}h</div>
          <div className="text-[10px] font-bold uppercase tracking-[.08em] text-schrift-3">Ist-Stunden</div>
        </div>
        <div className="bg-ebene border border-kontur rounded-panel p-3 text-center">
          <div className={`text-2xl font-bold font-mono tabular-nums ${totalOvertime < 0 ? 'text-signal' : 'text-schrift'}`}>
            {totalOvertime >= 0 ? '+' : ''}{totalOvertime.toFixed(1)}h
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[.08em] text-schrift-3">Überstunden</div>
        </div>
      </div>

      {/* Month-by-month table — Taktwerk-Datentabelle (28px-Zeilen) */}
      <div className="overflow-x-auto">
        <table className="border-collapse text-[11.5px] w-full min-w-[640px]">
          <thead>
            <tr className="bg-[#fafbfc] dark:bg-[#0e1522]">
              <th scope="col" className="px-3 py-[5px] text-left border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">Monat</th>
              <th scope="col" className="px-3 py-[5px] text-right border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">Schichten</th>
              <th scope="col" className="px-3 py-[5px] text-right border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">Abwesend</th>
              <th scope="col" className="px-3 py-[5px] text-right border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">Soll-Std</th>
              <th scope="col" className="px-3 py-[5px] text-right border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">Ist-Std</th>
              <th scope="col" className="px-3 py-[5px] text-right border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">Über/Unter</th>
              <th scope="col" className="px-3 py-[5px] text-left border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">Schichtarten</th>
            </tr>
          </thead>
          <tbody>
            {data.map(m => {
              const ot = m.actual_hours - m.target_hours;
              const labelEntries = Object.entries(m.label_counts).sort((a, b) => b[1] - a[1]);
              return (
                <tr key={m.month} className="hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)]">
                  <td className="px-3 h-[28px] border-b border-kontur-soft font-semibold text-schrift">
                    {MONTH_ABBR[m.month - 1]} {year}
                  </td>
                  <td className="px-3 h-[28px] border-b border-kontur-soft text-right font-mono tabular-nums text-schrift">
                    {m.shifts > 0 ? m.shifts : '—'}
                  </td>
                  <td className="px-3 h-[28px] border-b border-kontur-soft text-right font-mono tabular-nums text-schrift-2">
                    {m.absences > 0 ? m.absences : '—'}
                  </td>
                  <td className="px-3 h-[28px] border-b border-kontur-soft text-right font-mono tabular-nums text-schrift-2">
                    {m.target_hours.toFixed(1)}h
                  </td>
                  <td className="px-3 h-[28px] border-b border-kontur-soft text-right font-mono tabular-nums text-schrift">
                    {m.actual_hours.toFixed(1)}h
                  </td>
                  <td className={`px-3 h-[28px] border-b border-kontur-soft text-right font-mono tabular-nums font-semibold ${ot < 0 ? 'text-signal' : 'text-schrift-2'}`}>
                    {ot >= 0 ? '+' : ''}{ot.toFixed(1)}h
                  </td>
                  <td className="px-3 h-[28px] border-b border-kontur-soft">
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
            <tr className="bg-[#fafbfc] dark:bg-[#0e1522] font-bold text-schrift">
              <td className="px-3 h-[28px] border-t border-kontur">Gesamt</td>
              <td className="px-3 h-[28px] border-t border-kontur text-right font-mono tabular-nums">{totalShifts}</td>
              <td className="px-3 h-[28px] border-t border-kontur text-right font-mono tabular-nums">{totalAbsences}</td>
              <td className="px-3 h-[28px] border-t border-kontur text-right font-mono tabular-nums">{totalTarget.toFixed(1)}h</td>
              <td className="px-3 h-[28px] border-t border-kontur text-right font-mono tabular-nums">{totalActual.toFixed(1)}h</td>
              <td className={`px-3 h-[28px] border-t border-kontur text-right font-mono tabular-nums ${totalOvertime < 0 ? 'text-signal' : ''}`}>
                {totalOvertime >= 0 ? '+' : ''}{totalOvertime.toFixed(1)}h
              </td>
              <td className="px-3 h-[28px] border-t border-kontur">
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
  const reqIdRef = useRef(0);

  const filteredEmps = employees; // already filtered by parent
  const empIdsKey = filteredEmps.map(e => e.ID).join(',');

  useEffect(() => {
    if (filteredEmps.length === 0) return;
    setLoading(true);
    setError(null);
    const reqId = ++reqIdRef.current;
    Promise.all(filteredEmps.map(e => api.getScheduleYear(year, e.ID).then(d => [e.ID, d] as [number, MonthSummary[]])))
      .then(results => {
        if (reqId !== reqIdRef.current) return; // stale response, ignore
        const map = new Map<number, MonthSummary[]>();
        results.forEach(([id, d]) => map.set(id, d));
        setDataMap(map);
        setLoading(false);
      })
      .catch(() => {
        if (reqId !== reqIdRef.current) return;
        setError('Fehler beim Laden der Jahresübersicht');
        setLoading(false);
      });
  // filteredEmps is reconstructed each render; track membership via stable key
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, empIdsKey, groupId]);

  if (loading) return (
    <LoadingSpinner />
  );
  if (error) return <ApiErrorState message={error} />;
  if (filteredEmps.length === 0) return (
    <EmptyState
      icon="👥"
      title="Keine Mitarbeiter"
      description="Für diese Gruppe sind keine Mitarbeiter vorhanden."
    />
  );

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs min-w-[900px]">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-[#fafbfc] dark:bg-[#0e1522] px-3 py-[5px] text-left min-w-[160px] border-r border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">
              Mitarbeiter
            </th>
            {MONTH_ABBR.map((m, i) => (
              <th scope="col" key={i} className="bg-[#fafbfc] dark:bg-[#0e1522] px-1 py-[5px] text-center min-w-[90px] border-r border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">
                {m}
              </th>
            ))}
            <th scope="col" className="bg-[#fafbfc] dark:bg-[#0e1522] px-2 py-[5px] text-center min-w-[80px] border-l border-b border-kontur text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">
              Gesamt
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredEmps.map(emp => {
            const empData = dataMap.get(emp.ID) || [];
            const totalShifts = empData.reduce((a, m) => a + m.shifts, 0);
            const totalActual = empData.reduce((a, m) => a + m.actual_hours, 0);
            const totalTarget = empData.reduce((a, m) => a + m.target_hours, 0);
            const totalOvertime = totalActual - totalTarget;

            return (
              <tr key={emp.ID} className="hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)]">
                <td className="sticky left-0 z-10 bg-ebene px-3 py-1 border-r border-b border-kontur-soft font-medium text-schrift whitespace-nowrap">
                  {emp.NAME}, {emp.FIRSTNAME}
                </td>
                {empData.length > 0 ? (
                  empData.map(m => <MonthCell key={m.month} summary={m} colorMap={colorMap} />)
                ) : (
                  Array.from({ length: 12 }, (_, i) => (
                    <td key={i} className="border border-kontur-soft p-1.5 bg-wash text-center text-schrift-3 text-xs">—</td>
                  ))
                )}
                <td className="border border-kontur-soft p-1.5 text-center bg-wash">
                  <div className="text-xs font-bold font-mono tabular-nums text-schrift">{totalShifts}S</div>
                  <div className={`text-xs font-semibold font-mono tabular-nums ${totalOvertime < 0 ? 'text-signal' : 'text-schrift-2'}`}>
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

// ── Jahres-Tagesraster eines Mitarbeiters (V-8, Spec 4.4) ──────
function JahresRasterView({
  employee,
  year,
  onMonthClick,
  ausrichtung,
  maxEintraege,
}: {
  employee: Employee;
  year: number;
  onMonthClick: (month: number) => void;
  ausrichtung: JahresAusrichtung;
  maxEintraege: number;
}) {
  const [yearEntries, setYearEntries] = useState<ScheduleEntry[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  // true von Anfang an: der Lade-Effekt läuft direkt beim Mount —
  // so erscheint nie ein leeres Raster vor den Daten
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  // Der Jahres-Endpoint (getScheduleYear) liefert nur Monats-Aggregate —
  // die Tageseinträge inkl. generierter Zyklusdienste (source==='cycle')
  // kommen aus dem Monats-Endpoint getSchedule, 12× parallel (Parity V-8).
  // Geladen wird einmal pro Jahr (alle MA); der MA-Wechsel filtert lokal.
  useEffect(() => {
    setLoading(true);
    setError(null);
    const reqId = ++reqIdRef.current;
    Promise.all([
      Promise.all(Array.from({ length: 12 }, (_, i) => api.getSchedule(year, i + 1))),
      api.getHolidays(year),
    ])
      .then(([months, hols]) => {
        if (reqId !== reqIdRef.current) return; // stale response, ignore
        setYearEntries(months.flat());
        setHolidays(new Set(hols.map(h => h.DATE)));
        setLoading(false);
      })
      .catch(() => {
        if (reqId !== reqIdRef.current) return;
        setError('Fehler beim Laden des Jahresrasters');
        setLoading(false);
      });
  }, [year]);

  const empEntries = useMemo(
    () => yearEntries.filter(e => e.employee_id === employee.ID),
    [yearEntries, employee.ID],
  );
  const dayMap = useMemo(() => buildDayMap(empEntries), [empEntries]);
  const hasCycle = empEntries.some(e => e.source === 'cycle');

  if (loading) return <LoadingSpinner />;
  if (error) return <ApiErrorState message={error} />;

  return (
    <div className="space-y-2">
      <JahresRaster year={year} dayMap={dayMap} holidays={holidays} onMonthClick={onMonthClick} ausrichtung={ausrichtung} maxEintraege={maxEintraege} />
      <div className="text-[11px] text-schrift-2 flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="inline-block w-3 h-3 align-[-2px] rounded-sm border border-kontur bg-wash" /> Wochenende</span>
        <span><span className="inline-block w-3 h-3 align-[-2px] rounded-sm border border-kontur bg-[rgba(190,59,59,.08)] dark:bg-[rgba(228,105,111,.12)]" /> Feiertag</span>
        {hasCycle && <span>↻ = aus Schichtmodell (Zyklus)</span>}
        <span>Klick auf einen Tag öffnet den Dienstplan des Monats.</span>
      </div>
    </div>
  );
}

export default function Jahresuebersicht() {
  const now = new Date();
  const navigate = useNavigate();
  const [year, setYear] = useState(now.getFullYear());
  // 'raster' = Jahres-Tagesraster (Original-Verhalten, Spec 4.4);
  // 'summary' = bisherige Aggregat-Ansicht (Zusammenfassung, kein Feature-Verlust)
  const [mode, setMode] = useState<'raster' | 'summary'>('raster');
  // Spaltenausrichtung (Spec 4.11.11-1, Radio-Logik), Default = Kalendertage
  const [ausrichtung, setAusrichtung] = useState<JahresAusrichtung>('kalendertage');
  // Sichtbare Einträge je Feld (Spec 4.11.11-2): 1 oder 2 — Taktwerk §11
  // fixiert die Zelle auf 21×20px, mehr Slots wären dort nicht lesbar;
  // Überzählige signalisiert ▾ (Spec 4.13-3)
  const [maxEintraege, setMaxEintraege] = useState(2);
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
    }).catch(e => console.warn('[Jahresübersicht] Mitarbeiter laden fehlgeschlagen:', e));
    api.getGroups().then(setGroups).catch(e => console.warn('[Jahresübersicht] Gruppen laden fehlgeschlagen:', e));
    Promise.all([api.getShifts(), api.getLeaveTypes()]).then(([shifts, leaveTypes]) => {
      setColorMap(buildShiftColorMap(shifts, leaveTypes));
    }).catch(e => console.warn('[Jahresübersicht] Schichtfarben laden fehlgeschlagen:', e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // MA-Vor/Zurück im Jahresraster (Spec 4.4: ein MA pro Ansicht)
  const empIdx = filteredEmployees.findIndex(e => e.ID === selectedEmployeeId);
  const stepEmployee = (delta: number) => {
    if (filteredEmployees.length === 0) return;
    const next = empIdx === -1 ? 0 : Math.min(Math.max(empIdx + delta, 0), filteredEmployees.length - 1);
    setSelectedEmployeeId(filteredEmployees[next].ID);
  };

  // Bewusste Web-Abweichung zum Original (Spec R6.1-1): Eintragen/Löschen
  // direkt im Jahresraster gibt es nicht — Klick auf eine Zelle wechselt in
  // den Dienstplan des Monats. Schedule.tsx liest Jahr/Monat beim Mount aus
  // sessionStorage (bestehender Persistenz-Mechanismus der Dienstplan-Seite).
  const openDienstplan = (month: number) => {
    sessionStorage.setItem('schedule-year', String(year));
    sessionStorage.setItem('schedule-month', String(month));
    navigate('/schedule');
  };

  const handlePrint = async () => {
    setPrintLoading(true);
    try {
      if (mode === 'raster') {
        if (!selectedEmployee) return;
        const [months, hols] = await Promise.all([
          Promise.all(Array.from({ length: 12 }, (_, i) => api.getSchedule(year, i + 1))),
          api.getHolidays(year),
        ]);
        const dayMap = buildDayMap(months.flat().filter(e => e.employee_id === selectedEmployee.ID));
        openPrintWindowJ(buildJahresrasterHTML(selectedEmployee, year, dayMap, new Set(hols.map(h => h.DATE)), ausrichtung));
        return;
      }
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
      <PageHeader
        title="📆 Jahresübersicht"
        subtitle="Jahres-Tagesraster eines Mitarbeiters und Zusammenfassung"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Year navigation */}
            <div className="flex items-center gap-1">
              <button onClick={() => setYear(y => y - 1)} aria-label="Vorjahr" className="px-2 py-1 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift hover:bg-wash text-sm" title="Vorjahr">‹</button>
              <span className="font-bold font-mono tabular-nums text-schrift min-w-[56px] text-center">{year}</span>
              <button onClick={() => setYear(y => y + 1)} aria-label="Folgejahr" className="px-2 py-1 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift hover:bg-wash text-sm" title="Folgejahr">›</button>
            </div>

            {/* Modus: Tagesraster (Spec 4.4) vs. Zusammenfassung (Aggregat) —
                aktives Segment = Umkehrung */}
            <div className="flex rounded-ui overflow-hidden border border-kontur text-sm">
              <button
                onClick={() => setMode('raster')}
                className={`px-3 py-1.5 ${mode === 'raster' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift hover:bg-wash'}`}
              >
                Jahresraster
              </button>
              <button
                onClick={() => setMode('summary')}
                className={`px-3 py-1.5 border-l border-kontur ${mode === 'summary' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift hover:bg-wash'}`}
              >
                Zusammenfassung
              </button>
            </div>

            {/* Spaltenausrichtung (Spec 4.11.11-1, Radio-Logik) — nur Raster */}
            {mode === 'raster' && (
              <div className="flex rounded-ui overflow-hidden border border-kontur text-sm">
                <button
                  onClick={() => setAusrichtung('kalendertage')}
                  aria-pressed={ausrichtung === 'kalendertage'}
                  title="Spalten nach Kalendertagen ausrichten: Tage mit gleicher Monatstag-Nummer stehen untereinander"
                  className={`px-3 py-1.5 ${ausrichtung === 'kalendertage' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift hover:bg-wash'}`}
                >
                  Kalendertage
                </button>
                <button
                  onClick={() => setAusrichtung('wochentage')}
                  aria-pressed={ausrichtung === 'wochentage'}
                  title="Spalten nach Wochentagen ausrichten: gleiche Wochentage stehen untereinander"
                  className={`px-3 py-1.5 border-l border-kontur ${ausrichtung === 'wochentage' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift hover:bg-wash'}`}
                >
                  Wochentage
                </button>
              </div>
            )}

            {/* Sichtbare Einträge je Feld (Spec 4.11.11-2) — nur Raster */}
            {mode === 'raster' && (
              <label className="flex items-center gap-1.5 text-sm text-schrift" title="Sichtbare Einträge je Feld — überzählige Einträge zeigt ein ▾ an">
                Einträge je Feld:
                <select
                  value={maxEintraege}
                  onChange={e => setMaxEintraege(Number(e.target.value))}
                  className="border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
            )}

            {/* View mode (nur Zusammenfassung) */}
            {mode === 'summary' && (
              <div className="flex rounded-ui overflow-hidden border border-kontur text-sm">
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1.5 ${viewMode === 'all' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift hover:bg-wash'}`}
                >
                  Alle MA
                </button>
                <button
                  onClick={() => setViewMode('single')}
                  className={`px-3 py-1.5 border-l border-kontur ${viewMode === 'single' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift hover:bg-wash'}`}
                >
                  Einzelansicht
                </button>
              </div>
            )}

            {/* Group filter */}
            <select
              value={groupId ?? ''}
              onChange={e => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift text-sm"
            >
              <option value="">Alle Gruppen</option>
              {groupTreeOptions(groups).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>

            {/* Employee selector (Raster immer; Zusammenfassung nur Einzelansicht) */}
            {(mode === 'raster' || viewMode === 'single') && (
              <div className="flex items-center gap-1">
                {mode === 'raster' && (
                  <button
                    onClick={() => stepEmployee(-1)}
                    disabled={empIdx <= 0}
                    aria-label="Vorheriger Mitarbeiter"
                    title="Vorheriger Mitarbeiter"
                    className="px-2 py-1 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift hover:bg-wash disabled:opacity-40 text-sm"
                  >‹</button>
                )}
                <select
                  value={selectedEmployeeId ?? ''}
                  onChange={e => setSelectedEmployeeId(Number(e.target.value))}
                  className="px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift text-sm min-w-[200px]"
                >
                  {filteredEmployees.map(e => (
                    <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>
                  ))}
                </select>
                {mode === 'raster' && (
                  <button
                    onClick={() => stepEmployee(1)}
                    disabled={empIdx === filteredEmployees.length - 1}
                    aria-label="Nächster Mitarbeiter"
                    title="Nächster Mitarbeiter"
                    className="px-2 py-1 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift hover:bg-wash disabled:opacity-40 text-sm"
                  >›</button>
                )}
              </div>
            )}

            {/* Print button — Primäraktion als Umkehrung */}
            <button
              onClick={handlePrint}
              disabled={printLoading}
              className="no-print px-3 py-1.5 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold disabled:opacity-60 text-sm rounded-ui flex items-center gap-1.5"
              title="Jahresübersicht in neuem Fenster drucken"
            >
              {printLoading ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> Lade…</> : '🖨️ Drucken'}
            </button>
          </div>
        }
      />

      {/* Content — Fläche ohne Schatten (Taktwerk §3) */}
      <div className="flex-1 overflow-auto bg-ebene rounded-panel border border-kontur p-4">
        {mode === 'raster' ? (
          selectedEmployee ? (
            <div>
              <h2 className="text-base font-bold text-schrift mb-4">
                {selectedEmployee.NAME}, {selectedEmployee.FIRSTNAME} — Jahresraster {year}
              </h2>
              <JahresRasterView employee={selectedEmployee} year={year} onMonthClick={openDienstplan} ausrichtung={ausrichtung} maxEintraege={maxEintraege} />
            </div>
          ) : (
            <EmptyState
              icon="👤"
              title="Kein Mitarbeiter ausgewählt"
              description="Bitte einen Mitarbeiter auswählen, um das Jahresraster anzuzeigen."
            />
          )
        ) : viewMode === 'single' && selectedEmployee ? (
          <div>
            <h2 className="text-base font-bold text-schrift mb-4">
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
