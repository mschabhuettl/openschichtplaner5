import { lazy, type ComponentType } from 'react';

/**
 * Drop-in replacement for React.lazy that auto-recovers from a failed dynamic
 * import (lazy-chunk load error).
 *
 * Symptom this addresses: after a new deploy the served index.html references
 * fresh chunk hashes; a browser that still holds the previous index (or hits a
 * transient network blip) requests a chunk that no longer exists → the import()
 * rejects with a ChunkLoadError. Without recovery the page-level ErrorBoundary
 * shows „Seite nicht ladbar" and the user has to reload manually („STRG+R lädt
 * sie"). Here we reload once automatically to fetch the current index + chunks.
 *
 * Loop-safe: a sessionStorage guard ensures we reload at most once per failure
 * episode. The guard is cleared on the next successful import, so a later deploy
 * in the same session can recover again. If the import still fails after the
 * reload, the error is rethrown and the ErrorBoundary fallback is shown.
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

export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
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
