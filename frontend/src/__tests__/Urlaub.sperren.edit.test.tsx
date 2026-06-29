/**
 * Urlaub → Urlaubssperren: bestehende Sperre bearbeiten
 * (P-VOLLERFASSUNG GruppenErfassen.11). Der Sperren-Tab bietet je Zeile eine
 * Bearbeiten-Aktion, die das Formular vorausgefüllt öffnet und per PUT
 * /api/v1/holiday-bans/{id} speichert (SperrenTab nutzt rohes fetch).
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
  },
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
import Urlaub from '../pages/Urlaub';

const authMock = vi.mocked(useAuth);

const BAN = {
  id: 5,
  group_id: 2,
  group_name: 'Team A',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
  restrict: 1,
  reason: 'Sommersperre',
};

let fetchCalls: Array<{ url: string; method: string; body: unknown }>;

describe('Urlaub — Urlaubssperre bearbeiten (GruppenErfassen.11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sp5_language', 'de');
    sessionStorage.clear();
    authMock.mockReturnValue({
      user: { ID: 9, NAME: 'P', role: 'Planer', WABSENCES: true },
      isDevMode: false,
      devViewRole: 'admin',
      canWrite: true,
      canWriteDuties: true,
      canWriteAbsences: true,
      canAdmin: false,
      can: () => true,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(api.getEmployees).mockResolvedValue([] as never);
    vi.mocked(api.getLeaveTypes).mockResolvedValue([] as never);
    vi.mocked(api.getGroups).mockResolvedValue([{ ID: 2, NAME: 'Team A' }] as never);
    vi.mocked(api.getAbsences).mockResolvedValue([] as never);

    fetchCalls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      const body = opts?.body ? JSON.parse(opts.body as string) : undefined;
      fetchCalls.push({ url, method, body });
      if (url.includes('/holiday-bans') && method === 'GET') {
        return { ok: true, json: async () => [BAN] } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('edit prefills the form and PUTs the changed reason', async () => {
    render(<LanguageProvider><Urlaub /></LanguageProvider>);

    // Navigate to the Urlaubssperren tab.
    fireEvent.click(await screen.findByRole('button', { name: /Urlaubssperren/ }));

    // The ban row renders after the GET; open its edit form.
    const editBtn = await screen.findByTitle('Urlaubssperre bearbeiten');
    fireEvent.click(editBtn);

    // Form switches to edit mode with the existing reason prefilled.
    expect(await screen.findByText('Urlaubssperre bearbeiten')).toBeTruthy();
    const reasonInput = screen.getByPlaceholderText(/Messewoche/) as HTMLInputElement;
    expect(reasonInput.value).toBe('Sommersperre');

    fireEvent.change(reasonInput, { target: { value: 'verlängert' } });
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      const put = fetchCalls.find(c => c.method === 'PUT');
      expect(put).toBeTruthy();
      expect(put!.url).toContain('/holiday-bans/5');
      expect((put!.body as { reason: string }).reason).toBe('verlängert');
      expect((put!.body as { end_date: string }).end_date).toBe('2026-07-31');
    });
    // No POST (create) on the edit path.
    expect(fetchCalls.some(c => c.method === 'POST' && c.url.endsWith('/holiday-bans'))).toBe(false);
  });
});
