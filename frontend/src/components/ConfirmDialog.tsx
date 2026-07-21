import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Bestätigungsdialog nach Taktwerk-Dialog-Muster (docs/design-system.md §6):
 * Kopf 13px/700 mit Esc-Hint, Fußzeile auf Fläche 2 mit Abbrechen (Outline)
 * und Bestätigen (Umkehrung bzw. Signal bei destruktiven Aktionen).
 */
export function ConfirmDialog({
  open,
  title = 'Bestätigung',
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Barrierefreies Fokus-Management: Tab im Dialog halten (deaktivierte
  // Controls übersprungen), Escape schließt, Fokus geht zurück zum Auslöser.
  const dialogRef = useFocusTrap<HTMLDivElement>(open, { onEscape: onCancel });

  // Dieser Dialog legt den Startfokus lieber auf den Bestätigen-Button statt
  // aufs führende × — den Hook-Default nach dem Scharfen daher übersteuern.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => confirmRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdropIn"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur max-w-md w-full mx-4 overflow-hidden animate-scaleIn"
      >
        {/* Kopf: Titel + Esc-Hint */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-kontur">
          <h2 id="confirm-title" className="text-[13px] font-bold text-schrift">
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="font-mono text-[10px] text-schrift-3 hover:text-schrift px-1.5 py-0.5 rounded-ui border border-kontur transition-colors"
            aria-label="Schließen"
          >
            Esc
          </button>
        </div>

        {/* Message */}
        <p id="confirm-message" className="px-4 py-3.5 text-sm text-schrift-2 leading-relaxed">
          {message}
        </p>

        {/* Fußzeile: Abbrechen (Outline) + Bestätigen (Umkehrung / Signal) */}
        <div className="flex gap-2 justify-end px-4 py-2.5 border-t border-kontur bg-[#fafbfc] dark:bg-[#0e1522]">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-schrift bg-ebene border border-kontur rounded-ui hover:bg-wash transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-3 py-1.5 text-sm font-semibold rounded-ui transition-opacity hover:opacity-90 ${
              danger
                ? 'bg-signal text-white dark:text-[#1a1108]'
                : 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
