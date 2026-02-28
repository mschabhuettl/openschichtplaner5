/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useRef, useEffect, type ReactNode, useCallback } from 'react';
import { useSSE } from '../hooks/useSSE';
import type { SSEStatus, SSEEventType } from '../hooks/useSSE';
import { useAuth } from './AuthContext';

type Listener = (data: Record<string, unknown>) => void;

interface SSEContextType {
  status: SSEStatus;
  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  subscribe: (eventType: SSEEventType, listener: Listener) => () => void;
}

const SSEContext = createContext<SSEContextType | null>(null);

export function SSEProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const listenersRef = useRef<Map<SSEEventType, Set<Listener>>>(new Map());

  const subscribe = useCallback((eventType: SSEEventType, listener: Listener) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType)!.add(listener);
    return () => {
      listenersRef.current.get(eventType)?.delete(listener);
    };
  }, []);

  const handleEvent = useCallback(({ type, data }: { type: SSEEventType; data: Record<string, unknown> }) => {
    listenersRef.current.get(type)?.forEach(fn => fn(data));
  }, []);

  const { status } = useSSE({
    token,
    onEvent: handleEvent,
  });

  return (
    <SSEContext.Provider value={{ status, subscribe }}>
      {children}
    </SSEContext.Provider>
  );
}

export function useSSEContext(): SSEContextType {
  const ctx = useContext(SSEContext);
  if (!ctx) throw new Error('useSSEContext must be used within SSEProvider');
  return ctx;
}

/** Hook: subscribe to one or more SSE event types and trigger a refresh callback. */
export function useSSERefresh(
  eventTypes: SSEEventType[],
  refresh: () => void,
) {
  const { subscribe } = useSSEContext();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const unsubs = eventTypes.map(type =>
      subscribe(type, () => refreshRef.current())
    );
    return () => unsubs.forEach(u => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);
}
