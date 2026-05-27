/**
 * Tests for OrmMirror (Admin ORM-Spiegel page)
 * — covers rendering counts, loading/error/empty states, and sync + refetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  api: {
    getOrmMirrorStatus: vi.fn(),
    syncOrmMirror: vi.fn(),
  },
}));

const showToast = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast }),
}));

import { api } from '../api/client';
import OrmMirror from '../pages/OrmMirror';

const mockedApi = api as unknown as {
  getOrmMirrorStatus: ReturnType<typeof vi.fn>;
  syncOrmMirror: ReturnType<typeof vi.fn>;
};

const renderComp = () => render(<MemoryRouter><OrmMirror /></MemoryRouter>);

// ── Fixtures ────────────────────────────────────────────────────────────────────
const mockStatus = {
  mirror_db_exists: true,
  table_count: 3,
  total_rows: 150,
  counts: { employees: 100, groups: 20, shifts: 30 },
};

const mockSyncResult = {
  ok: true,
  synced: { employees: 100, groups: 20, shifts: 30 },
};

beforeEach(() => {
  mockedApi.getOrmMirrorStatus.mockResolvedValue(mockStatus);
  mockedApi.syncOrmMirror.mockResolvedValue(mockSyncResult);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────────
describe('OrmMirror', () => {
  it('renders heading', async () => {
    renderComp();
    await waitFor(() => screen.getByText('ORM-Spiegel'));
    expect(screen.getByText('ORM-Spiegel')).toBeTruthy();
  });

  it('shows loading indicator initially', () => {
    mockedApi.getOrmMirrorStatus.mockReturnValue(new Promise(() => {})); // never resolves
    renderComp();
    expect(screen.getByText(/wird geladen/i)).toBeTruthy();
  });

  it('renders per-table counts after load', async () => {
    renderComp();
    await waitFor(() => screen.getByText('employees'));
    expect(screen.getByText('employees')).toBeTruthy();
    expect(screen.getByText('groups')).toBeTruthy();
    expect(screen.getByText('shifts')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('renders total_rows and table count stat cards', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Zeilen gesamt'));
    expect(screen.getByText('Zeilen gesamt')).toBeTruthy();
    expect(screen.getByText('150')).toBeTruthy();
    expect(screen.getByText('Tabellen')).toBeTruthy();
  });

  it('shows mirror-db-exists indicator as present', async () => {
    renderComp();
    await waitFor(() => screen.getByText('Vorhanden'));
    expect(screen.getByText('Vorhanden')).toBeTruthy();
  });

  it('shows mirror-db indicator as missing when not present', async () => {
    mockedApi.getOrmMirrorStatus.mockResolvedValue({ ...mockStatus, mirror_db_exists: false });
    renderComp();
    await waitFor(() => screen.getByText('Fehlt'));
    expect(screen.getByText('Fehlt')).toBeTruthy();
  });

  it('shows error state when status fetch fails', async () => {
    mockedApi.getOrmMirrorStatus.mockRejectedValue(new Error('Netzwerkfehler'));
    renderComp();
    await waitFor(() => expect(screen.getByText(/Netzwerkfehler/i)).toBeTruthy());
  });

  it('triggers sync POST and refetches status when sync button clicked', async () => {
    renderComp();
    await waitFor(() => screen.getByText('employees'));
    expect(mockedApi.getOrmMirrorStatus).toHaveBeenCalledTimes(1);

    const syncBtn = screen.getByRole('button', { name: /synchronisieren/i });
    fireEvent.click(syncBtn);

    await waitFor(() => expect(mockedApi.syncOrmMirror).toHaveBeenCalledTimes(1));
    // status is refetched after sync
    await waitFor(() => expect(mockedApi.getOrmMirrorStatus).toHaveBeenCalledTimes(2));
    // success toast surfaced
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/synchronisiert/i), 'success');
  });

  it('shows error toast when sync fails', async () => {
    mockedApi.syncOrmMirror.mockRejectedValue(new Error('Sync kaputt'));
    renderComp();
    await waitFor(() => screen.getByText('employees'));
    const syncBtn = screen.getByRole('button', { name: /synchronisieren/i });
    fireEvent.click(syncBtn);
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Sync kaputt', 'error'));
  });
});
