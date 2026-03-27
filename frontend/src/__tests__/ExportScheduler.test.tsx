/**
 * Tests for ExportScheduler (Q075)
 * 14 tests covering: render, loading, empty state, list, modal, toggle, delete, run-now, error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── API mock ──────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  api: {
    getExportSchedules: vi.fn(),
    createExportSchedule: vi.fn(),
    updateExportSchedule: vi.fn(),
    deleteExportSchedule: vi.fn(),
    runExportSchedule: vi.fn(),
    getGroups: vi.fn(),
  },
}));

// ── Context mocks ─────────────────────────────────────────────────────────────

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { ID: 1, NAME: 'Admin', role: 'Admin', ADMIN: true },
    isDevMode: false,
    devViewRole: 'admin',
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import { api } from '../api/client';
import ExportScheduler from '../pages/ExportScheduler';

type MockedApi = {
  getExportSchedules: ReturnType<typeof vi.fn>;
  createExportSchedule: ReturnType<typeof vi.fn>;
  updateExportSchedule: ReturnType<typeof vi.fn>;
  deleteExportSchedule: ReturnType<typeof vi.fn>;
  runExportSchedule: ReturnType<typeof vi.fn>;
  getGroups: ReturnType<typeof vi.fn>;
};

const mockedApi = api as unknown as MockedApi;

const renderComp = () =>
  render(<MemoryRouter><ExportScheduler /></MemoryRouter>);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockSchedules = [
  {
    id: 1,
    name: 'Wöchentlicher Export',
    frequency: 'weekly' as const,
    day_of_week: 1, // Monday
    time: '08:00',
    format: 'xlsx' as const,
    group_id: null,
    email_to: ['chef@firma.at', 'hr@firma.at'],
    enabled: true,
  },
  {
    id: 2,
    name: 'CSV Backup',
    frequency: 'weekly' as const,
    day_of_week: 5, // Friday
    time: '17:00',
    format: 'csv' as const,
    group_id: 10,
    email_to: ['backup@firma.at'],
    enabled: false,
  },
];

const mockGroups = [
  { ID: 10, NAME: 'Frühdienst' },
  { ID: 11, NAME: 'Spätdienst' },
];

beforeEach(() => {
  mockedApi.getExportSchedules.mockResolvedValue(mockSchedules);
  mockedApi.getGroups.mockResolvedValue(mockGroups);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ExportScheduler', () => {

  it('renders page heading', () => {
    renderComp();
    expect(screen.getByText(/Export-Zeitpläne/i)).toBeTruthy();
  });

  it('shows loading state initially', () => {
    mockedApi.getExportSchedules.mockReturnValue(new Promise(() => {})); // never resolves
    renderComp();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders schedule rows after load', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Wöchentlicher Export'));
    expect(screen.getByText('Wöchentlicher Export')).toBeTruthy();
    expect(screen.getByText('CSV Backup')).toBeTruthy();
  });

  it('shows weekday and time correctly', async () => {
    renderComp();
    await waitFor(() => screen.getByText(/Montag.*08:00/i));
    expect(screen.getByText(/Montag.*08:00/i)).toBeTruthy();
    expect(screen.getByText(/Freitag.*17:00/i)).toBeTruthy();
  });

  it('shows format badges', async () => {
    renderComp();
    await waitFor(() => screen.getByText('XLSX'));
    expect(screen.getByText('XLSX')).toBeTruthy();
    expect(screen.getByText('CSV')).toBeTruthy();
  });

  it('shows recipient count', async () => {
    renderComp();
    await waitFor(() => screen.getAllByText(/Empfänger/i));
    const cells = screen.getAllByText(/Empfänger/i);
    expect(cells.length).toBeGreaterThan(0);
  });

  it('shows empty state when no schedules', async () => {
    mockedApi.getExportSchedules.mockResolvedValue([]);
    renderComp();
    await waitFor(() =>
      expect(screen.getByText(/Keine Export-Zeitpläne vorhanden/i)).toBeTruthy()
    );
  });

  it('opens create modal on Neuer Zeitplan button click', async () => {
    renderComp();
    await waitFor(() => screen.getByLabelText('Neuen Export-Zeitplan erstellen'));
    fireEvent.click(screen.getByLabelText('Neuen Export-Zeitplan erstellen'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Neuer Export-Zeitplan/i)).toBeTruthy();
  });

  it('closes modal on Abbrechen button', async () => {
    renderComp();
    await waitFor(() => screen.getByLabelText('Neuen Export-Zeitplan erstellen'));
    fireEvent.click(screen.getByLabelText('Neuen Export-Zeitplan erstellen'));
    const cancelBtn = screen.getByText('Abbrechen');
    fireEvent.click(cancelBtn);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeFalsy());
  });

  it('opens edit modal on edit button click', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Wöchentlicher Export'));
    const editBtns = screen.getAllByTitle('Bearbeiten');
    fireEvent.click(editBtns[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Zeitplan bearbeiten/i)).toBeTruthy();
  });

  it('calls createExportSchedule and adds row on save', async () => {
    const newSchedule = {
      id: 3,
      name: 'Neuer Test',
      frequency: 'weekly' as const,
      day_of_week: 2,
      time: '09:00',
      format: 'xlsx' as const,
      group_id: null,
      email_to: [],
      enabled: true,
    };
    mockedApi.createExportSchedule.mockResolvedValue(newSchedule);
    renderComp();
    await waitFor(() => screen.getByLabelText('Neuen Export-Zeitplan erstellen'));

    // Open modal
    fireEvent.click(screen.getByLabelText('Neuen Export-Zeitplan erstellen'));

    // Fill name
    const nameInput = screen.getByLabelText(/Name/i);
    fireEvent.change(nameInput, { target: { value: 'Neuer Test' } });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByText('Erstellen'));
    });

    await waitFor(() => expect(mockedApi.createExportSchedule).toHaveBeenCalled());
    await waitFor(() => screen.getByText('Neuer Test'));
  });

  it('calls deleteExportSchedule and removes row on confirm', async () => {
    mockedApi.deleteExportSchedule.mockResolvedValue({ ok: true, deleted: 1 });
    renderComp();
    await waitFor(() => screen.getByText('CSV Backup'));

    const deleteBtns = screen.getAllByTitle('Löschen');
    fireEvent.click(deleteBtns[1]); // second row = CSV Backup

    // Confirm dialog
    await waitFor(() => screen.getByText(/wirklich löschen/i));
    await act(async () => {
      fireEvent.click(screen.getByText('Löschen'));
    });

    await waitFor(() => expect(mockedApi.deleteExportSchedule).toHaveBeenCalledWith(2));
    await waitFor(() => expect(screen.queryByText('CSV Backup')).toBeFalsy());
  });

  it('calls updateExportSchedule when enable/disable toggle clicked', async () => {
    mockedApi.updateExportSchedule.mockResolvedValue({ ...mockSchedules[0], enabled: false });
    renderComp();
    await waitFor(() => screen.getByText('Wöchentlicher Export'));

    const toggleBtns = screen.getAllByTitle(/Aktiv|Inaktiv/);
    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() =>
      expect(mockedApi.updateExportSchedule).toHaveBeenCalledWith(1, expect.objectContaining({ enabled: false }))
    );
  });

  it('calls runExportSchedule on Run Now button click', async () => {
    mockedApi.runExportSchedule.mockResolvedValue({ ok: true, sent_to: 2, smtp_not_configured: false });
    renderComp();
    await waitFor(() => screen.getByText('Wöchentlicher Export'));

    const runBtns = screen.getAllByTitle('Jetzt ausführen');
    await act(async () => {
      fireEvent.click(runBtns[0]);
    });

    await waitFor(() => expect(mockedApi.runExportSchedule).toHaveBeenCalledWith(1));
  });

  it('shows error message when API fails', async () => {
    mockedApi.getExportSchedules.mockRejectedValue(new Error('Verbindungsfehler'));
    renderComp();
    await waitFor(() =>
      expect(screen.getByText(/Verbindungsfehler/i)).toBeTruthy()
    );
  });

  it('email tag input allows adding and removing emails', async () => {
    renderComp();
    await waitFor(() => screen.getByLabelText('Neuen Export-Zeitplan erstellen'));
    fireEvent.click(screen.getByLabelText('Neuen Export-Zeitplan erstellen'));

    const emailInput = screen.getByLabelText('E-Mail-Adresse eingeben');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.keyDown(emailInput, { key: 'Enter' });

    await waitFor(() => screen.getByText('test@example.com'));
    expect(screen.getByText('test@example.com')).toBeTruthy();

    // Remove the tag
    const removeBtn = screen.getByLabelText('E-Mail test@example.com entfernen');
    fireEvent.click(removeBtn);
    await waitFor(() => expect(screen.queryByText('test@example.com')).toBeFalsy());
  });

});
