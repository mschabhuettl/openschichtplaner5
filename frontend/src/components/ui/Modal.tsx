import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * Modal-Primitive des Design-Systems (Taktwerk-Dialog, docs/design-system.md §6)
 * für Nicht-Formular-Fälle (Bestätigung, Detail-Anzeige). Formulare nutzen
 * FormModal. Verhalten: ESC schließt, Backdrop-Klick schließt, Fokus-Falle mit
 * Rückgabe des Fokus (useFocusTrap) — identisch über alle Ansichten.
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
  /** Optionale Aktionsleiste unten (Buttons); ohne footer nur Inhalt + Esc. */
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
        className={`w-full ${sizeClass} rounded-[10px] bg-ebene shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur flex flex-col max-h-[90vh] overflow-hidden`}
      >
        <div className="flex items-center justify-between border-b border-kontur px-4 py-3">
          <h2 className="text-[13px] font-bold text-schrift">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="font-mono text-[10px] text-schrift-3 hover:text-schrift px-1.5 py-0.5 rounded-ui border border-kontur transition-colors"
          >
            Esc
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 text-schrift">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-kontur px-4 py-2.5 bg-[#fafbfc] dark:bg-[#0e1522]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
