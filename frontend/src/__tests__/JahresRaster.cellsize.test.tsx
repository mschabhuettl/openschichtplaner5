/**
 * Jahresraster (Befund 9): gleich große Matrix-Zellen wie im Original —
 * freie Sonderdienst-Kurznamen („N-CT 5:45-15:45") werden in der Zelle aufs
 * Kürzel begrenzt (Volltext bleibt als Tooltip), die Tabelle ist table-fixed.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { JahresRaster } from '../components/JahresRaster';
import type { ScheduleEntry } from '../types';

const entry = (p: Partial<ScheduleEntry>): ScheduleEntry => ({
  id: 1, employee_id: 40, date: '2026-07-10',
  shift_id: null, shift_name: '', shift_short: '',
  color_bk: '#ff00ff', color_text: '#fff',
  workplace_id: null, workplace_name: '',
  kind: 'special_shift', leave_name: '', display_name: '',
  ...p,
} as ScheduleEntry);

describe('JahresRaster — feste Zellgrößen', () => {
  it('kürzt Langnamen in der Zelle aufs Kürzel und nutzt table-fixed', () => {
    const dayMap = new Map<string, ScheduleEntry[]>([
      ['2026-07-10', [entry({ display_name: 'N-CT 5:45-15:45' })]],
      ['2026-07-11', [entry({ id: 2, date: '2026-07-11', display_name: 'BO' })]],
    ]);
    const { container, getByTestId } = render(
      <JahresRaster year={2026} dayMap={dayMap} holidays={new Set()} onMonthClick={vi.fn()} />
    );
    const table = getByTestId('jahresraster');
    expect(table.className).toContain('table-fixed');
    expect(container.querySelector('colgroup')).not.toBeNull();

    const cell = getByTestId('jr-cell-7-10');
    expect(cell.textContent.trim()).toBe('N-CT');           // gekürzt
    expect(cell.textContent).not.toContain('5:45-15:45');   // kein Langtext in der Zelle
    expect(getByTestId('jr-cell-7-11').textContent.trim()).toBe('BO'); // Kürzel unverändert
  });
});
