/**
 * Taktwerk-Chip-Anatomie der Dienstplan-Zelle (docs/design-system.md §6):
 * - Dienst = massiver Chip mit NORMALISIERTER Fläche (Rohfarbe nie direkt) +
 *   berechnetem Vordergrund; Fixwerte aus der Design-Referenz:
 *   F-Rohfarbe #0080FF → massiv light #2f6193 / dark #335f8a, Text #ffffff.
 * - Phasenkerbe links im Chip: oben/Mitte/unten = Früh/Tag/Nacht.
 * - Abwesenheit = hohler Chip (gestrichelte Kontur, keine Füllung);
 *   Ur-Rohfarbe #00A000 → hohl light #259325 / dark #79d879.
 * - Farbloser Eintrag = stille Typografie (Schrift-2, keine Fläche).
 * - Mehrfacheinträge = gestapelte Balken mit normalisierten Flächen.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScheduleCellStack } from '../components/ScheduleCellStack';
import type { Phase } from '../utils/scheduleVisuals';
import type { ScheduleEntry } from '../types';

function entry(partial: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    employee_id: 1,
    date: '2026-07-01',
    kind: 'shift',
    shift_id: 10,
    display_name: 'F',
    color_bk: '#0080FF',
    color_text: '#ffffff',
    ...partial,
  };
}

const chipOf = (container: HTMLElement) =>
  container.querySelector('span > span') as HTMLElement;

describe('ScheduleCellStack — Taktwerk-Chips', () => {
  beforeEach(cleanup);

  it('Dienst-Chip: normalisierte Fläche statt Rohfarbe (light, Referenz-Fixwert)', () => {
    const { container } = render(<ScheduleCellStack entries={[entry({})]} />);
    const chip = chipOf(container);
    expect(chip.style.backgroundColor).toBe('rgb(47, 97, 147)'); // #2f6193, nicht #0080FF
    expect(chip.style.color).toBe('rgb(255, 255, 255)');
  });

  it('Dienst-Chip dark: eigene Schiene (Referenz-Fixwert #335f8a)', () => {
    const { container } = render(<ScheduleCellStack entries={[entry({})]} isDark />);
    const chip = chipOf(container);
    expect(chip.style.backgroundColor).toBe('rgb(51, 95, 138)');
  });

  it('Phasenkerbe: Früh oben (top 2px), Nacht unten (top 13px); ohne phaseMap keine Kerbe', () => {
    const phases = new Map<number, Phase>([[10, 'frueh'], [11, 'nacht']]);
    const { container: c1 } = render(
      <ScheduleCellStack entries={[entry({ shift_id: 10 })]} phaseMap={phases} />,
    );
    const notch1 = c1.querySelector('span[aria-hidden="true"].absolute') as HTMLElement;
    expect(notch1).toBeTruthy();
    expect(notch1.style.top).toBe('2px');

    cleanup();
    const { container: c2 } = render(
      <ScheduleCellStack entries={[entry({ shift_id: 11, display_name: 'N' })]} phaseMap={phases} />,
    );
    const notch2 = c2.querySelector('span[aria-hidden="true"].absolute') as HTMLElement;
    expect(notch2.style.top).toBe('13px');

    cleanup();
    const { container: c3 } = render(<ScheduleCellStack entries={[entry({})]} />);
    expect(c3.querySelector('span[aria-hidden="true"].absolute')).toBeNull();
  });

  it('Abwesenheit: hohler Chip — gestrichelte Kontur in Hohl-Farbe, KEINE Füllung', () => {
    const { container } = render(
      <ScheduleCellStack
        entries={[entry({ kind: 'absence', shift_id: undefined, leave_type_id: 2, display_name: 'Ur', leave_name: 'Urlaub', color_bk: '#00A000' })]}
      />,
    );
    const chip = chipOf(container);
    expect(chip.style.backgroundColor).toBe('');
    expect(chip.style.border).toContain('1.5px dashed');
    // hohl light = hsl(120,60%,34%) → #238b23 (Modul-Schiene; der Referenz-Mock
    // nutzt abweichend L=36 % — verbindlich ist shiftColor.ts/README mit 34 %)
    expect(chip.style.color).toBe('rgb(35, 139, 35)');
  });

  it('farbloser Eintrag: stille Typografie ohne Fläche (Schrift-2)', () => {
    const { container } = render(
      <ScheduleCellStack entries={[entry({ color_bk: undefined, display_name: 'T' })]} />,
    );
    const el = screen.getByText('T');
    expect(el.className).toContain('text-schrift-2');
    expect(container.querySelector('[style*="background-color"]')).toBeNull();
  });

  it('Mehrfacheinträge: gestapelte Balken mit normalisierten Flächen', () => {
    render(
      <ScheduleCellStack
        entries={[
          entry({ display_name: 'F' }),
          entry({ shift_id: 12, display_name: 'S', color_bk: '#FF8000' }),
        ]}
      />,
    );
    const stack = screen.getByTestId('cell-stack');
    const bars = Array.from(stack.children) as HTMLElement[];
    expect(bars).toHaveLength(2);
    expect(bars[0].style.backgroundColor).toBe('rgb(47, 97, 147)');  // #2f6193
    expect(bars[1].style.backgroundColor).toBe('rgb(147, 97, 47)');  // S #FF8000 → #93612f
  });
});
