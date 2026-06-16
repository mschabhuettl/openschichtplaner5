/**
 * A6: Der Sonderdienst-Dialog (Einsatzplan) bietet freie Farben (Hintergrund/Schrift)
 * und getrennte Arbeitsstunden; die Werte werden an onSave durchgereicht (Round-Trip
 * in die DBF erfolgt api-seitig). Regression: ohne die Felder fällt dieser Test.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SonderdiensteModal } from '../pages/Einsatzplan';
import type { DayEntry } from '../api/client';
import type { ShiftType, Workplace } from '../types';

function makeShift(p: Partial<ShiftType>): ShiftType {
  return {
    ID: 1, NAME: 'Frühdienst', SHORTNAME: 'F', POSITION: 0,
    COLORBK: 16777215, COLORBK_HEX: '#ffffff', COLORTEXT: 0, COLORTEXT_HEX: '#000000',
    COLORBAR_HEX: '#000000', COLORBK_LIGHT: true, HIDE: false,
    TIMES_BY_WEEKDAY: {}, DURATION0: 8,
    ...p,
  };
}

const employee: DayEntry = {
  employee_id: 42, employee_name: 'Max Muster', employee_short: 'MM',
  shift_id: null, shift_name: '', shift_short: '',
  color_bk: '#fff', color_text: '#000',
  workplace_id: null, workplace_name: '',
  kind: null, leave_name: '', display_name: '',
};
const workplaces: Workplace[] = [];

describe('SonderdiensteModal — freie Farben + getrennte Arbeitsstunden (A6)', () => {
  it('reicht eigene Farben (BGR) und Arbeitsstunden an onSave durch', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SonderdiensteModal
        employee={employee}
        date="2026-06-15"  /* Montag → Default-Stunden = DURATION0 */
        shifts={[makeShift({ DURATION0: 8 })]}
        workplaces={workplaces}
        onClose={() => {}}
        onSave={onSave}
      />,
    );

    // Default-Arbeitsstunden = Schichtstunden des Tages (DURATION0 = 8)
    const hours = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(hours.value).toBe('8');

    // Freie Farben setzen
    fireEvent.change(screen.getByLabelText('Hintergrundfarbe'), { target: { value: '#112233' } });
    fireEvent.change(screen.getByLabelText('Schriftfarbe'), { target: { value: '#445566' } });
    // Getrennte Arbeitsstunden überschreiben
    fireEvent.change(hours, { target: { value: '6.5' } });

    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0];
    // #112233 → BGR (b<<16|g<<8|r) = 0x332211, #445566 → 0x665544
    expect(payload.colorbk).toBe(0x332211);
    expect(payload.colortext).toBe(0x665544);
    expect(payload.duration).toBe(6.5);
  });

  it('füllt beim Bearbeiten Farben und Stunden aus dem Bestand vor', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SonderdiensteModal
        employee={employee}
        date="2026-06-15"
        shifts={[makeShift({})]}
        workplaces={workplaces}
        existing={{
          id: 7, name: 'Extra', shortname: 'EX', shift_id: 1, workplace_id: 0,
          startend: '', colorBkHex: '#aabbcc', colorTextHex: '#102030', duration: 4,
        }}
        onClose={() => {}}
        onSave={onSave}
      />,
    );

    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('4');
    expect((screen.getByLabelText('Hintergrundfarbe') as HTMLInputElement).value).toBe('#aabbcc');
    expect((screen.getByLabelText('Schriftfarbe') as HTMLInputElement).value).toBe('#102030');

    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0];
    expect(payload.id).toBe(7);
    expect(payload.colorbk).toBe(0xccbbaa);   // #aabbcc → BGR
    expect(payload.duration).toBe(4);
  });
});
