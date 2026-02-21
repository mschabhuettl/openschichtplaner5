import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Holiday } from '../types';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface HolidayForm {
  DATE: string;
  NAME: string;
  INTERVAL: number;
}

const EMPTY_FORM: HolidayForm = {
  DATE: '',
  NAME: '',
  INTERVAL: 0,
};

export default function Holidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<HolidayForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toasts, showToast, removeToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.getHolidays(year).then(data => {
      setHolidays(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year]);

  const getWeekday = (dateStr: string) => {
    const d = new Date(dateStr);
    return WEEKDAY_NAMES[d.getDay()];
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, DATE: `${year}-01-01` });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (h: Holiday) => {
    setEditId(h.ID);
    setForm({
      DATE: h.DATE || '',
      NAME: h.NAME || '',
      INTERVAL: h.INTERVAL || 0,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editId !== null) {
        await api.updateHoliday(editId, form);
        showToast('Feiertag gespeichert ✓', 'success');
      } else {
        await api.createHoliday(form);
        showToast('Feiertag erstellt ✓', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: Holiday) => {
    if (!confirm(`Feiertag "${h.NAME}" wirklich löschen?`)) return;
    try {
      await api.deleteHoliday(h.ID);
      showToast("Feiertag gelöscht", "success");
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">🎉 Feiertage</h1>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 border rounded shadow-sm text-sm"
          >
            {Array.from({ length: 10 }, (_, i) => currentYear - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">{holidays.length} Feiertage</span>
        </div>
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
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700 text-white text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Datum</th>
                <th className="px-4 py-2 text-left">Wochentag</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-center">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h, i) => (
                <tr key={h.ID} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                  <td className="px-4 py-2 font-mono text-gray-700">{h.DATE}</td>
                  <td className="px-4 py-2 text-gray-500">{getWeekday(h.DATE)}</td>
                  <td className="px-4 py-2 font-semibold">{h.NAME}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => openEdit(h)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">Bearbeiten</button>
                      <button onClick={() => handleDelete(h)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Löschen</button>
                    </div>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Keine Feiertage für {year}</td></tr>
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
              {editId !== null ? 'Feiertag bearbeiten' : 'Neuer Feiertag'}
            </h2>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Datum *</label>
                <input
                  type="date"
                  value={form.DATE}
                  onChange={e => setForm(f => ({ ...f, DATE: e.target.value }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Wiederkehrend</label>
                <select
                  value={form.INTERVAL}
                  onChange={e => setForm(f => ({ ...f, INTERVAL: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Einmalig</option>
                  <option value={1}>Jährlich</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">Abbrechen</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.NAME.trim() || !form.DATE}
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
