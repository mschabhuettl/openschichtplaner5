/**
 * Regressionstest für das Anlegen eines Schichtwunsches: „Speichern" muss
 * api.createWish mit den Formularwerten (employee_id, date, wish_type, shift_id)
 * aufrufen. Schließt eine Lücke — Schichtwuensche.tsx hatte bisher keinen
 * Komponententest, obwohl es ein echter Self-Service-Schreibpfad ist. Der
 * End-to-End-Pfad ist zusätzlich im Browser belegt (Golden-Copy: POST 200 +
 * per API-GET bestätigte Persistenz).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getShifts: vi.fn(),
    getWishes: vi.fn(),
    createWish: vi.fn(),
    deleteWish: vi.fn(),
  },
}));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn(async () => true),
    dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ devViewRole: 'admin', user: { ID: 9, NAME: 'Admin', role: 'Admin' } }),
}));

import { api } from '../api/client';
import Schichtwuensche from '../pages/Schichtwuensche';

describe('Schichtwünsche — Wunsch anlegen (createWish-Verdrahtung)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEmployees).mockResolvedValue([
      { ID: 65, NAME: 'Anders', FIRSTNAME: 'Kerstin', SHORTNAME: 'KAN', HIDE: false },
    ] as never);
    vi.mocked(api.getShifts).mockResolvedValue([
      { ID: 1, SHORTNAME: 'F', NAME: 'Frühschicht', HIDE: false },
    ] as never);
    vi.mocked(api.getWishes).mockResolvedValue([] as never);
    vi.mocked(api.createWish).mockResolvedValue({
      id: 1, employee_id: 65, date: '2026-07-22', wish_type: 'WUNSCH', shift_id: null, note: '',
    } as never);
  });

  it('„Speichern" ruft api.createWish mit den Formularwerten', async () => {
    render(<Schichtwuensche />);
    await waitFor(() => expect(vi.mocked(api.getEmployees)).toHaveBeenCalled());

    // Formular öffnen
    fireEvent.click(screen.getByRole('button', { name: /Wunsch eintragen/i }));

    // Formular-Mitarbeiter-Select (Label „Mitarbeiter *", NICHT der Filter „Mitarbeiter:")
    const empSelect = screen.getByText('Mitarbeiter *').parentElement!.querySelector('select')!;
    fireEvent.change(empSelect, { target: { value: '65' } });

    // Datum im Formular setzen
    const dateInput = screen.getByText('Datum *').parentElement!.querySelector('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: '2026-07-22' } });

    // Speichern → createWish
    fireEvent.click(screen.getByRole('button', { name: /^Speichern$/ }));

    await waitFor(() =>
      expect(vi.mocked(api.createWish)).toHaveBeenCalledWith(
        expect.objectContaining({
          employee_id: 65,
          date: '2026-07-22',
          wish_type: 'WUNSCH',
          shift_id: null,
        }),
      ),
    );
  });
});
