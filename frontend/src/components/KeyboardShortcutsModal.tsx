import { useEffect } from 'react';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Globale Suche öffnen' },
      { keys: ['/'], description: 'Globale Suche öffnen' },
      { keys: ['?'], description: 'Diese Hilfe anzeigen' },
      { keys: ['Esc'], description: 'Schließen / Abbrechen' },
    ],
  },
  {
    title: 'Schnellnavigation (g + …)',
    shortcuts: [
      { keys: ['g', 'd'], description: 'Dashboard' },
      { keys: ['g', 'p'], description: 'Dienstplan' },
      { keys: ['g', 'm'], description: 'Mitarbeiter' },
      { keys: ['g', 'k'], description: 'Konflikte' },
      { keys: ['g', 's'], description: 'Statistiken' },
      { keys: ['g', 'u'], description: 'Urlaub' },
      { keys: ['g', 'e'], description: 'Einsatzplan' },
      { keys: ['g', 'w'], description: 'Schichtwünsche' },
      { keys: ['g', 'n'], description: 'Notizen' },
    ],
  },
  {
    title: 'Monatsnavigation',
    shortcuts: [
      { keys: ['←'], description: 'Vorheriger Monat / Woche' },
      { keys: ['→'], description: 'Nächster Monat / Woche' },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            ⌨️ Keyboard-Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none p-1"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, ki) => (
                        <span key={ki} className="inline-flex items-center">
                          {ki > 0 && (
                            <span className="text-slate-400 text-xs mx-0.5">+</span>
                          )}
                          <kbd className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono
                                         bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200
                                         border border-slate-300 dark:border-slate-600 shadow-sm">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-400 text-center border-t border-slate-200 dark:border-slate-700">
          Drücke <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">?</kbd> jederzeit um diese Hilfe zu öffnen
        </div>
      </div>
    </div>
  );
}
