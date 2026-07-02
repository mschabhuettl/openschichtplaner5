/**
 * Schichtmodell-Editor: Einheit „Tage" (5CYCLE.UNIT=0, Wine-belegt) — Umschalter
 * rechnet den Umfang um, Raster zeigt Tages-Blöcke, Save sendet unit und
 * schneidet Zellen jenseits des Umfangs ab.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const updateMock = vi.fn().mockResolvedValue({ ok: true, cycle: { ID: 5, name: 'X', weeks: 10, unit: 0, schedule: [] } });
vi.mock('../api/client', () => {
  const fns = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return { api: new Proxy({}, { get: (_t, key) => {
    if (key === 'updateShiftCycle') return updateMock;
    if (!fns.has(key)) fns.set(key, vi.fn().mockResolvedValue([]));
    return fns.get(key);
  } }) };
});
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canAdmin: true, readOnlyInstance: false, coreOnly: false }) }));

import { EditCycleModal } from '../pages/Schichtmodell';

const CYCLE = { ID: 5, name: 'Rotation', weeks: 2, unit: 1, position: 1, pattern: '', schedule: [] } as never;
const SHIFTS = [{ ID: 1, NAME: 'Frühschicht', SHORTNAME: 'F', HIDE: 0, COLORBK_HEX: '#fff', COLORTEXT_HEX: '#000' }] as never;

describe('Schichtmodell — Tages-Einheit', () => {
  it('Umschalter auf Tage: Umfang 2 Wochen → 14 Tage, Raster zeigt Tages-Blöcke', () => {
    render(<EditCycleModal cycle={CYCLE} shifts={SHIFTS} onSaved={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('Tage'));
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('14');
    expect(screen.getByText('Tage 1–7')).toBeTruthy();
    expect(screen.getByText('Tage 8–14')).toBeTruthy();
    expect(screen.getByText(/Tagesplan/)).toBeTruthy();
  });

  it('Save sendet unit=0 und nur Zellen im Umfang', async () => {
    render(<EditCycleModal cycle={CYCLE} shifts={SHIFTS} onSaved={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('Tage'));
    // Umfang auf 10 Tage verkleinern → Zellen 11-14 wären außerhalb
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    // Tag 3 setzen: DOM ist zeilenweise (Zeile 1: Tag1+Tag8, Zeile 2: Tag2+Tag9,
    // Zeile 3: Tag3) → viertes Select-Element (Index 4) ist Tag 3
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[4], { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const [, , size, entries, unit] = updateMock.mock.calls[0];
    expect(size).toBe(10);
    expect(unit).toBe(0);
    expect(entries).toEqual([{ index: 2, shift_id: 1 }]);
  });
});
