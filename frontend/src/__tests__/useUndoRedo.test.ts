/**
 * Tests for the useUndoRedo hook — the undo/redo stack used by the schedule editor.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo, type UndoableAction } from '../hooks/useUndoRedo';

function mkAction(label = 'a'): UndoableAction {
  return { type: 'delete_entry', label, undoData: {}, redoData: {}, timestamp: Date.now() };
}

const ok = () => ({ onUndo: vi.fn().mockResolvedValue(undefined), onRedo: vi.fn().mockResolvedValue(undefined) });

describe('useUndoRedo', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useUndoRedo(ok()));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.lastAction).toBeNull();
  });

  it('push enables undo and clears redo', () => {
    const { result } = renderHook(() => useUndoRedo(ok()));
    act(() => result.current.push(mkAction()));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo runs onUndo and moves the action to the redo stack', async () => {
    const cbs = ok();
    const { result } = renderHook(() => useUndoRedo(cbs));
    act(() => result.current.push(mkAction('x')));
    await act(async () => { await result.current.undo(); });
    expect(cbs.onUndo).toHaveBeenCalledWith(expect.objectContaining({ label: 'x' }));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.lastAction?.direction).toBe('undo');
  });

  it('redo runs onRedo and moves the action back to the past', async () => {
    const cbs = ok();
    const { result } = renderHook(() => useUndoRedo(cbs));
    act(() => result.current.push(mkAction('y')));
    await act(async () => { await result.current.undo(); });
    await act(async () => { await result.current.redo(); });
    expect(cbs.onRedo).toHaveBeenCalledWith(expect.objectContaining({ label: 'y' }));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.lastAction?.direction).toBe('redo');
  });

  it('push after an undo clears the redo stack', async () => {
    const { result } = renderHook(() => useUndoRedo(ok()));
    act(() => result.current.push(mkAction('1')));
    await act(async () => { await result.current.undo(); });
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.push(mkAction('2')));
    expect(result.current.canRedo).toBe(false);
  });

  it('undo/redo on empty stacks are no-ops', async () => {
    const cbs = ok();
    const { result } = renderHook(() => useUndoRedo(cbs));
    await act(async () => { await result.current.undo(); });
    await act(async () => { await result.current.redo(); });
    expect(cbs.onUndo).not.toHaveBeenCalled();
    expect(cbs.onRedo).not.toHaveBeenCalled();
  });

  it('leaves the stack intact when onUndo rejects', async () => {
    const onUndo = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useUndoRedo({ onUndo, onRedo: vi.fn() }));
    act(() => result.current.push(mkAction()));
    await act(async () => { await result.current.undo(); });
    expect(onUndo).toHaveBeenCalled();
    expect(result.current.canUndo).toBe(true);   // rollback: stack unchanged
    expect(result.current.canRedo).toBe(false);
  });

  it('clearLastAction resets the status', async () => {
    const { result } = renderHook(() => useUndoRedo(ok()));
    act(() => result.current.push(mkAction()));
    await act(async () => { await result.current.undo(); });
    expect(result.current.lastAction).not.toBeNull();
    act(() => result.current.clearLastAction());
    expect(result.current.lastAction).toBeNull();
  });
});
