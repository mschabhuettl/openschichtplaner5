import { useState, useEffect, useRef, useSyncExternalStore } from 'react';

// ─── Shared online/offline subscription (singleton) ────────
function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

/**
 * useOnlineStatus — reactive hook that tracks browser connectivity.
 *
 * Returns `true` when online, `false` when offline.
 * Uses `useSyncExternalStore` for tear-free reads in React 18+.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

/**
 * useOnlineStatusWithFlash — like useOnlineStatus but also provides
 * a brief `justReconnected` flag (true for 3 s after coming back online).
 */
export function useOnlineStatusWithFlash(): {
  online: boolean;
  justReconnected: boolean;
} {
  const online = useOnlineStatus();
  const [justReconnected, setJustReconnected] = useState(false);
  // Track the previous offline state in a ref: keeping it in state put it in the
  // effect deps, so flipping it re-ran the effect and the cleanup cancelled the
  // 3 s timer before it fired — justReconnected then never cleared. A ref doesn't
  // re-trigger the effect, so the timer survives.
  const wasOfflineRef = useRef(!navigator.onLine);

  useEffect(() => {
    if (!online) {
      wasOfflineRef.current = true;
      setJustReconnected(false);
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setJustReconnected(true);
      const timer = setTimeout(() => setJustReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [online]);

  return { online, justReconnected };
}
