/**
 * Lücke #1 (BenutzerErfassen.24): granulare Schreibrechte im Benutzer-UI.
 * Prüft die Verdrahtung: das Bearbeiten-Modal übernimmt die aktuellen 5USER-
 * Flags in die Checkboxen, und Speichern schickt sie als `permissions`-Objekt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(async () => []),
    getGroups: vi.fn(async () => []),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ canAdmin: true, user: { ID: 251, NAME: 'Admin' }, startImpersonation: vi.fn() }),
}));

vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn(async () => true), dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() } }),
}));

import Benutzerverwaltung from '../pages/Benutzerverwaltung';

const planer = {
  ID: 7, NAME: 'P. Lanner', DESCRIP: '', ADMIN: false, RIGHTS: 1, HIDE: false,
  role: 'Planer',
  WDUTIES: true, WABSENCES: true, WOVERTIMES: true, WNOTES: true, WDEVIATION: true,
  WCYCLEASS: true, WSWAPONLY: false, WPAST: false, ADDEMPL: false, BACKUP: false,
  SHOWABS: 0,
};

let putBody: Record<string, unknown> | null;

beforeEach(() => {
  vi.clearAllMocks();
  putBody = null;
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: RequestInit) => {
    if (String(url).endsWith('/api/v1/users') && (!opts || opts.method === undefined)) {
      return { ok: true, json: async () => [planer] } as Response;
    }
    if (opts?.method === 'PUT') {
      putBody = JSON.parse(String(opts.body));
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }));
});

function renderPage() {
  return render(<MemoryRouter><Benutzerverwaltung /></MemoryRouter>);
}

describe('Benutzerverwaltung — granulare Schreibrechte', () => {
  it('übernimmt aktuelle Flags ins Modal und sendet sie beim Speichern', async () => {
    renderPage();
    await screen.findByText(/Lanner/);

    fireEvent.click(screen.getByRole('button', { name: /Bearbeiten/ }));
    await screen.findByText(/Benutzer bearbeiten/);

    // Seeding: WPAST ist aus, WDUTIES ist an
    const wpast = screen.getByLabelText('Vergangenheit ändern') as HTMLInputElement;
    const wduties = screen.getByLabelText('Dienste eintragen/ändern') as HTMLInputElement;
    expect(wpast.checked).toBe(false);
    expect(wduties.checked).toBe(true);

    // WPAST einschalten und speichern
    fireEvent.click(wpast);
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => expect(putBody).not.toBeNull());
    const perms = putBody!.permissions as Record<string, boolean>;
    expect(perms.WPAST).toBe(true);
    expect(perms.WDUTIES).toBe(true);
    expect(perms.WSWAPONLY).toBe(false);
  });
});
