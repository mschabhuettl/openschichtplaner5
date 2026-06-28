/**
 * Pure Hilfsfunktionen für das Dienstplan-Grid (Schedule.tsx).
 *
 * - Coverage-Ampel-Mapping auf das neue API-Vokabular under|ok|over|none (APP-INT-1)
 * - Multi-Entry-Zellen: mehrere Einträge pro MA/Tag (V-1, Spec 6.7)
 * - Zyklus-Guards für generierte 5CYASS-Dienste (APP-INT-4)
 */
import type { ScheduleEntry } from '../types';
import type { AbsenceInterval, AbsenceTimeOptions, CoverageDay } from '../api/client';

// ── Coverage-Ampel (APP-INT-1) ───────────────────────────────

export type CoverageDotStatus = 'under' | 'ok' | 'over';

const COVERAGE_COLORS: Record<CoverageDotStatus, string> = {
  under: '#f87171', // rot — unterbesetzt
  ok: '#4ade80',    // grün — Soll erfüllt
  over: '#fb923c',  // orange — überbesetzt
};

/**
 * Mapping CoverageDay.status → Ampelpunkt.
 * 'none' (kein Bedarf definiert) → kein Indikator (null).
 */
export function coverageIndicator(
  cov: CoverageDay | undefined | null,
): { status: CoverageDotStatus; color: string } | null {
  if (!cov || cov.status === 'none') return null;
  return { status: cov.status, color: COVERAGE_COLORS[cov.status] };
}

/** Tooltip-Text der Ampel; required_count=null ⇒ „kein Bedarf definiert" (nie „x/null"). */
export function coverageTooltip(cov: CoverageDay): string {
  if (cov.required_count == null) {
    return `${cov.scheduled_count} eingeteilt · kein Bedarf definiert`;
  }
  return `${cov.scheduled_count}/${cov.required_count} Mitarbeiter besetzt`;
}

// ── Multi-Entry-Zellen (V-1) ─────────────────────────────────

/**
 * Baut die Zell-Lookup-Map "empId-day" → ScheduleEntry[].
 * Statt zu überschreiben werden alle Einträge je MA/Tag gesammelt
 * (Dienst + Abwesenheit koexistent, Spec 6.7); Dienste stehen vor Abwesenheiten.
 */
export function buildEntryMap(entries: ScheduleEntry[]): Map<string, ScheduleEntry[]> {
  const m = new Map<string, ScheduleEntry[]>();
  for (const e of entries) {
    const day = parseInt(e.date.split('-')[2]);
    const key = `${e.employee_id}-${day}`;
    const list = m.get(key);
    if (list) list.push(e);
    else m.set(key, [e]);
  }
  // Anzeige-Reihenfolge: Dienste zuerst, Abwesenheiten danach (stabil)
  m.forEach(list => {
    if (list.length > 1) {
      list.sort((a, b) => (a.kind === 'absence' ? 1 : 0) - (b.kind === 'absence' ? 1 : 0));
    }
  });
  return m;
}

// ── Zyklus-Guards (APP-INT-4) ────────────────────────────────

/** Generierter Zyklusdienst (5CYASS-Expansion) ohne eigenen 5MASHI-Datensatz? */
export function isCycleEntry(e: ScheduleEntry | undefined | null): boolean {
  return e?.source === 'cycle';
}

/** Enthält die Zelle mindestens einen echten (löschbaren) DB-Eintrag? */
export function hasDeletableEntry(entries: ScheduleEntry[]): boolean {
  return entries.some(e => !isCycleEntry(e));
}

/**
 * Vormonat-Kopie: nur manuelle Schichteinträge übernehmen —
 * Zyklusdienste (source==='cycle') dürfen nicht mit-materialisiert werden.
 */
export function filterPrevMonthCopyEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries.filter(e => e.kind === 'shift' && !!e.shift_id && !isCycleEntry(e));
}

/**
 * „Zusätzlich eintragen" möglich? 5MASHI erlaubt nur einen Schichteintrag
 * pro MA/Tag — ein zweiter Dienst neben einem echten Dienst würde 409 liefern.
 * (Ein Zyklusdienst zählt nicht: er wird durch den neuen 5MASHI-Eintrag überschrieben.)
 */
