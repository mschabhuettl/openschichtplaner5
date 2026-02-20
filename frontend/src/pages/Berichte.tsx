import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Employee, Group, ShiftType } from '../types';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function padZero(n: number) { return n.toString().padStart(2, '0'); }

// ── Print helpers ─────────────────────────────────────────────

function printHtml(html: string, title: string) {
  const w = window.open('', '_blank', 'width=1200,height=900');
  if (!w) { alert('Popup-Fenster blockiert!'); return; }
  w.document.write(`<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8"><title>${title}</title>
<style>
body { font-family: Arial, sans-serif; margin: 16px; font-size: 12px; }
h1 { font-size: 16px; margin-bottom: 4px; }
h2 { font-size: 13px; margin-bottom: 4px; margin-top: 16px; }
.subtitle { font-size: 11px; color: #666; margin-bottom: 12px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
th { background: #334155; color: #fff; padding: 4px 8px; text-align: left; font-size: 11px; white-space: nowrap; }
td { border: 1px solid #ddd; padding: 3px 8px; font-size: 11px; }
tr:nth-child(even) td { background: #f8fafc; }
.badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
@media print { @page { size: landscape; margin: 8mm; } body { margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
</style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

// ── Report: Mitarbeiterliste ──────────────────────────────────

async function reportEmployeeList(employees: Employee[], groups: Group[]) {
  const now = new Date().toLocaleString('de-AT');
  const groupMap = Object.fromEntries(groups.map(g => [g.ID, g.NAME]));

  let html = `<h1>👥 Mitarbeiterliste</h1>
<div class="subtitle">${employees.length} Mitarbeiter &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr>
<th>Nr.</th><th>Name</th><th>Vorname</th><th>Kürzel</th>
<th>Funktion</th><th>Std/Tag</th><th>Std/Woche</th>
<th>Eintritt</th><th>Austritt</th><th>Gruppen</th>
</tr></thead><tbody>`;

  // Load group memberships
  const assignments = await api.getGroupAssignments();
  const empGroups: Record<number, string[]> = {};
  for (const a of assignments) {
    if (!empGroups[a.employee_id]) empGroups[a.employee_id] = [];
    const grpName = groupMap[a.group_id];
    if (grpName) empGroups[a.employee_id].push(grpName);
  }

  for (const emp of employees) {
    const grpList = (empGroups[emp.ID] || []).join(', ') || '—';
    html += `<tr>
<td>${emp.NUMBER || '—'}</td>
<td><strong>${emp.NAME}</strong></td>
<td>${emp.FIRSTNAME}</td>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${emp.SHORTNAME || '—'}</span></td>
<td>${(emp as Employee & { FUNCTION?: string }).FUNCTION || '—'}</td>
<td style="text-align:right">${emp.HRSDAY?.toFixed(1) ?? '—'} h</td>
<td style="text-align:right">${emp.HRSWEEK?.toFixed(1) ?? '—'} h</td>
<td>${emp.EMPSTART || '—'}</td>
<td>${emp.EMPEND || '—'}</td>
<td>${grpList}</td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, 'Mitarbeiterliste');
}

// ── Report: Gruppenübersicht ──────────────────────────────────

async function reportGroups(groups: Group[]) {
  const now = new Date().toLocaleString('de-AT');

  let html = `<h1>🏢 Gruppenübersicht</h1>
<div class="subtitle">${groups.length} Gruppen &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr><th>Name</th><th>Kürzel</th><th>Übergeordnet</th><th>Mitglieder</th><th>Status</th></tr></thead><tbody>`;

  const groupMap = Object.fromEntries(groups.map(g => [g.ID, g.NAME]));
  for (const g of groups) {
    html += `<tr>
<td><strong>${g.NAME}</strong></td>
<td>${g.SHORTNAME || '—'}</td>
<td>${g.SUPERID ? (groupMap[g.SUPERID] || `#${g.SUPERID}`) : '— (Hauptgruppe)'}</td>
<td style="text-align:center">${g.member_count ?? '?'}</td>
<td>${g.HIDE ? '<span class="badge" style="background:#fef2f2;color:#dc2626">Ausgeblendet</span>' : '<span class="badge" style="background:#f0fdf4;color:#16a34a">Aktiv</span>'}</td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, 'Gruppenübersicht');
}

// ── Report: Schichtartenliste ─────────────────────────────────

