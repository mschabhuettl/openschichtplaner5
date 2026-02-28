import { useState, useEffect, useMemo, useRef } from 'react';
const API = import.meta.env.VITE_API_URL ?? '';

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}


// ── Types ─────────────────────────────────────────────────────────────────────
interface Employee {
  ID: number;
  NAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
  HIDE: number;
}

interface Group {
  ID: number;
  NAME: string;
  SHORTNAME?: string;
}

interface ScheduleEntry {
  employee_id: number;
  date: string;
  kind: 'shift' | 'absence';
  display_name: string;
  color_bk: string;
  color_text: string;
  leave_type_id?: number | null;
}

interface CellData {
  label: string;
  bk: string;
  text: string;
  kind: 'shift' | 'absence' | 'holiday';
}

interface Holiday {
  date: string;
  name: string;
}

interface GroupAssignment {
  employee_id: number;
  group_id: number;
}

const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const DAY_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

function isWeekend(dow: number): boolean {
  return dow === 0 || dow === 6;
}

// ── Print/Export HTML ─────────────────────────────────────────────────────────
function buildMatrixHTML(
  employees: Employee[],
  cellMap: Map<string, CellData>,
  year: number,
  month: number,
  holidays: Set<number>,
  groupLabel: string,
): string {
  const numDays = daysInMonth(year, month);
  const thBase = 'border:1px solid #94a3b8;padding:3px 4px;font-size:10px;text-align:center;white-space:nowrap;';
  const tdBase = 'border:1px solid #e2e8f0;padding:2px 3px;font-size:10px;text-align:center;vertical-align:middle;min-width:26px;';

  // Day header
  let dayHeaders = `<th style="${thBase}min-width:140px;text-align:left;background:#1e293b;color:#fff;">Mitarbeiter</th>`;
  for (let d = 1; d <= numDays; d++) {
    const dow = getDayOfWeek(year, month, d);
    const isHol = holidays.has(d);
    const bg = isHol ? '#fcd34d' : isWeekend(dow) ? '#e0e7ff' : '#334155';
    const color = isHol ? '#000' : isWeekend(dow) ? '#3730a3' : '#fff';
    dayHeaders += `<th style="${thBase}background:${bg};color:${color};">${d}<br><span style="font-size:8px;">${DAY_ABBR[dow]}</span></th>`;
  }
  dayHeaders += `<th style="${thBase}background:#0f172a;color:#fff;">Σ</th>`;

  let rows = '';
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';
    let shifts = 0, absences = 0;
    let cells = `<td style="${tdBase}background:${rowBg};text-align:left;font-weight:500;padding:2px 6px;min-width:140px;">${emp.NAME}, ${emp.FIRSTNAME}</td>`;
    for (let d = 1; d <= numDays; d++) {
      const key = `${emp.ID}_${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = cellMap.get(key);
      const dow = getDayOfWeek(year, month, d);
      const isHol = holidays.has(d);
      let bg = isHol ? '#fffbeb' : isWeekend(dow) ? '#f0f4ff' : rowBg;
      if (cell) {
        bg = cell.bk;
        if (cell.kind === 'shift') shifts++;
        else if (cell.kind === 'absence') absences++;
        cells += `<td style="${tdBase}background:${bg};color:${cell.text};font-weight:600;">${cell.label}</td>`;
      } else {
        cells += `<td style="${tdBase}background:${bg};color:#cbd5e1;">·</td>`;
      }
    }
    cells += `<td style="${tdBase}background:#f1f5f9;font-weight:bold;font-size:9px;"><span style="color:#1d4ed8">${shifts}S</span>${absences > 0 ? `<br><span style="color:#d97706">${absences}A</span>` : ''}</td>`;
    rows += `<tr>${cells}</tr>`;
  }

  // Summary row
  let summaryRow = `<td style="${tdBase}background:#1e293b;color:#fff;font-weight:bold;text-align:left;padding:2px 6px;">Besetzt</td>`;
  for (let d = 1; d <= numDays; d++) {
    let count = 0;
    for (const emp of employees) {
      const key = `${emp.ID}_${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = cellMap.get(key);
      if (cell && cell.kind === 'shift') count++;
    }
    const bg = count === 0 ? '#fee2e2' : count < 3 ? '#fef9c3' : '#dcfce7';
    const color = count === 0 ? '#dc2626' : count < 3 ? '#a16207' : '#16a34a';
    summaryRow += `<td style="${tdBase}background:${bg};color:${color};font-weight:700;">${count}</td>`;
  }
  summaryRow += `<td style="${tdBase}background:#e2e8f0;"></td>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Verfügbarkeits-Matrix ${MONTH_NAMES[month]} ${year}</title>
<style>
body { font-family: Arial, sans-serif; margin: 16px; }
h2 { color: #1e293b; font-size: 14px; margin: 0 0 8px; }
table { border-collapse: collapse; }
</style>
</head><body>
<h2>📊 Verfügbarkeits-Matrix — ${groupLabel} — ${MONTH_NAMES[month]} ${year}</h2>
<p style="font-size:11px;color:#64748b;margin:4px 0 8px;">Erstellt: ${new Date().toLocaleString('de-AT')}</p>
<table>
  <thead><tr>${dayHeaders}</tr></thead>
  <tbody>${rows}<tr>${summaryRow}</tr></tbody>
</table>
</body></html>`;
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function CellTooltip({ cell, date, empName }: { cell: CellData; date: string; empName: string }) {
  return (
    <div className="absolute z-50 pointer-events-none bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-800 text-white text-xs rounded-lg p-2 shadow-lg whitespace-normal">
      <div className="font-bold">{empName}</div>
      <div className="text-slate-300">{date}</div>
      <div className="mt-1 flex items-center gap-1">
        <span
          className="px-1.5 py-0.5 rounded text-xs font-bold"
          style={{ background: cell.bk, color: cell.text }}
        >{cell.label}</span>
        <span className="text-slate-300 capitalize">{cell.kind === 'shift' ? 'Schicht' : 'Abwesenheit'}</span>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 border-4 border-transparent border-t-slate-800" />
    </div>
  );
}

// ── Cell ────────────────────────────────────────────────────────────────────────
function MatrixCell({
  cell,
  isWeekend,
  isHoliday,
  date,
  empName,
}: {
  cell: CellData | null;
  isWeekend: boolean;
  isHoliday: boolean;
  date: string;
  empName: string;
}) {
  const [hovered, setHovered] = useState(false);

  const baseBg = isHoliday ? 'bg-amber-50' : isWeekend ? 'bg-indigo-50' : 'bg-white';

  if (!cell) {
    return (
      <td className={`border border-slate-100 ${baseBg} text-slate-200 text-center`} style={{ width: 28, minWidth: 28, fontSize: 10 }}>
        ·
      </td>
    );
  }

  return (
    <td
      className="border border-slate-100 text-center relative cursor-default"
      style={{ width: 28, minWidth: 28, background: cell.bk, color: cell.text, fontSize: 9, fontWeight: 700, padding: '1px 2px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {cell.label}
      {hovered && <CellTooltip cell={cell} date={date} empName={empName} />}
    </td>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VerfügbarkeitsMatrix() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groupId, setGroupId] = useState<number>(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [groupAssignments, setGroupAssignments] = useState<GroupAssignment[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);

  // Load static data
  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/groups`, { headers: getAuthHeaders() }).then(r => r.json()),
      fetch(`${API}/api/employees`, { headers: getAuthHeaders() }).then(r => r.json()),
      fetch(`${API}/api/group-assignments`, { headers: getAuthHeaders() }).then(r => r.json()),
    ]).then(([grps, emps, ga]) => {
      setGroups(grps.filter((g: Group) => g.ID !== 1));
      setAllEmployees(emps.filter((e: Employee) => !e.HIDE));
      setGroupAssignments(ga);
    });
  }, []);

  // Load schedule + holidays for selected month
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/schedule?year=${year}&month=${month}`, { headers: getAuthHeaders() }).then(r => r.json()),
      fetch(`${API}/api/holidays?year=${year}`, { headers: getAuthHeaders() }).then(r => r.json()),
    ]).then(([sched, hols]) => {
      setScheduleEntries(sched);
      setHolidays(hols.filter((h: Holiday) => {
        const d = new Date(h.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      }));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [year, month]);

  // Compute employees for selected group
  const employees = useMemo(() => {
    if (groupId === 0) return allEmployees;
    const ids = new Set(groupAssignments.filter(ga => ga.group_id === groupId).map(ga => ga.employee_id));
    return allEmployees.filter(e => ids.has(e.ID));
  }, [allEmployees, groupAssignments, groupId]);

  // Holiday day set
  const holidayDays = useMemo(() => {
    const s = new Set<number>();
    holidays.forEach(h => { const d = new Date(h.date); s.add(d.getDate()); });
    return s;
  }, [holidays]);

  // Build cell map: "empId_YYYY-MM-DD" → CellData
  const cellMap = useMemo(() => {
    const m = new Map<string, CellData>();
    scheduleEntries.forEach(e => {
      const key = `${e.employee_id}_${e.date}`;
      if (!m.has(key)) {
        m.set(key, {
          label: e.display_name || (e.kind === 'absence' ? 'Ab' : 'S'),
          bk: e.color_bk || (e.kind === 'absence' ? '#fbbf24' : '#3b82f6'),
          text: e.color_text || '#fff',
          kind: e.kind,
        });
      }
    });
    return m;
  }, [scheduleEntries]);

  const numDays = daysInMonth(year, month);

  // Column stats: how many employees have a shift per day
  const dayCounts = useMemo(() => {
    const arr: number[] = [];
    for (let d = 1; d <= numDays; d++) {
      const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let count = 0;
      employees.forEach(emp => {
        const cell = cellMap.get(`${emp.ID}_${ds}`);
        if (cell && cell.kind === 'shift') count++;
      });
      arr.push(count);
    }
    return arr;
  }, [employees, cellMap, year, month, numDays]);

  // Row stats per employee
  const empStats = useMemo(() => {
    return employees.map(emp => {
      let shifts = 0, absences = 0;
      for (let d = 1; d <= numDays; d++) {
        const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cell = cellMap.get(`${emp.ID}_${ds}`);
        if (!cell) continue;
        if (cell.kind === 'shift') shifts++;
        else absences++;
      }
      return { shifts, absences };
    });
  }, [employees, cellMap, year, month, numDays]);

  // Unique cells for legend
  const legendEntries = useMemo(() => {
    const seen = new Map<string, { bk: string; text: string; kind: string }>();
    cellMap.forEach(cell => {
      if (!seen.has(cell.label)) seen.set(cell.label, { bk: cell.bk, text: cell.text, kind: cell.kind });
    });
    return Array.from(seen.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [cellMap]);

  const groupLabel = groupId === 0 ? 'Alle Mitarbeiter' : (groups.find(g => g.ID === groupId)?.NAME || '');

  function handleExport() {
    const html = buildMatrixHTML(employees, cellMap, year, month, holidayDays, groupLabel);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verfuegbarkeits-matrix-${year}-${String(month).padStart(2, '0')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCSV() {
    const header = ['Mitarbeiter', ...Array.from({ length: numDays }, (_, i) => `${i + 1}`), 'Schichten', 'Abwesenheiten'].join(';');
    const rows = employees.map((emp, i) => {
      const cells: string[] = [`${emp.NAME} ${emp.FIRSTNAME}`];
      for (let d = 1; d <= numDays; d++) {
        const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cell = cellMap.get(`${emp.ID}_${ds}`);
        cells.push(cell ? cell.label : '');
      }
      cells.push(String(empStats[i].shifts));
      cells.push(String(empStats[i].absences));
      return cells.join(';');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verfuegbarkeits-matrix-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <div>
            <h1 className="text-base font-bold text-slate-800">Verfügbarkeits-Matrix</h1>
            <p className="text-xs text-slate-500">Wer arbeitet wann — kompakter Monatsüberblick</p>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">‹</button>
          <div className="flex items-center gap-1">
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="text-sm font-semibold text-slate-700 border border-slate-200 rounded px-2 py-1 bg-white"
            >
              {MONTH_NAMES.slice(1).map((n, i) => (
                <option key={i + 1} value={i + 1}>{n}</option>
              ))}
            </select>
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-16 text-sm font-semibold text-slate-700 border border-slate-200 rounded px-2 py-1 bg-white text-center"
              min={2000}
              max={2099}
            />
          </div>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">›</button>
        </div>

        {/* Group filter */}
        <select
          value={groupId}
          onChange={e => setGroupId(Number(e.target.value))}
          className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700"
        >
          <option value={0}>Alle Mitarbeiter</option>
          {groups.map(g => (
            <option key={g.ID} value={g.ID}>{g.NAME}</option>
          ))}
        </select>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLegend(l => !l)}
            className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {showLegend ? '🔡 Legende' : '🔡 Legende'}
          </button>
          <button
            onClick={handleCSV}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium"
          >
            📥 CSV
          </button>
          <button
            onClick={handleExport}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors font-medium"
          >
            🖨️ HTML
          </button>
        </div>
      </div>

      {/* Legend */}
      {showLegend && legendEntries.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-2 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-slate-500 mr-1">Legende:</span>
          {legendEntries.map(([label, info]) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: info.bk, color: info.text }}
            >
              {label}
              <span className="font-normal opacity-70 text-xs">{info.kind === 'absence' ? '(Ab)' : ''}</span>
            </span>
          ))}
          {/* Weekend + holiday */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 font-medium border border-indigo-200">
            WE
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 font-medium border border-amber-200">
            🎌 Feiertag
          </span>
        </div>
      )}

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-1.5 flex gap-4 text-xs text-slate-600">
        <span><strong className="text-slate-800">{employees.length}</strong> Mitarbeiter</span>
        <span><strong className="text-slate-800">{numDays}</strong> Tage</span>
        <span><strong className="text-slate-800">{scheduleEntries.length}</strong> Einträge</span>
        {holidays.length > 0 && (
          <span className="text-amber-600"><strong>{holidays.length}</strong> Feiertage</span>
        )}
        {loading && <span className="text-blue-500 animate-pulse ml-auto">Lade…</span>}
      </div>

      {/* Matrix table */}
      <div ref={tableRef} className="flex-1 overflow-auto p-3">
        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="text-5xl mb-3">📊</div>
            <div className="text-sm font-medium">Keine Mitarbeiter in dieser Gruppe</div>
          </div>
        ) : (
          <div className="inline-block min-w-full">
            <table className="border-collapse text-xs select-none" style={{ tableLayout: 'fixed' }}>
              {/* Sticky header */}
              <thead>
                <tr>
                  {/* Name column */}
                  <th
                    className="sticky left-0 z-20 bg-slate-800 text-white font-semibold text-left px-3 py-2 border border-slate-600"
                    style={{ minWidth: 160, width: 160 }}
                  >
                    Mitarbeiter
                  </th>
                  {/* Day columns */}
                  {Array.from({ length: numDays }, (_, i) => {
                    const d = i + 1;
                    const dow = getDayOfWeek(year, month, d);
                    const isHol = holidayDays.has(d);
                    const isWe = isWeekend(dow);
                    const bgClass = isHol
                      ? 'bg-amber-400 text-amber-900'
                      : isWe
                      ? 'bg-indigo-500 text-indigo-100'
                      : 'bg-slate-700 text-slate-100';
                    return (
                      <th
                        key={d}
                        className={`border border-slate-600 font-medium ${bgClass}`}
                        style={{ width: 28, minWidth: 28, padding: '2px 1px', textAlign: 'center' }}
                        title={isHol ? holidays.find(h => new Date(h.date).getDate() === d)?.name : DAY_ABBR[dow]}
                      >
                        <div style={{ fontSize: 11 }}>{d}</div>
                        <div style={{ fontSize: 8 }}>{DAY_ABBR[dow]}</div>
                      </th>
                    );
                  })}
                  {/* Summary */}
                  <th
                    className="sticky right-0 z-20 bg-slate-900 text-white font-bold border border-slate-600 text-center"
                    style={{ minWidth: 54, width: 54, padding: '2px 4px' }}
                  >
                    <div>S</div>
                    <div style={{ fontSize: 8, color: '#fbbf24' }}>Ab</div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {employees.map((emp, empIdx) => (
                  <tr key={emp.ID} className={empIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {/* Sticky name */}
                    <td
                      className="sticky left-0 z-10 border border-slate-200 px-2 py-1 font-medium text-slate-700 whitespace-nowrap"
                      style={{ minWidth: 160, width: 160, background: empIdx % 2 === 0 ? '#fff' : '#f8fafc' }}
                    >
                      <span className="text-slate-400 text-xs mr-1">{emp.SHORTNAME}</span>
                      {emp.NAME}, {emp.FIRSTNAME}
                    </td>
                    {/* Day cells */}
                    {Array.from({ length: numDays }, (_, i) => {
                      const d = i + 1;
                      const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const cell = cellMap.get(`${emp.ID}_${ds}`);
                      const dow = getDayOfWeek(year, month, d);
                      return (
                        <MatrixCell
                          key={d}
                          cell={cell || null}
                          isWeekend={isWeekend(dow)}
                          isHoliday={holidayDays.has(d)}
                          date={ds}
                          empName={`${emp.NAME}, ${emp.FIRSTNAME}`}
                        />
                      );
                    })}
                    {/* Row summary */}
                    <td
                      className="sticky right-0 z-10 border border-slate-200 text-center font-bold"
                      style={{ minWidth: 54, width: 54, background: '#f1f5f9', fontSize: 10, padding: '2px 4px' }}
                    >
                      <div className="text-blue-700">{empStats[empIdx].shifts}</div>
                      {empStats[empIdx].absences > 0 && (
                        <div className="text-amber-600">{empStats[empIdx].absences}</div>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Summary row */}
                <tr className="border-t-2 border-slate-400">
                  <td
                    className="sticky left-0 z-10 bg-slate-800 text-white font-bold px-2 py-1.5 border border-slate-600"
                    style={{ minWidth: 160 }}
                  >
                    👥 Besetzt
                  </td>
                  {dayCounts.map((count, i) => {
                    const d = i + 1;
                    const bgColor = count === 0
                      ? '#fee2e2'
                      : count < Math.max(2, Math.ceil(employees.length * 0.3))
                      ? '#fef9c3'
                      : '#dcfce7';
                    const textColor = count === 0 ? '#dc2626' : count < Math.max(2, Math.ceil(employees.length * 0.3)) ? '#a16207' : '#16a34a';
                    return (
                      <td
                        key={d}
                        className="border border-slate-200 text-center font-bold"
                        style={{ background: bgColor, color: textColor, fontSize: 10, padding: '3px 2px', width: 28, minWidth: 28 }}
                      >
                        {count}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 bg-slate-800 border border-slate-600" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
