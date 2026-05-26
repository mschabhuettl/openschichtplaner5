/**
 * Tests for useSSE — the Server-Sent-Events client hook.
 * EventSource is not implemented in jsdom, so a minimal mock stands in,
 * exposing helpers to emit named events, deliver raw payloads, and trigger
 * the error path. Visibility is faked via a redefined document property.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE } from '../hooks/useSSE';

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: MockEventSource[] = [];

  url: string;
  readyState = MockEventSource.CONNECTING;
  onerror: ((e: unknown) => void) | null = null;
  private listeners: Record<string, ((e: MessageEvent) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ||= []).push(cb);
  }
  close() {
    this.readyState = MockEventSource.CLOSED;
  }
  /** Emit a named event with a JSON-encoded data payload. */
  emit(type: string, data: unknown = {}) {
    const e = { data: JSON.stringify(data) } as MessageEvent;
    (this.listeners[type] || []).forEach((cb) => cb(e));
  }
  /** Emit a named event with a raw (possibly malformed) data string. */
  emitRaw(type: string, raw: string) {
    (this.listeners[type] || []).forEach((cb) => cb({ data: raw } as MessageEvent));
  }
  /** Trigger the EventSource error handler. */
  fail() {
    this.onerror?.({});
  }

  static get last() {
    return this.instances[this.instances.length - 1];
  }
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

describe('useSSE', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not connect without a token', () => {
    const { result } = renderHook(() => useSSE({ token: null }));
    expect(result.current.status).toBe('disconnected');
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('connects with a token and puts the auth token in the URL', () => {
    const { result } = renderHook(() => useSSE({ token: 'ab/cd' }));
    expect(result.current.status).toBe('connecting');
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.last.url).toContain('/api/v1/events?token=ab%2Fcd');
  });

  it('honours a custom baseUrl', () => {
    renderHook(() => useSSE({ token: 't', baseUrl: 'https://api.example.test' }));
    expect(MockEventSource.last.url).toBe('https://api.example.test/api/v1/events?token=t');
  });

  it('flips to "connected" on the connected event', () => {
    const { result } = renderHook(() => useSSE({ token: 't' }));
    act(() => MockEventSource.last.emit('connected'));
    expect(result.current.status).toBe('connected');
  });

  it('forwards parsed event payloads via onEvent', () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ token: 't', onEvent }));
    act(() => MockEventSource.last.emit('schedule_changed', { id: 7 }));
    expect(onEvent).toHaveBeenCalledWith({ type: 'schedule_changed', data: { id: 7 } });
  });

  it('tolerates malformed JSON, delivering empty data', () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ token: 't', onEvent }));
    act(() => MockEventSource.last.emitRaw('note_added', 'not-json{'));
    expect(onEvent).toHaveBeenCalledWith({ type: 'note_added', data: {} });
  });

  it('reconnects with backoff after an error while visible', () => {
    const { result } = renderHook(() => useSSE({ token: 't' }));
    expect(MockEventSource.instances).toHaveLength(1);
    act(() => MockEventSource.last.fail());
    expect(result.current.status).toBe('disconnected');
    // first retry after the 1s initial delay
    act(() => vi.advanceTimersByTime(1000));
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it('does not reconnect after an error while the tab is hidden', () => {
    renderHook(() => useSSE({ token: 't' }));
    setVisibility('hidden');
    act(() => MockEventSource.last.fail());
    act(() => vi.advanceTimersByTime(60_000));
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('disconnects and closes the stream when the token is cleared', () => {
    const { result, rerender } = renderHook(({ token }) => useSSE({ token }), {
      initialProps: { token: 't' as string | null },
    });
    const es = MockEventSource.last;
    rerender({ token: null });
    expect(result.current.status).toBe('disconnected');
    expect(es.readyState).toBe(MockEventSource.CLOSED);
  });

  it('reconnects when the network comes back online', () => {
    renderHook(() => useSSE({ token: 't' }));
    act(() => MockEventSource.last.fail()); // drop the connection (timer pending)
    act(() => window.dispatchEvent(new Event('online')));
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderHook(() => useSSE({ token: 't' }));
    const es = MockEventSource.last;
    unmount();
    expect(es.readyState).toBe(MockEventSource.CLOSED);
  });
});
