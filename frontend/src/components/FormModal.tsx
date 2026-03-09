import { useEffect, useRef, useCallback } from 'react';

interface FormModalProps {
  open: boolean;
  title: string;
  /** Called when backdrop or × is clicked */
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
 * FormModal — wiederverwendbare Modal-Hülle für Formulare.
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
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: cycle focus within the modal panel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, [onClose]);

  // Attach keyboard handler & auto-focus first input when opened
  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    // Auto-focus: try first input, then first focusable element
    setTimeout(() => {
      if (!panelRef.current) return;
      const firstInput = panelRef.current.querySelector<HTMLElement>('input, select, textarea');
      if (firstInput) {
        firstInput.focus();
      } else {
        const firstFocusable = panelRef.current.querySelector<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }, 50);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // Prevent body scroll when modal is open
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
      className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl animate-scaleIn w-full ${SIZE_MAP[size]} mx-4 p-6 ${className}`}
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-modal-title"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 id="form-modal-title" className="text-lg font-bold text-gray-800 dark:text-slate-100">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-xl leading-none p-1 -mr-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Schließen"
        >
          ×
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-sm">
          {error}
        </div>
      )}

      {/* Body */}
      {onSubmit ? (
        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-3">{children}</div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting && (
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {submitLabel}
            </button>
          </div>
        </form>
      ) : (
        <>{children}</>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdropIn"
      onClick={onClose}
    >
      {content}
    </div>
  );
}
