import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * Modal-Primitive des Design-Systems (UX-Audit B4) für Nicht-Formular-Fälle
 * (Bestätigung, Detail-Anzeige). Formulare nutzen FormModal. Verhalten:
 * ESC schließt, Backdrop-Klick schließt, Fokus-Falle mit Rückgabe des Fokus
 * (useFocusTrap) — identisch über alle Ansichten.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optionale Aktionsleiste unten (Buttons); ohne footer nur Inhalt + ×. */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(open, { onEscape: onClose });
  if (!open) return null;
  const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' }[size];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${sizeClass} rounded-xl bg-white dark:bg-slate-800 shadow-xl flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
