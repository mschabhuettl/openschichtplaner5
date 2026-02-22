import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Restriction } from '../api/client';
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
      <td style="padding:4px 8px">${emp.NAME}, ${emp.FIRSTNAME}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;font-weight:bold">Personalnummer:</td>
      <td style="padding:4px 8px">${emp.NUMBER || '—'}</td>
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

  printHtml(html, `Urlaubsantrag – ${emp.NAME} ${emp.FIRSTNAME}`);
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

    let headerCols = `<th style="${thStyle};text-align:left;min-width:70px">Mitarbeiter</th>`;
    for (const d of days) {
      const date = new Date(year, month - 1, d);
      const isWe = date.getDay() === 0 || date.getDay() === 6;
      const dn = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
      headerCols += `<th style="${thStyle};background:${isWe ? '#1e293b' : '#334155'};min-width:22px">${padZero(d)}<br><span style="font-size:7px">${dn}</span></th>`;
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
          cells += `<td style="border:1px solid #ddd;padding:1px;text-align:center;background:${entry.color_bk || cellBg}"><span style="color:${entry.color_text || '#000'};font-size:8px;font-weight:bold">${entry.display_name || ''}</span></td>`;
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

  let headerCols = `<th style="${thStyle};text-align:left;min-width:80px">Mitarbeiter</th>`;
  for (let m = 1; m <= 12; m++) {
    headerCols += `<th style="${thStyle};min-width:36px">${MONTHS[m-1].substring(0,3)}</th>`;
  }

  let rows = '';
  for (const emp of emps) {
    let cells = `<td style="${nameStyle}">${emp.NAME} ${emp.FIRSTNAME ? emp.FIRSTNAME.charAt(0) + '.' : ''}</td>`;
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

  let headerCols = `<th style="${thStyle};text-align:left;min-width:70px">Mitarbeiter</th>`;
  for (const d of days) {
    const date = new Date(year, month - 1, d);
    const isWe = date.getDay() === 0 || date.getDay() === 6;
    const dn = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()];
    headerCols += `<th style="${thStyle};background:${isWe ? '#1e293b' : '#334155'};min-width:22px">${padZero(d)}<br><span style="font-size:7px">${dn}</span></th>`;
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
        cells += `<td style="border:1px solid #ddd;padding:1px;text-align:center;background:${entry.color_bk || '#fee2e2'}"><span style="color:${entry.color_text || '#dc2626'};font-size:8px;font-weight:bold">${entry.display_name || entry.leave_name || 'A'}</span></td>`;
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
<thead><tr><th>Kürzel</th><th>Name</th><th>Farbe</th><th>Status</th></tr></thead><tbody>`;

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
<thead><tr><th>Name</th><th>Von</th><th>Bis</th><th>Gültige Wochentage</th><th>Feiertagsregel</th></tr></thead><tbody>`;

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
<thead><tr><th>Name</th><th>Vorname</th><th>Kürzel</th><th>Geburtstag</th><th>Alter ${thisYear}</th></tr></thead><tbody>`;

  for (const { emp, month, day, year } of withBd) {
    const age = thisYear - year;
    html += `<tr>
<td><strong>${emp.NAME}</strong></td>
<td>${emp.FIRSTNAME}</td>
<td><span class="badge" style="background:#e0f2fe;color:#0369a1">${emp.SHORTNAME || '—'}</span></td>
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
<thead><tr><th>Name</th><th>Straße</th><th>PLZ/Ort</th><th>Telefon</th><th>E-Mail</th></tr></thead><tbody>`;

  const sorted = [...employees].sort((a, b) => (a.NAME || '').localeCompare(b.NAME || ''));
  for (const emp of sorted) {
    const plzOrt = [emp.ZIP, emp.TOWN].filter(Boolean).join(' ') || '—';
    html += `<tr>
<td><strong>${emp.NAME}</strong>, ${emp.FIRSTNAME}</td>
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
<thead><tr><th>Mitarbeiter</th><th>Schicht</th><th>Wochentag</th><th>Typ</th><th>Grund</th></tr></thead><tbody>`;

    for (const [empIdStr, resList] of Object.entries(byEmp)) {
      const emp = empMap[parseInt(empIdStr)];
      const empName = emp ? `${emp.NAME}, ${emp.FIRSTNAME}` : `ID ${empIdStr}`;
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

  let headerCols = '<th>Mitarbeiter</th>' + ltList.map(lt => `<th style="text-align:center">${lt.SHORTNAME}<br><span style="font-size:9px;font-weight:normal">${lt.NAME}</span></th>`).join('') + '<th style="text-align:right">∑</th>';

  let rows = '';
  for (const emp of emps) {
    const s = stats[emp.ID] || {};
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    let cells = `<td><strong>${emp.NAME}</strong>, ${emp.FIRSTNAME}</td>`;
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

  let headerCols = '<th>Mitarbeiter</th>' + shiftLabels.map(l => `<th style="text-align:center">${l}</th>`).join('') + '<th style="text-align:right">∑</th>';

  let rows = '';
  for (const emp of emps) {
    const s = stats[emp.ID] || {};
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    let cells = `<td><strong>${emp.NAME}</strong>, ${emp.FIRSTNAME}</td>`;
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
<th>Mitarbeiter</th>
<th style="text-align:right">Anspruch</th>
<th style="text-align:right">Übertrag</th>
<th style="text-align:right">Gesamt</th>
<th style="text-align:right">Verbraucht</th>
<th style="text-align:right">Rest</th>
</tr></thead><tbody>`;

  for (const empId of empIds) {
    const emp = empMap[empId];
    if (!emp) continue;
    const d = data[empId];
    const total = d.entitlement + d.carry;
    const rest = total - d.used;
    const restColor = rest < 0 ? '#dc2626' : rest < 3 ? '#d97706' : '#16a34a';
    html += `<tr>
<td><strong>${emp.NAME}</strong>, ${emp.FIRSTNAME}</td>
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
    const badge = g.SHORTNAME ? `<span class="badge" style="background:#e0f2fe;color:#0369a1">${g.SHORTNAME}</span>` : '';
    const childCount = g.member_count != null ? `<span style="color:#666;font-size:10px">${g.member_count} Mitglieder</span>` : '';
    let html = `<tr>
<td style="padding-left:${indent + 8}px">${depth > 0 ? '↳ ' : ''}<strong>${g.NAME}</strong></td>
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
<thead><tr><th>Name</th><th>Kürzel</th><th>Mitglieder</th><th>Status</th></tr></thead>
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

    html += `<h2>🏢 ${grp.NAME}${grp.SHORTNAME ? ` (${grp.SHORTNAME})` : ''} — ${members.length} Mitglieder</h2>`;
    if (members.length === 0) {
      html += '<p style="color:#999;font-size:11px">Keine Mitglieder.</p>';
    } else {
      html += `<table style="margin-bottom:0">
<thead><tr><th>Nr.</th><th>Name</th><th>Vorname</th><th>Kürzel</th><th>Eintritt</th></tr></thead>
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
<thead><tr><th>Gruppe</th><th>Von</th><th>Bis</th><th>Typ</th><th>Grund</th></tr></thead><tbody>`;

  if (bans.length === 0) {
    html += '<tr><td colspan="5" style="text-align:center;color:#999">Keine Urlaubssperren vorhanden.</td></tr>';
  } else {
    for (const b of bans) {
      const grpName = b.group_name || groupMap[b.group_id] || `Gruppe ${b.group_id}`;
      const type = b.restrict === 1
        ? '<span class="badge" style="background:#fef2f2;color:#dc2626">Urlaubssperre</span>'
        : '<span class="badge" style="background:#fef9c3;color:#92400e">Eingeschränkt</span>';
      html += `<tr>
<td><strong>${grpName}</strong></td>
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

// ── Main Component ────────────────────────────────────────────

export default function Berichte() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);

  // Extra parameters for new reports
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [birthdayMonth, setBirthdayMonth] = useState(0); // 0 = all months
  const [memberGroupId, setMemberGroupId] = useState<number | null>(null);

  // Urlaubsantrag parameters
  const [urlaubEmpId, setUrlaubEmpId] = useState<number | null>(null);
  const [urlaubFrom, setUrlaubFrom] = useState('');
  const [urlaubTo, setUrlaubTo] = useState('');
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

  interface ReportCard {
    icon: string;
    title: string;
    description: string;
    action: () => void;
    color: string;
    category: string;
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
        </div>
      )}

      {/* Report cards grouped by category */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
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
                    className={`text-left p-5 rounded-xl border-2 transition-all cursor-pointer ${colorMap[card.color] ?? 'bg-gray-50 border-gray-200 hover:border-gray-400'} hover:shadow-md`}
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
            </div>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
