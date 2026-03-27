import { useEffect, useCallback, useRef } from 'react';

/** Route map for "g then <key>" navigation sequences */
const GO_MAP: Record<string, string> = {
  d: '/',                 // Dashboard
  p: '/schedule',         // dienstPlan
  m: '/employees',        // Mitarbeiter
  k: '/konflikte',        // Konflikte
  s: '/statistiken',      // Statistiken
  u: '/urlaub',           // Urlaub
  e: '/einsatzplan',      // Einsatzplan
  w: '/schichtwuensche',  // Wünsche
  n: '/notizen',          // Notizen
  a: '/analytics',        // Analytics
  q: '/kompetenz-matrix', // Kompetenz-Matrix (Q for Qualifikation)
  t: '/tauschboerse',     // Tauschbörse
  v: '/team',             // Team-Übersicht (V for Verwaltung)
  h: '/health',           // Health Dashboard
  g: '/groups',           // Gruppen
};

/** Alt+key navigation map */
const ALT_MAP: Record<string, string> = {
  t: '/team',
  a: '/analytics',
  h: '/health',
};

interface UseKeyboardShortcutsOptions {
  /** Called to navigate to a path */
  navigate: (path: string) => void;
  /** Toggle spotlight search open/closed */
  onToggleSpotlight: () => void;
  /** Toggle keyboard shortcuts modal */
  onToggleShortcuts: () => void;
  /** Called when "n" is pressed (new item, context-dependent) */
  onNewItem?: () => void;
  /** Current pathname (used for context-dependent actions) */
  pathname?: string;
}

/**
 * Global keyboard shortcuts hook.
 *
 * Listens for keydown events globally, ignoring when user is typing
 * in input/textarea/contenteditable. Supports single keys and
 * "g then <key>" sequences within 1 second.
 */
export function useKeyboardShortcuts({
  navigate,
  onToggleSpotlight,
  onToggleShortcuts,
  onNewItem,
}: UseKeyboardShortcutsOptions) {
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gPendingRef = useRef(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check if user is typing in an input
    const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
    const isTyping =
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      (document.activeElement as HTMLElement)?.isContentEditable;

    // Ctrl+K / Cmd+K — Spotlight search (always fires, even in inputs)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      onToggleSpotlight();
      return;
    }

    if (isTyping) return;

    // "/" key — open Spotlight search
    if (e.key === '/') {
      e.preventDefault();
      onToggleSpotlight();
      return;
    }

    // "?" key — toggle keyboard shortcuts help
    if (e.key === '?') {
      e.preventDefault();
      onToggleShortcuts();
      return;
    }

    // "n" key — new item (context-dependent)
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !gPendingRef.current) {
      if (onNewItem) {
        e.preventDefault();
        onNewItem();
        return;
      }
    }

    // "g" prefix — start sequence
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      gPendingRef.current = true;
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
      gTimerRef.current = setTimeout(() => {
        gPendingRef.current = false;
      }, 1000);
      return;
    }

    // Alt+key shortcuts
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const dest = ALT_MAP[e.key.toLowerCase()];
      if (dest) {
        e.preventDefault();
        navigate(dest);
        return;
      }
    }

    // Second key after "g"
    if (gPendingRef.current) {
      gPendingRef.current = false;
      if (gTimerRef.current) {
        clearTimeout(gTimerRef.current);
        gTimerRef.current = null;
      }
      const dest = GO_MAP[e.key];
      if (dest) {
        e.preventDefault();
        navigate(dest);
      }
    }
  }, [navigate, onToggleSpotlight, onToggleShortcuts, onNewItem]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
