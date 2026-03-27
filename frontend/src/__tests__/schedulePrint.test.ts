/**
 * Q063 edge case tests: Print schedule HTML generation
 * Tests buildScheduleHTML equivalent logic with 0, 1, and many employees.
 */
import { describe, it, expect } from 'vitest';

// ── Minimal type definitions ──────────────────────────────────────────────────

interface Employee {
  ID: number;
  NAME: string;
  FIRSTNAME: string;
  CBKLABEL?: number | null;
  CBKLABEL_HEX?: string;
  CFGLABEL_HEX?: string;
  BOLD?: number;
}

interface ScheduleEntry {
  display_name: string;
  color_bk?: string;
  color_text?: string;
}

// ── Replicated from Schedule.tsx ──────────────────────────────────────────────

function buildScheduleHTML(
  employees: Employee[],
  days: number[],
  entryMap: Map<string, ScheduleEntry>,
  holidays: Set<string>,
  year: number,
  month: number,
  monthName: string,
  groupLabel: string,
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const WD_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const thStyle = 'font-size:11px;background:#1e293b;color:#fff;padding:3px 4px;border:1px solid #334155;';
  const tdNameStyle = 'font-size:11px;padding:2px 6px;border:1px solid #ddd;white-space:nowrap;min-width:120px;';
  const tdStyle = (bk?: string, isWe?: boolean, isHol?: boolean): string => {
    const bg = bk || (isHol ? '#fee2e2' : isWe ? '#f1f5f9' : '#fff');
    return `border:1px solid #ddd;padding:2px 3px;font-size:11px;text-align:center;background:${bg};`;
  };

  let headerCells = `<th style="${thStyle}min-width:140px">Mitarbeiter</th>`;
  for (const day of days) {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const wd = new Date(year, month - 1, day).getDay();
    const isHol = holidays.has(dateStr);
    const isWe = wd === 0 || wd === 6;
    const style = thStyle + (isHol ? 'background:#b91c1c;' : isWe ? 'background:#475569;' : '');
    headerCells += `<th style="${style}min-width:28px">${day}<br/><span style="font-size:9px;opacity:.8">${WD_ABBR[wd]}</span></th>`;
  }

  let bodyRows = '';
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const empLabelBg =
      emp.CBKLABEL != null && emp.CBKLABEL !== 16777215 && emp.CBKLABEL !== 0 && emp.CBKLABEL_HEX
        ? emp.CBKLABEL_HEX
        : rowBg;
    const empLabelColor = emp.CFGLABEL_HEX || '#000';
    const empBold = emp.BOLD ? 'font-weight:700;' : '';
    let cells = `<td style="${tdNameStyle}background:${empLabelBg};color:${empLabelColor};${empBold}">${emp.NAME}, ${emp.FIRSTNAME}</td>`;
    for (const day of days) {
      const dateStr = `${year}-${pad(month)}-${pad(day)}`;
      const wd = new Date(year, month - 1, day).getDay();
      const isHol = holidays.has(dateStr);
      const isWe = wd === 0 || wd === 6;
      const entry = entryMap.get(`${emp.ID}-${day}`);
      const style = tdStyle(entry?.color_bk, isWe, isHol);
      const color = entry?.color_text || '#000';
      cells += `<td style="${style}"><span style="color:${color};font-weight:bold">${entry?.display_name || ''}</span></td>`;
    }
    bodyRows += `<tr>${cells}</tr>`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Dienstplan ${monthName} ${year}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 16px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  .subtitle { font-size: 12px; color: #555; margin-bottom: 10px; }
  table { border-collapse: collapse; }
  @media print {
    @page { size: landscape; margin: 8mm; }
    body { margin: 0; }
    h1 { font-size: 13px; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
<h1>Dienstplan – ${monthName} ${year}</h1>
<div class="subtitle">Gruppe: ${groupLabel} &nbsp;|&nbsp; ${employees.length} Mitarbeiter &nbsp;|&nbsp; Erstellt: ${new Date().toLocaleString('de-AT')}</div>
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
}

// ── Test data helpers ─────────────────────────────────────────────────────────

function makeEmployee(id: number, name: string, firstname: string): Employee {
  return { ID: id, NAME: name, FIRSTNAME: firstname };
}

function makeDays(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Q063 Print: buildScheduleHTML edge cases', () => {
  const year = 2026;
  const month = 3;
  const monthName = 'März 2026';
  const groupLabel = 'Alle Gruppen';
  const days = makeDays(31);
  const emptyEntryMap = new Map<string, ScheduleEntry>();
  const emptyHolidays = new Set<string>();

  it('renders valid HTML structure for 0 employees', () => {
    const html = buildScheduleHTML([], days, emptyEntryMap, emptyHolidays, year, month, monthName, groupLabel);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('Dienstplan – März 2026 2026');
    expect(html).toContain('0 Mitarbeiter');
    expect(html).toContain('<tbody></tbody>');
    // No employee rows
    expect(html).not.toContain('<td');
  });

  it('renders correctly for 1 employee with no shifts', () => {
    const employees = [makeEmployee(1, 'Müller', 'Anna')];
    const html = buildScheduleHTML(employees, days, emptyEntryMap, emptyHolidays, year, month, monthName, groupLabel);

    expect(html).toContain('1 Mitarbeiter');
    expect(html).toContain('Müller, Anna');
    // 31 days + 1 name cell = 32 <td> tags
    const tdCount = (html.match(/<td /g) || []).length;
    expect(tdCount).toBe(32); // 1 name cell + 31 day cells
  });

  it('renders correctly for 1 employee with shifts assigned', () => {
    const employees = [makeEmployee(1, 'Müller', 'Anna')];
    const entryMap = new Map<string, ScheduleEntry>([
      ['1-1', { display_name: 'F', color_bk: '#bfdbfe', color_text: '#1e40af' }],
      ['1-15', { display_name: 'S', color_bk: '#fef9c3', color_text: '#713f12' }],
    ]);
    const html = buildScheduleHTML(employees, days, entryMap, emptyHolidays, year, month, monthName, groupLabel);

    expect(html).toContain('>F<');
    expect(html).toContain('>S<');
    expect(html).toContain('#bfdbfe');
    expect(html).toContain('#1e40af');
  });

  it('renders correctly for many employees (stress test)', () => {
    const MAX_EMPLOYEES = 100;
    const employees = Array.from({ length: MAX_EMPLOYEES }, (_, i) =>
      makeEmployee(i + 1, `Nachname${i + 1}`, `Vorname${i + 1}`)
    );
    const html = buildScheduleHTML(employees, days, emptyEntryMap, emptyHolidays, year, month, monthName, groupLabel);

    expect(html).toContain(`${MAX_EMPLOYEES} Mitarbeiter`);
    expect(html).toContain('Nachname1, Vorname1');
    expect(html).toContain(`Nachname${MAX_EMPLOYEES}, Vorname${MAX_EMPLOYEES}`);

    // 100 employees × (31 days + 1 name) = 3200 <td> tags
    const tdCount = (html.match(/<td /g) || []).length;
    expect(tdCount).toBe(MAX_EMPLOYEES * 32);
  });

  it('alternates row background colors for 0/even rows', () => {
    const employees = [
      makeEmployee(1, 'Erster', 'MA'),
      makeEmployee(2, 'Zweiter', 'MA'),
      makeEmployee(3, 'Dritter', 'MA'),
    ];
    const html = buildScheduleHTML(employees, days, emptyEntryMap, emptyHolidays, year, month, monthName, groupLabel);

    // Even rows (0, 2) should have #fff, odd rows (1) should have #f8fafc
    expect(html).toContain('background:#fff');
    expect(html).toContain('background:#f8fafc');
  });

  it('marks holidays with red background in header', () => {
    const holidays = new Set(['2026-03-01']);
    const employees = [makeEmployee(1, 'Test', 'Person')];
    const html = buildScheduleHTML(employees, [1, 2, 3], emptyEntryMap, holidays, year, month, monthName, groupLabel);

    // Holiday header cell gets background:#b91c1c
    expect(html).toContain('background:#b91c1c');
    // Holiday body cell gets #fee2e2
    expect(html).toContain('#fee2e2');
  });

  it('marks weekends with slate background in header', () => {
    // 2026-03-07 is a Saturday, 2026-03-08 is a Sunday
    const employees = [makeEmployee(1, 'Test', 'Person')];
    const html = buildScheduleHTML(employees, [7, 8], emptyEntryMap, emptyHolidays, year, month, monthName, groupLabel);

    // Weekend header cells get background:#475569
    const weekendCount = (html.match(/background:#475569/g) || []).length;
    expect(weekendCount).toBeGreaterThanOrEqual(2); // At least 2 weekend columns
  });

  it('renders employee with BOLD flag as font-weight:700', () => {
    const employees = [{ ...makeEmployee(1, 'Fett', 'Bold'), BOLD: 1 }];
    const html = buildScheduleHTML(employees, [1], emptyEntryMap, emptyHolidays, year, month, monthName, groupLabel);

    expect(html).toContain('font-weight:700');
  });

  it('renders employee label color when CBKLABEL is set', () => {
    const employees = [
      { ...makeEmployee(1, 'Farbe', 'Empoyee'), CBKLABEL: 1, CBKLABEL_HEX: '#ffccdd', CFGLABEL_HEX: '#001122' },
    ];
    const html = buildScheduleHTML(employees, [1], emptyEntryMap, emptyHolidays, year, month, monthName, groupLabel);

    expect(html).toContain('#ffccdd');
    expect(html).toContain('#001122');
  });

  it('includes landscape print CSS media query', () => {
    const html = buildScheduleHTML([], days, emptyEntryMap, emptyHolidays, year, month, monthName, groupLabel);
    expect(html).toContain('@media print');
    expect(html).toContain('size: landscape');
  });
});
