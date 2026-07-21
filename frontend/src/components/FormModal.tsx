import { useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface FormModalProps {
  open: boolean;
  title: string;
  /** Called when backdrop or Esc is clicked */
  onClose: () => void;
  /** Called on form submit */
  onSubmit?: (e: React.FormEvent) => void;
  /** Label for the primary action button (default: "Speichern") */
  submitLabel?: string;
  /** Show spinner on submit button */
  submitting?: boolean;
  /** Error message to display inside the modal */
  error?: string | null;
  /** Extra Tailwind classes for the modal panel */
  className?: string;
  children: React.ReactNode;
  /** Width preset (default: "md") */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const SIZE_MAP: Record<NonNullable<FormModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

/**
 * FormModal — wiederverwendbare Modal-Hülle für Formulare
 * (Taktwerk-Dialog, docs/design-system.md §6: Kopf 13px/700 + Esc-Hint,
 * Fußzeile auf Fläche 2, Primär = Umkehrung, Sekundär = Outline).
 *
 * Usage:
 *   <FormModal open={showModal} title="Neue Gruppe" onClose={() => setShowModal(false)}
 *              onSubmit={handleSubmit} submitting={saving} error={error}>
 *     <input ... />
 *   </FormModal>
 */
export function FormModal({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = 'Speichern',
  submitting = false,
  error,
  className = '',
  children,
  size = 'md',
}: FormModalProps) {
  // Barrierefreies Fokus-Management: Tab im Panel halten (deaktivierte
  // Controls übersprungen), erstes Eingabefeld bevorzugen, Escape schließt,
  // Fokus geht beim Schließen zurück zum Auslöser. Siehe useFocusTrap.
  const panelRef = useFocusTrap<HTMLDivElement>(open, {
    onEscape: onClose,
    preferInput: true,
  });

  // Body-Scroll bei offenem Modal unterbinden
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const content = (
    <div
      className={`bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full ${SIZE_MAP[size]} mx-4 max-h-[90vh] flex flex-col overflow-hidden ${className}`}
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-modal-title"
      onClick={e => e.stopPropagation()}
    >
      {/* Kopf: Titel + Esc-Hint */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-kontur">
        <h2 id="form-modal-title" className="text-[13px] font-bold text-schrift">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[10px] text-schrift-3 hover:text-schrift px-1.5 py-0.5 rounded-ui border border-kontur transition-colors"
          aria-label="Schließen"
        >
          Esc
        </button>
      </div>

      <div className="px-4 py-3 overflow-y-auto">
        {/* Error */}
        {error && (
          <div className="mb-3 p-2 bg-signal-flaeche border border-[#eecfcf] dark:border-[#5a2626] text-signal rounded-ui text-sm">
            {error}
          </div>
        )}

        {/* Body */}
        {onSubmit ? (
          <form onSubmit={onSubmit} noValidate>
            <div className="space-y-3">{children}</div>
            <div className="flex justify-end gap-2 mt-5 -mx-4 -mb-3 px-4 py-2.5 border-t border-kontur bg-[#fafbfc] dark:bg-[#0e1522]">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-schrift bg-ebene border border-kontur rounded-ui hover:bg-wash transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-1.5 text-sm font-semibold rounded-ui bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
              >
                {submitting && (
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
                )}
                {submitLabel}
                <span className="font-mono text-[9px] opacity-55" aria-hidden="true">⏎</span>
              </button>
            </div>
          </form>
        ) : (
          <>{children}</>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdropIn"
      onClick={onClose}
    >
      {content}
    </div>
  );
}
