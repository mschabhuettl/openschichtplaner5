/**
 * Tests for OvertimeDashboard (Q071)
 * — 14 tests covering rendering, interactions, CSV export, edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── API mock ──────────────────────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  api: {
    getOvertimeDashboard: vi.fn(),
    getGroups: vi.fn(),
  },
}));

import { api } from '../api/client';
import OvertimeDashboard from '../pages/OvertimeDashboard';

const mockedApi = api as { getOvertimeDashboard: ReturnType<typeof vi.fn>; getGroups: ReturnType<typeof vi.fn> };

const renderComp = () =>
  render(<MemoryRouter><OvertimeDashboard /></MemoryRouter>);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeRow = (id: number, name: string, short: string, expected: number, actual: number) => ({
  employee_id: id,
  employee_name: name,
  employee_short: short,
  contract_hours: 40,
  expected_hours: expected,
  actual_hours: actual,
  difference: actual - expected,
  shifts_count: 20,
});

const mockRows = [
  makeRow(1, 'Müller, Anna',    'AMÜ', 160, 172), // +12h → Blau
  makeRow(2, 'Schmidt, Bernd',  'BSC', 160, 159), // -1h  → Grün (≤5%)
  makeRow(3, 'Weber, Clara',    'CWE', 160, 150), // -10h → Orange (6.25%)
  makeRow(4, 'Bauer, Dieter',   'DBE', 160, 130), // -30h → Rot (>10%)
];

const mockResponse = {
  year: 2026,
  month: 3,
  group_id: null,
  count: 4,
  employees: mockRows,
};

const mockGroups = [
  { ID: 10, NAME: 'Frühdienst' },
  { ID: 20, NAME: 'Spätdienst' },
];

beforeEach(() => {
  mockedApi.getOvertimeDashboard.mockResolvedValue(mockResponse);
  mockedApi.getGroups.mockResolvedValue(mockGroups);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OvertimeDashboard', () => {

  it('renders heading', () => {
    renderComp();
    expect(screen.getByText(/Überstunden-Dashboard/i)).toBeTruthy();
  });

  it('shows loading indicator initially', () => {
    mockedApi.getOvertimeDashboard.mockReturnValue(new Promise(() => {})); // never resolves
    renderComp();
    expect(screen.getByText(/Lade/i)).toBeTruthy();
  });

  it('renders employee rows after load', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    expect(screen.getByText('Müller, Anna')).toBeTruthy();
    expect(screen.getByText('Schmidt, Bernd')).toBeTruthy();
    expect(screen.getByText('Weber, Clara')).toBeTruthy();
    expect(screen.getByText('Bauer, Dieter')).toBeTruthy();
  });

  it('renders group filter with groups', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Frühdienst'));
    expect(screen.getByText('Frühdienst')).toBeTruthy();
    expect(screen.getByText('Spätdienst')).toBeTruthy();
  });

  it('calls API on mount with current month and year', async () => {
    renderComp();
    await waitFor(() => expect(mockedApi.getOvertimeDashboard).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      undefined,
    ));
  });

  it('navigates to next month when next button clicked', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    const nextBtn = screen.getByLabelText('Nächster Monat');
    fireEvent.click(nextBtn);
    await waitFor(() => expect(mockedApi.getOvertimeDashboard).toHaveBeenCalledTimes(2));
  });

  it('navigates to previous month when prev button clicked', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    const prevBtn = screen.getByLabelText('Vorheriger Monat');
    fireEvent.click(prevBtn);
    await waitFor(() => expect(mockedApi.getOvertimeDashboard).toHaveBeenCalledTimes(2));
  });

  it('calls API with group_id when group selected', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Frühdienst'));
    const select = screen.getByLabelText('Gruppe filtern');
    fireEvent.change(select, { target: { value: '10' } });
    await waitFor(() =>
      expect(mockedApi.getOvertimeDashboard).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        10,
      )
    );
  });

  it('displays summary stats cards', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    expect(screen.getByText('Gesamt Soll')).toBeTruthy();
    expect(screen.getByText('Gesamt Ist')).toBeTruthy();
    expect(screen.getByText('Überstunden total')).toBeTruthy();
    expect(screen.getByText('Minusstunden total')).toBeTruthy();
  });

  it('filters rows by search input', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    const searchInput = screen.getByPlaceholderText(/Suchen/i);
    fireEvent.change(searchInput, { target: { value: 'Weber' } });
    await waitFor(() => expect(screen.getByText('Weber, Clara')).toBeTruthy());
    expect(screen.queryByText('Müller, Anna')).toBeFalsy();
  });

  it('shows "Keine Mitarbeiter gefunden" when search yields no results', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    const searchInput = screen.getByPlaceholderText(/Suchen/i);
    fireEvent.change(searchInput, { target: { value: 'xyz_not_found_xyz' } });
    await waitFor(() =>
      expect(screen.getByText(/Keine Mitarbeiter gefunden/i)).toBeTruthy()
    );
  });

  it('shows error message when API fails', async () => {
    mockedApi.getOvertimeDashboard.mockRejectedValue(new Error('Netzwerkfehler'));
    renderComp();
    await waitFor(() =>
      expect(screen.getByText(/Fehler.*Netzwerkfehler/i)).toBeTruthy()
    );
  });

  it('shows empty state when API returns no employees', async () => {
    mockedApi.getOvertimeDashboard.mockResolvedValue({ ...mockResponse, employees: [], count: 0 });
    renderComp();
    await waitFor(() =>
      expect(screen.getByText(/Keine Daten/i)).toBeTruthy()
    );
  });

  it('CSV export button is rendered and not disabled when data exists', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    const exportBtn = screen.getByLabelText('Als CSV exportieren');
    expect(exportBtn).toBeTruthy();
    expect((exportBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('sorts by name ascending when name header clicked', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    // Find and click the Mitarbeiter header
    const ths = screen.getAllByRole('columnheader');
    const nameHeader = ths.find(th => th.textContent?.includes('Mitarbeiter'));
    if (nameHeader) fireEvent.click(nameHeader);
    const rows = screen.getAllByRole('row');
    // After ascending name sort, Bauer should come first in data rows
    expect(rows[1].textContent).toContain('Bauer');
  });

});
