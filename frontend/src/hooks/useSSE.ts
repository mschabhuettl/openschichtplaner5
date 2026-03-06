import { useEffect, useRef, useState, useCallback } from 'react';

export type SSEStatus = 'connecting' | 'connected' | 'disconnected';

export type SSEEventType =
  | 'schedule_changed'
  | 'conflict_updated'
  | 'note_added'
  | 'note_updated'
  | 'note_deleted'
  | 'absence_changed'
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
const MAX_RETRIES = 3; // give up after 3 consecutive failures

/**
 * useSSE — connects to /api/events and returns connection status.
 *
 * Automatically reconnects with exponential backoff (max 3 retries).
 * Passes the auth token as a query parameter (EventSource doesn't support headers).
 */
export function useSSE({ token, onEvent, baseUrl }: UseSSEOptions) {
  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const esRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!token) return;

    const base = baseUrl || window.location.origin;
    const url = `${base}/api/events?token=${encodeURIComponent(token)}`;

    setStatus('connecting');
    const es = new EventSource(url);
    esRef.current = es;

    const eventTypes: SSEEventType[] = [
      'connected',
      'schedule_changed',
      'conflict_updated',
      'note_added',
      'absence_changed',
    ];

    const handleEvent = (type: SSEEventType) => (e: MessageEvent) => {
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(e.data); } catch { /* empty data */ }
      onEventRef.current?.({ type, data });
    };

    eventTypes.forEach(type => {
      es.addEventListener(type, handleEvent(type));
    });

    es.addEventListener('connected', () => {
      setStatus('connected');
      retryDelayRef.current = INITIAL_RETRY_DELAY; // reset backoff on success
      retryCountRef.current = 0; // reset retry counter on successful connection
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setStatus('disconnected');

      retryCountRef.current += 1;
      if (retryCountRef.current > MAX_RETRIES) {
        // Gave up after max retries — stay disconnected
        console.warn(`[SSE] gave up after ${MAX_RETRIES} retries`);
        return;
      }

      // Exponential backoff reconnect
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY);
      retryTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [token, baseUrl]);

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      return;
    }
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryDelayRef.current = INITIAL_RETRY_DELAY;
      retryCountRef.current = 0;
    };
  }, [token, connect]);

  return { status };
}
