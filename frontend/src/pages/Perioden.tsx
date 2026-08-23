import { usePermissions } from '../hooks/usePermissions';
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Period } from '../api/client';
import type { Group } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { groupTreeOptions } from '../utils/groupTree';
import { shiftCellColorsMemo } from '../utils/shiftColor';

// Eingabefelder: Fläche 2 + Kontur, Fokus = Glut-Rand + Glut-Ring (Taktwerk §7)
const EINGABE = 'bg-ebene-2 border border-kontur rounded-ui text-schrift placeholder:text-schrift-3 focus:outline-none focus:border-glut focus:shadow-[0_0_0_3px_rgba(201,106,20,.12)] dark:focus:shadow-[0_0_0_3px_rgba(240,163,92,.15)]';

// Buttons: Primär = Umkehrung, Sekundär = Outline (Design-System §1)
const BTN_PRIMAER = 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold rounded-ui hover:opacity-90 transition-opacity';
const BTN_SEKUNDAER = 'bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift hover:bg-wash transition-colors';

// ─── Create / Edit Modal ───────────────────────────────────
interface CreateModalProps {
  groups: Group[];
  editPeriod?: Period | null;
  onSave: (data: { group_id: number; start: string; end: string; description: string; color: string }) => Promise<void>;
  onClose: () => void;
}

