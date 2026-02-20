import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { ShiftType } from '../types';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';

// Convert HTML #RRGGBB to BGR integer (Windows color storage)
function hexToBGR(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (b << 16) | (g << 8) | r;
}

interface ShiftForm {
  NAME: string;
  SHORTNAME: string;
  colorHex: string;   // display as #RRGGBB
  DURATION0: number;
  HIDE: boolean;
}

const EMPTY_FORM: ShiftForm = {
  NAME: '',
  SHORTNAME: '',
  colorHex: '#FFFFFF',
  DURATION0: 8,
  HIDE: false,
};

export default function Shifts() {
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ShiftForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, showToast, removeToast } = useToast();

  const load = () => {
    setLoading(true);
    api.getShifts().then(data => {
      setShifts(data);
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

  const openEdit = (s: ShiftType) => {
    setEditId(s.ID);
    setForm({
      NAME: s.NAME || '',
      SHORTNAME: s.SHORTNAME || '',
      colorHex: s.COLORBK_HEX || '#FFFFFF',
      DURATION0: s.DURATION0 || 0,
      HIDE: s.HIDE || false,
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
      DURATION0: form.DURATION0,
      HIDE: form.HIDE,
    };
    try {
      if (editId !== null) {
        await api.updateShift(editId, payload);
        showToast('Schichtart aktualisiert ✓', 'success');
      } else {
        await api.createShift(payload);
        showToast('Schichtart erstellt ✓', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: ShiftType) => {
    if (!confirm(`Schichtart "${s.NAME}" wirklich ausblenden?`)) return;
    try {
      await api.deleteShift(s.ID);
      showToast('Schichtart ausgeblendet', 'success');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🕐 Schichtarten ({shifts.length})</h1>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Neu
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop: Table layout */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-700 text-white text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Farbe</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Kürzel</th>
                  <th className="px-4 py-2 text-center">Mo–Fr</th>
                  <th className="px-4 py-2 text-center">Sa</th>
                  <th className="px-4 py-2 text-center">So</th>
                  <th className="px-4 py-2 text-right">Dauer</th>
                  <th className="px-4 py-2 text-center">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s, i) => {
                  const times = s.TIMES_BY_WEEKDAY || {};
                  const weekdayTime = times['0'] || times['1'] || null;
                  const satTime = times['5'] || null;
                  const sunTime = times['6'] || null;
                  return (
                    <tr key={s.ID} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                      <td className="px-4 py-2">
                        <div
                          className="w-8 h-6 rounded border border-gray-300 flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: s.COLORBK_HEX, color: s.COLORBK_LIGHT ? '#333' : '#fff' }}
                        >
                          {s.SHORTNAME}
                        </div>
                      </td>
                      <td className="px-4 py-2 font-semibold">{s.NAME}</td>
                      <td className="px-4 py-2 text-gray-500">{s.SHORTNAME}</td>
                      <td className="px-4 py-2 text-center text-gray-600 font-mono text-xs">
                        {weekdayTime ? `${weekdayTime.start}–${weekdayTime.end}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-500 font-mono text-xs">
                        {satTime ? `${satTime.start}–${satTime.end}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-500 font-mono text-xs">
                        {sunTime ? `${sunTime.start}–${sunTime.end}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {s.DURATION0 ? `${s.DURATION0}h` : '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => openEdit(s)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">Bearbeiten</button>
                          <button onClick={() => handleDelete(s)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Ausblenden</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shifts.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Keine Schichtarten</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card layout */}
          <div className="block md:hidden space-y-3">
            {shifts.map(s => {
              const times = s.TIMES_BY_WEEKDAY || {};
              const weekdayTime = times['0'] || times['1'] || null;
              const satTime = times['5'] || null;
              const sunTime = times['6'] || null;
              return (
                <div key={s.ID} className="bg-white rounded-lg shadow p-4 border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Large color swatch */}
                      <div
                        className="w-14 h-12 rounded-lg border border-gray-200 flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0"
                        style={{ backgroundColor: s.COLORBK_HEX, color: s.COLORBK_LIGHT ? '#333' : '#fff' }}
                      >
                        {s.SHORTNAME}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate">{s.NAME}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {s.DURATION0 ? `${s.DURATION0}h` : '—'}
                          {weekdayTime && <span className="ml-2 font-mono">{weekdayTime.start}–{weekdayTime.end}</span>}
                        </div>
                        {(satTime || sunTime) && (
                          <div className="text-xs text-gray-400 font-mono">
                            {satTime && <span>Sa: {satTime.start}–{satTime.end}</span>}
                            {satTime && sunTime && ' · '}
                            {sunTime && <span>So: {sunTime.start}–{sunTime.end}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-base leading-none"
                        title="Bearbeiten"
                      >✏️</button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-base leading-none"
                        title="Ausblenden"
                      >🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {shifts.length === 0 && (
              <div className="text-center py-8 text-gray-400">Keine Schichtarten</div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editId !== null ? 'Schichtart bearbeiten' : 'Neue Schichtart'}
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
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Dauer (Stunden)</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.DURATION0}
                  onChange={e => setForm(f => ({ ...f, DURATION0: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
