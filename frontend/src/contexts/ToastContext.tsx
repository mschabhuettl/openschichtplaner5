/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Toast } from '../hooks/useToast';

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Track active message keys to prevent duplicates
  const activeKeys = useRef(new Set<string>());

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const key = `${type}::${message}`;
    // Don't show if same message+type already visible
    if (activeKeys.current.has(key)) return;
    activeKeys.current.add(key);
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    // Errors and warnings stay visible longer than success/info
    const duration = type === 'error' ? 5500 : type === 'warning' ? 4500 : type === 'info' ? 4000 : 3000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      activeKeys.current.delete(key);
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      if (toast) activeKeys.current.delete(`${toast.type}::${toast.message}`);
      return prev.filter(t => t.id !== id);
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useGlobalToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useGlobalToast must be used within ToastProvider');
  return ctx;
}
