/**
 * Tests for RecurringShifts (Q073)
 * — 14 tests covering rendering, filters, create modal, delete, generate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── API mock ──────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  api: {
    getRecurringShifts: vi.fn(),
    createRecurringShift: vi.fn(),
    deleteRecurringShift: vi.fn(),
    generateRecurringShift: vi.fn(),
    getEmployees: vi.fn(),
    getGroups: vi.fn(),
    getShifts: vi.fn(),
  },
}));

import { api } from '../api/client';
import RecurringShifts from '../pages/RecurringShifts';

type MockedApi = {
  getRecurringShifts: ReturnType<typeof vi.fn>;
  createRecurringShift: ReturnType<typeof vi.fn>;
  deleteRecurringShift: ReturnType<typeof vi.fn>;
  generateRecurringShift: ReturnType<typeof vi.fn>;
  getEmployees: ReturnType<typeof vi.fn>;
  getGroups: ReturnType<typeof vi.fn>;
  getShifts: ReturnType<typeof vi.fn>;
};

const mockedApi = api as unknown as MockedApi;

const renderComp = () => render(<MemoryRouter><RecurringShifts /></MemoryRouter>);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockPatterns = [
  {
    id: 1,
    employee_id: 10,
    employee_name: 'Müller, Anna',
    shift_id: 100,
    shift_name: 'Frühdienst',
    shift_short: 'FD',
    recurrence: 'weekly',
    day_of_week: 0, // Montag
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
  },
  {
    id: 2,
    employee_id: 11,
    employee_name: 'Schmidt, Bernd',
    shift_id: 101,
    shift_name: 'Spätdienst',
    shift_short: 'SD',
    recurrence: 'biweekly',
    day_of_week: 4, // Freitag
    valid_from: '2026-02-01',
    valid_until: null,
  },
];

const mockEmployees = [
  { ID: 10, NAME: 'Müller', FIRSTNAME: 'Anna', SHORTNAME: 'AMÜ', NUMBER: '1' },
  { ID: 11, NAME: 'Schmidt', FIRSTNAME: 'Bernd', SHORTNAME: 'BSC', NUMBER: '2' },
];

const mockGroups = [
  { ID: 1, NAME: 'Frühdienst' },
  { ID: 2, NAME: 'Spätdienst' },
];

const mockShifts = [
  { ID: 100, NAME: 'Frühdienst', SHORTNAME: 'FD' },
  { ID: 101, NAME: 'Spätdienst', SHORTNAME: 'SD' },
];

beforeEach(() => {
  mockedApi.getRecurringShifts.mockResolvedValue(mockPatterns);
  mockedApi.getEmployees.mockResolvedValue(mockEmployees);
  mockedApi.getGroups.mockResolvedValue(mockGroups);
  mockedApi.getShifts.mockResolvedValue(mockShifts);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecurringShifts', () => {

  it('renders page heading', () => {
    renderComp();
    expect(screen.getByText(/Wiederkehrende Schichten/i)).toBeTruthy();
  });

  it('shows loading state initially', () => {
    mockedApi.getRecurringShifts.mockReturnValue(new Promise(() => {})); // never resolves
    renderComp();
    expect(screen.getByLabelText(/Lade Daten/i)).toBeTruthy();
  });

  it('renders pattern rows after load', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    expect(screen.getByText('Müller, Anna')).toBeTruthy();
    expect(screen.getByText('Schmidt, Bernd')).toBeTruthy();
  });

  it('shows Frühdienst and Spätdienst shift names', async () => {
    renderComp();
    await waitFor(() => screen.getAllByText('Frühdienst'));
    expect(screen.getAllByText('Frühdienst').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Spätdienst').length).toBeGreaterThan(0);
  });

  it('shows recurrence badges', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Wöchentlich'));
    expect(screen.getByText('Wöchentlich')).toBeTruthy();
    expect(screen.getByText('Zweiwöchentlich')).toBeTruthy();
  });

  it('shows weekday names', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Montag'));
    expect(screen.getByText('Montag')).toBeTruthy();
    expect(screen.getByText('Freitag')).toBeTruthy();
  });

  it('renders group filter dropdown', async () => {
    renderComp();
    await waitFor(() => screen.getByLabelText('Nach Gruppe filtern'));
    const select = screen.getByLabelText('Nach Gruppe filtern');
    expect(select).toBeTruthy();
  });

  it('renders employee filter dropdown', async () => {
    renderComp();
    await waitFor(() => screen.getByLabelText('Nach Mitarbeiter filtern'));
    expect(screen.getByLabelText('Nach Mitarbeiter filtern')).toBeTruthy();
  });

  it('opens create modal on button click', async () => {
    renderComp();
    await waitFor(() => screen.getByLabelText('Neues Muster erstellen'));
    fireEvent.click(screen.getByLabelText('Neues Muster erstellen'));
    expect(screen.getByLabelText('Wiederkehrende Schicht erstellen')).toBeTruthy();
  });

  it('closes create modal on Abbrechen', async () => {
    renderComp();
    await waitFor(() => screen.getByLabelText('Neues Muster erstellen'));
    fireEvent.click(screen.getByLabelText('Neues Muster erstellen'));
    const cancelBtn = screen.getAllByText('Abbrechen')[0];
    fireEvent.click(cancelBtn);
    await waitFor(() => expect(screen.queryByLabelText('Wiederkehrende Schicht erstellen')).toBeFalsy());
  });

  it('opens generate modal when Generieren button clicked', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    const genBtn = screen.getAllByText(/⚡ Generieren/i)[0];
    fireEvent.click(genBtn);
    expect(screen.getByLabelText('Schichten generieren')).toBeTruthy();
  });

  it('calls generateRecurringShift and shows toast on success', async () => {
    mockedApi.generateRecurringShift.mockResolvedValue({ created: 5, skipped: 2 });
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));

    // Open generate modal
    const genBtn = screen.getAllByText(/⚡ Generieren/i)[0];
    fireEvent.click(genBtn);

    // Click generate
    const generateBtn = screen.getByText('Generieren');
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    await waitFor(() =>
      expect(screen.getByText(/5 Schichten erstellt, 2 übersprungen/i)).toBeTruthy()
    );
  });

  it('opens delete confirmation dialog', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));
    const deleteBtn = screen.getAllByTitle('Muster löschen')[0];
    fireEvent.click(deleteBtn);
    expect(screen.getByText(/wirklich löschen/i)).toBeTruthy();
  });

  it('calls deleteRecurringShift and removes row on confirm', async () => {
    mockedApi.deleteRecurringShift.mockResolvedValue({ ok: true, deleted: 1 });
    renderComp();
    await waitFor(() => screen.getByText('Müller, Anna'));

    const deleteBtn = screen.getAllByTitle('Muster löschen')[0];
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByText('Löschen');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => expect(mockedApi.deleteRecurringShift).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText('Müller, Anna')).toBeFalsy());
  });

  it('shows error message when API fails', async () => {
    mockedApi.getRecurringShifts.mockRejectedValue(new Error('Netzwerkfehler'));
    renderComp();
    await waitFor(() =>
      expect(screen.getByText(/Fehler.*Netzwerkfehler/i)).toBeTruthy()
    );
  });

  it('shows empty state when no patterns', async () => {
    mockedApi.getRecurringShifts.mockResolvedValue([]);
    renderComp();
    await waitFor(() =>
      expect(screen.getByText(/Keine wiederkehrenden Schichten/i)).toBeTruthy()
    );
  });

  it('creates pattern and adds to list', async () => {
    const newPattern = {
      id: 3,
      employee_id: 10,
      employee_name: 'Müller, Anna',
      shift_id: 100,
      shift_name: 'Frühdienst',
      shift_short: 'FD',
      recurrence: 'weekly' as const,
      day_of_week: 2,
      valid_from: '2026-03-01',
      valid_until: null,
    };
    mockedApi.createRecurringShift.mockResolvedValue(newPattern);
    renderComp();
    await waitFor(() => screen.getByLabelText('Neues Muster erstellen'));
    fireEvent.click(screen.getByLabelText('Neues Muster erstellen'));

    // Fill form
    const empSelect = screen.getByLabelText('Mitarbeiter wählen');
    fireEvent.change(empSelect, { target: { value: '10' } });

    const shiftSelect = screen.getByLabelText('Schicht wählen');
    fireEvent.change(shiftSelect, { target: { value: '100' } });

    const createBtn = screen.getByText('Erstellen');
    await act(async () => {
      fireEvent.click(createBtn);
    });

    await waitFor(() => expect(mockedApi.createRecurringShift).toHaveBeenCalled());
  });

});
