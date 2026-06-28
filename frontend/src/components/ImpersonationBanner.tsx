import { useAuth } from '../contexts/AuthContext';

/**
 * P-B Admin-Impersonation („Als Benutzer ansehen"): persistentes Banner, das
 * dauerhaft anzeigt, wenn ein Admin die App als ein anderer Benutzer ansieht,
 * mit Ein-Klick „Zurück zu mir". Die Durchsetzung (nur lesend, keine Rechte-
 * Eskalation) erfolgt serverseitig; dieses Banner dient der Sichtbarkeit.
 */
export function ImpersonationBanner() {
  const { impersonation, stopImpersonation } = useAuth();

  if (!impersonation) return null;

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[99999] bg-amber-500 text-amber-950 text-sm font-medium flex items-center justify-center gap-3 py-2 px-4 shadow-md"
    >
      <span>
        👁️ Sie sehen die Anwendung als <strong>{impersonation.targetName}</strong> (nur lesend).
      </span>
      <button
        type="button"
        onClick={() => { void stopImpersonation(); }}
        className="rounded bg-amber-950 px-3 py-0.5 text-amber-50 hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-700"
      >
        Zurück zu mir
      </button>
    </div>
  );
}
