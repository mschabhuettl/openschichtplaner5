import { useEffect, useRef } from 'react';

/**
 * Selector for focusable elements inside a dialog. Note the `:not([disabled])`
 * guards — a disabled button/input must NOT be a tab stop, otherwise the trap
 * can land focus on an inert control (e.g. a "Submit" button that is disabled
 * until the form is valid) and the keyboard user appears stuck.
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
   * When true, initial focus prefers the first text input/textarea over the
   * first focusable element — the natural starting point for a form dialog.
   */
  preferInput?: boolean;
}

/**
 * useFocusTrap — accessible modal focus management in one hook.
 *
 * While `active` is true it:
 *  - remembers the element that had focus and restores it on close/unmount
 *    (WCAG 2.4.3 — focus order),
 *  - moves focus into the dialog container,
 *  - cycles Tab / Shift+Tab within the container so focus can't escape to the
 *    page behind the modal (WCAG 2.1.2 — no keyboard trap on the page), and
 *  - invokes `onEscape` on the Escape key.
 *
 * Attach the returned ref to the dialog panel element.
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

  // Keep the latest onEscape callback in a ref so the keydown handler always
  // calls the current one without re-arming (and re-focusing) the trap each
  // time the parent passes a fresh inline callback.
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

    // Move focus into the dialog (deferred so the panel is mounted/painted).
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
        // Nothing focusable — keep focus pinned to the container.
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
