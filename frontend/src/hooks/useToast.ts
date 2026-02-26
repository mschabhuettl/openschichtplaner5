// useToast is now backed by the global ToastContext (ToastProvider in App.tsx).
// Import this hook anywhere — no local state needed, no per-page <ToastContainer>.
export { useGlobalToast as useToast } from '../contexts/ToastContext';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}
