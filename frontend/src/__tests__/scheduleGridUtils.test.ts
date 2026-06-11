/**
 * Tests für die Dienstplan-Grid-Logik (APP-INT-1/4/7, V-1):
 * - Coverage-Status-Mapping under|ok|over|none (required_count:null)
 * - Multi-Entry-Zellen (mehrere Einträge pro MA/Tag)
 * - Zyklus-Guards (Vormonat-Kopie, Lösch-/Drop-Planung)
 */
import { describe, it, expect } from 'vitest';
import {
  coverageIndicator,
  coverageTooltip,
  buildEntryMap,
  isCycleEntry,
  hasDeletableEntry,
  filterPrevMonthCopyEntries,
  canAddWithoutReplace,
  planCellDrop,
} from '../components/scheduleGridUtils';
import type { ScheduleEntry } from '../types';
import type { CoverageDay } from '../api/client';

// ── Fixtures ─────────────────────────────────────────────────

function cov(partial: Partial<CoverageDay>): CoverageDay {
  return {
    day: 1,
    date: '2026-06-01',
    scheduled_count: 2,
    required_count: 3,
    required_min: 3,
    required_max: 5,
    status: 'under',
    cells: [],
    ...partial,
  };
}

function entry(partial: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    employee_id: 1,
    date: '2026-06-01',
    kind: 'shift',
    shift_id: 10,
    display_name: 'F',
    color_bk: '#fff',
    color_text: '#000',
    ...partial,
  };
}

// ── Coverage-Ampel (APP-INT-1) ───────────────────────────────

describe('coverageIndicator', () => {
  it('under → rot', () => {
    expect(coverageIndicator(cov({ status: 'under' }))).toEqual({ status: 'under', color: '#f87171' });
  });
  it('ok → grün', () => {
    expect(coverageIndicator(cov({ status: 'ok' }))).toEqual({ status: 'ok', color: '#4ade80' });
  });
  it('over → orange', () => {
    expect(coverageIndicator(cov({ status: 'over' }))).toEqual({ status: 'over', color: '#fb923c' });
  });
  it('none → kein Indikator', () => {
    expect(coverageIndicator(cov({ status: 'none', required_count: null }))).toBeNull();
  });
  it('fehlende Daten → kein Indikator', () => {
    expect(coverageIndicator(undefined)).toBeNull();
    expect(coverageIndicator(null)).toBeNull();
  });
});

describe('coverageTooltip', () => {
  it('zeigt x/y bei definiertem Bedarf', () => {
    expect(coverageTooltip(cov({ scheduled_count: 2, required_count: 3 }))).toBe('2/3 Mitarbeiter besetzt');
  });
  it('required_count null → „kein Bedarf definiert" statt „x/null"', () => {
    const text = coverageTooltip(cov({ scheduled_count: 4, required_count: null, status: 'none' }));
    expect(text).toBe('4 eingeteilt · kein Bedarf definiert');
    expect(text).not.toContain('null');
  });
});

// ── Multi-Entry-Zellen (V-1) ─────────────────────────────────

describe('buildEntryMap', () => {
  it('sammelt MEHRERE Einträge pro MA/Tag statt zu überschreiben', () => {
    const m = buildEntryMap([
      entry({ employee_id: 7, date: '2026-06-03', kind: 'shift', display_name: 'F' }),
      entry({ employee_id: 7, date: '2026-06-03', kind: 'absence', shift_id: undefined, leave_type_id: 2, display_name: 'U' }),
    ]);
    const cell = m.get('7-3');
    expect(cell).toHaveLength(2);
    expect(cell!.map(e => e.display_name)).toEqual(['F', 'U']);
  });

  it('sortiert Dienste vor Abwesenheiten (Anzeige-Reihenfolge)', () => {
    const m = buildEntryMap([
      entry({ employee_id: 7, date: '2026-06-03', kind: 'absence', shift_id: undefined, leave_type_id: 2, display_name: 'U' }),
      entry({ employee_id: 7, date: '2026-06-03', kind: 'shift', display_name: 'F' }),
    ]);
    expect(m.get('7-3')!.map(e => e.kind)).toEqual(['shift', 'absence']);
  });

  it('trennt Tage und Mitarbeiter korrekt', () => {
    const m = buildEntryMap([
      entry({ employee_id: 1, date: '2026-06-01' }),
      entry({ employee_id: 1, date: '2026-06-02' }),
      entry({ employee_id: 2, date: '2026-06-01' }),
    ]);
    expect(m.get('1-1')).toHaveLength(1);
    expect(m.get('1-2')).toHaveLength(1);
    expect(m.get('2-1')).toHaveLength(1);
    expect(m.get('2-2')).toBeUndefined();
  });
});

