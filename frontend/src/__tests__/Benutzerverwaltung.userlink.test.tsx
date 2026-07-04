/**
 * Item (26): Admin kann in der Benutzerverwaltung den „persönlichen Mitarbeiter"
 * eines Kontos setzen (macht die Mein-Kalender-Anleitung UI-actionable).
 * Prüft die Verdrahtung: das Rechte-Panel zeigt den Abschnitt, und „Zuordnen"
 * ruft api.linkUserEmployee mit der Auswahl auf.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
  api: {
    getUsers: vi.fn(),
    getEmployees: vi.fn(),
    getGroups: vi.fn(async () => []),
    getEmployeeAccess: vi.fn(async () => []),
    getGroupAccess: vi.fn(async () => []),
    getUserEmployee: vi.fn(),
    linkUserEmployee: vi.fn(async () => ({ ok: true, user_id: 7, employee_id: 61 })),
    unlinkUserEmployee: vi.fn(async () => ({ ok: true, removed: true })),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ canAdmin: true, user: { ID: 251, NAME: 'Admin' }, startImpersonation: vi.fn() }),
}));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn(async () => true), dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() } }),
}));

import { api } from '../api/client';
import Benutzerverwaltung from '../pages/Benutzerverwaltung';

const chef = {
  ID: 7, NAME: 'chef', DESCRIP: '', ADMIN: false, RIGHTS: 1, HIDE: false, role: 'Leser',
  WDUTIES: false, WABSENCES: false, WOVERTIMES: false, WNOTES: false, WDEVIATION: false,
  WCYCLEASS: false, WSWAPONLY: false, WPAST: false, ADDEMPL: false, BACKUP: false, SHOWABS: 0,
};
const employees = [
  { ID: 57, NAME: 'Schmidt', FIRSTNAME: 'Anna' },
  { ID: 61, NAME: 'Wolf', FIRSTNAME: 'Bea' },
];

beforeEach(() => {
  vi.clearAllMocks();
  (api.getEmployees as ReturnType<typeof vi.fn>).mockResolvedValue(employees);
  (api.getUserEmployee as ReturnType<typeof vi.fn>).mockResolvedValue({ user_id: 7, employee: null });
  // Die Benutzerliste lädt per rohem fetch (nicht über api.getUsers).
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).endsWith('/api/v1/users')) {
      return { ok: true, json: async () => [chef] } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }));
});

describe('Benutzerverwaltung — persönlicher Mitarbeiter (Admin-Zuordnung)', () => {
  it('setzt die Zuordnung über das Rechte-Panel', async () => {
    render(<MemoryRouter><Benutzerverwaltung /></MemoryRouter>);
    await screen.findByText(/chef/);

    fireEvent.click(screen.getByRole('button', { name: /Rechte/ }));
    await screen.findByText(/Persönlicher Mitarbeiter/);

    // Kein Link vorhanden → Auswahl + „Zuordnen" sichtbar
    const zuordnen = screen.getByRole('button', { name: /^Zuordnen$/ });
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '61' } });
    fireEvent.click(zuordnen);

    await waitFor(() => expect(api.linkUserEmployee).toHaveBeenCalledWith(7, 61));
  });
});
