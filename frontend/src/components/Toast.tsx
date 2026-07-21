import { useState } from 'react';
import type { Toast as ToastType } from '../hooks/useToast';

/**
 * Toasts nach Taktwerk-Muster (Interaktions-Referenz): fixed bottom-center,
 * Umkehrungs-Fläche (invertiert zum Theme), 11.5px/600, rise-Animation
 * (140 ms, ease-out). Der Typ bleibt über das Icon + ARIA-Rolle unterscheidbar;
 * die Fläche selbst ist bewusst neutral (Chrome kennt nur Glut + Signal).
 */
interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: string) => void;
}

const typeIcons: Record<ToastType['type'], string> = {
  success: '✓',
  error: '!',
  info: 'ℹ',
  warning: '⚠',
};

const INVERT = 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420]';

const iconClass = (type: ToastType['type']) =>
  type === 'error' || type === 'warning'
    ? 'text-[#e4696f] dark:text-[#be3b3b] font-extrabold'
    : 'opacity-80';

interface ToastItemProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => onRemove(toast.id), 140);
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`
        flex items-center gap-3 px-3.5 py-2.5 rounded-panel text-[11.5px] font-semibold
        shadow-[0_10px_30px_rgba(0,0,0,.4)] pointer-events-auto cursor-pointer
        max-w-sm min-w-[240px] transition-opacity duration-150
        ${removing ? 'opacity-0' : 'animate-rise'}
        ${INVERT}
      `}
      onClick={handleRemove}
      title="Klicken zum Schließen"
    >
      <span className={`text-sm flex-shrink-0 ${iconClass(toast.type)}`} aria-hidden="true">{typeIcons[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={e => { e.stopPropagation(); handleRemove(); }}
        className="ml-1 opacity-60 hover:opacity-100 text-base leading-none"
        aria-label="Benachrichtigung schließen"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-[26px] left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none"
      role="region"
      aria-label="Benachrichtigungen"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Komfort-Komponente für den einfachen Einzel-Toast-Fall
interface ToastProps {
  message: string;
  type?: ToastType['type'];
  onClose: () => void;
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  return (
    <div
      className={`
        fixed bottom-[26px] left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3
        px-3.5 py-2.5 rounded-panel text-[11.5px] font-semibold max-w-sm
        shadow-[0_10px_30px_rgba(0,0,0,.4)] animate-rise
        ${INVERT}
      `}
      onClick={onClose}
    >
      <span className={`text-sm ${iconClass(type)}`} aria-hidden="true">{typeIcons[type]}</span>
      <span>{message}</span>
      <button aria-label="Schließen" onClick={onClose} className="ml-1 opacity-60 hover:opacity-100 text-base">×</button>
    </div>
  );
}
