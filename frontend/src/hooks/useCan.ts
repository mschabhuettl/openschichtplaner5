import { useAuth } from '../contexts/AuthContext';

/**
 * Granulares Rechte-Gating (G-1, Spec 9.5.3): liefert den can(perm)-Helper
 * aus dem AuthContext. Schlüssel sind die 5USER-Flags in Kleinschreibung
 * (wduties/wabsences/wovertimes/wnotes/wdeviation/wcycleass/wswaponly/
 * wpast/addempl/showabs/shownotes/showstats/backup).
 *
 * Fällt auf "alles erlaubt" zurück, wenn der Kontext kein can liefert
 * (Alt-Mocks in Tests) — wie die api sperrt nur ein explizites false.
 */
export function useCan(): (perm: string) => boolean {
  const { can } = useAuth();
  return typeof can === 'function' ? can : () => true;
}
