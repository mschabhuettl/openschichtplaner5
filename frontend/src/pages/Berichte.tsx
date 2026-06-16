import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Restriction } from '../api/client';
import type { Employee, Group, ShiftType } from '../types';
import { useToast } from '../hooks/useToast';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { escapeHtml, safeColor } from '../utils/escapeHtml';
import { entryArt } from '../utils/reportRows';

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
<th scope="col">Nr.</th><th scope="col">Name</th><th scope="col">Vorname</th><th scope="col">Kürzel</th>
<th scope="col">Funktion</th><th scope="col">Std/Tag</th><th scope="col">Std/Woche</th>
<th scope="col">Eintritt</th><th scope="col">Austritt</th><th scope="col">Gruppen</th>
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
<td>${escapeHtml(emp.NUMBER || '—')}</td>
<td><strong>${escapeHtml(emp.NAME)}</strong></td>
<td>${escapeHtml(emp.FIRSTNAME)}</td>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${escapeHtml(emp.SHORTNAME || '—')}</span></td>
<td>${(emp as Employee & { FUNCTION?: string }).FUNCTION || '—'}</td>
<td style="text-align:right">${emp.HRSDAY?.toFixed(1) ?? '—'} h</td>
<td style="text-align:right">${emp.HRSWEEK?.toFixed(1) ?? '—'} h</td>
<td>${emp.EMPSTART || '—'}</td>
<td>${emp.EMPEND || '—'}</td>
<td>${escapeHtml(grpList)}</td>
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
<thead><tr><th scope="col">Name</th><th scope="col">Kürzel</th><th scope="col">Übergeordnet</th><th scope="col">Mitglieder</th><th scope="col">Status</th></tr></thead><tbody>`;

  const groupMap = Object.fromEntries(groups.map(g => [g.ID, g.NAME]));
  for (const g of groups) {
    html += `<tr>
<td><strong>${escapeHtml(g.NAME)}</strong></td>
<td>${escapeHtml(g.SHORTNAME || '—')}</td>
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
<thead><tr><th scope="col">Kürzel</th><th scope="col">Name</th><th scope="col">Dauer (Mo)</th><th scope="col">Farbe</th><th scope="col">Status</th></tr></thead><tbody>`;

  for (const s of shifts) {
    const dur = s.DURATION0 ? `${s.DURATION0.toFixed(1)} h` : '—';
    html += `<tr>
