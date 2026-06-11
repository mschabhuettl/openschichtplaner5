/**
 * Tests für die Jahresübersicht als Tagesraster (V-8, Spec 4.4):
 * - Rasteraufbau: 12 Monatszeilen × 31 Tagesspalten, tote Zellen
 *   (Tag-31-Handling, Schaltjahr-Februar)
 * - Kürzel-/Farb-Mapping aus ScheduleEntry (COLORREF-Konvention des Dienstplans)
 * - Zyklus-Kennzeichnung (source==='cycle', wie im Dienstplan)
 * - Klick auf Zelle → Dienstplan des Monats (sessionStorage + navigate)
 * - Modus-Toggle Jahresraster ↔ Zusammenfassung (kein Feature-Verlust)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ScheduleEntry } from '../types';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getGroups: vi.fn(),
    getGroupMembers: vi.fn(),
    getShifts: vi.fn(),
    getLeaveTypes: vi.fn(),
    getSchedule: vi.fn(),
    getScheduleYear: vi.fn(),
    getHolidays: vi.fn(),
  },
}));

import { api } from '../api/client';
import Jahresuebersicht from '../pages/Jahresuebersicht';
import { daysInMonth } from '../components/jahresRasterUtils';
import { CYCLE_TITLE } from '../components/ScheduleCellStack';

const Y = new Date().getFullYear();

const mockEmployees = [
  { ID: 1, NAME: 'Muster', FIRSTNAME: 'Max', SHORTNAME: 'MMU' },
  { ID: 2, NAME: 'Test', FIRSTNAME: 'Tina', SHORTNAME: 'TTE' },
];

const entry = (over: Partial<ScheduleEntry>): ScheduleEntry => ({
  employee_id: 1,
  date: `${Y}-03-15`,
  kind: 'shift',
  shift_id: 1,
  display_name: 'F',
  color_bk: '#ff0000',
  color_text: '#ffffff',
  ...over,
});

// März: manueller Dienst (MA 1), Zyklusdienst (MA 1), Fremd-Eintrag (MA 2)
const marchEntries: ScheduleEntry[] = [
  entry({}),
  entry({ date: `${Y}-03-16`, display_name: 'N', color_bk: '#0000ff', source: 'cycle' }),
  entry({ employee_id: 2, display_name: 'S', color_bk: '#00ff00' }),
];

const monthSummaries = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  shifts: 2,
  absences: 1,
  target_hours: 160,
  actual_hours: 165,
  label_counts: { F: 2 },
}));

async function renderRaster() {
  render(<Jahresuebersicht />);
  await waitFor(() => expect(screen.getByTestId('jahresraster')).toBeTruthy());
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(api.getEmployees).mockResolvedValue(mockEmployees);
  vi.mocked(api.getGroups).mockResolvedValue([]);
  vi.mocked(api.getGroupMembers).mockResolvedValue([]);
  vi.mocked(api.getShifts).mockResolvedValue([]);
  vi.mocked(api.getLeaveTypes).mockResolvedValue([]);
  vi.mocked(api.getSchedule).mockImplementation((_y: number, m: number) =>
    Promise.resolve(m === 3 ? marchEntries : []));
  vi.mocked(api.getScheduleYear).mockResolvedValue(monthSummaries);
  vi.mocked(api.getHolidays).mockResolvedValue([
    { ID: 1, DATE: `${Y}-01-01`, NAME: 'Neujahr', INTERVAL: 0 },
  ]);
});

describe('Jahresübersicht — Jahresraster (V-8, Spec 4.4)', () => {
  it('rendert 12 Monatszeilen × 31 Tagesspalten und lädt 12 Monate', async () => {
    await renderRaster();

    const raster = screen.getByTestId('jahresraster');
    // Header-Zeile + 12 Monatszeilen
    expect(within(raster).getAllByRole('row')).toHaveLength(13);
    for (const abbr of ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']) {
      expect(within(raster).getByText(abbr)).toBeTruthy();
    }
    // Kopfzeile: Monat + Tage 1…31
    expect(within(raster).getAllByRole('columnheader')).toHaveLength(32);
    // Tageseinträge kommen aus dem Monats-Endpoint, 12× (Jan…Dez)
    expect(api.getSchedule).toHaveBeenCalledTimes(12);
    expect(api.getSchedule).toHaveBeenCalledWith(Y, 1);
    expect(api.getSchedule).toHaveBeenCalledWith(Y, 12);
  });

  it('Tag-31-Handling: tote Zellen außerhalb der Monatslänge', async () => {
    await renderRaster();

    expect(screen.getByTestId('jr-cell-1-31')).toBeTruthy();   // Januar hat 31 Tage
    expect(screen.queryByTestId('jr-cell-4-31')).toBeNull();   // April hat 30 Tage
    expect(screen.queryByTestId('jr-cell-2-30')).toBeNull();   // Februar nie 30
    // Februar 29 nur im Schaltjahr
    const febDays = daysInMonth(Y, 2);
    if (febDays === 29) expect(screen.getByTestId('jr-cell-2-29')).toBeTruthy();
    else expect(screen.queryByTestId('jr-cell-2-29')).toBeNull();
  });

  it('daysInMonth: Schaltjahr-Regeln', () => {
    expect(daysInMonth(2024, 2)).toBe(29);  // Schaltjahr
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);  // durch 400 teilbar
    expect(daysInMonth(1900, 2)).toBe(28);  // Säkularjahr ohne Schalttag
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('zeigt Kürzel mit den Dienstplan-Farben und filtert auf den gewählten MA', async () => {
    await renderRaster();

    const cell = screen.getByTestId('jr-cell-3-15');
    expect(within(cell).getByText('F')).toBeTruthy();
    expect(cell.style.backgroundColor).toBe('rgb(255, 0, 0)'); // color_bk des Eintrags
    // Eintrag von MA 2 (display_name 'S') taucht im Raster von MA 1 nicht auf
    expect(within(screen.getByTestId('jahresraster')).queryByText('S')).toBeNull();
  });

  it('kennzeichnet Zyklusdienste wie im Dienstplan (↻ + Tooltip)', async () => {
    await renderRaster();

    const cell = screen.getByTestId('jr-cell-3-16');
    const badge = within(cell).getByTitle(CYCLE_TITLE);
    expect(badge.textContent).toContain('↻');
    expect(badge.textContent).toContain('N');
  });

  it('markiert Feiertage und den heutigen Tag im Tooltip', async () => {
    await renderRaster();

    expect(screen.getByTestId('jr-cell-1-1').title).toContain('Feiertag');
    const now = new Date();
    const todayCell = screen.getByTestId(`jr-cell-${now.getMonth() + 1}-${now.getDate()}`);
    expect(todayCell.title).toContain('Heute');
  });

  it('Klick auf eine Zelle öffnet den Dienstplan des Monats', async () => {
    await renderRaster();

    fireEvent.click(screen.getByTestId('jr-cell-3-15'));
    expect(sessionStorage.getItem('schedule-year')).toBe(String(Y));
    expect(sessionStorage.getItem('schedule-month')).toBe('3');
    expect(navigateMock).toHaveBeenCalledWith('/schedule');
  });

  it('MA-Navigation: ›/‹ wechseln den Mitarbeiter, Dropdown bleibt synchron', async () => {
    await renderRaster();

    expect(screen.getByText(/Muster, Max — Jahresraster/)).toBeTruthy();
    const prev = screen.getByRole('button', { name: 'Vorheriger Mitarbeiter' });
    expect((prev as HTMLButtonElement).disabled).toBe(true); // erster MA

    fireEvent.click(screen.getByRole('button', { name: 'Nächster Mitarbeiter' }));
    await waitFor(() => expect(screen.getByText(/Test, Tina — Jahresraster/)).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Nächster Mitarbeiter' }) as HTMLButtonElement).disabled).toBe(true); // letzter MA

    fireEvent.click(screen.getByRole('button', { name: 'Vorheriger Mitarbeiter' }));
    await waitFor(() => expect(screen.getByText(/Muster, Max — Jahresraster/)).toBeTruthy());
  });

  it('Modus-Toggle: Zusammenfassung zeigt die Aggregat-Ansicht (kein Feature-Verlust)', async () => {
    await renderRaster();

    fireEvent.click(screen.getByRole('button', { name: 'Zusammenfassung' }));
    // Aggregat-Einzelansicht: Summary-Karten + Monatszeilen via getScheduleYear
    await waitFor(() => expect(api.getScheduleYear).toHaveBeenCalledWith(Y, 1));
    expect(screen.getByText('Ist-Stunden')).toBeTruthy();
    expect(screen.getByText('Überstunden')).toBeTruthy();
    expect(screen.queryByTestId('jahresraster')).toBeNull();
    // Sub-Toggle der Zusammenfassung bleibt erhalten
    expect(screen.getByRole('button', { name: 'Alle MA' })).toBeTruthy();

    // zurück zum Raster
    fireEvent.click(screen.getByRole('button', { name: 'Jahresraster' }));
    await waitFor(() => expect(screen.getByTestId('jahresraster')).toBeTruthy());
  });
});
