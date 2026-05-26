/**
 * Tests for SSEContext — the pub/sub layer over useSSE. The underlying useSSE
 * hook and the auth context are mocked: the mock captures the onEvent callback
 * so tests can synthesise server events and assert listener dispatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SSEEventType } from '../hooks/useSSE';

const sseMock: { onEvent?: (e: { type: SSEEventType; data: Record<string, unknown> }) => void; status: string } = {
  status: 'connected',
};
vi.mock('../hooks/useSSE', () => ({
  useSSE: (opts: { onEvent?: (e: { type: SSEEventType; data: Record<string, unknown> }) => void }) => {
    sseMock.onEvent = opts.onEvent;
    return { status: sseMock.status };
  },
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ token: 'tok' }) }));

import { SSEProvider, useSSEContext, useSSERefresh } from '../contexts/SSEContext';

function fire(type: SSEEventType, data: Record<string, unknown> = {}) {
  act(() => sseMock.onEvent?.({ type, data }));
}

describe('SSEContext', () => {
  beforeEach(() => {
    sseMock.status = 'connected';
    sseMock.onEvent = undefined;
  });

  it('passes the useSSE status through', () => {
    sseMock.status = 'connecting';
    const { result } = renderHook(() => useSSEContext(), { wrapper: SSEProvider });
    expect(result.current.status).toBe('connecting');
  });

  it('delivers events to a subscriber of the matching type', () => {
    const { result } = renderHook(() => useSSEContext(), { wrapper: SSEProvider });
    const listener = vi.fn();
    act(() => {
      result.current.subscribe('schedule_changed', listener);
    });
    fire('schedule_changed', { id: 5 });
    expect(listener).toHaveBeenCalledWith({ id: 5 });
  });

  it('does not deliver events of a different type', () => {
    const { result } = renderHook(() => useSSEContext(), { wrapper: SSEProvider });
    const listener = vi.fn();
    act(() => {
      result.current.subscribe('schedule_changed', listener);
    });
    fire('note_added', {});
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe stops further delivery', () => {
    const { result } = renderHook(() => useSSEContext(), { wrapper: SSEProvider });
    const listener = vi.fn();
    let unsub!: () => void;
    act(() => {
      unsub = result.current.subscribe('conflict_updated', listener);
    });
    fire('conflict_updated');
    act(() => unsub());
    fire('conflict_updated');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('dispatches to every listener registered for a type', () => {
    const { result } = renderHook(() => useSSEContext(), { wrapper: SSEProvider });
    const a = vi.fn();
    const b = vi.fn();
    act(() => {
      result.current.subscribe('employee_changed', a);
      result.current.subscribe('employee_changed', b);
    });
    fire('employee_changed', { n: 1 });
    expect(a).toHaveBeenCalledWith({ n: 1 });
    expect(b).toHaveBeenCalledWith({ n: 1 });
  });

  it('useSSERefresh fires the callback on any subscribed type and stops on unmount', () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(
      () => useSSERefresh(['note_added', 'note_updated'], refresh),
      { wrapper: SSEProvider },
    );
    fire('note_added');
    fire('note_updated');
    expect(refresh).toHaveBeenCalledTimes(2);
    fire('schedule_changed'); // not subscribed
    expect(refresh).toHaveBeenCalledTimes(2);
    unmount();
    fire('note_added');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('useSSEContext throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSSEContext())).toThrow(/within SSEProvider/);
    spy.mockRestore();
  });
});
