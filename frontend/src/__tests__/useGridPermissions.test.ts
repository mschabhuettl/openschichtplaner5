/**
 * Tests für useGridPermissions/cellWriteState (G-1, Spec 9.5.3):
 * granulares Zell-Gating der Plan-Grids — Dienste nur mit WDUTIES,
 * Abwesenheiten nur mit WABSENCES, Vergangenheit nur mit WPAST.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../contexts/AuthContext';
import { useGridPermissions, cellWriteState, isPastDate } from '../hooks/useGridPermissions';

const authMock = vi.mocked(useAuth);

function setAuth(overrides: Record<string, unknown> = {}) {
  authMock.mockReturnValue({
    user: { role: 'Planer' },
    isDevMode: false,
    devViewRole: 'admin',
    canWrite: true,
    canWriteDuties: true,
    canWriteAbsences: true,
    canAdmin: false,
    can: () => true,
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>);
}

const TODAY = '2026-06-11';
const YESTERDAY = '2026-06-10';
const TOMORROW = '2026-06-12';

const allPerms = { duties: true, absences: true, past: true };

describe('useGridPermissions', () => {
  beforeEach(() => authMock.mockReset());

  it('leitet alle Flags aus can() ab, wenn Rollen-Gating erfüllt ist', () => {
    setAuth();
    const { result } = renderHook(() => useGridPermissions());
    expect(result.current).toEqual({
      duties: true, absences: true, notes: true, deviation: true, past: true,
    });
  });

  it('explizit false gesetzte Flags sperren einzeln', () => {
    setAuth({ can: (p: string) => p !== 'wduties' && p !== 'wpast' });
    const { result } = renderHook(() => useGridPermissions());
    expect(result.current.duties).toBe(false);
    expect(result.current.absences).toBe(true);
    expect(result.current.past).toBe(false);
  });

  it('ohne Rollen-Schreibrecht bleibt alles gesperrt (Leser)', () => {
    setAuth({ canWrite: false, canWriteDuties: false, canWriteAbsences: false });
    const { result } = renderHook(() => useGridPermissions());
    expect(result.current.duties).toBe(false);
    expect(result.current.absences).toBe(false);
    expect(result.current.notes).toBe(false);
    expect(result.current.deviation).toBe(false);
  });
});

describe('isPastDate', () => {
  it('vergleicht ISO-Daten lexikografisch', () => {
    expect(isPastDate(YESTERDAY, TODAY)).toBe(true);
    expect(isPastDate(TODAY, TODAY)).toBe(false);
    expect(isPastDate(TOMORROW, TODAY)).toBe(false);
  });
});

describe('cellWriteState — WPAST-Zellverhalten', () => {
  it('sperrt alle Zell-Aktionen für Vergangenheits-Tage ohne wpast', () => {
    const s = cellWriteState({ ...allPerms, past: false }, YESTERDAY, TODAY, [{ kind: 'shift' }]);
    expect(s.pastLocked).toBe(true);
    expect(s.canAddShift).toBe(false);
    expect(s.canAddAbsence).toBe(false);
    expect(s.canDelete).toBe(false);
    expect(s.canDrag).toBe(false);
    expect(s.readOnlyReason).toMatch(/WPAST/);
  });

  it('heute und Zukunft bleiben ohne wpast bearbeitbar', () => {
    for (const d of [TODAY, TOMORROW]) {
      const s = cellWriteState({ ...allPerms, past: false }, d, TODAY, [{ kind: 'shift' }]);
      expect(s.pastLocked).toBe(false);
      expect(s.canAddShift).toBe(true);
      expect(s.readOnlyReason).toBeNull();
    }
  });

  it('mit wpast ist auch die Vergangenheit bearbeitbar', () => {
    const s = cellWriteState(allPerms, YESTERDAY, TODAY, [{ kind: 'shift' }]);
    expect(s.pastLocked).toBe(false);
    expect(s.canAddShift).toBe(true);
    expect(s.canDelete).toBe(true);
  });
});

describe('cellWriteState — WDUTIES/WABSENCES je Eintragsart', () => {
  it('ohne wduties: keine Dienste, aber Abwesenheiten erlaubt', () => {
    const s = cellWriteState({ ...allPerms, duties: false }, TODAY, TODAY, []);
    expect(s.canAddShift).toBe(false);
    expect(s.canAddAbsence).toBe(true);
    expect(s.readOnlyReason).toMatch(/WDUTIES/);
  });

  it('ohne wduties: Dienst-Zelle weder löschbar noch ziehbar', () => {
    const s = cellWriteState({ ...allPerms, duties: false }, TODAY, TODAY, [{ kind: 'shift' }]);
    expect(s.canDelete).toBe(false);
    expect(s.canDrag).toBe(false);
  });

  it('ohne wabsences: Abwesenheits-Zelle nicht löschbar, Dienst-Zelle schon', () => {
    const perms = { ...allPerms, absences: false };
    const abs = cellWriteState(perms, TODAY, TODAY, [{ kind: 'absence' }]);
    expect(abs.canAddAbsence).toBe(false);
    expect(abs.canDelete).toBe(false);
    const shift = cellWriteState(perms, TODAY, TODAY, [{ kind: 'shift' }]);
    expect(shift.canDelete).toBe(true);
    expect(shift.canDrag).toBe(true);
  });

  it('Misch-Zelle (Dienst + Abwesenheit) erfordert beide Rechte zum Löschen', () => {
    const entries = [{ kind: 'shift' }, { kind: 'absence' }];
    expect(cellWriteState(allPerms, TODAY, TODAY, entries).canDelete).toBe(true);
    expect(cellWriteState({ ...allPerms, absences: false }, TODAY, TODAY, entries).canDelete).toBe(false);
    expect(cellWriteState({ ...allPerms, duties: false }, TODAY, TODAY, entries).canDelete).toBe(false);
  });

  it('leere Zelle: nichts zu löschen/ziehen', () => {
    const s = cellWriteState(allPerms, TODAY, TODAY, []);
    expect(s.canDelete).toBe(false);
    expect(s.canDrag).toBe(false);
  });

  it('ohne jegliches Schreibrecht nennt der Tooltip beide Flags', () => {
    const s = cellWriteState({ duties: false, absences: false, past: true }, TODAY, TODAY, []);
    expect(s.readOnlyReason).toMatch(/WDUTIES\/WABSENCES/);
  });
});
