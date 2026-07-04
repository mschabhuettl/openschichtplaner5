/**
 * Regression (im Browser-Re-Verify gefunden): die MA-Liste zeigte hinter JEDEM
 * Nachnamen eine „0". Ursache: `{emp.HIDE && <span>Inaktiv</span>}` — HIDE ist die
 * Ganzzahl 0, und React rendert `0 && X` als literale „0". Fix: `{!!emp.HIDE && …}`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n';

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getGroups: vi.fn(async () => []),
    getGroupAssignments: vi.fn(async () => []),
    getShifts: vi.fn(async () => []),
    getRestrictions: vi.fn(async () => []),
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
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn(async () => true),
    dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useAppSettings', () => ({
  useAppSettings: () => ({ settings: {}, update: vi.fn() }),
}));

import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import Employees from '../pages/Employees';

const emp = (over: Record<string, unknown>) => ({
  ID: 1, NAME: 'Musteractive', FIRSTNAME: 'Max', SHORTNAME: 'MMU', NUMBER: '10',
  HIDE: 0, HRSDAY: 7.7, WORKDAYS_LIST: [true, true, true, true, true, false, false],
  EMPSTART: null, ...over,
});

describe('MA-Liste — kein stray „0" hinter dem Nachnamen (HIDE=0)', () => {
  beforeEach(() => {
    localStorage.setItem('sp5_language', 'de');
    vi.mocked(useAuth).mockReturnValue({
      user: { ID: 9, NAME: 'U', role: 'Admin' }, isDevMode: false, devViewRole: 'admin',
      canAdmin: true, canWrite: true, canWriteOvertimes: true, can: () => true,
    } as unknown as ReturnType<typeof useAuth>);
    (api.getEmployees as ReturnType<typeof vi.fn>).mockResolvedValue([
      emp({ ID: 1, NAME: 'Musteractive', SHORTNAME: 'MMU' }),
    ]);
  });

  it('rendert den Nachnamen ohne angehängte 0', async () => {
    render(<LanguageProvider><MemoryRouter><Employees /></MemoryRouter></LanguageProvider>);
    // Name erscheint exakt (nicht „Musteractive0")
    expect(await screen.findByText('Musteractive')).toBeTruthy();
    expect(screen.queryByText('Musteractive0')).toBeNull();
  });
});
