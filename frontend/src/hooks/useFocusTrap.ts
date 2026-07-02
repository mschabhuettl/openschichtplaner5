import { useEffect, useRef } from 'react';

/**
 * Selektor für fokussierbare Elemente in einem Dialog. Wichtig sind die
 * `:not([disabled])`-Guards — ein deaktivierter Button/Input darf KEIN
 * Tab-Stopp sein, sonst landet die Falle auf einem toten Control (z. B. dem
 * bis zur Formular-Gültigkeit deaktivierten Speichern-Button) und der
 * Tastatur-Nutzer wirkt festgefahren.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface FocusTrapOptions {
  /** Called when Escape is pressed while the trap is active. */
  onEscape?: () => void;
  /**
   * Wenn true, bevorzugt der Startfokus das erste Text-Input/Textarea vor dem
   * ersten fokussierbaren Element — der natürliche Einstieg eines Formulardialogs.
   */
  preferInput?: boolean;
}

/**
 * useFocusTrap — barrierefreies Modal-Fokus-Management in einem Hook.
 *
 * Solange `active` true ist:
 *  - merkt sich das fokussierte Element und stellt es beim Schließen/Unmount
 *    wieder her (WCAG 2.4.3 — Fokus-Reihenfolge),
 *  - setzt den Fokus in den Dialog-Container,
 *  - hält Tab / Shift+Tab im Container (Fokus kann nicht auf die Seite hinter
 *    dem Modal entkommen — WCAG 2.1.2, keine Tastaturfalle) und
 *  - ruft `onEscape` bei der Escape-Taste.
 *
 * Die zurückgegebene Ref ans Dialog-Panel hängen.
 *
 * Usage:
 *   const ref = useFocusTrap<HTMLDivElement>(open, { onEscape: onClose });
 *   return <div ref={ref} role="dialog" aria-modal="true">…</div>;
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  options: FocusTrapOptions = {},
) {
  const containerRef = useRef<T>(null);
  const { preferInput = false } = options;

  // Den neuesten onEscape-Callback in einer Ref halten, damit der keydown-
  // Handler immer den aktuellen ruft, ohne die Falle bei jedem frischen
  // Inline-Callback des Parents neu zu scharfen (und neu zu fokussieren).
  const onEscapeRef = useRef(options.onEscape);
  useEffect(() => {
    onEscapeRef.current = options.onEscape;
  }, [options.onEscape]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Fokus in den Dialog setzen (verzögert, bis das Panel gemountet/gezeichnet ist).
    const initial = preferInput
      ? container.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled])',
        ) ?? focusables()[0]
      : focusables()[0];
    const focusTimer = window.setTimeout(() => initial?.focus(), 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscapeRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        // Nichts fokussierbar — Fokus am Container festhalten.
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const outside = !container.contains(current);

      if (e.shiftKey) {
        if (current === first || outside) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || outside) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [active, preferInput]);

  return containerRef;
}
