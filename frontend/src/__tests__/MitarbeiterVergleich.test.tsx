/**
 * Tests for MitarbeiterVergleich (Employee Comparison View) — Q067
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ── API mock ──────────────────────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getGroups: vi.fn(),
    getShifts: vi.fn(),
    getLeaveTypes: vi.fn(),
    getScheduleYear: vi.fn(),
    getEmployeeStatsYear: vi.fn(),
    getGroupMembers: vi.fn(),
  },
}));

import { MemoryRouter } from 'react-router-dom';
import { api } from '../api/client';
import MitarbeiterVergleich from '../pages/MitarbeiterVergleich';

// Helper: render wrapped in Router
const renderComp = (initialEntries = ['/mitarbeiter-vergleich']) =>
  render(<MemoryRouter initialEntries={initialEntries}><MitarbeiterVergleich /></MemoryRouter>);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockEmployees = [
  { ID: 1, NAME: 'Müller', FIRSTNAME: 'Anna', SHORTNAME: 'AMÜ', GROUP_ID: 10 },
  { ID: 2, NAME: 'Schmidt', FIRSTNAME: 'Bernd', SHORTNAME: 'BSC', GROUP_ID: 10 },
  { ID: 3, NAME: 'Weber', FIRSTNAME: 'Clara', SHORTNAME: 'CWE', GROUP_ID: 20 },
];

const mockGroups = [
  { ID: 10, NAME: 'Frühdienst' },
  { ID: 20, NAME: 'Spätdienst' },
];

const mockShifts = [
  { ID: 1, SHORTNAME: 'F', COLORBK_HEX: '#4ade80', COLORTEXT_HEX: '#fff' },
  { ID: 2, SHORTNAME: 'S', COLORBK_HEX: '#fb923c', COLORTEXT_HEX: '#fff' },
];

const mockLeaveTypes = [
  { ID: 1, SHORTNAME: 'U', COLORBK_HEX: '#fbbf24' },
];

const makeMonthSummaries = (shifts: number, absences: number, actual: number, target: number) =>
  Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    year: 2026,
    shifts,
    absences,
    actual_hours: actual,
    target_hours: target,
    label_counts: shifts > 0 ? { F: shifts } : {},
  }));

const makeStats = (shifts: number, actual: number, target: number) => ({
  totals: {
    shifts_count: shifts,
    actual_hours: actual,
    target_hours: target,
    weekend_shifts: 4,
    night_shifts: 2,
    vacation_days: 5,
    absence_days: 1,
  },
  months: [],
});

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getEmployees).mockResolvedValue(mockEmployees);
  vi.mocked(api.getGroups).mockResolvedValue(mockGroups);
  vi.mocked(api.getShifts).mockResolvedValue(mockShifts);
  vi.mocked(api.getLeaveTypes).mockResolvedValue(mockLeaveTypes);
  vi.mocked(api.getScheduleYear).mockResolvedValue(makeMonthSummaries(10, 2, 160, 152));
  vi.mocked(api.getEmployeeStatsYear).mockResolvedValue(makeStats(120, 1920, 1824));
  vi.mocked(api.getGroupMembers).mockResolvedValue(mockEmployees);
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('MitarbeiterVergleich — Employee Comparison View', () => {

  it('renders the page title', async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText(/Mitarbeiter-Vergleich/i)).toBeTruthy());
  });

  it('loads employee list from API on mount', async () => {
    renderComp();
    await waitFor(() => expect(api.getEmployees).toHaveBeenCalledTimes(1));
  });

  it('loads groups, shifts, and leave types on mount', async () => {
    renderComp();
    await waitFor(() => {
      expect(api.getGroups).toHaveBeenCalled();
      expect(api.getShifts).toHaveBeenCalled();
      expect(api.getLeaveTypes).toHaveBeenCalled();
    });
  });

  it('shows placeholder when no employees are selected', async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText(/zwei Mitarbeiter auswählen/i)).toBeTruthy());
  });

  it('renders employee selectors (Mitarbeiter 1 and 2)', async () => {
    renderComp();
    await waitFor(() => {
      expect(screen.getByText('Mitarbeiter 1')).toBeTruthy();
      expect(screen.getByText('Mitarbeiter 2')).toBeTruthy();
    });
  });

  it('populates employee dropdowns with fetched data', async () => {
    renderComp();
    await waitFor(() => {
      // Each employee appears in at least one select
      expect(screen.getAllByText('Müller, Anna').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Schmidt, Bernd').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls getScheduleYear when employee 1 is selected', async () => {
    renderComp();
    await waitFor(() => screen.getAllByText('Müller, Anna'));
    // selects: [0]=group, [1]=year, [2]=emp1, [3]=emp2
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[2], { target: { value: '1' } });
    await waitFor(() => expect(api.getScheduleYear).toHaveBeenCalledWith(expect.any(Number), 1));
  });

  it('calls getEmployeeStatsYear when employee 2 is selected', async () => {
    renderComp();
    await waitFor(() => screen.getAllByText('Schmidt, Bernd'));
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[3], { target: { value: '2' } });
    await waitFor(() => expect(api.getEmployeeStatsYear).toHaveBeenCalledWith(2, expect.any(Number)));
  });

  it('shows statistics section after both employees are selected', async () => {
    renderComp();
    await waitFor(() => screen.getAllByText('Müller, Anna'));
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[2], { target: { value: '1' } });
    fireEvent.change(selects[3], { target: { value: '2' } });
    await waitFor(() => {
      expect(screen.getByText(/Statistik-Vergleich/i)).toBeTruthy();
    });
  });

  it('shows monthly overview section after both employees are selected', async () => {
    renderComp();
    await waitFor(() => screen.getAllByText('Müller, Anna'));
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[2], { target: { value: '1' } });
    fireEvent.change(selects[3], { target: { value: '2' } });
    await waitFor(() => {
      expect(screen.getByText(/Monatsübersicht/i)).toBeTruthy();
    });
  });

  it('renders a year selector with current and nearby years', async () => {
    renderComp();
    await waitFor(() => {
      const currentYear = new Date().getFullYear();
      expect(screen.getByDisplayValue(String(currentYear))).toBeTruthy();
    });
  });

  it('renders group filter dropdown', async () => {
    renderComp();
    await waitFor(() => {
      expect(screen.getByText('Alle Gruppen')).toBeTruthy();
    });
  });

  it('populates group filter with fetched groups', async () => {
    renderComp();
    await waitFor(() => {
      expect(screen.getByText('Frühdienst')).toBeTruthy();
      expect(screen.getByText('Spätdienst')).toBeTruthy();
    });
  });

  it('filters employees by group when group filter changes', async () => {
    vi.mocked(api.getGroupMembers).mockResolvedValue([
      { ID: 1, NAME: 'Müller', FIRSTNAME: 'Anna', SHORTNAME: 'AMÜ', GROUP_ID: 10 },
      { ID: 2, NAME: 'Schmidt', FIRSTNAME: 'Bernd', SHORTNAME: 'BSC', GROUP_ID: 10 },
    ]);
    renderComp();
    await waitFor(() => screen.getByText('Frühdienst'));
    const groupSelect = document.querySelectorAll('select')[0];
    fireEvent.change(groupSelect, { target: { value: '10' } });
    await waitFor(() => expect(api.getGroupMembers).toHaveBeenCalledWith(10));
  });

  it('prevents selecting the same employee for both slots', async () => {
    renderComp();
    await waitFor(() => screen.getAllByText('Müller, Anna'));
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[2], { target: { value: '1' } });
    // Employee 1 (Anna) should not appear in slot 2 select after being chosen in slot 1
    await waitFor(() => {
      const slot2Options = Array.from(selects[3].querySelectorAll('option')).map(o => o.value);
      expect(slot2Options).not.toContain('1');
    });
  });

  it('shows shortname of selected employee in selector card', async () => {
    renderComp();
    await waitFor(() => screen.getAllByText('Müller, Anna'));
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[2], { target: { value: '1' } });
    await waitFor(() => {
      expect(screen.getByText('AMÜ')).toBeTruthy();
    });
  });

  it('re-fetches data when year changes', async () => {
    renderComp();
    await waitFor(() => screen.getAllByText('Müller, Anna'));
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[2], { target: { value: '1' } });
    await waitFor(() => expect(api.getScheduleYear).toHaveBeenCalledTimes(1));

    const yearSelect = screen.getByDisplayValue(String(new Date().getFullYear()));
    fireEvent.change(yearSelect, { target: { value: String(new Date().getFullYear() - 1) } });
    await waitFor(() => expect(api.getScheduleYear).toHaveBeenCalledTimes(2));
  });

});
