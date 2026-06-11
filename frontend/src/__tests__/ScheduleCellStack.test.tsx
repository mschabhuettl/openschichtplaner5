/**
 * Tests für die Multi-Entry-Zelle (V-1) und die Zyklus-Kennzeichnung (APP-INT-4):
 * - eine Zelle stellt mehrere Einträge (Dienst + Abwesenheit) gestapelt dar
 * - Zyklusdienste erhalten ↻-Badge + Tooltip „aus Schichtmodell"
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScheduleCellStack, CYCLE_TITLE } from '../components/ScheduleCellStack';
import type { ScheduleEntry } from '../types';

function entry(partial: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    employee_id: 1,
    date: '2026-06-01',
    kind: 'shift',
    shift_id: 10,
    display_name: 'F',
    color_bk: '#0000ff',
    color_text: '#ffffff',
    ...partial,
  };
}

describe('ScheduleCellStack', () => {
  beforeEach(cleanup);

  it('rendert nichts bei leerer Zelle', () => {
    const { container } = render(<ScheduleCellStack entries={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('rendert einen einzelnen Eintrag mit Kürzel', () => {
    render(<ScheduleCellStack entries={[entry({ display_name: 'F' })]} />);
    expect(screen.getByText('F')).toBeTruthy();
    expect(screen.queryByTestId('cell-stack')).toBeNull();
  });

  it('stapelt MEHRERE Einträge (Dienst + Abwesenheit koexistent, Spec 6.7)', () => {
    render(
      <ScheduleCellStack
        entries={[
          entry({ display_name: 'F' }),
          entry({ kind: 'absence', shift_id: undefined, leave_type_id: 2, display_name: 'U', leave_name: 'Urlaub' }),
        ]}
      />,
    );
    const stack = screen.getByTestId('cell-stack');
    expect(stack).toBeTruthy();
    expect(screen.getByText('F')).toBeTruthy();
    expect(screen.getByText('U')).toBeTruthy();
  });

  it('kennzeichnet Zyklusdienste mit ↻ und Tooltip „aus Schichtmodell"', () => {
    render(<ScheduleCellStack entries={[entry({ source: 'cycle', display_name: 'N' })]} />);
    const el = screen.getByTitle(CYCLE_TITLE);
    expect(el.textContent).toContain('↻');
    expect(el.textContent).toContain('N');
  });

  it('kennzeichnet Zyklusdienste auch im Stapel', () => {
    render(
      <ScheduleCellStack
        entries={[
          entry({ display_name: 'F' }),
          entry({ source: 'cycle', display_name: 'N', shift_name: 'Nachtdienst' }),
        ]}
      />,
    );
    const cycleChip = screen.getByTitle(`Nachtdienst · ${CYCLE_TITLE}`);
    expect(cycleChip.textContent).toContain('↻');
    // Manueller Eintrag ohne Zyklus-Badge
    expect(screen.getByText('F').textContent).not.toContain('↻');
  });
});
