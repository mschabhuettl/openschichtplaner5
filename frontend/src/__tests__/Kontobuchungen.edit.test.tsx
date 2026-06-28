/**
 * Page test for Kontobuchungen.tsx — Buchung bearbeiten
 * (P-VOLLERFASSUNG MitarbeiterErfassen.41): the booking list offers an edit
 * action that opens the shared modal prefilled and calls api.updateBooking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getBookings: vi.fn(),
    createBooking: vi.fn(),
    updateBooking: vi.fn(),
    deleteBooking: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import { api } from '../api/client';
import Kontobuchungen from '../pages/Kontobuchungen';

const mockEmployees = [
  { ID: 40, NAME: 'Mustermann', FIRSTNAME: 'Max', SHORTNAME: 'MM' },
];

const mockBooking = {
  id: 7,
  employee_id: 40,
  date: '2026-07-20',
  type: 0,
  value: 5,
  note: 'alt',
};

describe('Kontobuchungen — Buchung bearbeiten (MitarbeiterErfassen.41)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getEmployees).mockResolvedValue(mockEmployees as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getBookings).mockResolvedValue([mockBooking] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.updateBooking).mockResolvedValue({ ok: true, record: mockBooking } as any);
  });

  it('edit opens the prefilled modal and PUTs the changed value', async () => {
    render(<Kontobuchungen />);

    // Wait for the booking row to render.
    await screen.findByTitle('Buchung bearbeiten');

    fireEvent.click(screen.getByTitle('Buchung bearbeiten'));

    // Modal opens in edit mode with the existing value prefilled.
    expect(await screen.findByText('Kontobuchung bearbeiten')).toBeTruthy();
    const valueInput = screen.getByPlaceholderText('z.B. 2.5 oder -1.0') as HTMLInputElement;
    expect(valueInput.value).toBe('5');

    // Change the value and save.
    fireEvent.change(valueInput, { target: { value: '8.5' } });
    fireEvent.click(screen.getByText('Änderungen speichern'));

    await waitFor(() => {
      expect(api.updateBooking).toHaveBeenCalledWith(7, {
        date: '2026-07-20',
        type: 0,
        value: 8.5,
        note: 'alt',
      });
    });
    // Create must not be called on the edit path.
    expect(api.createBooking).not.toHaveBeenCalled();
  });
});
