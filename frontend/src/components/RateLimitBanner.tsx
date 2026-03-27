import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * RateLimitBanner — shows a warning banner when the API returns 429.
 * Listens for 'sp5:rate-limited' CustomEvents dispatched by the API client.
 * Auto-dismisses when the countdown expires.
 */
export default function RateLimitBanner() {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setSecondsLeft(0);
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ retry_after: number }>).detail;
      const seconds = detail?.retry_after ?? 60;

      // Reset any existing timer
      clearTimer();

      setSecondsLeft(seconds);
      setVisible(true);

      // Start countdown
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            // Auto-dismiss
            clearTimer();
            setVisible(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    window.addEventListener('sp5:rate-limited', handler);
    return () => {
      window.removeEventListener('sp5:rate-limited', handler);
      clearTimer();
    };
  }, [clearTimer]);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-lg w-full mx-4
        bg-amber-50 border border-amber-400 text-amber-900 px-4 py-3 rounded-lg shadow-lg
        flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
    >
      {/* Warning icon */}
      <svg
        className="h-5 w-5 text-amber-500 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>

      <div className="flex-1 text-sm font-medium">
        Zu viele Anfragen. Bitte{' '}
        <span className="font-bold tabular-nums">{secondsLeft}</span>{' '}
        Sekunden warten.
      </div>

      {/* Dismiss button */}
      <button
        onClick={dismiss}
        className="text-amber-700 hover:text-amber-900 transition-colors p-1 -mr-1"
        aria-label="Schließen"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
