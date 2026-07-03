/**
 * Zusatzfeld-Bezeichnungen (Original: Anpassen-Dialog „Bezeichnungen
 * Stammdatenfelder"; Labels sind maschinenlokal → hier App-Setting):
 * das MA-Formular zeigt die konfigurierten Labels statt fester Texte.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn(async () => true),
    dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: { display: { zusatzfeldLabel1: 'Führerscheinklasse', zusatzfeldLabel2: 'Spind-Nr.' } },
    update: vi.fn(),
  }),
}));

import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import Employees from '../pages/Employees';

describe('MA-Formular — konfigurierbare Zusatzfeld-Labels', () => {
  beforeEach(() => {
    localStorage.setItem('sp5_language', 'de');
    vi.mocked(useAuth).mockReturnValue({
      user: { ID: 9, NAME: 'U', role: 'Admin' },
      isDevMode: false,
      devViewRole: 'admin',
      canAdmin: true,
      canWrite: true,
      canWriteOvertimes: true,
      can: () => true,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(api.getEmployees).mockResolvedValue([] as never);
    vi.mocked(api.getGroups).mockResolvedValue([] as never);
    vi.mocked(api.getGroupAssignments).mockResolvedValue([] as never);
    vi.mocked(api.getShifts).mockResolvedValue([] as never);
    vi.mocked(api.getRestrictions).mockResolvedValue([] as never);
  });

  it('zeigt die konfigurierten Bezeichnungen im Formular', async () => {
    render(
      <LanguageProvider><MemoryRouter><Employees /></MemoryRouter></LanguageProvider>
    );
    fireEvent.click(await screen.findByText('+ Neu'));
    // Zusatzfelder liegen im Person-Tab des Formulars
    fireEvent.click(await screen.findByText(/Person$/));
    expect(await screen.findByText('Führerscheinklasse')).toBeTruthy();
    expect(screen.getByText('Spind-Nr.')).toBeTruthy();
  });
});
