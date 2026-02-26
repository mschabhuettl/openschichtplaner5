import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
  const { user, isDevMode, canWriteDuties, canWriteAbsences, canAdmin } = useAuth();

  return {
    // Kann Schicht im Dienstplan setzen/löschen?
    canEditSchedule: isDevMode || canWriteDuties,
    // Kann Abwesenheiten eintragen?
    canEditAbsences: isDevMode || canWriteAbsences,
    // Kann Stammdaten bearbeiten (Mitarbeiter, Schichten etc.)?
    canEditMasterData: isDevMode || (user?.WACCEMWND ?? false),
    // Kann Admin-Bereich sehen?
    canSeeAdmin: isDevMode || canAdmin,
    // Kann Backup machen?
    canDoBackup: isDevMode || (user?.BACKUP ?? false),
  };
}
