import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { WorkplaceEmployee } from '../api/client';
import type { Workplace, Employee } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';

function hexToBGR(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (b << 16) | (g << 8) | r;
}

interface WorkplaceForm {
  NAME: string;
  SHORTNAME: string;
  colorHex: string;
  HIDE: boolean;
}

const EMPTY_FORM: WorkplaceForm = {
  NAME: '',
  SHORTNAME: '',
  colorHex: '#FFFFFF',
  HIDE: false,
};

export default function Workplaces() {
  const { canAdmin } = useAuth();
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<WorkplaceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  // Detail / assignment panel
  const [selectedWp, setSelectedWp] = useState<Workplace | null>(null);
  const [wpEmployees, setWpEmployees] = useState<WorkplaceEmployee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assignBusy, setAssignBusy] = useState<number | null>(null);
  const [showAssignPanel, setShowAssignPanel] = useState(false);

  const load = () => {
    setLoading(true);
    api.getWorkplaces().then(data => {
      setWorkplaces(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Load all employees once (for assignment panel)
  useEffect(() => {
    api.getEmployees().then(setAllEmployees).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (w: Workplace) => {
    setEditId(w.ID);
    setForm({
      NAME: w.NAME || '',
      SHORTNAME: w.SHORTNAME || '',
      colorHex: w.COLORBK_HEX || '#FFFFFF',
      HIDE: false,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      NAME: form.NAME,
      SHORTNAME: form.SHORTNAME,
      COLORBK: hexToBGR(form.colorHex),
      HIDE: form.HIDE,
    };
    try {
      if (editId !== null) {
        await api.updateWorkplace(editId, payload);
        showToast('Arbeitsplatz gespeichert ✓', 'success');
      } else {
        await api.createWorkplace(payload);
        showToast('Arbeitsplatz erstellt ✓', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (w: Workplace) => {
    if (!await confirmDialog({ message: `Arbeitsplatz "${w.NAME}" wirklich ausblenden?`, danger: true })) return;
    try {
      await api.deleteWorkplace(w.ID);
      showToast("Arbeitsplatz ausgeblendet", "success");
      if (selectedWp?.ID === w.ID) setSelectedWp(null);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  const openDetail = async (w: Workplace) => {
    setSelectedWp(w);
    setShowAssignPanel(false);
    setDetailLoading(true);
    try {
      const emps = await api.getWorkplaceEmployees(w.ID);
      setWpEmployees(emps);
    } catch {
      setWpEmployees([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (wpId: number) => {
    try {
      const emps = await api.getWorkplaceEmployees(wpId);
      setWpEmployees(emps);
    } catch {
      setWpEmployees([]);
    }
  };

  const handleAssign = async (employee_id: number) => {
    if (!selectedWp) return;
    setAssignBusy(employee_id);
    try {
      await api.assignEmployeeToWorkplace(selectedWp.ID, employee_id);
      showToast('Mitarbeiter zugeordnet ✓', 'success');
      await refreshDetail(selectedWp.ID);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setAssignBusy(null);
    }
  };

  const handleRemove = async (employee_id: number) => {
    if (!selectedWp) return;
    setAssignBusy(employee_id);
    try {
      await api.removeEmployeeFromWorkplace(selectedWp.ID, employee_id);
      showToast('Zuordnung entfernt', 'success');
      await refreshDetail(selectedWp.ID);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setAssignBusy(null);
    }
  };

  const assignedIds = new Set(wpEmployees.map(e => e.ID));

  return (
    <div className="p-2 sm:p-4 lg:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Left: Workplaces list */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">🏭 Arbeitsplätze ({workplaces.length})</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
              title="Seite drucken"
            >
              🖨️ <span className="hidden sm:inline">Drucken</span>
            </button>
            {canAdmin && <button
              onClick={openCreate}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              + Neu
            </button>}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700 text-white text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Farbe</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Kürzel</th>
                  <th className="px-4 py-2 text-center">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {workplaces.map((w, i) => (
                  <tr
                    key={w.ID}
                    className={`border-b cursor-pointer ${
                      selectedWp?.ID === w.ID
                        ? 'bg-blue-50 border-blue-200'
                        : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-blue-50 transition-colors`}
                    onClick={() => openDetail(w)}
                  >
                    <td className="px-4 py-2">
                      <div
                        className="w-8 h-6 rounded border border-gray-300 flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: w.COLORBK_HEX || '#FFFFFF' }}
                      >
                        {w.SHORTNAME?.slice(0, 2)}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-semibold">{w.NAME}</td>
                    <td className="px-4 py-2 text-gray-500">{w.SHORTNAME}</td>
                    <td className="px-4 py-2 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => openEdit(w)}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDelete(w)}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                        >
                          Ausblenden
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {workplaces.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">Keine Arbeitsplätze</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: Detail / Assignment panel */}
      {selectedWp && (
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold border border-gray-200"
                style={{ backgroundColor: selectedWp.COLORBK_HEX || '#FFFFFF' }}
              >
                {selectedWp.SHORTNAME?.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 truncate">{selectedWp.NAME}</div>
                <div className="text-xs text-gray-500">ID: {selectedWp.ID}</div>
              </div>
              <button
                onClick={() => setSelectedWp(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                title="Schließen"
              >
                ×
              </button>
            </div>

            {/* Assigned employees */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  👥 Zugeordnete Mitarbeiter ({wpEmployees.length})
                </h3>
                <button
                  onClick={() => setShowAssignPanel(v => !v)}
                  className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  {showAssignPanel ? 'Schließen' : '+ Zuordnen'}
                </button>
              </div>
              {detailLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : wpEmployees.length === 0 ? (
                <div className="text-xs text-gray-400 py-2 text-center">Keine Mitarbeiter zugeordnet</div>
              ) : (
                <ul className="space-y-1">
                  {wpEmployees.map(e => (
                    <li key={e.ID} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                      <span className="text-sm text-gray-800">
                        {e.FIRSTNAME} {e.NAME}
                        {e.SHORTNAME && <span className="text-gray-400 ml-1">({e.SHORTNAME})</span>}
                      </span>
                      <button
                        onClick={() => handleRemove(e.ID)}
                        disabled={assignBusy === e.ID}
                        className="ml-2 text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                        title="Zuordnung entfernen"
                      >
                        {assignBusy === e.ID ? '…' : '✕'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Assignment picker */}
            {showAssignPanel && (
              <div className="border-t pt-3">
                <div className="text-xs font-semibold text-gray-600 mb-2">Mitarbeiter zuordnen:</div>
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {allEmployees
                    .filter(e => !assignedIds.has(e.ID))
                    .map(e => (
                      <div
                        key={e.ID}
                        className="flex items-center justify-between hover:bg-blue-50 rounded px-2 py-1 cursor-pointer"
                        onClick={() => handleAssign(e.ID)}
                      >
                        <span className="text-sm text-gray-700">
                          {e.FIRSTNAME} {e.NAME}
                          {e.SHORTNAME && <span className="text-gray-400 ml-1">({e.SHORTNAME})</span>}
                        </span>
                        <span className="text-xs text-green-600 font-bold">
                          {assignBusy === e.ID ? '…' : '+'}
                        </span>
                      </div>
                    ))}
                  {allEmployees.filter(e => !assignedIds.has(e.ID)).length === 0 && (
                    <div className="text-xs text-gray-400 py-2 text-center">Alle Mitarbeiter zugeordnet</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editId !== null ? 'Arbeitsplatz bearbeiten' : 'Neuer Arbeitsplatz'}
            </h2>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input
                  type="text"
                  autoFocus value={form.NAME}
                  onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kürzel</label>
                <input
                  type="text"
                  value={form.SHORTNAME}
                  onChange={e => setForm(f => ({ ...f, SHORTNAME: e.target.value }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Farbe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))}
                    className="w-12 h-9 rounded border cursor-pointer"
                  />
                  <div
                    className="flex-1 h-9 rounded border border-gray-200 flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: form.colorHex }}
                  >
                    {form.SHORTNAME || form.NAME}
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.HIDE}
                  onChange={e => setForm(f => ({ ...f, HIDE: e.target.checked }))}
                />
                Ausgeblendet
              </label>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.NAME.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> : null}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
