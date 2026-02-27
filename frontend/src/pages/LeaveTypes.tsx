import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { LeaveType } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';

function hexToBGR(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (b << 16) | (g << 8) | r;
}

interface LeaveTypeForm {
  NAME: string;
  SHORTNAME: string;
  colorHex: string;
  ENTITLED: boolean;
  STDENTIT: number;
  HIDE: boolean;
}

const EMPTY_FORM: LeaveTypeForm = {
  NAME: '',
  SHORTNAME: '',
  colorHex: '#FFFFFF',
  ENTITLED: false,
  STDENTIT: 0,
  HIDE: false,
};

export default function LeaveTypes() {
  const { canAdmin } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LeaveTypeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.getLeaveTypes().then(data => {
      setLeaveTypes(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (lt: LeaveType) => {
    setEditId(lt.ID);
    setForm({
      NAME: lt.NAME || '',
      SHORTNAME: lt.SHORTNAME || '',
      colorHex: lt.COLORBK_HEX || '#FFFFFF',
      ENTITLED: lt.ENTITLED || false,
      STDENTIT: lt.STDENTIT || 0,
      HIDE: lt.HIDE || false,
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
      ENTITLED: form.ENTITLED,
      STDENTIT: form.STDENTIT,
      HIDE: form.HIDE,
    };
    try {
      if (editId !== null) {
        await api.updateLeaveType(editId, payload);
        showToast('Abwesenheitsart gespeichert ✓', 'success');
      } else {
        await api.createLeaveType(payload);
        showToast('Abwesenheitsart erstellt ✓', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lt: LeaveType) => {
    if (!confirm(`Abwesenheitsart "${lt.NAME}" wirklich ausblenden?`)) return;
    try {
      await api.deleteLeaveType(lt.ID);
      showToast("Abwesenheitsart ausgeblendet", "success");
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🏖️ Abwesenheitsarten ({leaveTypes.length})</h1>
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
                <th className="px-4 py-2 text-center">Urlaubsanspruch</th>
                <th className="px-4 py-2 text-right">Standard</th>
                <th className="px-4 py-2 text-center">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.map((lt, i) => (
                <tr key={lt.ID} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                  <td className="px-4 py-2">
                    <div
                      className="w-8 h-6 rounded border border-gray-300 flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: lt.COLORBK_HEX, color: lt.COLORBK_LIGHT ? '#333' : '#fff', borderColor: lt.COLORBAR_HEX }}
                    >
                      {lt.SHORTNAME}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-semibold">{lt.NAME}</td>
                  <td className="px-4 py-2 text-gray-500">{lt.SHORTNAME}</td>
                  <td className="px-4 py-2 text-center">
                    {lt.ENTITLED
                      ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">Ja</span>
                      : <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs">Nein</span>
                    }
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {lt.ENTITLED && lt.STDENTIT ? `${lt.STDENTIT} Tage` : '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      {canAdmin && <button onClick={() => openEdit(lt)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">Bearbeiten</button>}
                      {canAdmin && <button onClick={() => handleDelete(lt)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Ausblenden</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {leaveTypes.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Keine Abwesenheitsarten</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editId !== null ? 'Abwesenheitsart bearbeiten' : 'Neue Abwesenheitsart'}
            </h2>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.NAME}
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
                  checked={form.ENTITLED}
                  onChange={e => setForm(f => ({ ...f, ENTITLED: e.target.checked }))}
                />
                Urlaubsanspruch verbraucht
              </label>
              {form.ENTITLED && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Standard-Urlaubstage</label>
                  <input
                    type="number"
                    step="1"
                    value={form.STDENTIT}
                    onChange={e => setForm(f => ({ ...f, STDENTIT: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
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
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">Abbrechen</button>
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

    </div>
  );
}
