/**
 * AuslastungsBereich — Optionen der Personalauslastung (Original-Spec 4.11.9-5/6):
 * 1. Default = heutiges Bild: automatisch alle aktiven Schichtarten, keine
 *    Bedarfs-Unterzeile.
 * 2. Eigene Zusammenstellung über MultiSelect (leer = alle): nur die gewählten
 *    Schichtarten werden angezeigt — auch ohne Einträge/Soll im Monat.
 * 3. „Bedarf" blendet je Schichtart eine Unterzeile mit dem Mindestbedarf ein
 *    (dieselbe Soll-Quelle wie der Zell-Tooltip); ohne Soll bleibt sie leer.
 * 4. „Max" zeigt zusätzlich den Maximalbedarf als „min–max".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { AuslastungsBereich } from '../pages/Schedule';
import type { ShiftRequirement } from '../api/client';
import type { ScheduleEntry, ShiftType } from '../types';

vi.mock('../contexts/ThemeContext', async importOriginal => {
  const real = await importOriginal<object>();
  return { ...real, useTheme: () => ({ theme: 'light', isDark: false }) };
});

const shift = (ID: number, SHORTNAME: string, NAME: string) =>
  ({ ID, SHORTNAME, NAME, COLORBK_HEX: '#0000ff', COLORTEXT_HEX: '#ffffff' }) as unknown as ShiftType;

// Positions-Reihenfolge: FD, SD, ND — ND hat weder Einträge noch Soll (inaktiv)
const shifts = [shift(1, 'FD', 'Frühdienst'), shift(2, 'SD', 'Spätdienst'), shift(3, 'ND', 'Nachtdienst')];

const entry = (employee_id: number, date: string, shift_id: number): ScheduleEntry =>
  ({ employee_id, date, kind: 'shift', shift_id, display_name: 'x' }) as unknown as ScheduleEntry;

// Soll nur für FD: an allen Wochentagen min 2 / max 4
const staffingReqs: ShiftRequirement[] = Array.from({ length: 7 }, (_, wd) =>
  ({ id: wd + 1, group_id: 10, weekday: wd, shift_id: 1, min: 2, max: 4 }) as unknown as ShiftRequirement);

function renderBereich() {
  return render(
    <AuslastungsBereich
      shifts={shifts}
      days={[1, 2, 3]}
      year={2026}
      month={7}
      entries={[entry(1, '2026-07-01', 1), entry(2, '2026-07-01', 1), entry(3, '2026-07-02', 2)]}
      staffingReqs={staffingReqs}
      selectedGroupIds={[]}
    />,
  );
}

describe('AuslastungsBereich (Spec 4.11.9-5/6)', () => {
  beforeEach(cleanup);

  it('Default = heutiges Bild: alle aktiven Schichtarten, keine Bedarfszeile', () => {
    renderBereich();
    expect(screen.getByText('FD')).toBeTruthy();
    expect(screen.getByText('SD')).toBeTruthy();
    expect(screen.queryByText('ND')).toBeNull(); // inaktiv → automatisch nicht gelistet
    expect(screen.getByText('Alle Schichtarten')).toBeTruthy(); // leer = alle
    expect(screen.queryByTestId('bedarf-zeile-1')).toBeNull();
    const bedarfBtn = screen.getByRole('button', { name: 'Bedarf' });
    expect(bedarfBtn.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Max' })).toBeNull(); // erst mit Bedarf
  });

  it('eigene Zusammenstellung: Auswahl zeigt genau die gewählte Schichtart — auch inaktive', () => {
    renderBereich();
    fireEvent.click(screen.getByText('Alle Schichtarten'));
    fireEvent.mouseDown(screen.getByText('ND – Nachtdienst'));
    expect(screen.getByText('ND')).toBeTruthy(); // Zeile trotz 0 Einträgen/Soll
    expect(screen.queryByText('FD')).toBeNull();
    expect(screen.queryByText('SD')).toBeNull();
  });

  it('„Bedarf" blendet die Unterzeile mit dem Mindestbedarf ein (Soll-Quelle wie Tooltip)', () => {
    renderBereich();
    fireEvent.click(screen.getByRole('button', { name: 'Bedarf' }));
    const zeileFd = screen.getByTestId('bedarf-zeile-1');
    expect(within(zeileFd).getAllByText('2')).toHaveLength(3); // min=2 an allen 3 Tagen
    const zeileSd = screen.getByTestId('bedarf-zeile-2'); // SD ohne Soll → leere Zellen
    expect(within(zeileSd).queryByText('2')).toBeNull();
    expect(within(zeileSd).getAllByText('·')).toHaveLength(3);
  });

  it('„Max" zeigt zusätzlich den Maximalbedarf als „min–max"', () => {
    renderBereich();
    fireEvent.click(screen.getByRole('button', { name: 'Bedarf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    const zeileFd = screen.getByTestId('bedarf-zeile-1');
    expect(within(zeileFd).getAllByText('2–4')).toHaveLength(3);
    expect(within(zeileFd).queryByText('2')).toBeNull();
  });
});
