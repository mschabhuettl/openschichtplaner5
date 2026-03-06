/**
 * Page tests for Employees.tsx
 * Uses real i18n/LanguageProvider to avoid translation mock complexity.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/context';

// ── API mock ──────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getGroups: vi.fn(),
    getGroupAssignments: vi.fn(),
    getShifts: vi.fn(),
    getRestrictions: vi.fn(),
    bulkEmployeeAction: vi.fn(),
    getEmployeePhotoUrl: vi.fn(() => ''),
    uploadEmployeePhoto: vi.fn(),
    updateEmployee: vi.fn(),
    createEmployee: vi.fn(),
    deleteEmployee: vi.fn(),
  },
  invalidateStammdatenCache: vi.fn(),
}));

// ── Auth mock ─────────────────────────────────────────────────
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { ID: 1, NAME: 'Admin', ADMIN: true, role: 'Admin' },
    isDevMode: false,
    canAdmin: true,
    canWrite: true,
    canWriteOvertimes: true,
  }),
}));

// ── Toast / Confirm mocks ─────────────────────────────────────
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn(async () => true),
    dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}));

import { api } from '../api/client';
import Employees from '../pages/Employees';

const mockEmployees = [
  {
    ID: 1, NAME: 'Mustermann', FIRSTNAME: 'Max', SHORTNAME: 'MM',
    NUMBER: '001', HRSDAY: 8, HRSWEEK: 40,
    WORKDAYS_LIST: [1, 1, 1, 1, 1, 0, 0], EMPSTART: '2020-01-01', HIDE: false,
  },
  {
    ID: 2, NAME: 'Schmidt', FIRSTNAME: 'Anna', SHORTNAME: 'AS',
    NUMBER: '002', HRSDAY: 6, HRSWEEK: 30,
    WORKDAYS_LIST: [1, 1, 1, 0, 0, 0, 0], EMPSTART: '2021-06-15', HIDE: false,
  },
];

function renderEmployees() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Employees />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('Employees page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force German locale so translations are predictable
    localStorage.setItem('sp5_language', 'de');
    // Clear session storage to avoid search filter bleed between tests
    sessionStorage.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getEmployees).mockResolvedValue(mockEmployees as any);
    vi.mocked(api.getGroups).mockResolvedValue([]);
    vi.mocked(api.getGroupAssignments).mockResolvedValue([]);
    vi.mocked(api.getShifts).mockResolvedValue([]);
  });

  it('renders page heading with Mitarbeiter', async () => {
    renderEmployees();
    await waitFor(() => {
      expect(screen.getByText(/Mitarbeiter/)).toBeTruthy();
    });
  });

  it('renders employee rows after data loads', async () => {
    renderEmployees();
    await waitFor(() => {
      expect(screen.getByText('Mustermann')).toBeTruthy();
      expect(screen.getByText('Schmidt')).toBeTruthy();
    });
  });

  it('renders search input', async () => {
    renderEmployees();
    // Wait for load first, then search input is present
    await waitFor(() => screen.getByText('Mustermann'));
    expect(screen.getByPlaceholderText('Suchen…')).toBeTruthy();
  });

  it('filters employees by search input', async () => {
    renderEmployees();
    await waitFor(() => screen.getByText('Mustermann'));

    const searchInput = screen.getByPlaceholderText('Suchen…');
    fireEvent.change(searchInput, { target: { value: 'Schmidt' } });

    await waitFor(() => {
      expect(screen.queryByText('Mustermann')).toBeNull();
      expect(screen.getByText('Schmidt')).toBeTruthy();
    });
  });

  it('filters employees to empty list when search has no match', async () => {
    renderEmployees();
    await waitFor(() => screen.getByText('Mustermann'));

    const searchInput = screen.getByPlaceholderText('Suchen…');
    fireEvent.change(searchInput, { target: { value: 'zzznobody' } });

    await waitFor(() => {
      expect(screen.queryByText('Mustermann')).toBeNull();
      expect(screen.queryByText('Schmidt')).toBeNull();
    }, { timeout: 3000 });
  });
});
