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
 * Nutzt `useSyncExternalStore` für riss-freie Reads ab React 18.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

/**
 * useOnlineStatusWithFlash — like useOnlineStatus but also provides
 * ein kurzes `justReconnected`-Flag (3 s lang true nach der Rückkehr online).
 */
export function useOnlineStatusWithFlash(): {
  online: boolean;
  justReconnected: boolean;
} {
  const online = useOnlineStatus();
  const [justReconnected, setJustReconnected] = useState(false);
  // Vorherigen Offline-Zustand in einer Ref führen: als State stand er in den
  // Effect-Deps — das Umschalten ließ den Effect neu laufen und der Cleanup brach den
  // 3 s timer before it fired — justReconnected then never cleared. A ref doesn't
  // Effect nicht erneut aus, der Timer überlebt.
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