function reportShifts(shifts: ShiftType[]) {
  const now = new Date().toLocaleString('de-AT');
  let html = `<h1>🕐 Schichtartenliste</h1>
<div class="subtitle">${shifts.length} Schichtarten &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr><th>Kürzel</th><th>Name</th><th>Dauer (Mo)</th><th>Farbe</th><th>Status</th></tr></thead><tbody>`;

  for (const s of shifts) {
    const dur = s.DURATION0 ? `${s.DURATION0.toFixed(1)} h` : '—';
    html += `<tr>
<td><span class="badge" style="background:${s.COLORBK_HEX};color:${s.COLORTEXT_HEX}">${s.SHORTNAME}</span></td>
<td><strong>${s.NAME}</strong></td>
<td style="text-align:right">${dur}</td>
<td><span style="display:inline-block;width:40px;height:16px;border-radius:3px;background:${s.COLORBK_HEX};border:1px solid #ccc"></span></td>
<td>${s.HIDE ? '<span class="badge" style="background:#fef2f2;color:#dc2626">Ausgeblendet</span>' : '<span class="badge" style="background:#f0fdf4;color:#16a34a">Aktiv</span>'}</td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, 'Schichtartenliste');
}

// ── Report: Monatsübersicht ───────────────────────────────────

async function reportMonthlySchedule(year: number, month: number, groupId: number | null, employees: Employee[], groups: Group[]) {
  const groupName = groupId ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`) : 'Alle';
  const entries = await api.getSchedule(year, month, groupId ?? undefined);
  const now = new Date().toLocaleString('de-AT');
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  // Build employee map
  let emps = employees;
  if (groupId) {
    const memberIds = new Set<number>();
    const assignmentsRaw = await api.getGroupAssignments();
    assignmentsRaw.filter(a => a.group_id === groupId).forEach(a => memberIds.add(a.employee_id));
    emps = employees.filter(e => memberIds.has(e.ID));
  }

  // Index entries by emp+date
  type Entry = typeof entries[0];
  const idx: Record<string, Entry> = {};
  for (const e of entries) {
    idx[`${e.employee_id}::${e.date}`] = e;
  }

  const thStyle = 'background:#334155;color:#fff;padding:2px 4px;font-size:10px;text-align:center;border:1px solid #475569;';
  const nameStyle = 'padding:2px 4px;font-size:10px;font-weight:bold;white-space:nowrap;border:1px solid #ddd;background:#f8fafc;';

  let headerCols = `<th style="${thStyle};text-align:left;min-width:80px">Mitarbeiter</th>`;
  for (const d of days) {
    const date = new Date(year, month - 1, d);
    const isWe = date.getDay() === 0 || date.getDay() === 6;
    const bg = isWe ? '#1e293b' : '#334155';
    const dn = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
    headerCols += `<th style="${thStyle};background:${bg};min-width:26px">${padZero(d)}<br><span style="font-size:8px">${dn}</span></th>`;
  }

  let rows = '';
  for (const emp of emps) {
    let cells = `<td style="${nameStyle}">${emp.NAME} ${emp.FIRSTNAME ? emp.FIRSTNAME.charAt(0) + '.' : ''}</td>`;
    for (const d of days) {
      const dateStr = `${year}-${padZero(month)}-${padZero(d)}`;
      const entry = idx[`${emp.ID}::${dateStr}`];
      const date = new Date(year, month - 1, d);
      const isWe = date.getDay() === 0 || date.getDay() === 6;
      const cellBg = isWe ? '#f1f5f9' : '#fff';
      if (entry) {
        cells += `<td style="border:1px solid #ddd;padding:1px;text-align:center;background:${entry.color_bk || cellBg}">
<span style="color:${entry.color_text || '#000'};font-size:9px;font-weight:bold">${entry.display_name || ''}</span></td>`;
      } else {
        cells += `<td style="border:1px solid #ddd;background:${cellBg}"></td>`;
      }
    }
    rows += `<tr>${cells}</tr>`;
  }

  const html = `<h1>📅 Monatsbericht Dienstplan</h1>
<div class="subtitle">Monat: ${MONTHS[month - 1]} ${year} &nbsp;|&nbsp; Gruppe: ${groupName} &nbsp;|&nbsp; ${emps.length} Mitarbeiter &nbsp;|&nbsp; Stand: ${now}</div>
<div style="overflow-x:auto">
<table style="border-collapse:collapse;font-size:10px">
<thead><tr>${headerCols}</tr></thead>
<tbody>${rows}</tbody>
</table>
</div>`;
  printHtml(html, `Dienstplan ${MONTHS[month - 1]} ${year}`);
}