function CreateModal({ groups, editPeriod, onSave, onClose }: CreateModalProps) {
  const isEdit = !!editPeriod;
  const [groupId, setGroupId] = useState<number>(editPeriod?.group_id ?? groups[0]?.ID ?? 0);
  const [start, setStart] = useState(editPeriod?.start ?? '');
  const [end, setEnd] = useState(editPeriod?.end ?? '');
  const [description, setDescription] = useState(editPeriod?.description ?? '');
  const [color, setColor] = useState(editPeriod?.color ?? '#fcd34d');  // R5.10-10: Hinterlegungsfarbe
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!start || !end) { setError('Bitte Start- und Enddatum angeben.'); return; }
    if (start > end) { setError('Startdatum muss vor dem Enddatum liegen.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ group_id: groupId, start, end, description, color });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdropIn">
      <div className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-md">
        <div className="px-6 py-4 border-b border-kontur flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-schrift">📅 {isEdit ? 'Zeitraum bearbeiten' : 'Neuer Abrechnungszeitraum'}</h2>
          <button aria-label="Schließen" onClick={onClose} className="text-schrift-3 hover:text-schrift text-xl">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-signal-flaeche border border-[#eecfcf] dark:border-[#5a2626] rounded-ui text-sm text-signal">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Gruppe *</label>
            <select
              value={groupId}
              onChange={e => setGroupId(Number(e.target.value))}
              className={`w-full px-3 py-2 text-sm ${EINGABE}`}
            >
              {groupTreeOptions(groups).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Bezeichnung</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="z.B. Q1 2026"
              className={`w-full px-3 py-2 text-sm ${EINGABE}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Startdatum *</label>
              <input
                type="date"
                value={start}
                onChange={e => setStart(e.target.value)}
                className={`w-full px-3 py-2 text-sm font-mono tabular-nums ${EINGABE}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Enddatum *</label>
              <input
                type="date"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className={`w-full px-3 py-2 text-sm font-mono tabular-nums ${EINGABE}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Farbe</label>
            {/* Farb-Eingabe + Vorschau zeigen bewusst den ROHEN DBF-Wert — der Nutzer
                bearbeitet die Originalfarbe; normalisiert wird nur die Listen-Darstellung. */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Farbe"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-12 h-9 rounded-ui border border-kontur cursor-pointer"
              />
              <div className="flex-1 h-9 rounded-ui border border-kontur flex items-center px-3 text-sm" style={{ backgroundColor: color }}>
                {description || 'Hinterlegung im Dienstplan'}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-kontur bg-[#fafbfc] dark:bg-[#0e1522] flex justify-end gap-3">
          <button onClick={onClose} className={`px-4 py-2 text-sm ${BTN_SEKUNDAER}`}>
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`px-4 py-2 text-sm ${BTN_PRIMAER} disabled:opacity-50`}
          >
            {saving ? 'Speichern…' : isEdit ? 'Speichern' : 'Erstellen'}
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
  const [editTarget, setEditTarget] = useState<Period | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Theme provider-frei vom Dokument lesen (Muster der übrigen Taktwerk-Seiten)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

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

  const handleSave = async (data: { group_id: number; start: string; end: string; description: string; color: string }) => {
    if (editTarget) {
      await api.updatePeriod(editTarget.id, data);
      load(filterGroup === '' ? undefined : filterGroup);
      showToast('Abrechnungszeitraum aktualisiert ✓', 'success');
    } else {
      await api.createPeriod(data);
      load(filterGroup === '' ? undefined : filterGroup);
      showToast('Abrechnungszeitraum erstellt ✓', 'success');
    }
  };

  const closeModal = () => {
    setShowCreate(false);
    setEditTarget(null);
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
          <h1 className="text-xl font-extrabold tracking-[-0.02em] text-schrift">📅 Abrechnungszeiträume</h1>
          <p className="text-sm text-schrift-2 mt-0.5">
            Verwaltung der Abrechnungsperioden (5PERIO)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterGroup}
            onChange={e => handleGroupChange(e.target.value)}
            className={`px-3 py-1.5 text-sm ${EINGABE}`}
          >
            <option value="">Alle Gruppen</option>
            {groupTreeOptions(groups).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            className={`no-print px-3 py-1.5 text-sm flex items-center gap-1 ${BTN_SEKUNDAER}`}
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className={`px-4 py-1.5 text-sm ${BTN_PRIMAER}`}
          >
            + Neu
          </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-signal-flaeche border border-[#eecfcf] dark:border-[#5a2626] rounded-ui text-sm text-signal">
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : periods.length === 0 ? (
        <div className="text-center py-20 bg-ebene border border-kontur rounded-panel text-schrift-2">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-sm">Keine Abrechnungszeiträume vorhanden.</div>
          {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className={`mt-4 px-4 py-2 text-sm ${BTN_PRIMAER}`}
          >
            Ersten Zeitraum erstellen
          </button>
          )}
        </div>
      ) : (
        <div className="bg-ebene border border-kontur rounded-panel overflow-x-auto">
          <table className="w-full text-[11.5px] min-w-[520px]">
            <thead className="bg-[#fafbfc] dark:bg-[#0e1522]">
              <tr>
                <th scope="col" className="px-4 py-[6px] text-left text-[9px] uppercase tracking-[.08em] font-bold text-schrift-3 border-b border-kontur">Bezeichnung</th>
                <th scope="col" className="px-4 py-[6px] text-left text-[9px] uppercase tracking-[.08em] font-bold text-schrift-3 border-b border-kontur">Gruppe</th>
                <th scope="col" className="px-4 py-[6px] text-left text-[9px] uppercase tracking-[.08em] font-bold text-schrift-3 border-b border-kontur">Start</th>
                <th scope="col" className="px-4 py-[6px] text-left text-[9px] uppercase tracking-[.08em] font-bold text-schrift-3 border-b border-kontur">Ende</th>
                <th scope="col" className="px-4 py-[6px] text-center text-[9px] uppercase tracking-[.08em] font-bold text-schrift-3 border-b border-kontur">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.id} className="h-[28px] border-b border-kontur-soft hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)]">
                  <td className="px-4 py-0 font-medium text-schrift">
                    <span className="inline-flex items-center gap-2">
                      {/* Stammdaten-Swatch: DBF-Rohfarbe normalisiert darstellen, nie roh */}
                      <span className="inline-block w-3 h-3 rounded-sm border border-kontur" style={{ backgroundColor: shiftCellColorsMemo(p.color || '#ffffff', isDark ? 'dark' : 'light').background }} title="Hinterlegungsfarbe" />
                      {p.description || <span className="text-schrift-3 italic">–</span>}
                    </span>
                  </td>
                  <td className="px-4 py-0 text-schrift-2">
                    {groupMap[p.group_id] || <span className="text-schrift-2">Gruppe {p.group_id}</span>}
                  </td>
                  <td className="px-4 py-0 text-schrift-2 font-mono tabular-nums text-xs">{formatDate(p.start)}</td>
                  <td className="px-4 py-0 text-schrift-2 font-mono tabular-nums text-xs">{formatDate(p.end)}</td>
                  <td className="px-4 py-0 text-center">
                    {canEdit && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setEditTarget(p)}
                        className={`px-3 py-1 text-xs ${BTN_SEKUNDAER}`}
                      >
                        ✏️ Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="px-3 py-1 text-xs rounded-ui border border-kontur text-signal hover:bg-signal-flaeche transition-colors disabled:opacity-50"
                      >
                        {deleting === p.id ? '…' : '🗑 Löschen'}
                      </button>
                    </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-[10px] text-schrift-3 border-t border-kontur bg-[#fafbfc] dark:bg-[#0e1522]">
            {periods.length} Zeitraum{periods.length !== 1 ? 'e' : ''} gefunden
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreate || editTarget) && groups.length > 0 && (
        <CreateModal
          groups={groups}
          editPeriod={editTarget}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
