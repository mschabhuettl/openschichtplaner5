import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Holiday } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { LeaveType } from '../types';

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

// ── Gauss Easter Algorithm ─────────────────────────────────
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ── Austrian Holidays ─────────────────────────────────────
function getAustrianHolidays(year: number): { date: string; name: string; interval: number }[] {
  const easter = calculateEaster(year);
  return [
    { date: `${year}-01-01`, name: 'Neujahr', interval: 1 },
    { date: `${year}-01-06`, name: 'Heilige Drei Könige', interval: 1 },
    { date: toISODate(addDays(easter, 1)), name: 'Ostermontag', interval: 0 },
    { date: `${year}-05-01`, name: 'Staatsfeiertag', interval: 1 },
    { date: toISODate(addDays(easter, 39)), name: 'Christi Himmelfahrt', interval: 0 },
    { date: toISODate(addDays(easter, 50)), name: 'Pfingstmontag', interval: 0 },
    { date: toISODate(addDays(easter, 60)), name: 'Fronleichnam', interval: 0 },
    { date: `${year}-08-15`, name: 'Mariä Himmelfahrt', interval: 1 },
    { date: `${year}-10-26`, name: 'Nationalfeiertag', interval: 1 },
    { date: `${year}-11-01`, name: 'Allerheiligen', interval: 1 },
    { date: `${year}-12-08`, name: 'Mariä Empfängnis', interval: 1 },
    { date: `${year}-12-25`, name: 'Christtag', interval: 1 },
    { date: `${year}-12-26`, name: 'Stefanitag', interval: 1 },
  ];
}

export default function Holidays() {
  const { canAdmin } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<HolidayForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  // ── Bulk absence state ───────────────────────────────────────
  const [showBulkAbsModal, setShowBulkAbsModal] = useState(false);
  const [bulkAbsHoliday, setBulkAbsHoliday] = useState<Holiday | null>(null);
  const [bulkAbsLeaveTypeId, setBulkAbsLeaveTypeId] = useState<number | ''>('');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [bulkAbsWorking, setBulkAbsWorking] = useState(false);

  useEffect(() => {
    api.getLeaveTypes().then(lt => setLeaveTypes(lt.filter((l: LeaveType) => !l.HIDE))).catch(() => {});
  }, []);

  const openBulkAbsModal = (h: Holiday) => {
    setBulkAbsHoliday(h);
    setBulkAbsLeaveTypeId('');
    setShowBulkAbsModal(true);
  };

  const handleBulkAbsence = async () => {
    if (!bulkAbsHoliday || bulkAbsLeaveTypeId === '') return;
    const confirmed = await confirmDialog({
      message: `Feiertag "${bulkAbsHoliday.NAME}" (${bulkAbsHoliday.DATE}) als Abwesenheit für ALLE aktiven Mitarbeiter eintragen?`,
      danger: false,
    });
    if (!confirmed) return;
    setBulkAbsWorking(true);
    try {
      const res = await api.bulkCreateAbsence({ date: bulkAbsHoliday.DATE, leave_type_id: Number(bulkAbsLeaveTypeId) });
      showToast(`${res.created} Abwesenheiten eingetragen${res.skipped > 0 ? `, ${res.skipped} bereits vorhanden` : ''} ✓`, 'success');
      setShowBulkAbsModal(false);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setBulkAbsWorking(false);
    }
  };

  const load = () => {
    setLoading(true);
    api.getHolidays(year).then(data => {
      setHolidays(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!await confirmDialog({ message: `Feiertag "${h.NAME}" wirklich löschen?`, danger: true })) return;
    try {
      await api.deleteHoliday(h.ID);
      showToast('Feiertag gelöscht', 'success');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  const handleImportAustria = async () => {
    if (!await confirmDialog({ message: `Österreichische Feiertage für ${year} importieren? Bereits vorhandene Feiertage werden nicht doppelt angelegt.`, danger: true })) return;
    setImporting(true);
    try {
      const atHolidays = getAustrianHolidays(year);
      const existingDates = new Set(holidays.map(h => h.DATE));
      const toImport = atHolidays.filter(h => !existingDates.has(h.date));
      let imported = 0;
      for (const h of toImport) {
        await api.createHoliday({ DATE: h.date, NAME: h.name, INTERVAL: h.interval });
        imported++;
      }
      showToast(`${imported} Feiertage importiert (${atHolidays.length - imported} bereits vorhanden)`, 'success');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Importieren', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800">📅 Feiertage</h1>
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
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          <button
            onClick={handleImportAustria}
            disabled={importing}
            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
            title="Österreichische Feiertage für das gewählte Jahr importieren" aria-label="Österreichische Feiertage für das gewählte Jahr importieren"
          >
            {importing ? '⟳ Importiere...' : '🇦🇹 Österreich importieren'}
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
                <th className="px-4 py-2 text-left">Datum</th>
                <th className="px-4 py-2 text-left">Wochentag</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-center">Typ</th>
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
                    {h.INTERVAL === 1 ? (
                      <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">Jährlich</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Einmalig</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {canAdmin && <button onClick={() => openBulkAbsModal(h)} className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs hover:bg-teal-200" title="Als Abwesenheit für alle MA eintragen">👥 Bulk</button>}
                      {canAdmin && <button onClick={() => openEdit(h)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">Bearbeiten</button>}
                      {canAdmin && <button onClick={() => handleDelete(h)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Löschen</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Keine Feiertage für {year}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdropIn" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl animate-scaleIn w-full max-w-md mx-4 p-6">
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
                  autoFocus value={form.NAME}
                  onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Typ</label>
                <select
                  value={form.INTERVAL}
                  onChange={e => setForm(f => ({ ...f, INTERVAL: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Einmalig (festes Jahr)</option>
                  <option value={1}>Jährlich wiederkehrend</option>
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

      <ConfirmDialog {...confirmDialogProps} />

      {/* ── Bulk Absence Modal ────────────────────────────────── */}
      {showBulkAbsModal && bulkAbsHoliday && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdropIn" onClick={() => setShowBulkAbsModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl animate-scaleIn w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Feiertag für alle eintragen</h2>
            <p className="text-sm text-gray-500 mb-4">
              Trägt <strong>{bulkAbsHoliday.NAME}</strong> ({bulkAbsHoliday.DATE}) als Abwesenheit für alle aktiven Mitarbeiter ein.
            </p>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Abwesenheitstyp</label>
            <select
              value={bulkAbsLeaveTypeId}
              onChange={e => setBulkAbsLeaveTypeId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 border rounded text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">— Typ auswählen —</option>
              {leaveTypes.map(lt => <option key={lt.ID} value={lt.ID}>{lt.NAME}{lt.SHORTNAME ? ` (${lt.SHORTNAME})` : ''}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBulkAbsModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">Abbrechen</button>
              <button
                onClick={handleBulkAbsence}
                disabled={bulkAbsLeaveTypeId === '' || bulkAbsWorking}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 text-sm font-semibold"
              >{bulkAbsWorking ? 'Wird eingetragen...' : 'Für alle eintragen'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
