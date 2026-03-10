import { useState, useCallback, useEffect, useRef } from 'react';

// ── Action types for undo/redo ──────────────────────────────
export type UndoableActionType = 'create_sonderdienst' | 'create_deviation' | 'delete_entry';

export interface UndoableAction {
  type: UndoableActionType;
  label: string;           // Human-readable label, e.g. "Sonderdienst Frühschicht für Max"
  /** Data needed to undo this action */
  undoData: Record<string, unknown>;
  /** Data needed to redo this action */
  redoData: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

interface UndoRedoState {
  past: UndoableAction[];
  future: UndoableAction[];
}

const MAX_HISTORY = 30;

interface UseUndoRedoOptions {
  /** Called to execute an undo action — should call the appropriate API */
  onUndo: (action: UndoableAction) => Promise<void>;
  /** Called to execute a redo action — should call the appropriate API */
  onRedo: (action: UndoableAction) => Promise<void>;
}

export interface UndoRedoHandle {
  /** Push a new undoable action onto the stack */
  push: (action: UndoableAction) => void;
  /** Undo the most recent action */
  undo: () => Promise<void>;
  /** Redo the most recently undone action */
  redo: () => Promise<void>;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** The most recently undone/redone action (for status display) */
  lastAction: { action: UndoableAction; direction: 'undo' | 'redo' } | null;
  /** Clear the status display */
  clearLastAction: () => void;
  /** Whether an undo/redo operation is in progress */
  busy: boolean;
}

export function useUndoRedo({ onUndo, onRedo }: UseUndoRedoOptions): UndoRedoHandle {
  const [state, setState] = useState<UndoRedoState>({ past: [], future: [] });
  const [lastAction, setLastAction] = useState<{ action: UndoableAction; direction: 'undo' | 'redo' } | null>(null);
  const [busy, setBusy] = useState(false);

  // Use refs for callbacks so keyboard handler always has latest
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  onUndoRef.current = onUndo;
  onRedoRef.current = onRedo;

  const stateRef = useRef(state);
  stateRef.current = state;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  // Auto-clear status after 4 seconds
  useEffect(() => {
    if (!lastAction) return;
    const t = setTimeout(() => setLastAction(null), 4000);
    return () => clearTimeout(t);
  }, [lastAction]);

  const push = useCallback((action: UndoableAction) => {
    setState(s => ({
      past: [...s.past.slice(-MAX_HISTORY + 1), action],
      future: [],  // new action clears redo stack
    }));
  }, []);

  const undo = useCallback(async () => {
    const s = stateRef.current;
    if (s.past.length === 0 || busyRef.current) return;
    const action = s.past[s.past.length - 1];
    setBusy(true);
    try {
      await onUndoRef.current(action);
      setState(prev => ({
        past: prev.past.slice(0, -1),
        future: [action, ...prev.future],
      }));
      setLastAction({ action, direction: 'undo' });
    } catch {
      // If undo fails, don't modify the stack
    } finally {
      setBusy(false);
    }
  }, []);

  const redo = useCallback(async () => {
    const s = stateRef.current;
    if (s.future.length === 0 || busyRef.current) return;
    const action = s.future[0];
    setBusy(true);
    try {
      await onRedoRef.current(action);
      setState(prev => ({
        past: [...prev.past, action],
        future: prev.future.slice(1),
      }));
      setLastAction({ action, direction: 'redo' });
    } catch {
      // If redo fails, don't modify the stack
    } finally {
      setBusy(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when inside input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (!isCtrlOrMeta) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return {
    push,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    lastAction,
    clearLastAction: () => setLastAction(null),
    busy,
  };
}
