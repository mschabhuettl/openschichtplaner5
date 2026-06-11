/**
 * Tests for Holidays.tsx — Spec-Semantik von 5HOLID.INTERVAL (Gap V-12):
 * 0 = ganztägig, 1 = halbtags (vormittags), 2 = halbtags (nachmittags),
 * plus "auch in den folgenden 9 Jahren anlegen" (repeat_years).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/context';

vi.mock('../api/client', () => ({
  api: {
    getHolidays: vi.fn(),
    getLeaveTypes: vi.fn(),
    createHoliday: vi.fn(),
    updateHoliday: vi.fn(),
    deleteHoliday: vi.fn(),
    bulkCreateAbsence: vi.fn(),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { ID: 1, NAME: 'Admin', ADMIN: true, role: 'Admin' },
    isDevMode: false,
    canAdmin: true,
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
import Holidays from '../pages/Holidays';

const mockHolidays = [
  { ID: 1, DATE: '2026-01-01', NAME: 'Neujahr', INTERVAL: 0 },
  { ID: 2, DATE: '2026-12-24', NAME: 'Heiligabend', INTERVAL: 1 },
  { ID: 3, DATE: '2026-12-31', NAME: 'Silvester', INTERVAL: 2 },
];

function renderHolidays() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Holidays />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('Holidays page — halbe Feiertage (V-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sp5_language', 'de');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getHolidays).mockResolvedValue(mockHolidays as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getLeaveTypes).mockResolvedValue([] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.createHoliday).mockResolvedValue({ ok: true } as any);
  });

  it('zeigt INTERVAL nach Spec-Semantik als Dauer an (ganz/halbtags)', async () => {
    renderHolidays();
    await waitFor(() => expect(screen.getByText('Neujahr')).toBeTruthy());
    expect(screen.getByText('Halbtags (vormittags)')).toBeTruthy();
    expect(screen.getByText('Halbtags (nachmittags)')).toBeTruthy();
    expect(screen.getAllByText('Ganztägig').length).toBeGreaterThan(0);
    // UNSICHER-Hinweis als Tooltip auf den Halbtags-Badges
    expect(
      (screen.getByText('Halbtags (vormittags)') as HTMLElement).getAttribute('title')
    ).toMatch(/UNSICHER/);
  });

  it('Anlegen mit halbtags (nachmittags) und 9 Folgejahren sendet INTERVAL=2 + repeat_years', async () => {
    renderHolidays();
    await waitFor(() => expect(screen.getByText('Neujahr')).toBeTruthy());

    fireEvent.click(screen.getByText('+ Neu'));
    // Name eintragen (einziges Textfeld im Modal)
    const nameInput = screen.getByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'Testtag' } });

    // Dauer-Select: comboboxes[0] = Jahr-Auswahl im Header, [1] = Dauer
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: '2' } });

    fireEvent.click(screen.getByLabelText('Auch in den folgenden 9 Jahren anlegen'));
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => expect(api.createHoliday).toHaveBeenCalledTimes(1));
    expect(api.createHoliday).toHaveBeenCalledWith(expect.objectContaining({
      NAME: 'Testtag',
      INTERVAL: 2,
      repeat_years: 1,
    }));
  });

  it('Anlegen ohne Wiederholung sendet kein repeat_years', async () => {
    renderHolidays();
    await waitFor(() => expect(screen.getByText('Neujahr')).toBeTruthy());

    fireEvent.click(screen.getByText('+ Neu'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Einmalig' } });
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => expect(api.createHoliday).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(api.createHoliday).mock.calls[0][0];
    expect(payload.INTERVAL).toBe(0);
    expect('repeat_years' in payload).toBe(false);
  });

  it('Österreich-Import legt alle Feiertage ganztägig an (INTERVAL=0)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getHolidays).mockResolvedValue([] as any);
    renderHolidays();
    await waitFor(() => expect(screen.getByText(/Österreich importieren/)).toBeTruthy());

    fireEvent.click(screen.getByText(/Österreich importieren/));
    await waitFor(() => expect(api.createHoliday).toHaveBeenCalledTimes(13));
    for (const call of vi.mocked(api.createHoliday).mock.calls) {
      expect(call[0].INTERVAL).toBe(0);
    }
  });
});