<td><span class="badge" style="background:${safeColor(s.COLORBK_HEX)};color:${safeColor(s.COLORTEXT_HEX)}">${escapeHtml(s.SHORTNAME)}</span></td>
<td><strong>${escapeHtml(s.NAME)}</strong></td>
<td style="text-align:right">${dur}</td>
<td><span style="display:inline-block;width:40px;height:16px;border-radius:3px;background:${safeColor(s.COLORBK_HEX)};border:1px solid #ccc"></span></td>
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

  let headerCols = `<th scope="col" style="${thStyle};text-align:left;min-width:80px">Mitarbeiter</th>`;
  for (const d of days) {
    const date = new Date(year, month - 1, d);
    const isWe = date.getDay() === 0 || date.getDay() === 6;
    const bg = isWe ? '#1e293b' : '#334155';
    const dn = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
    headerCols += `<th scope="col" style="${thStyle};background:${bg};min-width:26px">${padZero(d)}<br><span style="font-size:8px">${dn}</span></th>`;
  }

  let rows = '';
  for (const emp of emps) {
    let cells = `<td style="${nameStyle}">${escapeHtml(emp.NAME)} ${escapeHtml(emp.FIRSTNAME ? emp.FIRSTNAME.charAt(0) + '.' : '')}</td>`;
    for (const d of days) {
      const dateStr = `${year}-${padZero(month)}-${padZero(d)}`;
      const entry = idx[`${emp.ID}::${dateStr}`];
      const date = new Date(year, month - 1, d);
      const isWe = date.getDay() === 0 || date.getDay() === 6;
      const cellBg = isWe ? '#f1f5f9' : '#fff';
      if (entry) {
        cells += `<td style="border:1px solid #ddd;padding:1px;text-align:center;background:${safeColor(entry.color_bk || cellBg)}">
<span style="color:${safeColor(entry.color_text || '#000')};font-size:9px;font-weight:bold">${escapeHtml(entry.display_name || '')}</span></td>`;
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
<th scope="col">Name</th><th scope="col">Vorname</th><th scope="col">Kürzel</th>
<th scope="col" style="text-align:right">Anspruch</th><th scope="col" style="text-align:right">Genommen</th>
<th scope="col" style="text-align:right">Offen</th><th scope="col">Status</th>
</tr></thead><tbody>`;

  for (const emp of emps) {
    const s = stats[emp.ID] || { used: 0, entitlement: 0 };
    const remaining = s.entitlement - s.used;
    const statusColor = remaining < 0 ? '#dc2626' : remaining === 0 ? '#d97706' : '#16a34a';
    const statusText = remaining < 0 ? 'Überschritten' : remaining === 0 ? 'Vollständig' : 'Offen';
    html += `<tr>
<td><strong>${escapeHtml(emp.NAME)}</strong></td>
<td>${escapeHtml(emp.FIRSTNAME)}</td>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${escapeHtml(emp.SHORTNAME || '—')}</span></td>
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
<thead><tr><th scope="col">Datum</th><th scope="col">Wochentag</th><th scope="col">Name</th><th scope="col">Typ</th></tr></thead><tbody>`;

  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  for (const h of holidays) {
    const d = new Date(h.DATE);
    const dn = dayNames[d.getDay()];
    const isWe = d.getDay() === 0 || d.getDay() === 6;
    html += `<tr>
<td><strong>${h.DATE}</strong></td>
<td ${isWe ? 'style="color:#dc2626"' : ''}>${dn}</td>
<td>${escapeHtml(h.NAME)}</td>
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
<td><strong>${escapeHtml(emp.NAME)}</strong>, ${escapeHtml(emp.FIRSTNAME)}</td>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${escapeHtml(emp.SHORTNAME || '—')}</span></td>
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
<th scope="col">Mitarbeiter</th>
<th scope="col">Kürzel</th>
<th scope="col" style="text-align:right">Soll-Std.</th>
<th scope="col" style="text-align:right">Ist-Std.</th>
<th scope="col" style="text-align:right">Differenz</th>
<th scope="col" style="text-align:center">Urlaub</th>
<th scope="col" style="text-align:center">Krank</th>
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

// ── Report: Urlaubsantrag ─────────────────────────────────────

function countWorkdays(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

async function reportUrlaubsantrag(
  employeeId: number,
  fromDate: string,
  toDate: string,
  employees: Employee[],
) {
  if (!employeeId || !fromDate || !toDate) {
    alert('Bitte Mitarbeiter und Zeitraum auswählen.');
    return;
  }
  const emp = employees.find(e => e.ID === employeeId);
  if (!emp) { alert('Mitarbeiter nicht gefunden.'); return; }

  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (from > to) { alert('Von-Datum muss vor Bis-Datum liegen.'); return; }

  const workdays = countWorkdays(from, to);
  const year = from.getFullYear();

  // Load entitlements and used absences
  const [entitlements, absences] = await Promise.all([
    api.getLeaveEntitlements({ year, employee_id: employeeId }),
    api.getAbsences({ year, employee_id: employeeId }),
  ]);

  // Find total entitlement for year (vacation leave types)
  const leaveTypes = await api.getLeaveTypes();
  const vacationLtIds = new Set(leaveTypes.filter(lt => lt.ENTITLED).map(lt => lt.ID));
  const entTotal = entitlements
    .filter(e => e.year === year && vacationLtIds.has(e.leave_type_id))
    .reduce((sum, e) => sum + e.entitlement, 0);
  const used = absences.filter(a => vacationLtIds.has(a.leave_type_id ?? 0)).length;
  const remaining = entTotal - used - workdays;

  const now = new Date().toLocaleDateString('de-AT');
  const fromStr = from.toLocaleDateString('de-AT');
  const toStr = to.toLocaleDateString('de-AT');

  const html = `
<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;font-size:13px;padding:16px;">
  <div style="text-align:center;border-top:3px double #333;padding-top:8px;margin-bottom:8px;">
    <div style="font-size:18px;font-weight:bold;letter-spacing:2px;margin-bottom:4px;">URLAUBSANTRAG</div>
  </div>
  <div style="border-top:3px double #333;margin-bottom:16px;"></div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="padding:4px 8px;font-weight:bold;width:40%">Mitarbeiter:</td>
      <td style="padding:4px 8px">${escapeHtml(emp.NAME)}, ${escapeHtml(emp.FIRSTNAME)}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;font-weight:bold">Personalnummer:</td>
      <td style="padding:4px 8px">${escapeHtml(emp.NUMBER || '—')}</td>
    </tr>
  </table>

  <div style="border-top:1px solid #aaa;margin:12px 0;"></div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="padding:4px 8px;font-weight:bold;width:40%">Urlaubszeitraum:</td>
      <td style="padding:4px 8px">${fromStr} bis ${toStr}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;font-weight:bold">Anzahl Tage:</td>
      <td style="padding:4px 8px"><strong>${workdays} Arbeitstage</strong></td>
    </tr>
  </table>

  <div style="border-top:1px solid #aaa;margin:12px 0;"></div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="padding:4px 8px;font-weight:bold;width:40%">Urlaubsanspruch ${year}:</td>
      <td style="padding:4px 8px">${entTotal} Tage</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;font-weight:bold">Bereits verbraucht:</td>
      <td style="padding:4px 8px">${used} Tage</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;font-weight:bold">Nach diesem Urlaub verbleibend:</td>
      <td style="padding:4px 8px;font-weight:bold;color:${remaining < 0 ? '#dc2626' : '#16a34a'}">${remaining} Tage</td>
    </tr>
  </table>

  <div style="border-top:1px solid #aaa;margin:12px 0;"></div>

  <table style="width:100%;border-collapse:collapse;margin-top:24px;">
    <tr>
      <td style="padding:8px;width:50%;vertical-align:bottom;">
        <div>Datum: ___________________</div>
        <div style="margin-top:24px;">Unterschrift Mitarbeiter:</div>
        <div style="border-bottom:1px solid #333;margin-top:24px;"></div>
      </td>
      <td style="padding:8px;width:50%;vertical-align:bottom;">
        <div>Genehmigt am: _______________</div>
        <div style="margin-top:24px;">Unterschrift Vorgesetzter:</div>
        <div style="border-bottom:1px solid #333;margin-top:24px;"></div>
      </td>
    </tr>
  </table>

  <div style="border-top:3px double #333;margin-top:20px;"></div>
  <div style="text-align:center;font-size:10px;color:#888;margin-top:4px">Erstellt am ${now}</div>
</div>`;

  printHtml(html, `Urlaubsantrag – ${escapeHtml(emp.NAME)} ${escapeHtml(emp.FIRSTNAME)}`);
}

// ── Report: Quartals-Dienstplan ──────────────────────────────

async function reportQuarterSchedule(year: number, quarter: number, groupId: number | null, employees: Employee[], groups: Group[]) {
  const monthStart = (quarter - 1) * 3 + 1;
  const months = [monthStart, monthStart + 1, monthStart + 2];
  const groupName = groupId ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`) : 'Alle';
  const now = new Date().toLocaleString('de-AT');

  let emps = employees;
  if (groupId) {
    const assignments = await api.getGroupAssignments();
    const memberIds = new Set(assignments.filter(a => a.group_id === groupId).map(a => a.employee_id));
    emps = employees.filter(e => memberIds.has(e.ID));
  }

  const allEntries = await Promise.all(months.map(m => api.getSchedule(year, m, groupId ?? undefined)));

  const thStyle = 'background:#334155;color:#fff;padding:2px 3px;font-size:9px;text-align:center;border:1px solid #475569;';
  const nameStyle = 'padding:2px 4px;font-size:9px;font-weight:bold;white-space:nowrap;border:1px solid #ddd;background:#f8fafc;';

  let html = `<h1>📅 Quartals-Dienstplan Q${quarter} ${year}</h1>
<div class="subtitle">Quartal ${quarter} / ${year} &nbsp;|&nbsp; Gruppe: ${groupName} &nbsp;|&nbsp; ${emps.length} Mitarbeiter &nbsp;|&nbsp; Stand: ${now}</div>`;

  for (let mi = 0; mi < 3; mi++) {
    const month = months[mi];
    const entries = allEntries[mi];
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: number[] = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    type Entry = typeof entries[0];
    const idx: Record<string, Entry> = {};
    for (const e of entries) idx[`${e.employee_id}::${e.date}`] = e;

    let headerCols = `<th scope="col" style="${thStyle};text-align:left;min-width:70px">Mitarbeiter</th>`;
    for (const d of days) {
      const date = new Date(year, month - 1, d);
      const isWe = date.getDay() === 0 || date.getDay() === 6;
      const dn = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
      headerCols += `<th scope="col" style="${thStyle};background:${isWe ? '#1e293b' : '#334155'};min-width:22px">${padZero(d)}<br><span style="font-size:7px">${dn}</span></th>`;
    }

    let rows = '';
    for (const emp of emps) {
      let cells = `<td style="${nameStyle}">${escapeHtml(emp.NAME)} ${escapeHtml(emp.FIRSTNAME ? emp.FIRSTNAME.charAt(0) + '.' : '')}</td>`;
      for (const d of days) {
        const dateStr = `${year}-${padZero(month)}-${padZero(d)}`;
        const entry = idx[`${emp.ID}::${dateStr}`];
        const date = new Date(year, month - 1, d);
        const isWe = date.getDay() === 0 || date.getDay() === 6;
        const cellBg = isWe ? '#f1f5f9' : '#fff';
        if (entry) {
          cells += `<td style="border:1px solid #ddd;padding:1px;text-align:center;background:${safeColor(entry.color_bk || cellBg)}"><span style="color:${safeColor(entry.color_text || '#000')};font-size:8px;font-weight:bold">${escapeHtml(entry.display_name || '')}</span></td>`;
        } else {
          cells += `<td style="border:1px solid #ddd;background:${cellBg}"></td>`;
        }
      }
      rows += `<tr>${cells}</tr>`;
    }

    html += `<h2>${MONTHS[month - 1]} ${year}</h2>
<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:9px">
<thead><tr>${headerCols}</tr></thead>
<tbody>${rows}</tbody>
</table></div>`;
  }

  printHtml(html, `Quartals-Dienstplan Q${quarter} ${year}`);
}

// ── Report: Jahres-Dienstplan ─────────────────────────────────

async function reportYearSchedule(year: number, groupId: number | null, employees: Employee[], groups: Group[]) {
  const groupName = groupId ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`) : 'Alle';
  const now = new Date().toLocaleString('de-AT');

  let emps = employees;
  if (groupId) {
    const assignments = await api.getGroupAssignments();
    const memberIds = new Set(assignments.filter(a => a.group_id === groupId).map(a => a.employee_id));
    emps = employees.filter(e => memberIds.has(e.ID));
  }

  // Load all 12 months
  const allEntries = await Promise.all(
    Array.from({ length: 12 }, (_, mi) => api.getSchedule(year, mi + 1, groupId ?? undefined))
  );

  // Build month summary per employee: dominant shift per month
  const empMonthData: Record<number, Record<number, { shifts: Record<string, number>; absences: number }>> = {};
  for (let mi = 0; mi < 12; mi++) {
    for (const e of allEntries[mi]) {
      if (!empMonthData[e.employee_id]) empMonthData[e.employee_id] = {};
      if (!empMonthData[e.employee_id][mi + 1]) empMonthData[e.employee_id][mi + 1] = { shifts: {}, absences: 0 };
      const cell = empMonthData[e.employee_id][mi + 1];
      if (e.kind === 'absence') cell.absences++;
      else {
        const key = e.display_name || '?';
        cell.shifts[key] = (cell.shifts[key] || 0) + 1;
      }
    }
  }

  const thStyle = 'background:#334155;color:#fff;padding:3px 6px;font-size:10px;text-align:center;border:1px solid #475569;';
  const nameStyle = 'padding:2px 6px;font-size:10px;font-weight:bold;white-space:nowrap;border:1px solid #ddd;background:#f8fafc;';

  let headerCols = `<th scope="col" style="${thStyle};text-align:left;min-width:80px">Mitarbeiter</th>`;
  for (let m = 1; m <= 12; m++) {
    headerCols += `<th scope="col" style="${thStyle};min-width:36px">${MONTHS[m-1].substring(0,3)}</th>`;
  }

  let rows = '';
  for (const emp of emps) {
    let cells = `<td style="${nameStyle}">${escapeHtml(emp.NAME)} ${escapeHtml(emp.FIRSTNAME ? emp.FIRSTNAME.charAt(0) + '.' : '')}</td>`;
    for (let m = 1; m <= 12; m++) {
      const cell = empMonthData[emp.ID]?.[m];
      if (!cell) { cells += `<td style="border:1px solid #ddd;background:#fff"></td>`; continue; }
      const topShiftEntry = Object.entries(cell.shifts).sort((a, b) => b[1] - a[1])[0];
      if (cell.absences > 0 && !topShiftEntry) {
        cells += `<td style="border:1px solid #ddd;background:#fef2f2;text-align:center;font-size:9px;color:#dc2626">${cell.absences}A</td>`;
      } else if (topShiftEntry) {
        cells += `<td style="border:1px solid #ddd;background:#f0fdf4;text-align:center;font-size:9px;font-weight:bold;color:#15803d">${topShiftEntry[0]}×${topShiftEntry[1]}</td>`;
      } else {
        cells += `<td style="border:1px solid #ddd;background:#fff"></td>`;
      }
    }
    rows += `<tr>${cells}</tr>`;
  }

  const html = `<h1>📅 Jahres-Dienstplan ${year}</h1>
<div class="subtitle">Jahr: ${year} &nbsp;|&nbsp; Gruppe: ${groupName} &nbsp;|&nbsp; ${emps.length} Mitarbeiter &nbsp;|&nbsp; Stand: ${now}</div>
<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:10px">
<thead><tr>${headerCols}</tr></thead>
<tbody>${rows}</tbody>
</table></div>
<p style="font-size:9px;color:#666;margin-top:6px">Format: häufigste Schicht × Anzahl Tage. A = Abwesenheitstage (Urlaub/Krank etc.).</p>`;

  printHtml(html, `Jahres-Dienstplan ${year}`);
}

// ── Report: Abwesenheitsübersicht ─────────────────────────────

async function reportAbsenceOverview(year: number, month: number, groupId: number | null, employees: Employee[], groups: Group[]) {
  const groupName = groupId ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`) : 'Alle';
  const now = new Date().toLocaleString('de-AT');

  let emps = employees;
  if (groupId) {
    const assignments = await api.getGroupAssignments();
    const memberIds = new Set(assignments.filter(a => a.group_id === groupId).map(a => a.employee_id));
    emps = employees.filter(e => memberIds.has(e.ID));
  }

  const entries = await api.getSchedule(year, month, groupId ?? undefined);
  const absenceEntries = entries.filter(e => e.kind === 'absence');
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  type AEntry = typeof absenceEntries[0];
  const idx: Record<string, AEntry> = {};
  for (const e of absenceEntries) idx[`${e.employee_id}::${e.date}`] = e;

  const thStyle = 'background:#334155;color:#fff;padding:2px 3px;font-size:9px;text-align:center;border:1px solid #475569;';
  const nameStyle = 'padding:2px 4px;font-size:9px;font-weight:bold;white-space:nowrap;border:1px solid #ddd;background:#f8fafc;';

  let headerCols = `<th scope="col" style="${thStyle};text-align:left;min-width:70px">Mitarbeiter</th>`;
  for (const d of days) {
    const date = new Date(year, month - 1, d);
    const isWe = date.getDay() === 0 || date.getDay() === 6;
    const dn = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
    headerCols += `<th scope="col" style="${thStyle};background:${isWe ? '#1e293b' : '#334155'};min-width:22px">${padZero(d)}<br><span style="font-size:7px">${dn}</span></th>`;
  }

  let rows = '';
  for (const emp of emps) {
    let cells = `<td style="${nameStyle}">${escapeHtml(emp.NAME)} ${escapeHtml(emp.FIRSTNAME ? emp.FIRSTNAME.charAt(0) + '.' : '')}</td>`;
    for (const d of days) {
      const dateStr = `${year}-${padZero(month)}-${padZero(d)}`;
      const entry = idx[`${emp.ID}::${dateStr}`];
      const date = new Date(year, month - 1, d);
      const isWe = date.getDay() === 0 || date.getDay() === 6;
      const cellBg = isWe ? '#f1f5f9' : '#fff';
      if (entry) {
        cells += `<td style="border:1px solid #ddd;padding:1px;text-align:center;background:${safeColor(entry.color_bk || '#fee2e2')}"><span style="color:${safeColor(entry.color_text || '#dc2626')};font-size:8px;font-weight:bold">${escapeHtml(entry.display_name || entry.leave_name || 'A')}</span></td>`;
      } else {
        cells += `<td style="border:1px solid #ddd;background:${cellBg}"></td>`;
      }
    }
    rows += `<tr>${cells}</tr>`;
  }

  const html = `<h1>📋 Abwesenheitsübersicht</h1>
<div class="subtitle">${MONTHS[month - 1]} ${year} &nbsp;|&nbsp; Gruppe: ${groupName} &nbsp;|&nbsp; ${emps.length} Mitarbeiter &nbsp;|&nbsp; Stand: ${now}</div>
<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:9px">
<thead><tr>${headerCols}</tr></thead>
<tbody>${rows}</tbody>
</table></div>
<p style="font-size:9px;color:#666;margin-top:6px">Nur Abwesenheiten (Urlaub/Krank) farbig markiert. Schicht-freie Tage bleiben leer.</p>`;

  printHtml(html, `Abwesenheitsübersicht ${MONTHS[month - 1]} ${year}`);
}

// ── Report: Arbeitsplätze ─────────────────────────────────────

async function reportWorkplaces() {
  const now = new Date().toLocaleString('de-AT');
  const workplaces = await api.getWorkplaces();
  let html = `<h1>🏭 Arbeitsplätze</h1>
<div class="subtitle">${workplaces.length} Arbeitsplätze &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr><th scope="col">Kürzel</th><th scope="col">Name</th><th scope="col">Farbe</th><th scope="col">Status</th></tr></thead><tbody>`;

  for (const w of workplaces) {
    html += `<tr>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${w.SHORTNAME || '—'}</span></td>
<td><strong>${w.NAME}</strong></td>
<td><span style="display:inline-block;width:40px;height:16px;border-radius:3px;background:${w.COLORBK_HEX || '#eee'};border:1px solid #ccc"></span> ${w.COLORBK_HEX || '—'}</td>
<td>${w.HIDE ? '<span class="badge" style="background:#fef2f2;color:#dc2626">Ausgeblendet</span>' : '<span class="badge" style="background:#f0fdf4;color:#16a34a">Aktiv</span>'}</td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, 'Arbeitsplätze');
}

// ── Report: Zeitzuschläge ─────────────────────────────────────

async function reportExtracharges() {
  const now = new Date().toLocaleString('de-AT');
  const charges = await api.getExtraCharges();
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  function minutesToTime(m: number): string {
    if (!m && m !== 0) return '—';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }

  let html = `<h1>💰 Zeitzuschläge</h1>
<div class="subtitle">${charges.length} Zeitzuschläge &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr><th scope="col">Name</th><th scope="col">Von</th><th scope="col">Bis</th><th scope="col">Gültige Wochentage</th><th scope="col">Feiertagsregel</th></tr></thead><tbody>`;

  for (const c of charges) {
    const validDays = (c.VALIDDAYS || '0000000').split('').map((v, i) => v === '1' ? dayNames[i] : null).filter(Boolean).join(', ') || '—';
    const holRule = c.HOLRULE === 1 ? 'Nur Feiertage' : c.HOLRULE === 2 ? 'Nicht an Feiertagen' : 'Alle Tage';
    html += `<tr>
<td><strong>${c.NAME}</strong></td>
<td>${minutesToTime(c.START)}</td>
<td>${minutesToTime(c.END)}</td>
<td>${validDays}</td>
<td>${holRule}</td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, 'Zeitzuschläge');
}

// ── Report: Geburtstagsliste ──────────────────────────────────

async function reportBirthdays(employees: Employee[], birthdayMonth: number) {
  const now = new Date().toLocaleString('de-AT');
  const today = new Date();
  const thisYear = today.getFullYear();

  const withBd = employees
    .filter(e => e.BIRTHDAY && e.BIRTHDAY.length >= 5)
    .map(e => {
      const bd = new Date(e.BIRTHDAY!);
      return { emp: e, month: bd.getMonth() + 1, day: bd.getDate(), year: bd.getFullYear(), bd };
    })
    .filter(x => birthdayMonth === 0 || x.month === birthdayMonth)
    .sort((a, b) => a.month - b.month || a.day - b.day);

  const monthLabel = birthdayMonth > 0 ? MONTHS[birthdayMonth - 1] : 'Alle Monate';
  let html = `<h1>🎂 Geburtstagsliste</h1>
<div class="subtitle">${monthLabel} &nbsp;|&nbsp; ${withBd.length} Mitarbeiter mit Geburtstag &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr><th scope="col">Name</th><th scope="col">Vorname</th><th scope="col">Kürzel</th><th scope="col">Geburtstag</th><th scope="col">Alter ${thisYear}</th></tr></thead><tbody>`;

  for (const { emp, month, day, year } of withBd) {
    const age = thisYear - year;
    html += `<tr>
<td><strong>${escapeHtml(emp.NAME)}</strong></td>
<td>${escapeHtml(emp.FIRSTNAME)}</td>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${escapeHtml(emp.SHORTNAME || '—')}</span></td>
<td>${padZero(day)}.${padZero(month)}.${year}</td>
<td style="text-align:center">${age} Jahre</td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, `Geburtstagsliste${birthdayMonth > 0 ? ' ' + MONTHS[birthdayMonth - 1] : ''}`);
}

// ── Report: Mitarbeiter-Adressen ──────────────────────────────

async function reportAddresses(employees: Employee[]) {
  const now = new Date().toLocaleString('de-AT');
  let html = `<h1>📬 Mitarbeiter-Adressen</h1>
<div class="subtitle">${employees.length} Mitarbeiter &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr><th scope="col">Name</th><th scope="col">Straße</th><th scope="col">PLZ/Ort</th><th scope="col">Telefon</th><th scope="col">E-Mail</th></tr></thead><tbody>`;

  const sorted = [...employees].sort((a, b) => (a.NAME || '').localeCompare(b.NAME || ''));
  for (const emp of sorted) {
    const plzOrt = [emp.ZIP, emp.TOWN].filter(Boolean).join(' ') || '—';
    html += `<tr>
<td><strong>${escapeHtml(emp.NAME)}</strong>, ${escapeHtml(emp.FIRSTNAME)}</td>
<td>${emp.STREET || '—'}</td>
<td>${plzOrt}</td>
<td>${emp.PHONE || '—'}</td>
<td>${emp.EMAIL || '—'}</td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, 'Mitarbeiter-Adressen');
}

// ── Report: Schichtbeschränkungen ────────────────────────────

async function reportRestrictions(employees: Employee[]) {
  const now = new Date().toLocaleString('de-AT');
  const restrictions = await api.getRestrictions();
  const empMap = Object.fromEntries(employees.map(e => [e.ID, e]));

  // Group by employee
  const byEmp: Record<number, Restriction[]> = {};
  for (const r of restrictions) {
    if (!byEmp[r.employee_id]) byEmp[r.employee_id] = [];
    byEmp[r.employee_id].push(r);
  }

  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  let html = `<h1>🚫 Schichtbeschränkungen</h1>
<div class="subtitle">${restrictions.length} Einschränkungen &nbsp;|&nbsp; Stand: ${now}</div>`;

  if (restrictions.length === 0) {
    html += '<p>Keine Schichtbeschränkungen vorhanden.</p>';
  } else {
    html += `<table>
<thead><tr><th scope="col">Mitarbeiter</th><th scope="col">Schicht</th><th scope="col">Wochentag</th><th scope="col">Typ</th><th scope="col">Grund</th></tr></thead><tbody>`;

    for (const [empIdStr, resList] of Object.entries(byEmp)) {
      const emp = empMap[parseInt(empIdStr)];
      const empName = emp ? `${escapeHtml(emp.NAME)}, ${escapeHtml(emp.FIRSTNAME)}` : `ID ${empIdStr}`;
      for (const r of resList) {
        const wd = r.weekday === 0 ? 'Alle Tage' : (dayNames[r.weekday - 1] || `Tag ${r.weekday}`);
        const typ = r.restrict === 0 ? '<span class="badge" style="background:#fef2f2;color:#dc2626">Verboten</span>' :
                    '<span class="badge" style="background:#fef9c3;color:#92400e">Eingeschränkt</span>';
        html += `<tr>
<td><strong>${empName}</strong></td>
<td>${r.shift_name} (${r.shift_short})</td>
<td>${wd}</td>
<td>${typ}</td>
<td>${r.reason || '—'}</td>
</tr>`;
      }
    }
    html += '</tbody></table>';
  }
  printHtml(html, 'Schichtbeschränkungen');
}

// ── Report: Abwesenheitsstatistik ────────────────────────────

async function reportAbsenceStats(year: number, groupId: number | null, employees: Employee[], groups: Group[]) {
  const groupName = groupId ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`) : 'Alle';
  const now = new Date().toLocaleString('de-AT');

  let emps = employees;
  if (groupId) {
    const assignments = await api.getGroupAssignments();
    const memberIds = new Set(assignments.filter(a => a.group_id === groupId).map(a => a.employee_id));
    emps = employees.filter(e => memberIds.has(e.ID));
  }

  const [absences, leaveTypes] = await Promise.all([api.getAbsences({ year }), api.getLeaveTypes()]);
  const ltList = leaveTypes.filter(lt => !lt.HIDE);

  // Build stats: emp → leaveTypeId → count
  const stats: Record<number, Record<number, number>> = {};
  for (const a of absences) {
    if (!emps.find(e => e.ID === a.employee_id)) continue;
    if (!stats[a.employee_id]) stats[a.employee_id] = {};
    const ltId = a.leave_type_id ?? 0;
    stats[a.employee_id][ltId] = (stats[a.employee_id][ltId] || 0) + 1;
  }

  const headerCols = '<th scope="col">Mitarbeiter</th>' + ltList.map(lt => `<th scope="col" style="text-align:center">${lt.SHORTNAME}<br><span style="font-size:9px;font-weight:normal">${lt.NAME}</span></th>`).join('') + '<th scope="col" style="text-align:right">∑</th>';

  let rows = '';
  for (const emp of emps) {
    const s = stats[emp.ID] || {};
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    let cells = `<td><strong>${escapeHtml(emp.NAME)}</strong>, ${escapeHtml(emp.FIRSTNAME)}</td>`;
    for (const lt of ltList) {
      const cnt = s[lt.ID] || 0;
      cells += `<td style="text-align:center">${cnt > 0 ? `<span class="badge" style="background:${lt.COLORBK_HEX}33;color:#374151">${cnt}</span>` : '—'}</td>`;
    }
    cells += `<td style="text-align:right;font-weight:bold">${total}</td>`;
    rows += `<tr>${cells}</tr>`;
  }

  const html = `<h1>📊 Abwesenheitsstatistik ${year}</h1>
<div class="subtitle">Jahr: ${year} &nbsp;|&nbsp; Gruppe: ${groupName} &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr>${headerCols}</tr></thead>
<tbody>${rows || '<tr><td colspan="100" style="text-align:center;color:#999">Keine Abwesenheiten vorhanden</td></tr>'}</tbody>
</table>`;
  printHtml(html, `Abwesenheitsstatistik ${year}`);
}

// ── Report: Dienststatistik ───────────────────────────────────

async function reportShiftStats(year: number, month: number, groupId: number | null, employees: Employee[], groups: Group[]) {
  const groupName = groupId ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`) : 'Alle';
  const now = new Date().toLocaleString('de-AT');

  let emps = employees;
  if (groupId) {
    const assignments = await api.getGroupAssignments();
    const memberIds = new Set(assignments.filter(a => a.group_id === groupId).map(a => a.employee_id));
    emps = employees.filter(e => memberIds.has(e.ID));
  }

  const entries = await api.getSchedule(year, month, groupId ?? undefined);
  const shiftEntries = entries.filter(e => e.kind === 'shift' || e.kind === 'special_shift');

  // Collect all shift types used
  const shiftLabels = [...new Set(shiftEntries.map(e => e.display_name || '?'))].sort();

  // Build stats: emp → shiftLabel → count
  const stats: Record<number, Record<string, number>> = {};
  for (const e of shiftEntries) {
    if (!emps.find(emp => emp.ID === e.employee_id)) continue;
    if (!stats[e.employee_id]) stats[e.employee_id] = {};
    const lbl = e.display_name || '?';
    stats[e.employee_id][lbl] = (stats[e.employee_id][lbl] || 0) + 1;
  }

  const headerCols = '<th scope="col">Mitarbeiter</th>' + shiftLabels.map(l => `<th scope="col" style="text-align:center">${l}</th>`).join('') + '<th scope="col" style="text-align:right">∑</th>';

  let rows = '';
  for (const emp of emps) {
    const s = stats[emp.ID] || {};
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    let cells = `<td><strong>${escapeHtml(emp.NAME)}</strong>, ${escapeHtml(emp.FIRSTNAME)}</td>`;
    for (const lbl of shiftLabels) {
      const cnt = s[lbl] || 0;
      cells += `<td style="text-align:center">${cnt > 0 ? cnt : '—'}</td>`;
    }
    cells += `<td style="text-align:right;font-weight:bold">${total || '—'}</td>`;
    rows += `<tr>${cells}</tr>`;
  }

  const html = `<h1>📈 Dienststatistik</h1>
<div class="subtitle">${MONTHS[month - 1]} ${year} &nbsp;|&nbsp; Gruppe: ${groupName} &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr>${headerCols}</tr></thead>
<tbody>${rows}</tbody>
</table>`;
  printHtml(html, `Dienststatistik ${MONTHS[month - 1]} ${year}`);
}

// ── Report: Urlaubsanspruchs-Statistik ───────────────────────

async function reportEntitlementStats(year: number, employees: Employee[]) {
  const now = new Date().toLocaleString('de-AT');
  const [entitlements, absences, leaveTypes] = await Promise.all([
    api.getLeaveEntitlements({ year }),
    api.getAbsences({ year }),
    api.getLeaveTypes(),
  ]);

  const vacLtIds = new Set(leaveTypes.filter(lt => lt.ENTITLED).map(lt => lt.ID));

  // Per employee
  const data: Record<number, { entitlement: number; carry: number; used: number }> = {};
  for (const e of entitlements) {
    if (!vacLtIds.has(e.leave_type_id)) continue;
    if (!data[e.employee_id]) data[e.employee_id] = { entitlement: 0, carry: 0, used: 0 };
    data[e.employee_id].entitlement += e.entitlement;
    data[e.employee_id].carry += e.carry_forward;
  }
  for (const a of absences) {
    if (!vacLtIds.has(a.leave_type_id ?? 0)) continue;
    if (!data[a.employee_id]) data[a.employee_id] = { entitlement: 0, carry: 0, used: 0 };
    data[a.employee_id].used++;
  }

  const empMap = Object.fromEntries(employees.map(e => [e.ID, e]));
  const empIds = [...new Set([...Object.keys(data).map(Number)])].sort((a, b) => {
    const na = empMap[a]?.NAME || '';
    const nb = empMap[b]?.NAME || '';
    return na.localeCompare(nb);
  });

  let html = `<h1>📋 Urlaubsanspruchs-Statistik ${year}</h1>
<div class="subtitle">Jahr: ${year} &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr>
<th scope="col">Mitarbeiter</th>
<th scope="col" style="text-align:right">Anspruch</th>
<th scope="col" style="text-align:right">Übertrag</th>
<th scope="col" style="text-align:right">Gesamt</th>
<th scope="col" style="text-align:right">Verbraucht</th>
<th scope="col" style="text-align:right">Rest</th>
</tr></thead><tbody>`;

  for (const empId of empIds) {
    const emp = empMap[empId];
    if (!emp) continue;
    const d = data[empId];
    const total = d.entitlement + d.carry;
    const rest = total - d.used;
    const restColor = rest < 0 ? '#dc2626' : rest < 3 ? '#d97706' : '#16a34a';
    html += `<tr>
<td><strong>${escapeHtml(emp.NAME)}</strong>, ${escapeHtml(emp.FIRSTNAME)}</td>
<td style="text-align:right">${d.entitlement} Tg.</td>
<td style="text-align:right">${d.carry} Tg.</td>
<td style="text-align:right;font-weight:bold">${total} Tg.</td>
<td style="text-align:right">${d.used} Tg.</td>
<td style="text-align:right;font-weight:bold;color:${restColor}">${rest} Tg.</td>
</tr>`;
  }
  html += '</tbody></table>';
  printHtml(html, `Urlaubsanspruchs-Statistik ${year}`);
}

// ── Report: Gruppen-Struktur ──────────────────────────────────

async function reportGroupTree(groups: Group[]) {
  const now = new Date().toLocaleString('de-AT');
  const groupMap = Object.fromEntries(groups.map(g => [g.ID, g]));

  // Build tree
  const roots = groups.filter(g => !g.SUPERID || !groupMap[g.SUPERID]);
  const children: Record<number, Group[]> = {};
  for (const g of groups) {
    if (g.SUPERID && groupMap[g.SUPERID]) {
      if (!children[g.SUPERID]) children[g.SUPERID] = [];
      children[g.SUPERID].push(g);
    }
  }

  function renderGroup(g: Group, depth: number): string {
    const indent = depth * 24;
    const badge = g.SHORTNAME ? `<span class="badge" style="background:#e0f2fe;color:#0369a1">${escapeHtml(g.SHORTNAME)}</span>` : '';
    const childCount = g.member_count != null ? `<span style="color:#666;font-size:10px">${g.member_count} Mitglieder</span>` : '';
    let html = `<tr>
<td style="padding-left:${indent + 8}px">${depth > 0 ? '↳ ' : ''}<strong>${escapeHtml(g.NAME)}</strong></td>
<td>${badge}</td>
<td>${childCount}</td>
<td>${g.HIDE ? '<span class="badge" style="background:#fef2f2;color:#dc2626">Ausgeblendet</span>' : '<span class="badge" style="background:#f0fdf4;color:#16a34a">Aktiv</span>'}</td>
</tr>`;
    for (const child of (children[g.ID] || [])) {
      html += renderGroup(child, depth + 1);
    }
    return html;
  }

  let rows = '';
  for (const root of roots) rows += renderGroup(root, 0);

  const html = `<h1>🌳 Gruppen-Struktur</h1>
<div class="subtitle">${groups.length} Gruppen &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr><th scope="col">Name</th><th scope="col">Kürzel</th><th scope="col">Mitglieder</th><th scope="col">Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
  printHtml(html, 'Gruppen-Struktur');
}

// ── Report: Gruppen-Mitglieder ────────────────────────────────

async function reportGroupMembers(memberGroupId: number | null, employees: Employee[], groups: Group[]) {
  const now = new Date().toLocaleString('de-AT');
  const assignments = await api.getGroupAssignments();
  const empMap = Object.fromEntries(employees.map(e => [e.ID, e]));

  const targetGroups = memberGroupId ? groups.filter(g => g.ID === memberGroupId) : groups.filter(g => !g.HIDE);

  let html = `<h1>👥 Gruppen-Mitglieder</h1>
<div class="subtitle">Stand: ${now}</div>`;

  for (const grp of targetGroups) {
    const memberIds = assignments.filter(a => a.group_id === grp.ID).map(a => a.employee_id);
    const members = memberIds.map(id => empMap[id]).filter(Boolean).sort((a, b) => (a.NAME || '').localeCompare(b.NAME || ''));

    html += `<h2>🏢 ${escapeHtml(grp.NAME)}${grp.SHORTNAME ? ` (${escapeHtml(grp.SHORTNAME)})` : ''} — ${members.length} Mitglieder</h2>`;
    if (members.length === 0) {
      html += '<p style="color:#999;font-size:11px">Keine Mitglieder.</p>';
    } else {
      html += `<table style="margin-bottom:0">
<thead><tr><th scope="col">Nr.</th><th scope="col">Name</th><th scope="col">Vorname</th><th scope="col">Kürzel</th><th scope="col">Eintritt</th></tr></thead>
<tbody>`;
      for (const m of members) {
        html += `<tr>
<td>${m.NUMBER || '—'}</td>
<td><strong>${m.NAME}</strong></td>
<td>${m.FIRSTNAME}</td>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${m.SHORTNAME || '—'}</span></td>
<td>${m.EMPSTART || '—'}</td>
</tr>`;
      }
      html += '</tbody></table>';
    }
  }

  printHtml(html, 'Gruppen-Mitglieder');
}

// ── Report: Urlaubssperren ────────────────────────────────────

async function reportHolidayBans(groups: Group[]) {
  const now = new Date().toLocaleString('de-AT');
  const bans = await api.getHolidayBans();
  const groupMap = Object.fromEntries(groups.map(g => [g.ID, g.NAME]));

  let html = `<h1>🚫 Urlaubssperren</h1>
<div class="subtitle">${bans.length} Urlaubssperren &nbsp;|&nbsp; Stand: ${now}</div>
<table>
<thead><tr><th scope="col">Gruppe</th><th scope="col">Von</th><th scope="col">Bis</th><th scope="col">Typ</th><th scope="col">Grund</th></tr></thead><tbody>`;

  if (bans.length === 0) {
    html += '<tr><td colspan="5" style="text-align:center;color:#999">Keine Urlaubssperren vorhanden.</td></tr>';
  } else {
    for (const b of bans) {
      const grpName = b.group_name || groupMap[b.group_id] || `Gruppe ${b.group_id}`;
      const type = b.restrict === 1
        ? '<span class="badge" style="background:#fef2f2;color:#dc2626">Urlaubssperre</span>'
        : '<span class="badge" style="background:#fef9c3;color:#92400e">Eingeschränkt</span>';
      html += `<tr>
<td><strong>${escapeHtml(grpName)}</strong></td>
<td>${b.start_date}</td>
<td>${b.end_date}</td>
<td>${type}</td>
<td>${b.reason || '—'}</td>
</tr>`;
    }
  }
  html += '</tbody></table>';
  printHtml(html, 'Urlaubssperren');
}

// ── Report: Dienstplaneinträge (Liste) ────────────────────────
// R-1 (Spec 7.4.5 Nr. 1): je Mitarbeiter alle Einträge im Zeitraum mit
// Datum, Art, Kürzel/Name, Uhrzeiten, Arbeitsplatz und Stunden + Summen je MA.

function csvCell(v: string | number): string {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCSVFile(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const DAY_SHORT_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

async function reportDienstplanEintraege(
  fromDate: string,
  toDate: string,
  groupId: number | null,
  employees: Employee[],
  groups: Group[],
  shifts: ShiftType[],
  format: 'print' | 'csv',
  plan: 'ist' | 'soll' | 'both' = 'ist',
) {
  if (!fromDate || !toDate) { alert('Bitte Zeitraum (Von/Bis) auswählen.'); return; }
  if (toDate < fromDate) { alert('Von-Datum muss vor Bis-Datum liegen.'); return; }
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if ((to.getTime() - from.getTime()) / 86400000 > 366) { alert('Zeitraum zu lang (max. 1 Jahr).'); return; }

  // Monate im Zeitraum + Feiertage der beteiligten Jahre laden
  const monthKeys: { y: number; m: number }[] = [];
  for (let y = from.getFullYear(), m = from.getMonth() + 1; y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth() + 1);) {
    monthKeys.push({ y, m });
    m++; if (m > 12) { m = 1; y++; }
  }
  const years = [...new Set(monthKeys.map(k => k.y))];
  const [workplaces, ...holidayLists] = await Promise.all([
    api.getWorkplaces(),
    ...years.map(y => api.getHolidays(y)),
  ]);
  const holidayDates = new Set(holidayLists.flat().map(h => h.DATE));
  const wpMap = Object.fromEntries(workplaces.map(w => [w.ID, w.NAME]));
  const shiftMap = Object.fromEntries(shifts.map(s => [s.ID, s]));

  const allEntries = (await Promise.all(monthKeys.map(k => api.getSchedule(k.y, k.m, groupId ?? undefined, plan))))
    .flat()
    .filter(e => e.date >= fromDate && e.date <= toDate);

  // Tagindex nach Spec D-34: 0=Mo..6=So, 7=Feiertag
  const dayIndex = (dateStr: string): number => {
    if (holidayDates.has(dateStr)) return 7;
    return (new Date(`${dateStr}T00:00:00`).getDay() + 6) % 7;
  };

  interface ListRow {
    date: string; art: string; short: string; name: string;
    times: string; workplace: string; hours: number | null;
  }

  const byEmp: Record<number, ListRow[]> = {};
  for (const e of allEntries) {
    const idx = dayIndex(e.date);
    const shift = e.shift_id ? shiftMap[e.shift_id] : undefined;
    let times = '';
    let hours: number | null = null;
    if (e.kind !== 'absence' && shift) {
      const se = shift[`STARTEND${idx}` as keyof ShiftType] as string | undefined;
      times = (se || '').trim() || (shift.STARTEND0 || '').trim();
      const dur = shift[`DURATION${idx}` as keyof ShiftType] as number | undefined;
      hours = dur || shift.DURATION0 || 0;
    }
    const art = entryArt(e.kind ?? '', e.source, e.schedule_type);
    const row: ListRow = {
      date: e.date,
      art,
      short: e.display_name || '',
      name: e.shift_name || e.leave_name || e.custom_name || '',
      times,
      workplace: e.workplace_id ? (wpMap[e.workplace_id] ?? `#${e.workplace_id}`) : '',
      hours,
    };
    (byEmp[e.employee_id] ??= []).push(row);
  }

  const empMap = Object.fromEntries(employees.map(e => [e.ID, e]));
  const empIds = Object.keys(byEmp).map(Number)
    .sort((a, b) => (empMap[a]?.NAME || '').localeCompare(empMap[b]?.NAME || '', 'de'));
  for (const id of empIds) byEmp[id].sort((a, b) => a.date.localeCompare(b.date));

  const groupName = groupId ? (groups.find(g => g.ID === groupId)?.NAME ?? `Gruppe ${groupId}`) : 'Alle';
  const fmtDate = (d: string) => `${DAY_SHORT_DE[new Date(`${d}T00:00:00`).getDay()]} ${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  const sumHours = (rows: ListRow[]) => rows.reduce((acc, r) => acc + (r.hours ?? 0), 0);

  if (format === 'csv') {
    const lines = ['Mitarbeiter;Datum;Art;Kürzel;Name;Uhrzeiten;Arbeitsplatz;Stunden'];
    for (const id of empIds) {
      const emp = empMap[id];
      const empName = emp ? `${emp.NAME}, ${emp.FIRSTNAME}` : `MA #${id}`;
      for (const r of byEmp[id]) {
        lines.push([empName, r.date, r.art, r.short, r.name, r.times, r.workplace,
          r.hours != null ? r.hours.toFixed(2) : ''].map(csvCell).join(';'));
      }
      lines.push([empName, '', 'Summe', '', `${byEmp[id].length} Einträge`, '', '',
        sumHours(byEmp[id]).toFixed(2)].map(csvCell).join(';'));
    }
    downloadCSVFile(`dienstplaneintraege_${fromDate}_${toDate}.csv`, lines.join('\n'));
    return;
  }

  const now = new Date().toLocaleString('de-AT');
  const planLabel = plan === 'soll' ? 'Sollplan' : plan === 'both' ? 'Soll- & Istplan' : 'Istplan';
  let html = `<h1>📋 Dienstplaneinträge (Liste)</h1>
<div class="subtitle">Zeitraum: ${fromDate} bis ${toDate} &nbsp;|&nbsp; Datenbasis: ${planLabel} &nbsp;|&nbsp; Gruppe: ${groupName} &nbsp;|&nbsp; ${empIds.length} Mitarbeiter &nbsp;|&nbsp; Stand: ${now}</div>`;

  if (empIds.length === 0) {
    html += '<p>Keine Einträge im gewählten Zeitraum.</p>';
  }
  for (const id of empIds) {
    const emp = empMap[id];
    const rows = byEmp[id];
    const counts = {
      dienst: rows.filter(r => r.art.startsWith('Dienst')).length,
      sonder: rows.filter(r => r.art === 'Sonderdienst').length,
      abw: rows.filter(r => r.art === 'Abwesenheit').length,
    };
    html += `<h2>👤 ${emp ? `${escapeHtml(emp.NAME)}, ${escapeHtml(emp.FIRSTNAME)}` : `MA #${id}`}${emp?.NUMBER ? ` (Nr. ${emp.NUMBER})` : ''}</h2>
<table>
<thead><tr>
<th scope="col">Datum</th><th scope="col">Art</th><th scope="col">Kürzel</th><th scope="col">Name</th>
<th scope="col">Uhrzeiten</th><th scope="col">Arbeitsplatz</th><th scope="col" style="text-align:right">Stunden</th>
</tr></thead><tbody>`;
    for (const r of rows) {
      html += `<tr>
<td>${fmtDate(r.date)}</td>
<td>${r.art}</td>
<td><strong>${r.short}</strong></td>
<td>${r.name || '—'}</td>
<td style="font-family:monospace">${r.times || '—'}</td>
<td>${r.workplace || '—'}</td>
<td style="text-align:right">${r.hours != null ? r.hours.toFixed(2) + ' h' : '—'}</td>
</tr>`;
    }
    html += `</tbody>
<tfoot><tr style="background:#f1f5f9;font-weight:bold;border-top:2px solid #334155">
<td colspan="6">∑ ${rows.length} Einträge — ${counts.dienst} Dienste, ${counts.sonder} Sonderdienste, ${counts.abw} Abwesenheiten</td>
<td style="text-align:right">${sumHours(rows).toFixed(2)} h</td>
</tr></tfoot>
</table>`;
  }

  printHtml(html, `Dienstplaneinträge ${fromDate} – ${toDate}`);
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

  // Monatsabschluss-Report
  const [reportFormat, setReportFormat] = useState<'csv' | 'pdf'>('pdf');
  const [reportLoading, setReportLoading] = useState(false);

  // Extra parameters for new reports
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [birthdayMonth, setBirthdayMonth] = useState(0); // 0 = all months
  const [memberGroupId, setMemberGroupId] = useState<number | null>(null);

  // Urlaubsantrag parameters
  const [urlaubEmpId, setUrlaubEmpId] = useState<number | null>(null);
  const [urlaubFrom, setUrlaubFrom] = useState('');
  const [urlaubTo, setUrlaubTo] = useState('');

  // Dienstplaneinträge-Liste (R-1): Zeitraum + Ausgabeformat
  const monthPadded = String(now.getMonth() + 1).padStart(2, '0');
  const [listFrom, setListFrom] = useState(`${now.getFullYear()}-${monthPadded}-01`);
  const [listTo, setListTo] = useState(
    `${now.getFullYear()}-${monthPadded}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`,
  );
  const [listFormat, setListFormat] = useState<'print' | 'csv'>('print');
  const [listPlan, setListPlan] = useState<'ist' | 'soll' | 'both'>('ist');

  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

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
    }).catch((err) => {
      setLoading(false);
      showToast('Stammdaten konnten nicht geladen werden — Backend prüfen. ' + String(err), 'error');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // nur beim Mount ausführen

  const run = async (fn: () => Promise<void> | void) => {
    try {
      await fn();
    } catch (e) {
      showToast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  interface ReportCard {
    icon: string;
    title: string;
    description: string;
    action: () => void;
    color: string;
    category: string;
    downloadMode?: boolean;
  }

  const reportCards: ReportCard[] = [
    // ── Existing 8 reports ──
    {
      icon: '👥',
      title: 'Mitarbeiterliste',
      description: 'Vollständige Liste aller Mitarbeiter mit Kontaktdaten, Gruppen und Arbeitszeitmodell.',
      action: () => run(() => reportEmployeeList(employees, groups)),
      color: 'blue',
      category: 'Mitarbeiter',
    },
    {
      icon: '🏢',
      title: 'Gruppenübersicht',
      description: 'Liste aller Gruppen mit Hierarchie und Mitgliederanzahl.',
      action: () => run(() => reportGroups(groups)),
      color: 'purple',
      category: 'Organisation',
    },
    {
      icon: '🕐',
      title: 'Schichtartenliste',
      description: 'Übersicht aller Schichtarten mit Farben und Zeiten.',
      action: () => run(() => reportShifts(shifts)),
      color: 'indigo',
      category: 'Organisation',
    },
    {
      icon: '📅',
      title: 'Monatlicher Dienstplan',
      description: `Druckbare Monatsübersicht des Dienstplans für ${MONTHS[month - 1]} ${year}.`,
      action: () => run(() => reportMonthlySchedule(year, month, groupId, employees, groups)),
      color: 'green',
      category: 'Dienstplan',
    },
    {
      icon: '🏖️',
      title: 'Urlaubsübersicht',
      description: `Urlaubsanspruch und -verbrauch für ${year} mit Resturlaubsanzeige.`,
      action: () => run(() => reportVacation(year, employees)),
      color: 'orange',
      category: 'Statistik',
    },
    {
      icon: '🎉',
      title: 'Feiertagsliste',
      description: `Alle Feiertage für ${year} mit Datum und Wochentag.`,
      action: () => run(() => reportHolidays(year)),
      color: 'red',
      category: 'Organisation',
    },
    {
      icon: '⏱️',
      title: 'Stunden-Auswertung',
      description: `Soll/Ist-Stunden-Vergleich pro Mitarbeiter für ${MONTHS[month - 1]} ${year} mit Überstunden, Urlaub und Kranktagen.`,
      action: () => run(() => reportStundenAuswertung(year, month, groupId, employees, groups)),
      color: 'teal',
      category: 'Statistik',
    },
    {
      icon: '📝',
      title: 'Urlaubsantrag',
      description: 'Druckbarer Urlaubsantrag mit Unterschriftsfeldern, Urlaubsanspruch und Resturlaub.',
      action: () => run(() => reportUrlaubsantrag(urlaubEmpId ?? 0, urlaubFrom, urlaubTo, employees)),
      color: 'amber',
      category: 'Mitarbeiter',
    },
    // ── 14 new reports ──
    {
      icon: '📆',
      title: 'Quartals-Dienstplan',
      description: `Kompakter Dienstplan für Q${quarter} ${year} — 3 Monate nebeneinander mit Schicht-Kürzeln.`,
      action: () => run(() => reportQuarterSchedule(year, quarter, groupId, employees, groups)),
      color: 'green',
      category: 'Dienstplan',
    },
    {
      icon: '🗓️',
      title: 'Jahres-Dienstplan',
      description: `Kompakte Jahresübersicht ${year} — 12 Monate, Schichthäufigkeit pro Mitarbeiter.`,
      action: () => run(() => reportYearSchedule(year, groupId, employees, groups)),
      color: 'green',
      category: 'Dienstplan',
    },
    {
      icon: '📋',
      title: 'Dienstplaneinträge (Liste)',
      description: `Je Mitarbeiter alle Einträge ${listFrom} bis ${listTo}: Datum, Art (Dienst/Sonderdienst/Abwesenheit), Kürzel, Uhrzeiten, Arbeitsplatz, Stunden — mit Summen je Mitarbeiter (${listFormat === 'csv' ? 'CSV' : 'Druck'}).`,
      action: () => run(() => reportDienstplanEintraege(listFrom, listTo, groupId, employees, groups, shifts, listFormat, listPlan)),
      color: 'green',
      category: 'Dienstplan',
    },
    {
      icon: '🟥',
      title: 'Abwesenheitsübersicht',
      description: `Monatstabelle ${MONTHS[month - 1]} ${year} — nur Abwesenheiten farbig, Schichten leer.`,
      action: () => run(() => reportAbsenceOverview(year, month, groupId, employees, groups)),
      color: 'red',
      category: 'Dienstplan',
    },
    {
      icon: '🏭',
      title: 'Arbeitsplatz-Bericht',
      description: 'Liste aller Arbeitsplätze mit Farbe und Kürzel.',
      action: () => run(() => reportWorkplaces()),
      color: 'slate',
      category: 'Organisation',
    },
    {
      icon: '💰',
      title: 'Zeitzuschlag-Bericht',
      description: 'Liste aller Zeitzuschläge mit Zeiten und Wochentagen.',
      action: () => run(() => reportExtracharges()),
      color: 'yellow',
      category: 'Organisation',
    },
    {
      icon: '🎂',
      title: 'Geburtstagsliste',
      description: `Geburtstage${birthdayMonth > 0 ? ` für ${MONTHS[birthdayMonth - 1]}` : ' aller Mitarbeiter'} sortiert nach Monat und Tag.`,
      action: () => run(() => reportBirthdays(employees, birthdayMonth)),
      color: 'pink',
      category: 'Mitarbeiter',
    },
    {
      icon: '📬',
      title: 'Mitarbeiter-Adressen',
      description: 'Tabelle mit Name, Straße, PLZ/Ort, Telefon und E-Mail.',
      action: () => run(() => reportAddresses(employees)),
      color: 'blue',
      category: 'Mitarbeiter',
    },
    {
      icon: '🚫',
      title: 'Schichtbeschränkungen',
      description: 'Alle Schichtbeschränkungen und -verbote pro Mitarbeiter.',
      action: () => run(() => reportRestrictions(employees)),
      color: 'red',
      category: 'Mitarbeiter',
    },
    {
      icon: '📊',
      title: 'Abwesenheitsstatistik',
      description: `Abwesenheiten ${year} pro Mitarbeiter und Abwesenheitsart (Anzahl Tage).`,
      action: () => run(() => reportAbsenceStats(year, groupId, employees, groups)),
      color: 'orange',
      category: 'Statistik',
    },
    {
      icon: '📈',
      title: 'Dienststatistik',
      description: `Schichtanzahl pro Mitarbeiter für ${MONTHS[month - 1]} ${year}.`,
      action: () => run(() => reportShiftStats(year, month, groupId, employees, groups)),
      color: 'teal',
      category: 'Statistik',
    },
    {
      icon: '📋',
      title: 'Urlaubsanspruchs-Statistik',
      description: `Anspruch, Verbrauch und Resturlaub für ${year} pro Mitarbeiter.`,
      action: () => run(() => reportEntitlementStats(year, employees)),
      color: 'orange',
      category: 'Statistik',
    },
    {
      icon: '🌳',
      title: 'Gruppen-Struktur',
      description: 'Hierarchische Liste aller Gruppen mit über-/untergeordneten Gruppen.',
      action: () => run(() => reportGroupTree(groups)),
      color: 'purple',
      category: 'Gruppen',
    },
    {
      icon: '👫',
      title: 'Gruppen-Mitglieder',
      description: `Mitgliederliste${memberGroupId ? ` für ${groups.find(g => g.ID === memberGroupId)?.NAME ?? 'Gruppe'}` : ' aller Gruppen'} mit Nummer und Eintrittsdatum.`,
      action: () => run(() => reportGroupMembers(memberGroupId, employees, groups)),
      color: 'purple',
      category: 'Gruppen',
    },
    {
      icon: '🔒',
      title: 'Urlaubssperren',
      description: 'Alle Urlaubssperren mit Gruppe, Zeitraum und Grund.',
      action: () => run(() => reportHolidayBans(groups)),
      color: 'red',
      category: 'Gruppen',
    },
    // ── Monatsabschluss-Report ──
    {
      icon: '📥',
      title: 'Monatsabschluss-Report',
      description: `Vollständiger Stundenreport für ${MONTHS[month - 1]} ${year}: Soll/Ist-Stunden, Überstunden, Zeitzuschläge, Urlaub/Krank — als ${reportFormat.toUpperCase()}-Download.`,
      action: () => run(async () => {
        setReportLoading(true);
        try {
          await api.downloadMonthlyReport(year, month, reportFormat, groupId ?? undefined);
        } finally {
          setReportLoading(false);
        }
      }),
      color: 'emerald',
      category: 'Download',
      downloadMode: true,
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
    amber: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    slate: 'bg-slate-50 border-slate-200 hover:border-slate-400',
    yellow: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400',
    pink: 'bg-pink-50 border-pink-200 hover:border-pink-400',
    emerald: 'bg-emerald-50 border-emerald-200 hover:border-emerald-500',
  };

  const categories = [...new Set(reportCards.map(c => c.category))];

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

      {/* Extra Parameter Panels */}
      {!loading && (
        <div className="space-y-3 mb-4">
          {/* Urlaubsantrag Parameters */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-400">
            <div className="font-semibold text-gray-700 mb-2 text-sm">📝 Urlaubsantrag – Parameter</div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Mitarbeiter</label>
                <select
                  value={urlaubEmpId ?? ''}
                  onChange={e => setUrlaubEmpId(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white min-w-[180px]"
                >
                  <option value="">— bitte wählen —</option>
                  {employees.map(e => (
                    <option key={e.ID} value={e.ID}>{e.NAME} {e.FIRSTNAME}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Von</label>
                <input
                  type="date"
                  value={urlaubFrom}
                  onChange={e => setUrlaubFrom(e.target.value)}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Bis</label>
                <input
                  type="date"
                  value={urlaubTo}
                  onChange={e => setUrlaubTo(e.target.value)}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Dienstplaneinträge-Liste (R-1) */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="font-semibold text-gray-700 mb-2 text-sm">📋 Dienstplaneinträge (Liste) – Parameter</div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Von</label>
                <input
                  type="date"
                  value={listFrom}
                  onChange={e => setListFrom(e.target.value)}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Bis</label>
                <input
                  type="date"
                  value={listTo}
                  min={listFrom}
                  onChange={e => setListTo(e.target.value)}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ausgabe</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setListFormat('print')}
                    className={`px-4 py-2 rounded text-sm font-semibold border-2 transition-colors ${listFormat === 'print' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'}`}
                  >
                    🖨️ Druck
                  </button>
                  <button
                    onClick={() => setListFormat('csv')}
                    className={`px-4 py-2 rounded text-sm font-semibold border-2 transition-colors ${listFormat === 'csv' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'}`}
                  >
                    📊 CSV
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Datenbasis</label>
                <select
                  value={listPlan}
                  onChange={e => setListPlan(e.target.value as 'ist' | 'soll' | 'both')}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                >
                  <option value="ist">Istplan</option>
                  <option value="soll">Sollplan</option>
                  <option value="both">Soll- &amp; Istplan</option>
                </select>
              </div>
              <div className="text-xs text-gray-500 max-w-xs">
                Gruppenfilter oben wird berücksichtigt.
              </div>
            </div>
          </div>

          {/* New report parameters */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-400">
            <div className="font-semibold text-gray-700 mb-2 text-sm">📆 Quartals-Dienstplan – Parameter</div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Quartal</label>
                <select value={quarter} onChange={e => setQuarter(parseInt(e.target.value))}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                  <option value={1}>Q1 (Jan–Mär)</option>
                  <option value={2}>Q2 (Apr–Jun)</option>
                  <option value={3}>Q3 (Jul–Sep)</option>
                  <option value={4}>Q4 (Okt–Dez)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-pink-400">
            <div className="font-semibold text-gray-700 mb-2 text-sm">🎂 Geburtstagsliste – Parameter</div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Monat (optional)</label>
                <select value={birthdayMonth} onChange={e => setBirthdayMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white min-w-[140px]">
                  <option value={0}>Alle Monate</option>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-400">
            <div className="font-semibold text-gray-700 mb-2 text-sm">👫 Gruppen-Mitglieder – Parameter</div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Gruppe (leer = alle)</label>
                <select value={memberGroupId ?? ''} onChange={e => setMemberGroupId(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white min-w-[160px]">
                  <option value="">Alle Gruppen</option>
                  {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Monatsabschluss-Report */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
            <div className="font-semibold text-gray-700 mb-2 text-sm">📥 Monatsabschluss-Report – Download-Format</div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setReportFormat('pdf')}
                    className={`px-4 py-2 rounded text-sm font-semibold border-2 transition-colors ${reportFormat === 'pdf' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'}`}
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={() => setReportFormat('csv')}
                    className={`px-4 py-2 rounded text-sm font-semibold border-2 transition-colors ${reportFormat === 'csv' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'}`}
                  >
                    📊 CSV (Excel)
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 max-w-xs">
                <span className="font-medium">PDF:</span> Professionell formatiert, druckbereit.<br/>
                <span className="font-medium">CSV:</span> Für Excel/Calc, alle Rohdaten.
              </div>
              {reportLoading && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Generiere Report…
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report cards grouped by category */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-6">
          {categories.map(cat => (
            <div key={cat}>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-gray-200"></span>
                {cat}
                <span className="h-px flex-1 bg-gray-200"></span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportCards.filter(c => c.category === cat).map(card => (
                  <button
                    key={card.title}
                    onClick={card.action}
                    disabled={card.downloadMode && reportLoading}
                    className={`text-left p-5 rounded-xl border-2 transition-all cursor-pointer ${colorMap[card.color] ?? 'bg-gray-50 border-gray-200 hover:border-gray-400'} hover:shadow-md disabled:opacity-60 disabled:cursor-wait`}
                  >
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <div className="font-bold text-gray-800 mb-1">{card.title}</div>
                    <div className="text-xs text-gray-600 leading-relaxed">{card.description}</div>
                    {card.downloadMode ? (
                      <div className="mt-3 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        {reportLoading
                          ? <><span className="inline-block w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> Generiere…</>
                          : <>{reportFormat === 'pdf' ? '📄' : '📊'} {reportFormat.toUpperCase()} herunterladen</>
                        }
                      </div>
                    ) : (
                      <div className="mt-3 text-xs font-semibold text-gray-500 flex items-center gap-1">
                        🖨️ Drucken / PDF
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
