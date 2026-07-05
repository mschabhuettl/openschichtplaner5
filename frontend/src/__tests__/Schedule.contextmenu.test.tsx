/**
 * Regressionstest für das Dienstplan-Kontextmenü und die Zeilen-Memoisierung
 * (P-KONTEXTMENÜ). Belegt:
 *   1. Rechtsklick auf eine Grid-Zelle öffnet das CellContextMenu; Escape und
 *      Klick außerhalb schließen es wieder.
 *   2. Die memoisierte EmployeeRow rendert bei einem unbeteiligten Eltern-Render
 *      NICHT neu (memo-Bailout) — ohne die Memoisierung würde jeder setState
 *      (z. B. Kontextmenü öffnen) das ganze Grid re-rendern (Original-Perf-Bug).
 *
 * Bewusst OHNE vollen Schedule-Mount getestet: die extrahierte Row-Komponente +
 * das echte CellContextMenu werden direkt verdrahtet (wie in Schedule.tsx).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState, useMemo, useEffect, type ComponentProps } from 'react';
import {
  EmployeeRow,
  CellContextMenu,
  type EmployeeRowProps,
  type RowCallbacks,
  type HoverApi,
  type ContextMenuState,
} from '../pages/Schedule';
import type { DarstellungsModi } from '../components/ScheduleCellStack';
import type { CellWriteState, GridWritePerms } from '../hooks/useGridPermissions';
import type { Employee, ScheduleEntry } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

const noopHover: HoverApi = { enter: () => {}, move: () => {}, leave: () => {} };

const noopCb = (over: Partial<RowCallbacks> = {}): RowCallbacks => ({
  onCellMouseDown: () => {},
  onCellMouseEnter: () => {},
  onContextMenu: () => {},
  onDragStart: () => {},
  onDragEnd: () => {},
  onDragOver: () => {},
  onDragLeave: () => {},
  onDrop: () => {},
  onDeleteEntry: () => {},
  onAddShift: () => {},
  onAddAbsence: () => {},
  ...over,
});

const emp = { ID: 5, NAME: 'Muster', FIRSTNAME: 'Max' } as unknown as Employee;

const allPerms: GridWritePerms = { duties: true, absences: true, notes: true, deviation: true, past: true };
const modi: DarstellungsModi = { dienste: 'kuerzel', abwesenheiten: 'kuerzel' };

function makeRowProps(over: Partial<EmployeeRowProps> = {}): EmployeeRowProps {
  return {
    emp,
    idx: 0,
    displayedDays: [1, 2, 3],
    year: 2026,
    month: 7,
    todayDay: -1,
    todayStr: '2026-07-03',
    entryMap: new Map<string, ScheduleEntry[]>(),
    holidays: new Set<string>(),
    notesMap: new Map(),
    wishMap: new Map(),
    conflictMap: new Map(),
    workloadMap: new Map(),
    shifts: [],
    leaveTypes: [],
    darstellungsModi: modi,
    grid: allPerms,
    isDark: false,
    isLeserView: false,
    currentUserEmpId: null,
    showWorkloadBars: false,
    filterShiftId: '',
    filterLeaveId: '',
    selectedDay: null,
    dndSrcDay: null,
    dndTgtDay: null,
    activePickerDay: null,
    selInBand: false,
    selMinDay: 0,
    selMaxDay: 0,
    isRowHighlighted: false,
    isDimmed: false,
    cb: noopCb(),
    hover: noopHover,
    setActivePicker: () => {},
    setNotePopup: () => {},
    setHighlightedEmpId: () => {},
    ...over,
  };
}

const fullWriteState: CellWriteState = {
  pastLocked: false,
  canAddShift: true,
  canAddAbsence: true,
  canDelete: false,
  canDrag: false,
  readOnlyReason: null,
};

// Verdrahtet EmployeeRow + CellContextMenu wie in Schedule.tsx: Rechtsklick auf
// eine Zelle öffnet das Menü, Escape (globaler Keydown) schließt es.
// ACHTUNG Harness-Grenze: der Escape-Listener hier SPIEGELT den globalen
// Keydown-Handler von Schedule.tsx (Escape-Zweig muss dort setContextMenu(null)
// aufrufen — der onKeyDown des Menüs selbst greift nur bei Fokus im Menü).
// Der echte Pfad ist zusätzlich im Browser belegt (ctxmenu-close-Proof).
function MenuHarness({
  shifts = [],
  onAssignShift = () => {},
}: {
  shifts?: ComponentProps<typeof CellContextMenu>['shifts'];
  onAssignShift?: ComponentProps<typeof CellContextMenu>['onAssignShift'];
} = {}) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const cb = useMemo(
    () =>
      noopCb({
        onContextMenu: (e, empId, day) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, empId, day, dateStr: `2026-07-${pad(day)}` });
        },
      }),
    [],
  );
  const rowProps = useMemo(() => makeRowProps({ cb }), [cb]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  return (
    <>
      <table><tbody><EmployeeRow {...rowProps} /></tbody></table>
      {menu && (
        <CellContextMenu
          state={menu}
          entries={[]}
          shifts={shifts}
          leaveTypes={[]}
          workplaces={[]}
          hasClipboard={false}
          writeState={fullWriteState}
          canNotes
          canDeviation
          onClose={() => setMenu(null)}
          onAddNote={async () => {}}
          onAssignShift={onAssignShift}
          onAddAbsence={() => {}}
          onAddSonderdienst={async () => {}}
          onAddDeviation={async () => {}}
          onAssignWorkplace={async () => {}}
          onDelete={() => {}}
          onDeleteEntry={() => {}}
          onCopy={() => {}}
          onPaste={() => {}}
        />
      )}
    </>
  );
}

describe('Dienstplan-Kontextmenü (P-KONTEXTMENÜ)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('Rechtsklick auf eine Zelle öffnet das CellContextMenu', () => {
    const { container } = render(<MenuHarness />);
    // tds[0] = Namenszelle, tds[1] = Tag 1
    const cells = container.querySelectorAll('td');
    expect(cells.length).toBe(4); // Name + 3 Tage
    expect(screen.queryByText('📋 Schicht zuweisen...')).toBeNull();

    fireEvent.contextMenu(cells[1]);

    // Menü sichtbar mit Datum + Schicht-Aktion
    expect(screen.getByText('📋 Schicht zuweisen...')).toBeTruthy();
    expect(screen.getByText('2026-07-01')).toBeTruthy();
    // Menü-Container: fixed z-[100]
    expect(document.querySelector('div.fixed.z-\\[100\\]')).toBeTruthy();
  });

  it('Escape schließt das geöffnete Kontextmenü', () => {
    const { container } = render(<MenuHarness />);
    fireEvent.contextMenu(container.querySelectorAll('td')[1]);
    expect(screen.getByText('📋 Schicht zuweisen...')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('📋 Schicht zuweisen...')).toBeNull();
  });

  it('Klick außerhalb schließt das Kontextmenü', () => {
    const { container } = render(<MenuHarness />);
    fireEvent.contextMenu(container.querySelectorAll('td')[2]);
    expect(screen.getByText('📋 Schicht zuweisen...')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('📋 Schicht zuweisen...')).toBeNull();
  });

  it('Schicht zuweisen → Klick auf eine Schicht ruft onAssignShift(empId, day, shiftId)', () => {
    // Deckt die Schreib-Verdrahtung ab, die der Kopf-Test mit Stub nicht prüfte:
    // Rechtsklick → „Schicht zuweisen…" → Schicht anklicken muss onAssignShift mit
    // (empId, day, shiftId) der Zelle aufrufen (Kern des Umplanens/Eintragens).
    const onAssignShift = vi.fn();
    const shifts = [
      { ID: 1, SHORTNAME: 'F', NAME: 'Frühschicht', HIDE: false, COLORBK_HEX: '#ffffff', COLORTEXT_HEX: '#000000' },
    ] as unknown as ComponentProps<typeof CellContextMenu>['shifts'];
    const { container } = render(<MenuHarness shifts={shifts} onAssignShift={onAssignShift} />);
    // tds[1] = Tag 1 → empId 5 (emp.ID), day 1
    fireEvent.contextMenu(container.querySelectorAll('td')[1]);
    fireEvent.click(screen.getByText('📋 Schicht zuweisen...'));
    fireEvent.click(screen.getByText('F – Frühschicht'));
    expect(onAssignShift).toHaveBeenCalledWith(5, 1, 1);
  });
});

// Harness für den memo-Bailout-Test: ein Tick-Button ändert Eltern-State, ohne
// die (referenzstabilen) Row-Props zu verändern.
function MemoHarness({ entryMap, dark }: { entryMap: Map<string, ScheduleEntry[]>; dark: boolean }) {
  const [, setTick] = useState(0);
  const rowProps = useMemo(() => makeRowProps({ entryMap }), [entryMap]);
  return (
    <>
      <button onClick={() => setTick(t => t + 1)}>tick</button>
      <table><tbody><EmployeeRow {...rowProps} isDark={dark} /></tbody></table>
    </>
  );
}

describe('EmployeeRow memo-Bailout (Perf-Fix)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('rendert bei unbeteiligtem Eltern-Render NICHT neu, aber bei Prop-Änderung schon', () => {
    const entryMap = new Map<string, ScheduleEntry[]>();
    const getSpy = vi.spyOn(entryMap, 'get');

    const { rerender } = render(<MemoHarness entryMap={entryMap} dark={false} />);
    const afterMount = getSpy.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0); // Zeile hat initial gerendert

    // Unbeteiligter Eltern-Render (Tick) → Row-Props identisch → memo bailt aus
    fireEvent.click(screen.getByText('tick'));
    expect(getSpy.mock.calls.length).toBe(afterMount);

    // Kontrolle: geänderte Prop (isDark) → Row rendert neu → entryMap.get erneut
    rerender(<MemoHarness entryMap={entryMap} dark={true} />);
    expect(getSpy.mock.calls.length).toBeGreaterThan(afterMount);
  });
});