export function canAddWithoutReplace(
  existing: ScheduleEntry[],
  incomingKind: 'shift' | 'absence',
): boolean {
  if (incomingKind === 'absence') return true;
  return !existing.some(e => e.kind === 'shift' && !isCycleEntry(e));
}

// ── Drag & Drop-Planung (APP-INT-4: halbe Moves vermeiden) ───

export interface DropPlan {
  /** Ziel-Zelle vor dem Schreiben leeren (nur wenn dort echte DB-Einträge liegen). */
  clearTarget: boolean;
  /** Quelle nach erfolgreichem Anlegen löschen (Move); bei Zyklus-Quelle nie. */
  deleteSource: boolean;
  /** Zyklus-Quelle bleibt bestehen — der Move wird faktisch zur Kopie. */
  cycleSourceKept: boolean;
}

export function planCellDrop(opts: {
  sourceEntry: ScheduleEntry;
  targetEntries: ScheduleEntry[];
  isCopy: boolean;
  choice: 'add' | 'replace';
}): DropPlan {
  const cycleSource = isCycleEntry(opts.sourceEntry);
  return {
    // Zyklus-Ziel ohne Delete überschreiben: nur echte Einträge löschen
    clearTarget: opts.choice === 'replace' && hasDeletableEntry(opts.targetEntries),
    deleteSource: !opts.isCopy && !cycleSource,
    cycleSourceKept: !opts.isCopy && cycleSource,
  };
}

// ── Konflikt-Strategie (V-2): merkbarer Default für belegte Felder ──

export type ConflictStrategy = 'ask' | 'add' | 'replace';

const CONFLICT_STRATEGY_KEY = 'sp5-schedule-conflict-strategy';

/** Gespeicherte Standard-Strategie für belegte Felder ('ask' = immer fragen). */
export function getConflictStrategy(): ConflictStrategy {
  try {
    const v = localStorage.getItem(CONFLICT_STRATEGY_KEY);
    return v === 'add' || v === 'replace' ? v : 'ask';
  } catch {
    return 'ask';
  }
}

export function setConflictStrategy(s: ConflictStrategy): void {
  try {
    if (s === 'ask') localStorage.removeItem(CONFLICT_STRATEGY_KEY);
    else localStorage.setItem(CONFLICT_STRATEGY_KEY, s);
  } catch {
    /* localStorage nicht verfügbar — Strategie bleibt 'ask' */
  }
}

// ── Teiltags-Abwesenheiten (V-3, 5ABSEN.INTERVAL) ────────────

export interface AbsenceTimeState {
  interval: AbsenceInterval;
  start_time: string;
  end_time: string;
  /** Optionaler Kommentartext (nur bei nicht-ganztägig); wird als Dienstplan-Notiz gespeichert. */
  comment: string;
}

export const DEFAULT_ABSENCE_TIME: AbsenceTimeState = {
  interval: 0,
  start_time: '08:00',
  end_time: '12:00',
  comment: '',
};

/** "HH:MM" → Minuten ab Mitternacht (0..1439); ungültige Eingabe → 0. */
function hhmmToMinutes(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return 0;
  return h * 60 + min;
}

/**
 * State → API-Optionen; ganztägig (0) braucht keine Optionen. Die API erwartet
 * START/END als Minuten ab Mitternacht (int), nicht als "HH:MM" — der
 * type="time"-Picker liefert "HH:MM", deshalb wird hier umgerechnet.
 */
export function toAbsenceTimeOptions(v: AbsenceTimeState): AbsenceTimeOptions | undefined {
  if (v.interval === 0) return undefined;
  // Kommentar nur bei nicht-ganztägiger Eintragung (analog Original-Dialog).
  const comment = (v.comment ?? '').trim();
  const commentOpt = comment ? { comment } : {};
  if (v.interval === 3)
    return { interval: 3, start_time: hhmmToMinutes(v.start_time), end_time: hhmmToMinutes(v.end_time), ...commentOpt };
  return { interval: v.interval, ...commentOpt };
}
