import { useEffect, useRef, useState, useCallback } from 'react';

export type SSEStatus = 'connecting' | 'connected' | 'disconnected';

export type SSEEventType =
  | 'schedule_changed'
  | 'conflict_updated'
  | 'note_added'
  | 'note_updated'
  | 'note_deleted'
  | 'absence_changed'
  | 'employee_changed'
  | 'notification_changed'
  | 'swap_changed'
  | 'settings_changed'
  | 'connected';

interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

interface UseSSEOptions {
  /** Called whenever an SSE event arrives */
  onEvent?: (event: SSEEvent) => void;
  /** Auth token — if null, SSE won't connect */
  token: string | null;
  /** Base URL (defaults to window.location.origin) */
  baseUrl?: string;
}

const MAX_RETRY_DELAY = 30_000; // 30s cap
const INITIAL_RETRY_DELAY = 1_000; // 1s

/**
 * useSSE — connects to /api/events and returns connection status.
 *
 * Automatically reconnects with exponential backoff (unlimited retries).
 * Uses Page Visibility API to pause/resume when tab is hidden/visible.
 * Passes the auth token as a query parameter (EventSource doesn't support headers).
 */
export function useSSE({ token, onEvent, baseUrl }: UseSSEOptions) {
  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const esRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const tokenRef = useRef(token);
  onEventRef.current = onEvent;
  tokenRef.current = token;

  const cleanup = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;

    // Clean up any existing connection first
    cleanup();

    const base = baseUrl || window.location.origin;
    const url = `${base}/api/events?token=${encodeURIComponent(currentToken)}`;

    setStatus('connecting');
    const es = new EventSource(url);
    esRef.current = es;

    const ALL_EVENT_TYPES: SSEEventType[] = [
      'connected',
      'schedule_changed',
      'conflict_updated',
      'note_added',
      'note_updated',
      'note_deleted',
      'absence_changed',
      'employee_changed',
      'notification_changed',
      'swap_changed',
      'settings_changed',
    ];

    const handleEvent = (type: SSEEventType) => (e: MessageEvent) => {
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(e.data); } catch { /* empty data */ }
      onEventRef.current?.({ type, data });
    };

    ALL_EVENT_TYPES.forEach(type => {
      es.addEventListener(type, handleEvent(type));
    });

    es.addEventListener('connected', () => {
      setStatus('connected');
      retryDelayRef.current = INITIAL_RETRY_DELAY; // reset backoff on success
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setStatus('disconnected');

      // Only retry if tab is visible
      if (document.visibilityState === 'hidden') return;

      // Exponential backoff reconnect (unlimited retries)
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY);
      retryTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [baseUrl, cleanup]);

  // Page Visibility API: reconnect when tab becomes visible, disconnect when hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible — reconnect if disconnected
        if (!esRef.current || esRef.current.readyState === EventSource.CLOSED) {
          retryDelayRef.current = INITIAL_RETRY_DELAY;
          connect();
        }
      } else {
        // Tab hidden — close connection to save resources
        cleanup();
        setStatus('disconnected');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [connect, cleanup]);

  // Online/offline detection: reconnect when network comes back
  useEffect(() => {
    const handleOnline = () => {
      if (document.visibilityState === 'visible' && tokenRef.current) {
        retryDelayRef.current = INITIAL_RETRY_DELAY;
        connect();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [connect]);

  useEffect(() => {
    if (!token) {
      cleanup();
      setStatus('disconnected');
      return;
    }
    connect();
    return () => {
      cleanup();
      retryDelayRef.current = INITIAL_RETRY_DELAY;
    };
  }, [token, connect, cleanup]);

  return { status };
}