// ── Report: Urlaubsliste ──────────────────────────────────────

async function reportVacation(year: number, employees: Employee[]) {
  const now = new Date().toLocaleString('de-AT');
  const absences = await api.getAbsences({ year });
  const entitlements = await api.getLeaveEntitlements();
  const leaveTypes = await api.getLeaveTypes();
  const ltMap = Object.fromEntries(leaveTypes.filter(lt => lt.ENTITLED).map(lt => [lt.ID, lt]));
  const empMap = Object.fromEntries(employees.map(e => [e.ID, e]));

  // Aggregate by employee
  const stats: Record<number, { used: number; entitlement: number }> = {};
  for (const a of absences) {
    if (!ltMap[a.leave_type_id ?? 0]) continue;
    if (!stats[a.employee_id]) stats[a.employee_id] = { used: 0, entitlement: 0 };
    stats[a.employee_id].used++;
  }
  for (const e of entitlements) {
    if (e.year !== year) continue;
    if (!stats[e.employee_id]) stats[e.employee_id] = { used: 0, entitlement: 0 };
    stats[e.employee_id].entitlement = e.entitlement;
  }

  const empIds = [...new Set([...absences.map(a => a.employee_id), ...entitlements.filter(e => e.year === year).map(e => e.employee_id)])];
  const emps = empIds.map(id => empMap[id]).filter(Boolean).sort((a, b) => (a.NAME || '').localeCompare(b.NAME || ''));

  let html = `<h1>🏖️ Urlaubsübersicht ${year}</h1>
<div class="subtitle">Stand: ${now}</div>
<table>
<thead><tr>
<th>Name</th><th>Vorname</th><th>Kürzel</th>
<th style="text-align:right">Anspruch</th><th style="text-align:right">Genommen</th>
<th style="text-align:right">Offen</th><th>Status</th>
</tr></thead><tbody>`;

  for (const emp of emps) {
    const s = stats[emp.ID] || { used: 0, entitlement: 0 };
    const remaining = s.entitlement - s.used;
    const statusColor = remaining < 0 ? '#dc2626' : remaining === 0 ? '#d97706' : '#16a34a';
    const statusText = remaining < 0 ? 'Überschritten' : remaining === 0 ? 'Vollständig' : 'Offen';
    html += `<tr>
<td><strong>${emp.NAME}</strong></td>
<td>${emp.FIRSTNAME}</td>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${emp.SHORTNAME || '—'}</span></td>
<td style="text-align:right">${s.entitlement} Tg.</td>
<td style="text-align:right">${s.used} Tg.</td>
<td style="text-align:right;font-weight:bold;color:${statusColor}">${remaining} Tg.</td>
<td><span class="badge" style="background:${statusColor}22;color:${statusColor}">${statusText}</span></td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, `Urlaubsübersicht ${year}`);
}

// ── Report: Feiertagsliste ────────────────────────────────────

async function reportHolidays(year: number) {
  const now = new Date().toLocaleString('de-AT');
  const holidays = await api.getHolidays(year);
  let html = `<h1>🎉 Feiertagsliste ${year}</h1>
<div class="subtitle">${holidays.length} Feiertage &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr><th>Datum</th><th>Wochentag</th><th>Name</th><th>Typ</th></tr></thead><tbody>`;

  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  for (const h of holidays) {
    const d = new Date(h.DATE);
    const dn = dayNames[d.getDay()];
    const isWe = d.getDay() === 0 || d.getDay() === 6;
    html += `<tr>
<td><strong>${h.DATE}</strong></td>
<td ${isWe ? 'style="color:#dc2626"' : ''}>${dn}</td>
<td>${h.NAME}</td>
<td>${h.INTERVAL === 1 ? 'Jährlich' : 'Einmalig'}</td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, `Feiertagsliste ${year}`);
}

// ── Report: Stunden-Auswertung ────────────────────────────────

