/**
 * Page tests for LeaveTypes.tsx — Anrechnungs-Konfiguration (Gap V-4, Spec 5.2/5.3):
 * CHARGETYP/CHARGEHRS, ENTITLED/STDENTIT, CARRYFWD, COUNTALL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: {
    getLeaveTypes: vi.fn(),
    createLeaveType: vi.fn(),
    updateLeaveType: vi.fn(),
    deleteLeaveType: vi.fn(),
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
import LeaveTypes from '../pages/LeaveTypes';

const mockLeaveTypes = [
  {
    ID: 1, NAME: 'Urlaub', SHORTNAME: 'U', POSITION: 1,
    COLORBK_HEX: '#ffffff', COLORBAR_HEX: '#000000', COLORBK_LIGHT: true,
    ENTITLED: true, STDENTIT: 25, HIDE: false,
    CHARGETYP: 2, CHARGEHRS: 7.7, CARRYFWD: 1, COUNTALL: 1,
  },
];

describe('LeaveTypes page — Anrechnungs-Konfiguration (V-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getLeaveTypes).mockResolvedValue(mockLeaveTypes as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.createLeaveType).mockResolvedValue({ ok: true } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.updateLeaveType).mockResolvedValue({ ok: true } as any);
  });

  it('create dialog shows CHARGETYP options; Stundenfeld nur bei Typ 2', async () => {
    render(<LeaveTypes />);
    await waitFor(() => expect(screen.getByText('Urlaub')).toBeTruthy());

    fireEvent.click(screen.getByText('+ Neu'));
    expect(screen.getByText('Anzurechnende Arbeitszeit')).toBeTruthy();
    expect(screen.getByLabelText('Keine')).toBeTruthy();
    expect(screen.getByLabelText('Abwesenheitszeit (Sollzeit des Tages)')).toBeTruthy();

    // Stundenfeld erscheint erst bei "Feste Stundenzahl je Tag"
    expect(screen.queryByText('Stundenzahl je Tag')).toBeNull();
    fireEvent.click(screen.getByLabelText('Feste Stundenzahl je Tag'));
    expect(screen.getByText('Stundenzahl je Tag')).toBeTruthy();
  });

  it('save sends CHARGETYP/CHARGEHRS/CARRYFWD/COUNTALL', async () => {
    render(<LeaveTypes />);
    await waitFor(() => expect(screen.getByText('Urlaub')).toBeTruthy());

    fireEvent.click(screen.getByText('+ Neu'));
    // textbox[0] = Suche, [1] = Name, [2] = Kürzel
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[1], { target: { value: 'Sonderurlaub' } });
    fireEvent.change(textboxes[2], { target: { value: 'SU' } });

    fireEvent.click(screen.getByLabelText('Feste Stundenzahl je Tag'));
    const hoursInput = screen.getByRole('spinbutton');
    fireEvent.change(hoursInput, { target: { value: '6' } });

    fireEvent.click(screen.getByLabelText('Mit Anspruch verbunden (verbraucht Urlaubsanspruch)'));
    fireEvent.click(screen.getByLabelText('Resttage beim Jahresabschluss ins Folgejahr übertragen'));
    fireEvent.click(screen.getByLabelText('Alle Abwesenheitstage zählen (auch arbeitsfreie Tage)'));

    fireEvent.click(screen.getByText('Speichern'));
    await waitFor(() => expect(api.createLeaveType).toHaveBeenCalledTimes(1));
    expect(api.createLeaveType).toHaveBeenCalledWith(expect.objectContaining({
      NAME: 'Sonderurlaub',
      SHORTNAME: 'SU',
      CHARGETYP: 2,
      CHARGEHRS: 6,
      ENTITLED: true,
      CARRYFWD: true,
      COUNTALL: true,
    }));
  });

  it('edit dialog prefills charge fields and sends them on save', async () => {
    render(<LeaveTypes />);
    await waitFor(() => expect(screen.getByText('Urlaub')).toBeTruthy());

    fireEvent.click(screen.getByText('Bearbeiten'));
    const chargeRadio = screen.getByLabelText('Feste Stundenzahl je Tag') as HTMLInputElement;
    expect(chargeRadio.checked).toBe(true);
    const carryCheckbox = screen.getByLabelText('Resttage beim Jahresabschluss ins Folgejahr übertragen') as HTMLInputElement;
    expect(carryCheckbox.checked).toBe(true);

    fireEvent.click(screen.getByText('Speichern'));
    await waitFor(() => expect(api.updateLeaveType).toHaveBeenCalledTimes(1));
    expect(api.updateLeaveType).toHaveBeenCalledWith(1, expect.objectContaining({
      CHARGETYP: 2,
      CHARGEHRS: 7.7,
      CARRYFWD: true,
      COUNTALL: true,
    }));
  });

  it('validates CHARGEHRS when feste Stundenzahl selected', async () => {
    render(<LeaveTypes />);
    await waitFor(() => expect(screen.getByText('Urlaub')).toBeTruthy());

    fireEvent.click(screen.getByText('+ Neu'));
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[1], { target: { value: 'X' } });
    fireEvent.change(textboxes[2], { target: { value: 'X' } });
    fireEvent.click(screen.getByLabelText('Feste Stundenzahl je Tag'));

    fireEvent.click(screen.getByText('Speichern'));
    expect(screen.getByText('Bitte eine Stundenzahl je Tag angeben.')).toBeTruthy();
    expect(api.createLeaveType).not.toHaveBeenCalled();
  });
});
