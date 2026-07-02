/**
 * Zuschlagsart „festes Datum" (VALIDITY=1, Spec 3.8.2 Nr. 5): Formular bietet
 * den Modus an, sendet DATE und zeigt das Datum in der Liste.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => {
  const fns = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return { api: new Proxy({}, { get: (_t, key) => {
    if (!fns.has(key)) fns.set(key, vi.fn().mockResolvedValue([]));
    return fns.get(key);
  } }) };
});
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canAdmin: true, readOnlyInstance: false }) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { api } from '../api/client';
import Extracharges from '../pages/Extracharges';

describe('Zeitzuschläge — festes Datum', () => {
  beforeEach(() => {
    vi.mocked(api.getExtraCharges as never as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ID: 9, NAME: 'Heiligabend', POSITION: 1, START: 0, END: 1440, VALIDITY: 1, VALIDDAYS: '0000000', DATE: '2026-12-24', HOLRULE: 0, HIDE: 0 },
    ]);
  });

  it('zeigt bei VALIDITY=1 das Datum in der Liste', async () => {
    render(<Extracharges />);
    await waitFor(() => expect(screen.getByText('Heiligabend')).toBeTruthy());
    expect(screen.getByText(/am 2026-12-24/)).toBeTruthy();
  });

  it('Formular: Modus-Umschalter zeigt Datumsfeld und sendet DATE', async () => {
    render(<Extracharges />);
    await waitFor(() => expect(screen.getByText('Heiligabend')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Neu/ }));
    // Das NAME-Feld des Modals hat autoFocus — das Suchfeld der Liste nicht treffen
    fireEvent.change(document.activeElement as HTMLInputElement, { target: { value: 'Silvester' } });
    fireEvent.click(screen.getByLabelText('Festes Datum'));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    fireEvent.change(dateInput, { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: /Speichern|Anlegen/ }));
    await waitFor(() => {
      expect(vi.mocked(api.createExtraCharge as never as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        expect.objectContaining({ VALIDITY: 1, DATE: '2026-12-31' })
      );
    });
  });
});
