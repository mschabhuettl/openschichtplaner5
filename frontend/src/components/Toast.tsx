import { useState, useEffect } from 'react';
import type { Toast as ToastType } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: string) => void;
}

const typeStyles: Record<ToastType['type'], string> = {
  success: 'bg-green-600 text-white border-green-700',
  error: 'bg-red-600 text-white border-red-700',
  info: 'bg-blue-600 text-white border-blue-700',
  warning: 'bg-amber-500 text-white border-amber-600',
};

const typeIcons: Record<ToastType['type'], string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

interface ToastItemProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  // When toast is removed externally (auto-timeout), trigger exit animation
  useEffect(() => {
    return () => {
      // cleanup — no action needed, external removal goes through state
    };
  }, []);

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`
        flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium
        pointer-events-auto cursor-pointer
        ${removing ? 'animate-slideOut' : 'animate-slideIn'}
        max-w-sm min-w-[240px]
        ${typeStyles[toast.type]}
      `}
      onClick={handleRemove}
      title="Klicken zum Schließen"
    >
      <span className="text-base flex-shrink-0" aria-hidden="true">{typeIcons[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={e => { e.stopPropagation(); handleRemove(); }}
        className="ml-1 opacity-70 hover:opacity-100 text-lg leading-none"
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
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
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

// Convenience single-toast component for simple usage
interface ToastProps {
  message: string;
  type?: ToastType['type'];
  onClose: () => void;
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  return (
    <div
      className={`
        fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3
        rounded-lg shadow-lg border text-sm font-medium max-w-sm
        animate-slideIn
        ${typeStyles[type]}
      `}
      onClick={onClose}
    >
      <span className="text-base">{typeIcons[type]}</span>
      <span>{message}</span>
      <button aria-label="Schließen" onClick={onClose} className="ml-1 opacity-70 hover:opacity-100 text-lg">×</button>
    </div>
  );
}
