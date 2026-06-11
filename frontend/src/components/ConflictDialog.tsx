/**
 * ConflictDialog — Hinweisfenster beim Eintragen in ein belegtes Feld (Spec 6.7, V-2).
 *
 * Bietet die drei Original-Optionen „Zusätzlich eintragen" / „Vorhandene ersetzen" /
 * „Abbrechen" und eine merkbare Standard-Strategie („immer so", Spec 4.11.6-1),
 * die in localStorage persistiert wird.
 */
import { useEffect, useState } from 'react';

export type ConflictChoice = 'add' | 'replace' | 'cancel';

interface ConflictDialogProps {
  open: boolean;
  /** Kürzel/Namen der bereits vorhandenen Einträge in der Zelle. */
  existingLabels: string[];
  /** Beschriftung des neuen Eintrags (z. B. „F – Frühdienst"). */
  incomingLabel: string;
  /** false, wenn „Zusätzlich" nicht möglich ist (zweiter Dienst am selben Tag). */
  allowAdd: boolean;
  onChoose: (choice: ConflictChoice, remember: boolean) => void;
}

export function ConflictDialog({
  open,
  existingLabels,
  incomingLabel,
  allowAdd,
  onChoose,
}: ConflictDialogProps) {
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRemember(false);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChoose('cancel', false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdropIn" onClick={() => onChoose('cancel', false)} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-5 max-w-md w-full mx-4 animate-scaleIn">
        <h2 id="conflict-title" className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          ⚠️ Feld bereits belegt
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
          In diesem Feld {existingLabels.length === 1 ? 'ist bereits ein Eintrag' : `sind bereits ${existingLabels.length} Einträge`} vorhanden:{' '}
          <strong>{existingLabels.join(', ')}</strong>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Wie soll <strong>{incomingLabel}</strong> eingetragen werden?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onChoose('add', remember)}
            disabled={!allowAdd}
            title={allowAdd ? undefined : 'Nicht möglich: pro Tag ist nur ein Dienst-Eintrag erlaubt'}
            className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ➕ Zusätzlich eintragen
          </button>
          <button
            onClick={() => onChoose('replace', remember)}
            className="w-full px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium"
          >
            ♻️ Vorhandene ersetzen
          </button>
          <button
            onClick={() => onChoose('cancel', false)}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            Abbrechen
          </button>
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            className="rounded"
          />
          Entscheidung merken (immer so, nicht mehr fragen)
        </label>
      </div>
    </div>
  );
}
