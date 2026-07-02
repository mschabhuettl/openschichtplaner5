import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isExtraPath } from '../utils/coreOnly';

/**
 * SP5_CORE_ONLY-Routen-Guard: im Core-Modus rendert er für EXTRA-Pfade
 * (utils/coreOnly, gleiche Liste wie der Nav-Filter) einen Hinweis statt
 * der Seite — kein toter Deep-Link. Die Durchsetzung auf Datenebene ist
 * das serverseitige 404-Gate der API.
 */
export function CoreOnlyGuard({ children }: { children: React.ReactNode }) {
  const { coreOnly } = useAuth();
  const { pathname } = useLocation();
  if (coreOnly && isExtraPath(pathname)) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center shadow-sm">
          <div className="text-3xl mb-2">🔧</div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Im Core-Modus deaktiviert
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Diese Instanz läuft im Original-Funktionsumfang (SP5_CORE_ONLY).
            Diese Zusatzfunktion ist hier abgeschaltet.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
