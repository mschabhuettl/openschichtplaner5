/**
 * Regression: Zyklus-Ausnahme (5CYEXC) = freier Tag.
 * Das Frontend schickte früher `type: shiftId` (eine echte Schicht-ID) an
 * POST /api/cycle-exceptions, wo `type` aber Field(ge=0, le=1) ist (Plan-Eintragsart,
 * 5CYEXC hat KEIN Ersatzschicht-Feld) → 422 "type: Must be at most 1". Der Speicher-
 * Aufruf darf jetzt KEIN shift-id-`type` mehr enthalten.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { setCycleException } = vi.hoisted(() => ({ setCycleException: vi.fn() }));
vi.mock('../api/client', () => ({ api: { setCycleException } }));

import { AddExceptionModal } from '../pages/Schichtmodell';
import type { Employee } from '../types';

const employees = [
  { ID: 7, NAME: 'Muster', FIRSTNAME: 'Max' },
] as unknown as Employee[];
// AddExceptionModal akzeptiert nur Mitarbeiter mit aktiver Zyklus-Zuweisung.
const assignments = [{ id: 42, employee_id: 7 }] as never;

describe('AddExceptionModal (Zyklus-Ausnahme = freier Tag)', () => {
  beforeEach(() => {
    setCycleException.mockReset();
    setCycleException.mockResolvedValue({ ok: true });
  });

  it('speichert eine Ausnahme ohne shift-id-`type` (Bugfix gegen 422)', async () => {
    const { container } = render(
      <AddExceptionModal employees={employees} assignments={assignments} onCreated={vi.fn()} onClose={vi.fn()} />,
    );
    fireEvent.change(container.querySelector('select')!, { target: { value: '7' } });
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-06-15' } });
    fireEvent.click(screen.getByText('Ausnahme speichern'));

    await waitFor(() => expect(setCycleException).toHaveBeenCalledTimes(1));
    const body = setCycleException.mock.calls[0][0];
    expect(body).toEqual({ employee_id: 7, cycle_assignment_id: 42, date: '2026-06-15' });
    // Kern der Regression: kein `type`-Feld (vorher type: shiftId → 422).
    expect(body).not.toHaveProperty('type');
  });
});
