import { useAuth } from '../contexts/AuthContext';

/**
 * SP5_READONLY: dauerhaftes Banner, wenn die Instanz serverseitig
 * schreibgeschützt betrieben wird (reine Leseansicht, z. B. Viewer-Betrieb
 * auf read-only gemountetem Datenbestand). Die Durchsetzung erfolgt in der
 * API-Middleware (403 für jede Schreibmethode); das Banner und die
 * ausgeblendete Schreib-UI sind die konsistente Optik dazu.
 */
export function ReadOnlyBanner() {
  const { readOnlyInstance, impersonation } = useAuth();

  // Impersonations-Banner hat Vorrang (belegt dieselbe Position)
  if (!readOnlyInstance || impersonation) return null;

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[99998] bg-sky-600 text-white text-sm font-medium flex items-center justify-center gap-2 py-1.5 px-4 shadow-md"
    >
      🔒 Schreibgeschützte Instanz — alle Daten sind nur lesbar.
    </div>
  );
}
