/**
 * G-1 (Spec 9.5.3): Urlaub — Erfassen/Genehmigen nur mit WABSENCES.
 * Gating der Aktions-Buttons in AntraegeTab und AbwesenheitenTab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../i18n';

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getLeaveTypes: vi.fn(),
    getGroups: vi.fn(),
    getAbsences: vi.fn(),
    downloadVacationRequest: vi.fn(),
  },
}));

vi.mock('../contexts/SSEContext', () => ({
  useSSEContext: () => ({ status: 'disconnected', subscribe: vi.fn(() => vi.fn()) }),
  useSSERefresh: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../contexts/AuthContext';

import { api } from '../api/client';
import Urlaub from '../pages/Urlaub';

const authMock = vi.mocked(useAuth);

function setAuth(can: (perm: string) => boolean) {
  authMock.mockReturnValue({
    user: { ID: 9, NAME: 'P', role: 'Planer', WABSENCES: true },
    isDevMode: false,
    devViewRole: 'admin',
    canWrite: true,
    canWriteDuties: true,
    canWriteAbsences: true,
    canAdmin: false,
    can,
  } as unknown as ReturnType<typeof useAuth>);
}

const YEAR = new Date().getFullYear();

function renderUrlaub() {
  return render(<LanguageProvider><Urlaub /></LanguageProvider>);
}

describe('Urlaub — WABSENCES-Gating (G-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sp5_language', 'de');
    sessionStorage.clear();
    vi.mocked(api.getEmployees).mockResolvedValue([
      { ID: 1, NAME: 'Muster', FIRSTNAME: 'Max', NUMBER: '001' },
    ] as never);
    vi.mocked(api.getLeaveTypes).mockResolvedValue([
      { ID: 10, NAME: 'Urlaub', SHORTNAME: 'U' },
    ] as never);
    vi.mocked(api.getGroups).mockResolvedValue([] as never);
    vi.mocked(api.getAbsences).mockResolvedValue([
      { id: 100, employee_id: 1, date: `${YEAR}-07-01`, leave_type_id: 10 },
    ] as never);
    // AntraegeTab lädt den Status über fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mit wabsences: Genehmigen/Ablehnen-Buttons werden angeboten', async () => {
    setAuth(() => true);
    renderUrlaub();
    await waitFor(() => {
      expect(screen.getByTitle('Genehmigen')).toBeTruthy();
    });
    expect(screen.getByTitle('Ablehnen')).toBeTruthy();
  });

  // P2-6: der „Urlaubsantrag" (druckbares Original-Formular) ist je Zeile abrufbar,
  // unabhängig von der Genehmigungs-Berechtigung; Klick lädt das PDF für MA/Datum/Art.
  it('Urlaubsantrag-Druckknopf ruft downloadVacationRequest mit MA/Datum/Art', async () => {
    setAuth(() => true);
    vi.mocked(api.downloadVacationRequest).mockResolvedValue(undefined);
    renderUrlaub();
    const btn = await screen.findByTitle(/Urlaubsantrag als PDF/);
    fireEvent.click(btn);
    await waitFor(() =>
      expect(api.downloadVacationRequest).toHaveBeenCalledWith(1, `${YEAR}-07-01`, `${YEAR}-07-01`, 10)
    );
  });

  it('Urlaubsantrag-Druckknopf auch ohne wabsences vorhanden', async () => {
    setAuth((perm) => perm !== 'wabsences');
    renderUrlaub();
    expect(await screen.findByTitle(/Urlaubsantrag als PDF/)).toBeTruthy();
  });

  it('ohne wabsences: keine Genehmigen-Aktion, stattdessen Hinweis', async () => {
    setAuth((perm) => perm !== 'wabsences');
    renderUrlaub();
    await waitFor(() => {
      expect(screen.getByTitle(/WABSENCES/)).toBeTruthy();
    });
    expect(screen.queryByTitle('Genehmigen')).toBeNull();
    expect(screen.queryByTitle('Ablehnen')).toBeNull();
  });

  it('mit wabsences: direkte Erfassung „＋ Abwesenheit" im Abwesenheiten-Tab', async () => {
    setAuth(() => true);
    renderUrlaub();
    fireEvent.click(await screen.findByRole('button', { name: /Abwesenheiten/ }));
    await waitFor(() => {
      expect(screen.getByText('Abwesenheit', { selector: 'span' })).toBeTruthy();
    });
  });

  it('ohne wabsences: keine direkte Erfassung im Abwesenheiten-Tab', async () => {
    setAuth((perm) => perm !== 'wabsences');
    renderUrlaub();
    fireEvent.click(await screen.findByRole('button', { name: /Abwesenheiten/ }));
    await waitFor(() => {
      // Tab ist geladen (Ansichts-Umschalter sichtbar) …
      expect(screen.getByText(/Jahresübersicht/)).toBeTruthy();
    });
    // … aber der ＋-Abwesenheit-Button fehlt
    expect(screen.queryByText('Abwesenheit', { selector: 'span' })).toBeNull();
  });
});
