/**
 * ReorderDialog — manuelle, programmweite Stammdaten-Sortierung (A9, Spec 5.1 Nr. 4).
 *
 * Zeigt die Einträge einer Stammdaten-Liste in ihrer aktuellen Reihenfolge und
 * lässt sie per ▲/▼ umordnen; beim Speichern wird die neue POSITION über
 * `api.reorderMasterData(entity, orderedIds)` persistiert. Eine Komponente für
 * alle Entitäten (employees/shifts/groups/leave_types/workplaces).
 */
import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';

export interface ReorderItem {
  id: number;
  label: string;
}

interface ReorderDialogProps {
  entity: 'employees' | 'shifts' | 'groups' | 'leave_types' | 'workplaces';
  title: string;
  items: ReorderItem[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ReorderDialog({ entity, title, items, onClose, onSaved }: ReorderDialogProps) {
  const [order, setOrder] = useState<ReorderItem[]>(items);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    setOrder(prev => {
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.reorderMasterData(entity, order.map(o => o.id));
      showToast('Reihenfolge gespeichert ✓', 'success');
      onSaved();
      onClose();
    } catch (e) {
      showToast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">↕ {title}</h2>
          <p className="text-xs text-gray-500">Reihenfolge per ▲/▼ anpassen — gilt programmweit.</p>
        </div>
        <ul className="flex-1 overflow-y-auto p-3 space-y-1">
          {order.map((it, i) => (
            <li
              key={it.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
            >
              <span className="w-6 text-right text-xs text-gray-400 tabular-nums">{i + 1}</span>
              <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-100">{it.label}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="nach oben"
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-30 hover:bg-white dark:hover:bg-gray-600"
              >▲</button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label="nach unten"
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-30 hover:bg-white dark:hover:bg-gray-600"
              >▼</button>
            </li>
          ))}
        </ul>
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200"
          >Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >{saving ? 'Speichern…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}
