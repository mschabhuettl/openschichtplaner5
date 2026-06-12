import { describe, it, expect } from 'vitest';
import { occupiedShiftIds } from '../pages/einsatzplanUtils';
import type { DayEntry } from '../api/client';

function entry(p: Partial<DayEntry>): DayEntry {
  return {
    employee_id: 1, employee_name: 'X', employee_short: 'X',
    shift_id: null, shift_name: '', shift_short: '',
    color_bk: '#fff', color_text: '#000',
    workplace_id: null, workplace_name: '',
    kind: null, leave_name: '', display_name: '',
    ...p,
  };
}

describe('occupiedShiftIds', () => {
  it('collects shift ids of assigned shifts and special shifts', () => {
    const ids = occupiedShiftIds([
      entry({ shift_id: 5, kind: 'shift' }),
      entry({ shift_id: 5, kind: 'shift' }), // duplicate → one entry in set
      entry({ shift_id: 7, kind: 'special_shift' }),
    ]);
    expect([...ids].sort()).toEqual([5, 7]);
  });

  it('ignores absences and free entries', () => {
    const ids = occupiedShiftIds([
      entry({ shift_id: null, kind: 'absence', leave_name: 'Urlaub' }),
      entry({ shift_id: null, kind: null }), // frei
    ]);
    expect(ids.size).toBe(0);
  });

  it('returns an empty set for no entries', () => {
    expect(occupiedShiftIds([]).size).toBe(0);
  });
});
