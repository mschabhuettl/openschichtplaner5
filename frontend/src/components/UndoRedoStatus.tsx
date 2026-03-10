import type { UndoRedoHandle } from '../hooks/useUndoRedo';

interface UndoRedoStatusProps {
  handle: UndoRedoHandle;
}

export function UndoRedoStatus({ handle }: UndoRedoStatusProps) {
  const { canUndo, canRedo, lastAction, clearLastAction, busy, undo, redo } = handle;

  return (
    <>
      {/* Floating status notification */}
      {lastAction && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] animate-slideUp">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg border text-sm font-medium ${
            lastAction.direction === 'undo'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <span className="text-base">
              {lastAction.direction === 'undo' ? '↩️' : '↪️'}
            </span>
            <span>
              {lastAction.direction === 'undo' ? 'Rückgängig' : 'Wiederholt'}:
              {' '}{lastAction.action.label}
            </span>
            <button
              onClick={clearLastAction}
              className="ml-2 text-gray-400 hover:text-gray-600 text-xs leading-none"
              aria-label="Schließen"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Undo/Redo toolbar buttons */}
      {(canUndo || canRedo) && (
        <div className="no-print flex items-center gap-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-sm px-1">
          <button
            onClick={() => undo()}
            disabled={!canUndo || busy}
            className="p-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Rückgängig (Strg+Z)"
          >
            ↩️
          </button>
          <button
            onClick={() => redo()}
            disabled={!canRedo || busy}
            className="p-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Wiederholen (Strg+Y)"
          >
            ↪️
          </button>
        </div>
      )}
    </>
  );
}