// ── Zyklus-Guards (APP-INT-4) ────────────────────────────────

describe('isCycleEntry / hasDeletableEntry', () => {
  it('erkennt Zyklusdienste an source=cycle', () => {
    expect(isCycleEntry(entry({ source: 'cycle' }))).toBe(true);
    expect(isCycleEntry(entry({}))).toBe(false);
    expect(isCycleEntry(entry({ source: null }))).toBe(false);
  });
  it('Zelle nur mit Zyklusdienst hat keinen löschbaren Eintrag', () => {
    expect(hasDeletableEntry([entry({ source: 'cycle' })])).toBe(false);
    expect(hasDeletableEntry([entry({ source: 'cycle' }), entry({})])).toBe(true);
    expect(hasDeletableEntry([])).toBe(false);
  });
});

describe('filterPrevMonthCopyEntries (Vormonat-Kopie)', () => {
  it('filtert Zyklusdienste aus — sie dürfen nicht materialisiert werden', () => {
    const result = filterPrevMonthCopyEntries([
      entry({ shift_id: 10 }),
      entry({ shift_id: 11, source: 'cycle' }),
      entry({ kind: 'absence', shift_id: undefined, leave_type_id: 2 }),
      entry({ kind: 'special_shift', shift_id: 12 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].shift_id).toBe(10);
  });
});

describe('canAddWithoutReplace', () => {
  it('zweiter Dienst neben echtem Dienst nicht möglich (5MASHI: 1/Tag)', () => {
    expect(canAddWithoutReplace([entry({})], 'shift')).toBe(false);
  });
  it('Dienst zusätzlich zu Abwesenheit möglich (Spec 6.7)', () => {
    expect(canAddWithoutReplace([entry({ kind: 'absence', shift_id: undefined, leave_type_id: 2 })], 'shift')).toBe(true);
  });
  it('Dienst über Zyklusdienst möglich (überschreibt die Expansion)', () => {
    expect(canAddWithoutReplace([entry({ source: 'cycle' })], 'shift')).toBe(true);
  });
  it('Abwesenheit zusätzlich immer möglich', () => {
    expect(canAddWithoutReplace([entry({})], 'absence')).toBe(true);
  });
});

describe('planCellDrop', () => {
  const manual = entry({});
  const cycle = entry({ source: 'cycle' });

  it('Move mit echter Quelle: Ziel ersetzen + Quelle löschen', () => {
    expect(planCellDrop({ sourceEntry: manual, targetEntries: [manual], isCopy: false, choice: 'replace' }))
      .toEqual({ clearTarget: true, deleteSource: true, cycleSourceKept: false });
  });

  it('Quelle=cycle: nie löschen — Move wird zur Kopie (keine halben Moves)', () => {
    expect(planCellDrop({ sourceEntry: cycle, targetEntries: [], isCopy: false, choice: 'replace' }))
      .toEqual({ clearTarget: false, deleteSource: false, cycleSourceKept: true });
  });

  it('Zyklus-Ziel ohne Delete überschreiben (kein 404)', () => {
    expect(planCellDrop({ sourceEntry: manual, targetEntries: [cycle], isCopy: false, choice: 'replace' }).clearTarget).toBe(false);
  });

  it('Kopie (Alt): Quelle bleibt, kein Zyklus-Hinweis', () => {
    expect(planCellDrop({ sourceEntry: manual, targetEntries: [], isCopy: true, choice: 'replace' }))
      .toEqual({ clearTarget: false, deleteSource: false, cycleSourceKept: false });
  });

  it('„Zusätzlich eintragen" leert das Ziel nicht', () => {
    expect(planCellDrop({ sourceEntry: manual, targetEntries: [manual], isCopy: false, choice: 'add' }).clearTarget).toBe(false);
  });
});
