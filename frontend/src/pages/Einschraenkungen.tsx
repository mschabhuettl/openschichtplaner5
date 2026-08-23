import { useState, useEffect, useCallback } from 'react';
import type { Employee, ShiftType } from '../types';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { shiftCellColorsMemo } from '../utils/shiftColor';

interface Restriction {
  id: number;
  employee_id: number;
  shift_id: number;
  reason: string;
  weekday: number;
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Eingabefeld-Optik nach Taktwerk: Kontur-Rand, Fokus = Glut-Rand + Ring
const INPUT_CLS =
  'w-full bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui px-3 py-2 text-sm text-schrift focus:outline-none focus:border-glut focus:shadow-[0_0_0_3px_rgba(201,106,20,.12)] dark:focus:shadow-[0_0_0_3px_rgba(240,163,92,.15)]';
// Feldlabel: UPPERCASE 10px/700 mit Tracking
const LABEL_CLS = 'block text-[10px] font-bold uppercase tracking-[.08em] text-schrift-3 mb-1';

export default function Einschraenkungen() {
  const { canAdmin } = useAuth();
  // Theme provider-frei: die dark-Klasse am <html> entscheidet
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // New restriction form
  const [showForm, setShowForm] = useState(false);
  const [formEmpId, setFormEmpId] = useState<number>(0);
  const [formShiftId, setFormShiftId] = useState<number>(0);
  const [formReason, setFormReason] = useState('');
  const [formWeekday, setFormWeekday] = useState<number>(0);
  // Einschränkungs-Grad (Spec 4.11): 0=keine, 1=auf Anfrage, 2=nie
  const [formGrade, setFormGrade] = useState<number>(2);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, sh, restrictions] = await Promise.all([
        api.getEmployees(),
        api.getShifts(),
        api.getRestrictions(),
      ]);
      setEmployees(emps);
      setShifts(sh);
      setRestrictions(restrictions as Restriction[]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Initialize form defaults after data loads
  useEffect(() => {
    if (employees.length > 0 && formEmpId === 0) setFormEmpId(employees[0].ID);
  }, [employees, formEmpId]);
  useEffect(() => {
    if (shifts.length > 0 && formShiftId === 0) setFormShiftId(shifts[0].ID);
  }, [shifts, formShiftId]);

  const handleCreate = async () => {
    if (!formEmpId || !formShiftId) return;
    setSaving(true);
    try {
      await api.addRestriction({
        employee_id: formEmpId,
        shift_id: formShiftId,
        reason: formReason,
        weekday: formWeekday,
        grade: formGrade,
      });
      setShowForm(false);
      setFormReason('');
      await loadAll();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (empId: number, shiftId: number, weekday: number) => {
    const key = `${empId}-${shiftId}-${weekday}`;
    if (!await confirmDialog({ message: 'Einschränkung wirklich löschen?', danger: true })) return;
    setDeleting(key);
    try {
      await api.removeRestriction(empId, shiftId, weekday);
      await loadAll();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(null);
    }
  };

  const getShiftName = (id: number) => {
    const s = shifts.find(sh => sh.ID === id);
    return s ? `${s.SHORTNAME} – ${s.NAME}` : `Schicht #${id}`;
  };
  const getShift = (id: number) => shifts.find(sh => sh.ID === id);

  // Group restrictions by employee
  const filteredEmps = employees.filter(e =>
    `${e.NAME} ${e.FIRSTNAME} ${e.NUMBER}`.toLowerCase().includes(search.toLowerCase())
  );

  const empRestrictions = (empId: number) => restrictions.filter(r => r.employee_id === empId);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-schrift">🚫 Schichteinschränkungen</h1>
          <p className="text-sm text-schrift-2 mt-0.5">
            Gesperrte Schichtarten pro Mitarbeiter – verhindert automatische Zuweisung
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="no-print px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift text-sm hover:bg-wash flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          {canAdmin && <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold text-sm rounded-ui hover:opacity-90 flex items-center gap-2"
          >
            ＋ Einschränkung anlegen
          </button>}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-signal-flaeche border border-[#eecfcf] dark:border-[#5a2626] rounded-ui text-sm text-signal">
          ⚠️ {error}
          <button aria-label="Schließen" onClick={() => setError(null)} className="ml-3 text-signal opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-5 bg-ebene rounded-panel border border-kontur p-5">
          <h3 className="text-[15px] font-bold text-schrift mb-4">Neue Schichteinschränkung</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={LABEL_CLS}>Mitarbeiter</label>
              <select
                value={formEmpId}
                onChange={e => setFormEmpId(Number(e.target.value))}
                className={INPUT_CLS}
              >
                {employees.map(e => (
                  <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Schichtart</label>
              <select
                value={formShiftId}
                onChange={e => setFormShiftId(Number(e.target.value))}
                className={INPUT_CLS}
              >
                {shifts.filter(s => !s.HIDE).map(s => (
                  <option key={s.ID} value={s.ID}>{s.SHORTNAME} – {s.NAME}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Wochentag</label>
              <select
                value={formWeekday}
                onChange={e => setFormWeekday(Number(e.target.value))}
                className={INPUT_CLS}
              >
                {WEEKDAY_LABELS.map((l, i) => (
                  <option key={i} value={i}>{l}</option>
                ))}
                <option value={7}>Feiertag</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Grad</label>
              <select
                value={formGrade}
                onChange={e => setFormGrade(Number(e.target.value))}
                className={INPUT_CLS}
                title="nie = harte Sperre, auf Anfrage = nur mit Warnung einteilbar"
              >
                <option value={2}>nie (Sperre)</option>
                <option value={1}>auf Anfrage (?)</option>
                <option value={0}>keine</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Begründung</label>
              <input
                type="text"
                value={formReason}
                onChange={e => setFormReason(e.target.value)}
                placeholder="z.B. Ausbildung, Gesundheit..."
                className={INPUT_CLS}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={saving || !formEmpId || !formShiftId}
              className="px-4 py-2 text-sm rounded-ui bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <span className="animate-spin">⟳</span>}
              Einschränkung speichern
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-ui bg-ebene dark:bg-ebene-2 border border-kontur text-schrift hover:bg-wash"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          placeholder="Mitarbeiter suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-sm text-schrift placeholder:text-schrift-3 w-52 focus:outline-none focus:border-glut focus:shadow-[0_0_0_3px_rgba(201,106,20,.12)] dark:focus:shadow-[0_0_0_3px_rgba(240,163,92,.15)]"
        />
        <span className="text-xs text-schrift-2">
          {restrictions.length} Einschränkung{restrictions.length !== 1 ? 'en' : ''} gesamt
        </span>
      </div>

      {/* Employee list with restrictions */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {filteredEmps
            .filter(e => empRestrictions(e.ID).length > 0 || !search)
            .map(emp => {
              const empRestr = empRestrictions(emp.ID);
              return (
                <div key={emp.ID} className="bg-ebene rounded-panel border border-kontur overflow-hidden">
                  <div className="px-4 py-3 bg-[#fafbfc] dark:bg-[#0e1522] border-b border-kontur flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-schrift">{emp.NAME}, {emp.FIRSTNAME}</span>
                      <span className="ml-2 text-xs text-schrift-2 font-mono tabular-nums">{emp.NUMBER}</span>
                    </div>
                    {empRestr.length === 0 ? (
                      <span className="text-xs text-schrift-3 italic">Keine Einschränkungen</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-signal-flaeche text-signal border border-[#eecfcf] dark:border-[#5a2626] font-semibold">
                        {empRestr.length} Einschränkung{empRestr.length !== 1 ? 'en' : ''}
                      </span>
                    )}
                  </div>
                  {empRestr.length > 0 && (
                    <div className="divide-y divide-kontur-soft">
                      {empRestr.map(r => {
                        const shift = getShift(r.shift_id);
                        const key = `${r.employee_id}-${r.shift_id}-${r.weekday}`;
                        // DBF-Rohfarbe nie roh rendern — normalisieren, Vordergrund wird berechnet
                        const chip = shift?.COLORBK_HEX
                          ? shiftCellColorsMemo(shift.COLORBK_HEX, isDark ? 'dark' : 'light')
                          : null;
                        return (
                          <div key={r.id ?? key} className="px-4 py-2.5 flex items-center gap-3">
                            {/* Schicht-Chip (normalisierte Fläche) */}
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-cell text-xs font-bold flex-shrink-0 ${chip ? '' : 'bg-wash text-schrift-2'}`}
                              style={chip ? { backgroundColor: chip.background, color: chip.color } : undefined}
                            >
                              {shift?.SHORTNAME?.[0] ?? '?'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-schrift truncate">
                                {getShiftName(r.shift_id)}
                              </div>
                              <div className="text-xs text-schrift-2 flex items-center gap-2">
                                <span>
                                  {r.weekday === 7
                                    ? '📅 Nur Feiertag'
                                    : `📅 Nur ${WEEKDAY_LABELS[r.weekday] ?? r.weekday}`}
                                </span>
                                {r.reason && (
                                  <>
                                    <span className="text-schrift-3">|</span>
                                    <span className="italic">{r.reason}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {canAdmin && <button
                              onClick={() => handleDelete(r.employee_id, r.shift_id, r.weekday)}
                              disabled={deleting === key}
                              className="ml-auto text-signal opacity-70 hover:opacity-100 text-sm px-2 py-1 rounded-ui hover:bg-signal-flaeche flex-shrink-0"
                              title="Einschränkung löschen"
                            >
                              {deleting === key ? '⟳' : '🗑️'}
                            </button>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          {filteredEmps.length === 0 && (
            <EmptyState icon="🔍" title="Keine Mitarbeiter gefunden" />
          )}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 p-3 bg-wash border border-kontur rounded-panel text-xs text-schrift-2 flex items-start gap-2">
        <span className="text-base flex-shrink-0">ℹ️</span>
        <span>
          <strong>Schichteinschränkungen</strong> verhindern die automatische Zuweisung bestimmter Schichtarten an einen Mitarbeiter.
          Wochentag: <strong>0 = alle Tage</strong>, 1 = Montag, 2 = Dienstag, … 7 = Sonntag.
          Einschränkungen gelten ab dem angegebenen Datum und können befristet oder dauerhaft sein.
        </span>
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
