/**
 * G-1 (Spec 9.5.3 Nr. 2.1): „Neuer Mitarbeiter" nur mit ADDEMPL-Opt-in
 * oder Admin-Rolle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n';

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

vi.mock('../contexts/SSEContext', () => ({
  useSSEContext: () => ({ status: 'disconnected', subscribe: vi.fn(() => vi.fn()) }),
  useSSERefresh: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn(async () => true),
    dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../contexts/AuthContext';

import { api } from '../api/client';
import Employees from '../pages/Employees';

const authMock = vi.mocked(useAuth);

function setAuth(opts: { role: string; canAdmin: boolean; can: (perm: string) => boolean }) {
  authMock.mockReturnValue({
    user: { ID: 9, NAME: 'U', role: opts.role },
    isDevMode: false,
    devViewRole: 'dev',
    canAdmin: opts.canAdmin,
    canWrite: true,
    canWriteOvertimes: true,
    can: opts.can,
  } as unknown as ReturnType<typeof useAuth>);
}

function renderEmployees() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Employees />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('Employees — ADDEMPL-Gating (G-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sp5_language', 'de');
    sessionStorage.clear();
    vi.mocked(api.getEmployees).mockResolvedValue([
      {
        ID: 1, NAME: 'Mustermann', FIRSTNAME: 'Max', SHORTNAME: 'MM',
        NUMBER: '001', HRSDAY: 8, HRSWEEK: 40,
        WORKDAYS_LIST: [1, 1, 1, 1, 1, 0, 0], EMPSTART: '2020-01-01', HIDE: false,
      },
    ] as never);
    vi.mocked(api.getGroups).mockResolvedValue([] as never);
    vi.mocked(api.getGroupAssignments).mockResolvedValue([] as never);
    vi.mocked(api.getShifts).mockResolvedValue([] as never);
  });

  it('Admin sieht den Anlegen-Button (unabhängig von addempl)', async () => {
    setAuth({ role: 'Admin', canAdmin: true, can: () => false });
    renderEmployees();
    await waitFor(() => {
      expect(screen.getByText('+ Neu')).toBeTruthy();
    });
  });

  it('Planer mit addempl-Opt-in sieht den Anlegen-Button', async () => {
    setAuth({ role: 'Planer', canAdmin: false, can: (p) => p === 'addempl' });
    renderEmployees();
    await waitFor(() => {
      expect(screen.getByText('+ Neu')).toBeTruthy();
    });
  });

  it('Planer ohne addempl sieht den Anlegen-Button nicht', async () => {
    setAuth({ role: 'Planer', canAdmin: false, can: (p) => p !== 'addempl' });
    renderEmployees();
    await waitFor(() => {
      expect(screen.getByText(/Mustermann/)).toBeTruthy();
    });
    expect(screen.queryByText('+ Neu')).toBeNull();
  });

  it('Leser sieht den Anlegen-Button nicht (auch mit addempl)', async () => {
    setAuth({ role: 'Leser', canAdmin: false, can: () => true });
    renderEmployees();
    await waitFor(() => {
      expect(screen.getByText(/Mustermann/)).toBeTruthy();
    });
    expect(screen.queryByText('+ Neu')).toBeNull();
  });
});
