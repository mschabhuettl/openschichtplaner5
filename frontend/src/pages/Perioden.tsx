import { usePermissions } from '../hooks/usePermissions';
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Period } from '../api/client';
import type { Group } from '../types';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';

// ─── Create Modal ──────────────────────────────────────────
interface CreateModalProps {
  groups: Group[];
  onSave: (data: { group_id: number; start: string; end: string; description: string }) => Promise<void>;
  onClose: () => void;
}

function CreateModal({ groups, onSave, onClose }: CreateModalProps) {
  const [groupId, setGroupId] = useState<number>(groups[0]?.ID ?? 0);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!start || !end) { setError('Bitte Start- und Enddatum angeben.'); return; }
    if (start > end) { setError('Startdatum muss vor dem Enddatum liegen.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ group_id: groupId, start, end, description });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdropIn">
      <div className="bg-white rounded-xl shadow-2xl animate-scaleIn w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">📅 Neuer Abrechnungszeitraum</h2>
          <button aria-label="Schließen" onClick={onClose} className="text-gray-600 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gruppe *</label>
            <select
              value={groupId}
              onChange={e => setGroupId(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {groups.map(g => (
                <option key={g.ID} value={g.ID}>{g.NAME}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="z.B. Q1 2026"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum *</label>
              <input
                type="date"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enddatum *</label>
              <input
                type="date"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function Perioden() {
  const { canEditSchedule: canEdit } = usePermissions();
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<number | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async (groupId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPeriods(groupId);
      setPeriods(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.getGroups()
      .then(g => setGroups(g))
      .catch(e => setError(String(e)));
    load();
  }, []);

  const handleGroupChange = (val: string) => {
    const gid = val === '' ? undefined : Number(val);
    setFilterGroup(val === '' ? '' : Number(val));
    load(gid);
  };

  const handleCreate = async (data: { group_id: number; start: string; end: string; description: string }) => {
    await api.createPeriod(data);
    load(filterGroup === '' ? undefined : filterGroup);
    showToast('Abrechnungszeitraum erstellt ✓', 'success');
  };

  const handleDelete = async (id: number) => {
    if (!await confirmDialog({ message: 'Abrechnungszeitraum wirklich löschen?', danger: true })) return;
    setDeleting(id);
    try {
      await api.deletePeriod(id);
      setPeriods(prev => prev.filter(p => p.id !== id));
      showToast('Abrechnungszeitraum gelöscht', 'success');
    } catch (e) {
      setError(String(e));
      showToast(String(e), 'error');
    } finally {
      setDeleting(null);
    }
  };

  const groupMap: Record<number, string> = {};
  for (const g of groups) groupMap[g.ID] = g.NAME;

  const formatDate = (iso: string) => {
    if (!iso) return '–';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">📅 Abrechnungszeiträume</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Verwaltung der Abrechnungsperioden (5PERIO)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterGroup}
            onChange={e => handleGroupChange(e.target.value)}
            className="px-3 py-1.5 border rounded shadow-sm text-sm"
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            + Neu
          </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-600">⟳ Lade Abrechnungszeiträume…</div>
      ) : periods.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg shadow text-gray-600">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-sm">Keine Abrechnungszeiträume vorhanden.</div>
          {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ersten Zeitraum erstellen
          </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-slate-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide font-semibold">Bezeichnung</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide font-semibold">Gruppe</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide font-semibold">Start</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide font-semibold">Ende</th>
                <th className="px-4 py-3 text-center text-xs uppercase tracking-wide font-semibold">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periods.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.description || <span className="text-gray-600 italic">–</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {groupMap[p.group_id] || <span className="text-gray-600">Gruppe {p.group_id}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{formatDate(p.start)}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{formatDate(p.end)}</td>
                  <td className="px-4 py-3 text-center">
                    {canEdit && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                      className="px-3 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                    >
                      {deleting === p.id ? '…' : '🗑 Löschen'}
                    </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-gray-600 border-t bg-gray-50">
            {periods.length} Zeitraum{periods.length !== 1 ? 'e' : ''} gefunden
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && groups.length > 0 && (
        <CreateModal
          groups={groups}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
