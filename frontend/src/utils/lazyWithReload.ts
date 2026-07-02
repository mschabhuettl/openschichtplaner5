import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Drop-in-Ersatz für React.lazy, der sich von einem fehlgeschlagenen
 * dynamischen Import (Lazy-Chunk-Ladefehler) selbst erholt.
 *
 * Behobenes Symptom: Nach einem Deploy referenziert die ausgelieferte
 * index.html frische Chunk-Hashes; ein Browser mit der alten index (oder ein
 * kurzer Netz-Schluckauf) fordert einen Chunk an, den es nicht mehr gibt →
 * import() wirft einen ChunkLoadError. Ohne Erholung zeigt die Seiten-
 * ErrorBoundary „Seite nicht ladbar" und der Nutzer muss manuell neu laden
 * („STRG+R lädt sie"). Hier wird einmal automatisch neu geladen, um die
 * aktuelle index + Chunks zu holen.
 *
 * Schleifensicher: ein sessionStorage-Guard erlaubt höchstens einen Reload
 * je Fehler-Episode. Der Guard wird beim nächsten erfolgreichen Import
 * gelöscht, sodass ein späterer Deploy in derselben Session wieder erholen
 * kann. Scheitert der Import auch nach dem Reload, wird der Fehler erneut
 * geworfen und der ErrorBoundary-Fallback erscheint.
 */

const RELOAD_GUARD_KEY = 'sp5-chunk-reloaded';

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message || '';
  return (
    error.name === 'ChunkLoadError' ||
    /dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

// `any` spiegelt Reacts eigene `lazy`-Signatur: Komponenten tragen eigene (oft
// verpflichtende) Prop-Typen, die nicht an ComponentType<unknown> zuweisbar sind.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      // Success → re-arm so a future (e.g. post-deploy) failure can recover too.
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
      return mod;
    } catch (error) {
      if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        window.location.reload();
        // Hang until the reload navigates away so nothing renders in the meantime.
        return new Promise<{ default: T }>(() => {});
      }
      // Not a chunk error, or we already reloaded once → let the ErrorBoundary show.
      throw error;
    }
  });
}
