/**
 * EmptyState — shown when a list/table has no data.
 * ApiErrorState — shown when an API call fails, with optional retry button.
 */

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="text-5xl mb-4 opacity-60">{icon}</div>
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface ApiErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ApiErrorState({
  message = 'Daten konnten nicht geladen werden.',
  onRetry,
  className = '',
}: ApiErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Fehler beim Laden</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg font-medium transition-colors"
        >
          🔄 Erneut versuchen
        </button>
      )}
    </div>
  );
}

/** Compact inline error banner for secondary data (inside cards etc.) */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
      <span>⚠️</span>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs underline hover:no-underline shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}
