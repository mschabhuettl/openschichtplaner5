/**
 * EmptyState — leere Liste/Tabelle; ApiErrorState — fehlgeschlagener API-Call;
 * InlineError — kompakter Fehlerstreifen. Optik nach Taktwerk
 * (docs/design-system.md §6): Icon-Sockel 44px auf Wash, Titel 12.5px/700,
 * Primäraktion = Umkehrung; Error mit Signal-Icon-Feld und Outline-Aktion.
 */

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  /** Render as a table row spanning columns (for inside <tbody>) */
  colSpan?: number;
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  colSpan,
}: EmptyStateProps) {
  const content = (
    <div
      className={`flex flex-col items-center justify-center min-h-[200px] py-14 px-6 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="w-11 h-11 rounded-[10px] bg-wash flex items-center justify-center text-lg opacity-90"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="text-[12.5px] font-bold text-schrift mt-2.5">{title}</h3>
      {description && (
        <p className="text-[11px] leading-relaxed text-schrift-2 max-w-sm mt-1">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2.5 px-[11px] py-[5px] bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] text-[11px] rounded-ui font-semibold hover:opacity-90 transition-opacity"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );

  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan}>{content}</td>
      </tr>
    );
  }

  return content;
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
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
      role="alert"
    >
      <div
        className="w-[26px] h-[26px] rounded-[7px] bg-signal-flaeche flex items-center justify-center text-[13px] font-extrabold text-signal"
        aria-hidden="true"
      >
        !
      </div>
      <p className="text-xs font-bold text-schrift mt-2 mb-1">Fehler beim Laden</p>
      <p className="text-[10.5px] leading-relaxed text-schrift-2 max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-[9px] py-[3px] border border-kontur bg-ebene text-[10.5px] text-schrift rounded-[5px] hover:bg-wash transition-colors"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  );
}

/** Compact inline error banner for secondary data (inside cards etc.) */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex items-center gap-2 rounded-ui bg-signal-flaeche border border-[#eecfcf] dark:border-[#5a2626] px-3 py-2 text-sm text-signal"
      role="alert"
    >
      <span className="font-extrabold" aria-hidden="true">!</span>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs underline hover:no-underline shrink-0"
        >
          Wiederholen
        </button>
      )}
    </div>
  );
}
