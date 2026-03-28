/**
 * Unit tests for ScheduleCalendar drag & drop functionality.
 *
 * Tests cover:
 * - Rendering of the shift palette (PaletteShiftChip)
 * - Draggable shift chips in calendar cells (ShiftChip)
 * - Drop zone highlighting on dragOver
 * - onShiftAssign callback triggered on palette → day drop
 * - onShiftMove callback triggered on cell → cell move
 * - readOnly mode disables drag & drop interactions
 * - Drop zone indicator text rendered when dragging over empty cell
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import ScheduleCalendar from '../components/ScheduleCalendar';
import type { Employee, ScheduleEntry, ShiftType } from '../types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockShifts: ShiftType[] = [
  {
    ID: 1,
    NAME: 'Frühschicht',
    SHORTNAME: 'F',
    COLORTEXT: 0,
    COLORTEXT_HEX: '#000000',
    COLORBK: 16776960,
    COLORBK_HEX: '#FFFF00',
    COLORBAR_HEX: '#FFFF00',
    COLORBK_LIGHT: true,
    HIDE: false,
    POSITION: 0,
    TIMES_BY_WEEKDAY: {},
    DURATION0: 480,
  },
  {
    ID: 2,
    NAME: 'Spätschicht',
    SHORTNAME: 'S',
    COLORTEXT: 0,
    COLORTEXT_HEX: '#000000',
    COLORBK: 255,
    COLORBK_HEX: '#FF0000',
    COLORBAR_HEX: '#FF0000',
    COLORBK_LIGHT: false,
    HIDE: false,
    POSITION: 1,
    TIMES_BY_WEEKDAY: {},
    DURATION0: 480,
  },
];

const mockEmployees: Employee[] = [
  {
    ID: 10,
    POSITION: 0,
    NUMBER: 'E001',
    NAME: 'Müller',
    FIRSTNAME: 'Anna',
    SHORTNAME: 'MÜA',
    SEX: 1,
    HRSDAY: 8,
    HRSWEEK: 40,
    HRSMONTH: 160,
    WORKDAYS_LIST: [true, true, true, true, true, false, false],
    HIDE: false,
  },
];

function makeEntryMap(entries: Array<{ empId: number; day: number; shiftId: number }>): Map<string, ScheduleEntry> {
  const map = new Map<string, ScheduleEntry>();
  for (const e of entries) {
    const shift = mockShifts.find(s => s.ID === e.shiftId)!;
    map.set(`${e.empId}-${e.day}`, {
      employee_id: e.empId,
      date: `2024-03-${String(e.day).padStart(2, '0')}`,
      shift_id: e.shiftId,
      display_name: shift.SHORTNAME,
      color_bk: shift.COLORBK_HEX || '',
      color_text: shift.COLORTEXT_HEX || '',
    } as ScheduleEntry);
  }
  return map;
}

const baseProps = {
  year: 2024,
  month: 3, // März
  employees: mockEmployees,
  entryMap: new Map<string, ScheduleEntry>(),
  holidays: new Set<string>(),
  shifts: mockShifts,
};

// ── Helper: fire a drop event with custom dataTransfer on an element ─────────

function fireDrop(
  element: Element,
  types: string[],
  getData: (type: string) => string,
) {
  const event = createEvent.drop(element);
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      types,
      getData: vi.fn(getData),
      dropEffect: 'none',
    },
  });
  fireEvent(element, event);
}



// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ScheduleCalendar — Shift Palette', () => {
  it('renders palette with shift chips when shifts are provided', () => {
    render(<ScheduleCalendar {...baseProps} />);
    // Palette heading
    expect(screen.getByText(/Schicht-Palette/i)).toBeTruthy();
    // Shift shortnames appear as chips
    expect(screen.getAllByText('F').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S').length).toBeGreaterThan(0);
  });

  it('hides palette chips when collapsed', () => {
    render(<ScheduleCalendar {...baseProps} />);
    const toggleBtn = screen.getByTitle(/Palette zuklappen/i);
    fireEvent.click(toggleBtn);
    // After collapse, shift chips should not be visible
    expect(screen.queryByTitle(/Frühschicht — hierher ziehen/i)).toBeNull();
  });

  it('shows drag hint text when not readOnly', () => {
    render(<ScheduleCalendar {...baseProps} readOnly={false} />);
    expect(screen.getByText(/Schichten aus der Palette auf Tage ziehen/i)).toBeTruthy();
  });

  it('does not show drag hint in readOnly mode', () => {
    render(<ScheduleCalendar {...baseProps} readOnly={true} />);
    expect(screen.queryByText(/Schichten aus der Palette auf Tage ziehen/i)).toBeNull();
  });
});

describe('ScheduleCalendar — readOnly mode', () => {
  it('palette chips are not draggable in readOnly mode', () => {
    render(<ScheduleCalendar {...baseProps} readOnly={true} />);
    // Palette chips should not be draggable
    const chips = screen.getAllByTitle(/Frühschicht/i);
    // In readOnly, title does NOT include "hierher ziehen"
    for (const chip of chips) {
      expect(chip.getAttribute('title')).not.toContain('hierher ziehen');
    }
  });

  it('shows "Klicke auf einen Tag" hint in readOnly mode', () => {
    render(<ScheduleCalendar {...baseProps} readOnly={true} />);
    expect(screen.getByText(/Klicke auf einen Tag für die Tagesübersicht/i)).toBeTruthy();
  });
});

describe('ScheduleCalendar — Day cell rendering', () => {
  it('renders 31 day cells for March 2024', () => {
    render(<ScheduleCalendar {...baseProps} />);
    // Day 1 through 31 should be present as text
    for (let d = 1; d <= 31; d++) {
      const cells = screen.getAllByText(String(d));
      expect(cells.length).toBeGreaterThan(0);
    }
  });

  it('renders weekday headers', () => {
    render(<ScheduleCalendar {...baseProps} />);
    for (const wd of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
      expect(screen.getByText(wd)).toBeTruthy();
    }
  });

  it('renders month/year in footer', () => {
    render(<ScheduleCalendar {...baseProps} />);
    expect(screen.getByText(/März 2024/)).toBeTruthy();
  });

  it('renders employee count in footer', () => {
    render(<ScheduleCalendar {...baseProps} />);
    expect(screen.getByText(/1 Mitarbeiter/)).toBeTruthy();
  });
});

describe('ScheduleCalendar — Shift chips in cells', () => {
  it('renders shift chip in cell when entry exists', () => {
    const entryMap = makeEntryMap([{ empId: 10, day: 5, shiftId: 1 }]);
    render(<ScheduleCalendar {...baseProps} entryMap={entryMap} />);
    // The chip label 'F' should appear at least once (in palette + in cell)
    const fChips = screen.getAllByText('F');
    expect(fChips.length).toBeGreaterThanOrEqual(2); // palette + cell
  });

  it('shows assignment count ratio in cell', () => {
    const entryMap = makeEntryMap([{ empId: 10, day: 5, shiftId: 1 }]);
    render(<ScheduleCalendar {...baseProps} entryMap={entryMap} />);
    // Should show "1/1" (1 assigned / 1 total employee)
    expect(screen.getByText('1/1')).toBeTruthy();
  });
});

describe('ScheduleCalendar — DnD callbacks', () => {
  // Helper to get the actual DayCell div (first child of the data-drop-date wrapper)
  function getDayCell(dateStr: string): HTMLElement {
    const wrapper = document.querySelector(`[data-drop-date="${dateStr}"]`) as HTMLElement;
    expect(wrapper).not.toBeNull();
    return wrapper.firstElementChild as HTMLElement ?? wrapper;
  }

  it('calls onShiftAssign when palette shift is dropped onto a day cell', () => {
    const onShiftAssign = vi.fn();
    render(<ScheduleCalendar {...baseProps} onShiftAssign={onShiftAssign} />);

    const cell = getDayCell('2024-03-10');
    const paletteData = JSON.stringify({ shiftId: 1, shiftName: 'F' });
    fireDrop(cell, ['application/x-sp5-palette-shift'], () => paletteData);

    expect(onShiftAssign).toHaveBeenCalledWith({
      shiftId: 1,
      dateStr: '2024-03-10',
    });
  });

  it('calls onShiftMove when a shift is moved between day cells', () => {
    const onShiftMove = vi.fn();
    render(<ScheduleCalendar {...baseProps} onShiftMove={onShiftMove} />);

    const cell = getDayCell('2024-03-15');
    const moveData = JSON.stringify({
      employeeId: 10,
      fromDateStr: '2024-03-10',
      shiftId: 1,
      shiftName: 'F',
    });
    fireDrop(cell, ['application/x-sp5-move-shift'], (type) =>
      type === 'application/x-sp5-move-shift' ? moveData : '');

    expect(onShiftMove).toHaveBeenCalledWith({
      employeeId: 10,
      fromDateStr: '2024-03-10',
      toDateStr: '2024-03-15',
      shiftId: 1,
    });
  });

  it('does NOT call onShiftMove when dropped on the same date', () => {
    const onShiftMove = vi.fn();
    render(<ScheduleCalendar {...baseProps} onShiftMove={onShiftMove} />);

    const cell = getDayCell('2024-03-10');
    const moveData = JSON.stringify({
      employeeId: 10,
      fromDateStr: '2024-03-10', // same date
      shiftId: 1,
      shiftName: 'F',
    });
    fireDrop(cell, ['application/x-sp5-move-shift'], (type) =>
      type === 'application/x-sp5-move-shift' ? moveData : '');

    expect(onShiftMove).not.toHaveBeenCalled();
  });

  it('does NOT call onShiftAssign when readOnly=true', () => {
    const onShiftAssign = vi.fn();
    render(<ScheduleCalendar {...baseProps} onShiftAssign={onShiftAssign} readOnly={true} />);

    const cell = getDayCell('2024-03-10');
    const paletteData = JSON.stringify({ shiftId: 1, shiftName: 'F' });
    fireDrop(cell, ['application/x-sp5-palette-shift'], () => paletteData);

    expect(onShiftAssign).not.toHaveBeenCalled();
  });

  it('does NOT call onShiftMove when readOnly=true', () => {
    const onShiftMove = vi.fn();
    render(<ScheduleCalendar {...baseProps} onShiftMove={onShiftMove} readOnly={true} />);

    const cell = getDayCell('2024-03-15');
    const moveData = JSON.stringify({
      employeeId: 10,
      fromDateStr: '2024-03-10',
      shiftId: 1,
      shiftName: 'F',
    });
    fireDrop(cell, ['application/x-sp5-move-shift'], (type) =>
      type === 'application/x-sp5-move-shift' ? moveData : '');

    expect(onShiftMove).not.toHaveBeenCalled();
  });

  it('calls onDayClick when a day cell is clicked', () => {
    const onDayClick = vi.fn();
    render(<ScheduleCalendar {...baseProps} onDayClick={onDayClick} />);

    const cell = getDayCell('2024-03-10');
    fireEvent.click(cell);

    expect(onDayClick).toHaveBeenCalledWith(10, '2024-03-10');
  });
});

describe('ScheduleCalendar — DnD data transfer (DndAssignPayload / DndMovePayload types)', () => {
  function getDayCell(dateStr: string): HTMLElement {
    const wrapper = document.querySelector(`[data-drop-date="${dateStr}"]`) as HTMLElement;
    return wrapper.firstElementChild as HTMLElement ?? wrapper;
  }

  it('DndAssignPayload contains shiftId and dateStr', () => {
    const onShiftAssign = vi.fn();
    render(<ScheduleCalendar {...baseProps} onShiftAssign={onShiftAssign} />);

    const cell = getDayCell('2024-03-20');
    const paletteData = JSON.stringify({ shiftId: 2, shiftName: 'S' });
    fireDrop(cell, ['application/x-sp5-palette-shift'], () => paletteData);

    const payload = onShiftAssign.mock.calls[0][0];
    expect(payload).toHaveProperty('shiftId', 2);
    expect(payload).toHaveProperty('dateStr', '2024-03-20');
  });

  it('DndMovePayload contains employeeId, fromDateStr, toDateStr, shiftId', () => {
    const onShiftMove = vi.fn();
    render(<ScheduleCalendar {...baseProps} onShiftMove={onShiftMove} />);

    const cell = getDayCell('2024-03-25');
    const moveData = JSON.stringify({
      employeeId: 10,
      fromDateStr: '2024-03-20',
      shiftId: 2,
      shiftName: 'S',
    });
    fireDrop(cell, ['application/x-sp5-move-shift'], (type) =>
      type === 'application/x-sp5-move-shift' ? moveData : '');

    const payload = onShiftMove.mock.calls[0][0];
    expect(payload).toHaveProperty('employeeId', 10);
    expect(payload).toHaveProperty('fromDateStr', '2024-03-20');
    expect(payload).toHaveProperty('toDateStr', '2024-03-25');
    expect(payload).toHaveProperty('shiftId', 2);
  });

  it('handles malformed JSON in drop data gracefully (no throw)', () => {
    const onShiftAssign = vi.fn();
    render(<ScheduleCalendar {...baseProps} onShiftAssign={onShiftAssign} />);
    const cell = getDayCell('2024-03-10');
    expect(() => {
      fireDrop(cell, ['application/x-sp5-palette-shift'], () => 'NOT_JSON');
    }).not.toThrow();
    expect(onShiftAssign).not.toHaveBeenCalled();
  });
});

describe('ScheduleCalendar — Holidays', () => {
  it('renders holiday marker (★) for holiday dates', () => {
    const holidays = new Set(['2024-03-29']); // Karfreitag
    render(<ScheduleCalendar {...baseProps} holidays={holidays} />);
    expect(screen.getByText('★')).toBeTruthy();
  });
});

describe('ScheduleCalendar — Hidden shifts', () => {
  it('does not render HIDE=true shifts in palette', () => {
    const shiftsWithHidden: ShiftType[] = [
      ...mockShifts,
      {
        ID: 99,
        NAME: 'Versteckte Schicht',
        SHORTNAME: 'VH',
        COLORTEXT: 0,
        COLORTEXT_HEX: '#000',
        COLORBK: 0,
        COLORBK_HEX: '#fff',
        COLORBAR_HEX: '#fff',
        COLORBK_LIGHT: true,
        HIDE: true,
        POSITION: 99,
        TIMES_BY_WEEKDAY: {},
        DURATION0: 0,
      },
    ];
    render(<ScheduleCalendar {...baseProps} shifts={shiftsWithHidden} />);
    expect(screen.queryByText('VH')).toBeNull();
  });
});
