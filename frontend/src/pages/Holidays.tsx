import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Holiday } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { LeaveType } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Badge } from '../components/Badge';

// Taktwerk-Eingabefeld (docs/design-system.md §1/§3): Ebene-2-Fläche, Kontur, Glut-Fokusring.
const EINGABE =
  'bg-ebene-2 border border-kontur rounded-ui text-schrift placeholder:text-schrift-3 focus:outline-none focus:border-glut focus:shadow-[0_0_0_3px_rgba(201,106,20,.12)] dark:focus:shadow-[0_0_0_3px_rgba(240,163,92,.15)]';

// Taktwerk-Buttons (docs/design-system.md §1/§6): Primär = Umkehrung, Sekundär = Kontur-Fläche.
const BTN_PRIMAER = 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold rounded-ui hover:opacity-90 transition-opacity';
const BTN_SEKUNDAER = 'bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift hover:bg-wash transition-colors';

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
// Alle österreichischen Feiertage sind ganztägig (INTERVAL=0, Spec-Semantik 3.2.1 Nr. 3).
function getAustrianHolidays(year: number): { date: string; name: string }[] {
  const easter = calculateEaster(year);
  return [
    { date: `${year}-01-01`, name: 'Neujahr' },
    { date: `${year}-01-06`, name: 'Heilige Drei Könige' },
    { date: toISODate(addDays(easter, 1)), name: 'Ostermontag' },
    { date: `${year}-05-01`, name: 'Staatsfeiertag' },
    { date: toISODate(addDays(easter, 39)), name: 'Christi Himmelfahrt' },
    { date: toISODate(addDays(easter, 50)), name: 'Pfingstmontag' },
    { date: toISODate(addDays(easter, 60)), name: 'Fronleichnam' },
    { date: `${year}-08-15`, name: 'Mariä Himmelfahrt' },
    { date: `${year}-10-26`, name: 'Nationalfeiertag' },
    { date: `${year}-11-01`, name: 'Allerheiligen' },
    { date: `${year}-12-08`, name: 'Mariä Empfängnis' },
    { date: `${year}-12-25`, name: 'Christtag' },
    { date: `${year}-12-26`, name: 'Stefanitag' },
  ];
}

/** UNSICHER-Hinweis zur Halbtags-Zuordnung (5HOLID.INTERVAL, Spec 3.2.1 Nr. 3). */
const INTERVAL_UNSURE_HINT =
  'UNSICHER: Zuordnung 1 = vormittags / 2 = nachmittags ist aus der Original-Disassembly abgeleitet, datenseitig unbestätigt.';

