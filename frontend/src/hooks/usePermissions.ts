import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
  const { user, isDevMode, devViewRole, canWriteDuties, canWriteAbsences, canAdmin } = useAuth();

  // In dev mode with the highest ('admin') view-role: full access
  const isFullDevView = isDevMode && (devViewRole === 'admin');

  return {
    // Kann Schicht im Dienstplan setzen/löschen?
    canEditSchedule: isFullDevView || canWriteDuties,
    // Kann Abwesenheiten eintragen?
    canEditAbsences: isFullDevView || canWriteAbsences,
    // Kann Stammdaten bearbeiten (Mitarbeiter, Schichten etc.)?
    canEditMasterData: isFullDevView || (user?.WACCEMWND ?? false),
    // Kann Admin-Bereich sehen?
    canSeeAdmin: isFullDevView || canAdmin,
    // Kann Backup machen?
    canDoBackup: isFullDevView || (user?.BACKUP ?? false),
  };
}
