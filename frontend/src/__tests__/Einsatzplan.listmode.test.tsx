/**
 * Einsatzplan-Auflisten-Modi wie das Original (Spec 4.3): „Nur Arbeitende"
 * blendet Abwesend/Frei aus, „Nur Abwesende" blendet die Schicht-Blöcke aus.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DayView } from '../pages/Einsatzplan';

vi.mock('../api/client', () => ({ api: new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }) }));

const SHIFTS = [{ ID: 1, NAME: 'Frühschicht', SHORTNAME: 'F', COLORBK_HEX: '#eee', COLORTEXT_HEX: '#000', HIDE: 0 }] as never;
const ENTRIES = [
  { employee_id: 1, employee_name: 'Arbeit, Anna', kind: 'shift', shift_id: 1, display_name: 'F' },
  { employee_id: 2, employee_name: 'Weg, Willi', kind: 'absence', leave_name: 'Urlaub', display_name: 'U' },
  { employee_id: 3, employee_name: 'Frei, Fritz', kind: null, display_name: '' },
] as never;

describe('Einsatzplan — Auflisten-Modi', () => {
  it('alle: Schicht-, Abwesend- und Frei-Block sichtbar', () => {
    render(<DayView date="2026-07-06" entries={ENTRIES} shifts={SHIFTS} listMode="alle" />);
    expect(screen.getByText(/Frühschicht/)).toBeTruthy();
    expect(screen.getByText(/Abwesend —/)).toBeTruthy();
    expect(screen.getByText(/Frei \/ kein Eintrag/)).toBeTruthy();
  });

  it('arbeitend: nur Schicht-Blöcke', () => {
    render(<DayView date="2026-07-06" entries={ENTRIES} shifts={SHIFTS} listMode="arbeitend" />);
    expect(screen.getByText(/Frühschicht/)).toBeTruthy();
    expect(screen.queryByText(/Abwesend —/)).toBeNull();
    expect(screen.queryByText(/Frei \/ kein Eintrag/)).toBeNull();
  });

  it('abwesend: nur der Abwesend-Block', () => {
    render(<DayView date="2026-07-06" entries={ENTRIES} shifts={SHIFTS} listMode="abwesend" />);
    expect(screen.queryByText(/Frühschicht/)).toBeNull();
    expect(screen.getByText(/Abwesend —/)).toBeTruthy();
    expect(screen.queryByText(/Frei \/ kein Eintrag/)).toBeNull();
  });
});