/** Anzeige-Label für 5HOLID.INTERVAL (Spec-Semantik: 0 = ganztägig, 1/2 = halber Feiertag). */
function intervalLabel(interval: number): string {
  if (interval === 1) return 'Halbtags (vormittags)';
  if (interval === 2) return 'Halbtags (nachmittags)';
  return 'Ganztägig';
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
  // "auch in den folgenden 9 Jahren anlegen" (Spec 3.2.1 Nr. 4 / Dialog 5.16, nur beim Anlegen)
  const [repeatYears, setRepeatYears] = useState(false);
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
    setRepeatYears(false);
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
    setError(null);
    if (!form.NAME.trim()) { setError('Bezeichnung ist ein Pflichtfeld.'); return; }
    if (!form.DATE) { setError('Datum ist ein Pflichtfeld.'); return; }
    setSaving(true);
    try {
      if (editId !== null) {
        await api.updateHoliday(editId, form);
        showToast('Feiertag gespeichert ✓', 'success');
      } else {
        // repeat_years (truthy) legt den Termin zusätzlich für die folgenden 9 Jahre an.
        await api.createHoliday({ ...form, ...(repeatYears ? { repeat_years: 1 } : {}) });
        showToast(repeatYears ? 'Feiertag für 10 Jahre erstellt ✓' : 'Feiertag erstellt ✓', 'success');
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
        await api.createHoliday({ DATE: h.date, NAME: h.name, INTERVAL: 0 });
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
          <h1 className="text-xl font-extrabold tracking-[-0.02em] text-schrift">📅 Feiertage</h1>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className={`px-3 py-1.5 text-sm font-mono tabular-nums ${EINGABE}`}
          >
            {Array.from({ length: 10 }, (_, i) => currentYear - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-sm text-schrift-2"><span className="font-mono tabular-nums">{holidays.length}</span> Feiertage</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className={`no-print px-3 py-1.5 text-sm flex items-center gap-1 ${BTN_SEKUNDAER}`}
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          <button
            onClick={handleImportAustria}
            disabled={importing}
            className={`px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${BTN_SEKUNDAER}`}
            title="Österreichische Feiertage für das gewählte Jahr importieren" aria-label="Österreichische Feiertage für das gewählte Jahr importieren"
          >
            {importing ? '⟳ Importiere...' : '🇦🇹 Österreich importieren'}
          </button>
          {canAdmin && <button
            onClick={openCreate}
            className={`px-3 py-1.5 text-sm ${BTN_PRIMAER}`}
          >
            + Neu
          </button>}
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-ebene border border-kontur rounded-panel overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-[#fafbfc] dark:bg-[#0e1522] text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">
              <tr className="border-b border-kontur">
                <th scope="col" className="px-4 py-[5px] text-left">Datum</th>
                <th scope="col" className="px-4 py-[5px] text-left">Wochentag</th>
                <th scope="col" className="px-4 py-[5px] text-left">Name</th>
                <th scope="col" className="px-4 py-[5px] text-center">Dauer</th>
                <th scope="col" className="px-4 py-[5px] text-center">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map(h => (
                <tr key={h.ID} className="h-[28px] border-b border-kontur-soft hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)] transition-colors">
                  {/* Feiertags-Kennzeichnung in Signal — wie die Feiertagsspalten im Dienstplan-Kopf */}
                  <td className="px-4 py-1 font-mono tabular-nums text-signal">{h.DATE}</td>
                  <td className="px-4 py-1 text-schrift-2">{getWeekday(h.DATE)}</td>
                  <td className="px-4 py-1 font-semibold text-schrift">{h.NAME}</td>
                  <td className="px-4 py-1 text-center">
                    {h.INTERVAL === 1 || h.INTERVAL === 2 ? (
                      // Status-Pille lokal (Urlaubs-Schiene h≈40), weil der UNSICHER-Tooltip am Element bleiben muss
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap text-[#7e5f25] border-[#e7dbc6] dark:text-[#d5bd90] dark:border-[#604f2e]"
                        title={INTERVAL_UNSURE_HINT}
                      >
                        <span className="w-[5px] h-[5px] rounded-full bg-current flex-shrink-0" aria-hidden="true" />
                        {intervalLabel(h.INTERVAL)}
                      </span>
                    ) : (
                      <Badge>Ganztägig</Badge>
                    )}
                  </td>
                  <td className="px-4 py-1 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {canAdmin && <button onClick={() => openBulkAbsModal(h)} className={`px-2 py-0.5 text-xs ${BTN_SEKUNDAER}`} title="Als Abwesenheit für alle MA eintragen">👥 Bulk</button>}
                      {canAdmin && <button onClick={() => openEdit(h)} className={`px-2 py-0.5 text-xs ${BTN_SEKUNDAER}`}>Bearbeiten</button>}
                      {canAdmin && <button onClick={() => handleDelete(h)} className="px-2 py-0.5 text-xs border border-kontur rounded-ui text-signal hover:bg-signal-flaeche transition-colors">Löschen</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-schrift-2">Keine Feiertage für {year}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdropIn" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-md mx-4 overflow-hidden">
            <h2 className="text-[13px] font-bold text-schrift px-6 py-3 border-b border-kontur">
              {editId !== null ? 'Feiertag bearbeiten' : 'Neuer Feiertag'}
            </h2>
            {error && <div className="mx-6 mt-3 p-2 bg-signal-flaeche text-signal rounded-ui text-sm">{error}</div>}
            <div className="space-y-3 px-6 py-4">
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Datum *</label>
                <input
                  type="date"
                  value={form.DATE}
                  onChange={e => setForm(f => ({ ...f, DATE: e.target.value }))}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums ${EINGABE}`}
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Name *</label>
                <input
                  type="text"
                  autoFocus value={form.NAME}
                  onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                  className={`w-full px-3 py-2 text-sm ${EINGABE}`}
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1" title={INTERVAL_UNSURE_HINT}>
                  Dauer <span className="cursor-help text-schrift-3" aria-label={INTERVAL_UNSURE_HINT}>ⓘ</span>
                </label>
                <select
                  value={form.INTERVAL}
                  onChange={e => setForm(f => ({ ...f, INTERVAL: parseInt(e.target.value) || 0 }))}
                  className={`w-full px-3 py-2 text-sm ${EINGABE}`}
                  title={INTERVAL_UNSURE_HINT}
                >
                  <option value={0}>Ganztägig</option>
                  <option value={1}>Halbtags (vormittags)</option>
                  <option value={2}>Halbtags (nachmittags)</option>
                </select>
              </div>
              {editId === null && (
                <label className="flex items-center gap-2 text-sm text-schrift cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-glut"
                    checked={repeatYears}
                    onChange={e => setRepeatYears(e.target.checked)}
                  />
                  Auch in den folgenden 9 Jahren anlegen
                </label>
              )}
            </div>
            <div className="flex gap-2 justify-end px-6 py-3 bg-[#fafbfc] dark:bg-[#0e1522] border-t border-kontur">
              <button onClick={() => setShowModal(false)} className={`px-4 py-2 text-sm ${BTN_SEKUNDAER}`}>Abbrechen</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.NAME.trim() || !form.DATE}
                className={`px-4 py-2 text-sm disabled:opacity-50 ${BTN_PRIMAER}`}
              >
                {saving ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" /> : null}
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
          <div onClick={e => e.stopPropagation()} className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-sm mx-4 overflow-hidden">
            <h2 className="text-[13px] font-bold text-schrift px-6 py-3 border-b border-kontur">Feiertag für alle eintragen</h2>
            <p className="text-sm text-schrift-2 px-6 pt-3 mb-4">
              Trägt <strong>{bulkAbsHoliday.NAME}</strong> ({bulkAbsHoliday.DATE}) als Abwesenheit für alle aktiven Mitarbeiter ein.
            </p>
            <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1 px-6">Abwesenheitstyp</label>
            <select
              value={bulkAbsLeaveTypeId}
              onChange={e => setBulkAbsLeaveTypeId(e.target.value === '' ? '' : Number(e.target.value))}
              className={`w-[calc(100%-3rem)] mx-6 px-3 py-2 text-sm mb-4 ${EINGABE}`}
            >
              <option value="">— Typ auswählen —</option>
              {leaveTypes.map(lt => <option key={lt.ID} value={lt.ID}>{lt.NAME}{lt.SHORTNAME ? ` (${lt.SHORTNAME})` : ''}</option>)}
            </select>
            <div className="flex gap-2 justify-end px-6 py-3 bg-[#fafbfc] dark:bg-[#0e1522] border-t border-kontur">
              <button onClick={() => setShowBulkAbsModal(false)} className={`px-4 py-2 text-sm ${BTN_SEKUNDAER}`}>Abbrechen</button>
              <button
                onClick={handleBulkAbsence}
                disabled={bulkAbsLeaveTypeId === '' || bulkAbsWorking}
                className={`px-4 py-2 text-sm disabled:opacity-50 ${BTN_PRIMAER}`}
              >{bulkAbsWorking ? 'Wird eingetragen...' : 'Für alle eintragen'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
