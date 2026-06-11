import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from './usePermissions';
import { useCan } from './useCan';

/**
 * Granulare Schreibrechte für die Plan-Grids (G-1, Spec 9.5.3):
 * kombiniert das Rollen-/Dev-Gating (usePermissions) mit den
 * 5USER-Flags aus /api/auth/me (useCan).
 */
export interface GridWritePerms {
  /** Dienste eintragen/löschen/verschieben (WDUTIES) */
  duties: boolean;
  /** Abwesenheiten eintragen/löschen (WABSENCES) */
  absences: boolean;
  /** Notizen & Plan-Kommentare schreiben (WNOTES) */
  notes: boolean;
  /** Arbeitszeitabweichungen erfassen (WDEVIATION) */
  deviation: boolean;
  /** Änderungen an Tagen vor heute (WPAST) */
  past: boolean;
}

export function useGridPermissions(): GridWritePerms {
  const { canEditSchedule, canEditAbsences } = usePermissions();
  const { canWrite } = useAuth();
  const can = useCan();
  return {
    duties: canEditSchedule && can('wduties'),
    absences: canEditAbsences && can('wabsences'),
    notes: canWrite && can('wnotes'),
    deviation: canWrite && can('wdeviation'),
    past: can('wpast'),
  };
}

/** Liegt dateStr (YYYY-MM-DD) vor todayStr (YYYY-MM-DD)? */
export function isPastDate(dateStr: string, todayStr: string): boolean {
  return dateStr < todayStr;
}

/** Berechnete Schreib-Aktionen für eine Grid-Zelle. */
export interface CellWriteState {
  /** Zelle ist wegen fehlendem WPAST gesperrt (Datum < heute). */
  pastLocked: boolean;
  canAddShift: boolean;
  canAddAbsence: boolean;
  /** Löschen der Zell-Einträge erlaubt (je Eintragsart geprüft). */
  canDelete: boolean;
  /** Drag & Drop der Zell-Einträge erlaubt (Dienste ⇒ WDUTIES). */
  canDrag: boolean;
  /** Tooltip-Text, wenn die Zelle (teilweise) gesperrt ist; sonst null. */
  readOnlyReason: string | null;
}

/**
 * Schreib-Gating einer Plan-Zelle: Dienste nur mit WDUTIES, Abwesenheiten
 * nur mit WABSENCES, Vergangenheits-Edits nur mit WPAST (Spec 9.5.3/9.6).
 */
export function cellWriteState(
  perms: Pick<GridWritePerms, 'duties' | 'absences' | 'past'>,
  dateStr: string,
  todayStr: string,
  entries: ReadonlyArray<{ kind?: string | null }>,
): CellWriteState {
  const pastLocked = isPastDate(dateStr, todayStr) && !perms.past;
  const hasShift = entries.some(e => e.kind !== 'absence');
  const hasAbsence = entries.some(e => e.kind === 'absence');
  // Löschen/Ziehen nur, wenn alle enthaltenen Eintragsarten erlaubt sind
  const kindsAllowed = (!hasShift || perms.duties) && (!hasAbsence || perms.absences);
  const readOnlyReason = pastLocked
    ? 'Vergangenheit gesperrt — keine Berechtigung für rückwirkende Änderungen (WPAST)'
    : !perms.duties && !perms.absences
      ? 'Keine Schreibberechtigung (WDUTIES/WABSENCES)'
      : !perms.duties
        ? 'Keine Schreibberechtigung für Dienste (WDUTIES)'
        : null;
  return {
    pastLocked,
    canAddShift: perms.duties && !pastLocked,
    canAddAbsence: perms.absences && !pastLocked,
    canDelete: entries.length > 0 && kindsAllowed && !pastLocked,
    canDrag: entries.length > 0 && perms.duties && kindsAllowed && !pastLocked,
    readOnlyReason,
  };
}