async function reportStundenAuswertung(
  year: number,
  month: number,
  groupId: number | null,
  employees: Employee[],
  groups: Group[],
) {
  const now = new Date().toLocaleString('de-AT');
  const monthStr = MONTHS[month - 1];
  const groupName = groupId ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`) : 'Alle';

  // Determine which employees to show
  let emps = employees;
  if (groupId) {
    const assignments = await api.getGroupAssignments();
    const memberIds = new Set(assignments.filter(a => a.group_id === groupId).map(a => a.employee_id));
    emps = employees.filter(e => memberIds.has(e.ID));
  }

  // Load bookings for the month (all employees)
  const monthPad = padZero(month);
  const allBookings = await api.getBookings(year, month);

  // Load absences for the year, filter by month
  const allAbsences = await api.getAbsences({ year });
  const monthAbsences = allAbsences.filter(a => a.date && a.date.startsWith(`${year}-${monthPad}`));

  // Build per-employee stats
  interface EmpStats {
    soll: number;
    ist: number;
    urlaubTage: number;
    krankTage: number;
  }

  const statsMap: Record<number, EmpStats> = {};
  const getStats = (id: number): EmpStats => {
    if (!statsMap[id]) statsMap[id] = { soll: 0, ist: 0, urlaubTage: 0, krankTage: 0 };
    return statsMap[id];
  };

  for (const b of allBookings) {
    const s = getStats(b.employee_id);
    if (b.type === 0) s.ist += b.value;       // Ist-Stunden
    else if (b.type === 1) s.soll += b.value; // Soll-Stunden
  }

  for (const a of monthAbsences) {
    const s = getStats(a.employee_id);
    const nameLower = (a.leave_type_name || '').toLowerCase();
    const shortLower = (a.leave_type_short || '').toLowerCase();
    if (nameLower.includes('krank') || shortLower === 'k' || shortLower.includes('krank')) {
      s.krankTage++;
    } else {
      s.urlaubTage++;
    }
  }

  // Summary totals
  let totalSoll = 0, totalIst = 0, totalUrlaub = 0, totalKrank = 0;
  for (const emp of emps) {
    const s = statsMap[emp.ID] || { soll: 0, ist: 0, urlaubTage: 0, krankTage: 0 };
    totalSoll += s.soll;
    totalIst += s.ist;
    totalUrlaub += s.urlaubTage;
    totalKrank += s.krankTage;
  }
  const totalDiff = totalIst - totalSoll;

  // Build HTML
  let rows = '';
  for (const emp of emps) {
    const s = statsMap[emp.ID] || { soll: 0, ist: 0, urlaubTage: 0, krankTage: 0 };
    const diff = s.ist - s.soll;
    const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#374151';
    const diffSign = diff > 0 ? '+' : '';
    rows += `<tr>
<td><strong>${emp.NAME}</strong>, ${emp.FIRSTNAME}</td>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${emp.SHORTNAME || '—'}</span></td>
<td style="text-align:right">${s.soll.toFixed(2)} h</td>
<td style="text-align:right">${s.ist.toFixed(2)} h</td>
<td style="text-align:right;font-weight:bold;color:${diffColor}">${diffSign}${diff.toFixed(2)} h</td>
<td style="text-align:center">${s.urlaubTage > 0 ? `<span class="badge" style="background:#fef9c3;color:#854d0e">${s.urlaubTage} Tg.</span>` : '—'}</td>
<td style="text-align:center">${s.krankTage > 0 ? `<span class="badge" style="background:#fee2e2;color:#dc2626">${s.krankTage} Tg.</span>` : '—'}</td>
</tr>`;
  }

  const totalDiffColor = totalDiff > 0 ? '#16a34a' : totalDiff < 0 ? '#dc2626' : '#374151';
  const totalDiffSign = totalDiff > 0 ? '+' : '';

  const html = `<h1>⏱️ Stunden-Auswertung</h1>
<div class="subtitle">Monat: ${monthStr} ${year} &nbsp;|&nbsp; Gruppe: ${groupName} &nbsp;|&nbsp; ${emps.length} Mitarbeiter &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr>
<th>Mitarbeiter</th>
<th>Kürzel</th>
<th style="text-align:right">Soll-Std.</th>
<th style="text-align:right">Ist-Std.</th>
<th style="text-align:right">Differenz</th>
<th style="text-align:center">Urlaub</th>
<th style="text-align:center">Krank</th>
</tr></thead>
<tbody>
${rows}
</tbody>
<tfoot><tr style="background:#f1f5f9;font-weight:bold;border-top:2px solid #334155">
<td colspan="2">∑ Gesamt (${emps.length} Mitarbeiter)</td>
<td style="text-align:right">${totalSoll.toFixed(2)} h</td>
<td style="text-align:right">${totalIst.toFixed(2)} h</td>
<td style="text-align:right;color:${totalDiffColor}">${totalDiffSign}${totalDiff.toFixed(2)} h</td>
<td style="text-align:center">${totalUrlaub} Tg.</td>
<td style="text-align:center">${totalKrank} Tg.</td>
</tr></tfoot>
</table>
<p style="font-size:10px;color:#666;margin-top:8px">
  Soll = Summe der Soll-Buchungen (TYPE=1) im Zeitkonto &nbsp;|&nbsp;
  Ist = Summe der Ist-Buchungen (TYPE=0) im Zeitkonto &nbsp;|&nbsp;
  Urlaub/Krank = Abwesenheitstage lt. Abwesenheitsplan
</p>`;

  printHtml(html, `Stunden-Auswertung ${monthStr} ${year}`);
}

// ── Main Component ────────────────────────────────────────────

export default function Berichte() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getEmployees(),
      api.getGroups(),
      api.getShifts(),
    ]).then(([emps, grps, shfs]) => {
      setEmployees(emps);
      setGroups(grps);
      setShifts(shfs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const run = async (fn: () => Promise<void> | void) => {
    try {
      await fn();
    } catch (e) {
      showToast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  const reportCards: {
    icon: string;
    title: string;
    description: string;
    action: () => void;
    color: string;
  }[] = [
    {
      icon: '👥',
      title: 'Mitarbeiterliste',
      description: 'Vollständige Liste aller Mitarbeiter mit Kontaktdaten, Gruppen und Arbeitszeitmodell.',
      action: () => run(() => reportEmployeeList(employees, groups)),
      color: 'blue',
    },
    {
      icon: '🏢',
      title: 'Gruppenübersicht',
      description: 'Liste aller Gruppen mit Hierarchie und Mitgliederanzahl.',
      action: () => run(() => reportGroups(groups)),
      color: 'purple',
    },
    {
      icon: '🕐',
      title: 'Schichtartenliste',
      description: 'Übersicht aller Schichtarten mit Farben und Zeiten.',
      action: () => run(() => reportShifts(shifts)),
      color: 'indigo',
    },
    {
      icon: '📅',
      title: 'Monatlicher Dienstplan',
      description: `Druckbare Monatsübersicht des Dienstplans für ${MONTHS[month - 1]} ${year}.`,
      action: () => run(() => reportMonthlySchedule(year, month, groupId, employees, groups)),
      color: 'green',
    },
    {
      icon: '🏖️',
      title: 'Urlaubsübersicht',
      description: `Urlaubsanspruch und -verbrauch für ${year} mit Resturlaubsanzeige.`,
      action: () => run(() => reportVacation(year, employees)),
      color: 'orange',
    },
    {
      icon: '🎉',
      title: 'Feiertagsliste',
      description: `Alle Feiertage für ${year} mit Datum und Wochentag.`,
      action: () => run(() => reportHolidays(year)),
      color: 'red',
    },
    {
      icon: '⏱️',
      title: 'Stunden-Auswertung',
      description: `Soll/Ist-Stunden-Vergleich pro Mitarbeiter für ${MONTHS[month - 1]} ${year} mit Überstunden, Urlaub und Kranktagen.`,
      action: () => run(() => reportStundenAuswertung(year, month, groupId, employees, groups)),
      color: 'teal',
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    purple: 'bg-purple-50 border-purple-200 hover:border-purple-400',
    indigo: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
    green: 'bg-green-50 border-green-200 hover:border-green-400',
    orange: 'bg-orange-50 border-orange-200 hover:border-orange-400',
    red: 'bg-red-50 border-red-200 hover:border-red-400',
    teal: 'bg-teal-50 border-teal-200 hover:border-teal-400',
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 mb-1">📊 Berichte &amp; Ausdruck</h1>
        <p className="text-sm text-gray-500">Erstellen Sie druckbare Berichte und Übersichten. Alle Berichte öffnen im Browser für Druck oder PDF-Export.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Jahr</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Monat</label>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Gruppe (für Dienstplan)</label>
          <select value={groupId ?? ''} onChange={e => setGroupId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]">
            <option value="">Alle Gruppen</option>
            {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
          </select>
        </div>
      </div>

      {/* Report cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportCards.map(card => (
            <button
              key={card.title}
              onClick={card.action}
              className={`text-left p-5 rounded-xl border-2 transition-all cursor-pointer ${colorMap[card.color]} hover:shadow-md`}
            >
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="font-bold text-gray-800 mb-1">{card.title}</div>
              <div className="text-xs text-gray-600 leading-relaxed">{card.description}</div>
              <div className="mt-3 text-xs font-semibold text-gray-500 flex items-center gap-1">
                🖨️ Drucken / PDF
              </div>
            </button>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
