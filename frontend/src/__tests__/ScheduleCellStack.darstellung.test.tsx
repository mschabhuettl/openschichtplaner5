/**
 * Felddarstellungsmodi (Original-Anpassen-Dialog, Kategorie „Felder"):
 * Kürzel | Farbbalken | Farbbalken+Kürzel | nur Hintergrund.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScheduleCellStack } from '../components/ScheduleCellStack';
import type { ScheduleEntry } from '../types';

const SHIFT = {
  kind: 'shift', shift_id: 1, display_name: 'F', shift_name: 'Frühschicht',
  color_bk: '#ff0000', color_text: '#ffffff',
} as unknown as ScheduleEntry;
const ABSENCE = {
  kind: 'absence', leave_type_id: 2, display_name: 'U', leave_name: 'Urlaub',
  color_bk: '#00ff00', color_text: '#000000',
} as unknown as ScheduleEntry;

describe('ScheduleCellStack — Felddarstellung', () => {
  it('Default (kuerzel): Kürzel sichtbar, kein Balken', () => {
    render(<ScheduleCellStack entries={[SHIFT]} />);
    expect(screen.getByText('F')).toBeTruthy();
    expect(screen.queryByTestId('farbbalken')).toBeNull();
  });

  it('farbbalken: Balken statt Kürzel', () => {
    render(<ScheduleCellStack entries={[SHIFT]} modi={{ dienste: 'farbbalken', abwesenheiten: 'kuerzel' }} />);
    expect(screen.queryByText('F')).toBeNull();
    expect(screen.getByTestId('farbbalken')).toBeTruthy();
  });

  it('farbbalken_kuerzel: beides', () => {
    render(<ScheduleCellStack entries={[SHIFT]} modi={{ dienste: 'farbbalken_kuerzel', abwesenheiten: 'kuerzel' }} />);
    expect(screen.getByText('F')).toBeTruthy();
    expect(screen.getByTestId('farbbalken')).toBeTruthy();
  });

  it('hintergrund: weder Kürzel noch Balken (Fläche färbt die Zelle)', () => {
    render(<ScheduleCellStack entries={[SHIFT]} modi={{ dienste: 'hintergrund', abwesenheiten: 'kuerzel' }} />);
    expect(screen.queryByText('F')).toBeNull();
    expect(screen.queryByTestId('farbbalken')).toBeNull();
  });

  it('Modi wirken getrennt je Art (Dienst=Balken, Abwesenheit=Kürzel)', () => {
    render(
      <ScheduleCellStack
        entries={[SHIFT, ABSENCE]}
        modi={{ dienste: 'farbbalken', abwesenheiten: 'kuerzel' }}
      />
    );
    expect(screen.queryByText('F')).toBeNull();
    expect(screen.getByTestId('farbbalken')).toBeTruthy();
    expect(screen.getByText('U')).toBeTruthy();
  });
});
