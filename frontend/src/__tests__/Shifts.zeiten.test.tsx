/**
 * Dialog-Tests für das Spec-Zeitenmodell der Schichtarten (V-10):
 * 8 Tagestypen (Mo..So + Ft), bis zu 3 Zeiträume, Auto-Berechnung, NOEXTRA.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/context';

vi.mock('../api/client', () => ({
  api: {
    getShifts: vi.fn(),
    createShift: vi.fn(),
    updateShift: vi.fn(),
    deleteShift: vi.fn(),
  },
  invalidateStammdatenCache: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { ID: 1, NAME: 'Admin', ADMIN: true, role: 'Admin' },
    isDevMode: false,
    canAdmin: true,
    canWrite: true,
  }),
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

import { api } from '../api/client';
import Shifts from '../pages/Shifts';

const mockShifts = [
  {
    ID: 1, NAME: 'Frühschicht', SHORTNAME: 'F', DURATION0: 8, HIDE: false,
    STARTEND0: '06:00-14:00', STARTEND7: '', NOEXTRA: 0,
    COLORBK_HEX: '#FFFFFF', TIMES_BY_WEEKDAY: {},
  },
];

function renderShifts() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Shifts />
      </MemoryRouter>
    </LanguageProvider>
  );
}

async function openCreateModal() {
  renderShifts();
  await waitFor(() => expect(screen.getAllByText('Frühschicht').length).toBeGreaterThan(0));
  fireEvent.click(screen.getByText('+ Neu'));
  await screen.findByText('Neue Schichtart');
}

describe('Shifts Zeiten-Dialog (V-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sp5_language', 'de');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getShifts).mockResolvedValue(mockShifts as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.createShift).mockResolvedValue({ ok: true } as any);
  });

  it('zeigt 8 Tagestypen inklusive Ft (Feiertag)', async () => {
    await openCreateModal();
    for (const day of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So', 'Ft']) {
      expect(screen.getByLabelText(`Zeiträume ${day}`)).toBeTruthy();
      expect(screen.getByLabelText(`Arbeitszeit ${day}`)).toBeTruthy();
    }
  });

  it('lehnt mehr als drei Zeiträume je Tagestyp ab', async () => {
    await openCreateModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Kürzel'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Zeiträume Mo'), {
      target: { value: '06:00-08:00 09:00-10:00 11:00-12:00 13:00-14:00' },
    });
    fireEvent.click(screen.getByText('Speichern'));
    await screen.findByText(/Maximal drei Zeiträume/);
    expect(api.createShift).not.toHaveBeenCalled();
  });

  it('lehnt ungültige Uhrzeiten ab', async () => {
    await openCreateModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Kürzel'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Zeiträume Ft'), { target: { value: '25:00-26:00' } });
    fireEvent.click(screen.getByText('Speichern'));
    await screen.findByText(/Ft: Ungültige Uhrzeit/);
    expect(api.createShift).not.toHaveBeenCalled();
  });

  it('berechnet die Arbeitszeit per 🧮 (Tageswechsel 22:00-06:00 → 8h)', async () => {
    await openCreateModal();
    fireEvent.change(screen.getByLabelText('Zeiträume Mo'), { target: { value: '22:00-06:00' } });
    fireEvent.click(screen.getByLabelText('Arbeitszeit Mo berechnen'));
    expect((screen.getByLabelText('Arbeitszeit Mo') as HTMLInputElement).value).toBe('8');
  });

  it('sendet STARTEND0..7/DURATION0..7 und NOEXTRA an die API', async () => {
    await openCreateModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Nacht' } });
    fireEvent.change(screen.getByLabelText('Kürzel'), { target: { value: 'N' } });
    fireEvent.change(screen.getByLabelText('Zeiträume Mo'), { target: { value: '06:00-10:00 14:00-18:00' } });
    fireEvent.change(screen.getByLabelText('Arbeitszeit Mo'), { target: { value: '7.5' } });
    fireEvent.change(screen.getByLabelText('Zeiträume Ft'), { target: { value: '08:00-12:00' } });
    fireEvent.change(screen.getByLabelText('Arbeitszeit Ft'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Keine Arbeitszeitzuschläge berechnen'));
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => expect(api.createShift).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(api.createShift).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.STARTEND0).toBe('06:00-10:00 14:00-18:00');
    expect(payload.DURATION0).toBe(7.5);
    expect(payload.STARTEND7).toBe('08:00-12:00');
    expect(payload.DURATION7).toBe(4);
    expect(payload.STARTEND3).toBe('');
    expect(payload.DURATION3).toBe(0);
    expect(payload.NOEXTRA).toBe(true);
  });
});
