/**
 * Directive A (Identität): „Mein Kalender" ist bei unverknüpftem Konto KEINE
 * Sackgasse mehr. Planer/Admin (can_link) bekommen eine Auswahl + „Verknüpfen"
 * direkt hier; Leser eine klare Anleitung (Admin/Benutzerverwaltung) — nicht
 * mehr „Benutzername = Nachname".
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn(), dialogProps: { open: false } }),
}));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../api/client', () => ({
  api: {
    getShifts: vi.fn(),
    getMySchedule: vi.fn(),
    getMyWishes: vi.fn(),
    getMyEmployee: vi.fn(),
    getEmployees: vi.fn(),
    linkMyEmployee: vi.fn(),
  },
}));

import { api } from '../api/client';
import MeinKalender from '../pages/MeinKalender';

const notFound = () => Promise.reject({ status: 404 });

function renderPage() {
  return render(
    <BrowserRouter>
      <MeinKalender />
    </BrowserRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.getShifts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  // Unverknüpftes Konto → self-Endpunkte 404 → noEmployee-Zustand
  (api.getMySchedule as ReturnType<typeof vi.fn>).mockImplementation(notFound);
  (api.getMyWishes as ReturnType<typeof vi.fn>).mockImplementation(notFound);
  (api.getEmployees as ReturnType<typeof vi.fn>).mockResolvedValue([
    { ID: 47, NAME: 'Bartel', FIRSTNAME: 'Karsten' },
    { ID: 61, NAME: 'Wolf', FIRSTNAME: 'Bea' },
  ]);
  (api.linkMyEmployee as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true, user_id: 259, employee_id: 47,
  });
});

describe('MeinKalender — unverknüpftes Konto', () => {
  it('Planer (can_link) kann die Zuordnung direkt herstellen', async () => {
    (api.getMyEmployee as ReturnType<typeof vi.fn>).mockResolvedValue({
      employee: null, user_id: 259, can_link: true, suggestion: null,
    });
    renderPage();

    // Linking-UI erscheint (kein Sackgassen-Text)
    const btn = await screen.findByRole('button', { name: /verknüpfen/i });
    expect(btn).toBeTruthy();
    expect(screen.queryByText(/Benutzername = Nachname/i)).toBeNull();

    // Mitarbeiter wählen + verknüpfen
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '47' } });
    fireEvent.click(screen.getByRole('button', { name: /verknüpfen/i }));

    await waitFor(() => {
      expect(api.linkMyEmployee).toHaveBeenCalledWith(47);
    });
    // Nach erfolgreicher Zuordnung wird neu geladen (self-schedule erneut)
    await waitFor(() => {
      expect((api.getMySchedule as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('Leser (kein can_link) bekommt eine klare Anleitung statt Auswahl', async () => {
    (api.getMyEmployee as ReturnType<typeof vi.fn>).mockResolvedValue({
      employee: null, user_id: 259, can_link: false, suggestion: null,
    });
    renderPage();

    await screen.findByText(/Administrator/i);
    expect(screen.queryByRole('button', { name: /verknüpfen/i })).toBeNull();
    // Keine Auswahl, keine „Benutzername = Nachname"-Anleitung mehr
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(/Benutzername = Nachname/i)).toBeNull();
  });
});
