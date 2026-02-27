import { useState, useEffect, useCallback } from 'react';
import type { Employee, ShiftType } from '../types';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const API = import.meta.env.VITE_API_URL ?? '';

interface Restriction {
  id: number;
  employee_id: number;
  shift_id: number;
  reason: string;
  weekday: number;
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function Einschraenkungen() {
  const { canAdmin } = useAuth();
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, sh] = await Promise.all([api.getEmployees(), api.getShifts()]);
      setEmployees(emps);
      setShifts(sh);
      const res = await fetch(`${API}/api/restrictions`);
      if (res.ok) {
        setRestrictions(await res.json());
      } else {
        setRestrictions([]);
      }
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
      const res = await fetch(`${API}/api/restrictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: formEmpId,
          shift_id: formShiftId,
          reason: formReason,
          weekday: formWeekday,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
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
    if (!confirm('Einschränkung wirklich löschen?')) return;
    setDeleting(key);
    try {
      const res = await fetch(`${API}/api/restrictions/${empId}/${shiftId}?weekday=${weekday}`, {
        method: 'DELETE',
      });
      if (res.ok) await loadAll();
      else setError(`Fehler: HTTP ${res.status}`);
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
          <h1 className="text-xl font-bold text-gray-800">🚫 Schichteinschränkungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gesperrte Schichtarten pro Mitarbeiter – verhindert automatische Zuweisung
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          {canAdmin && <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center gap-2 shadow-sm"
          >
            ＋ Einschränkung anlegen
          </button>}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-5 bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Neue Schichteinschränkung</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mitarbeiter</label>
              <select
                value={formEmpId}
                onChange={e => setFormEmpId(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {employees.map(e => (
                  <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Schichtart</label>
              <select
                value={formShiftId}
                onChange={e => setFormShiftId(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {shifts.filter(s => !s.HIDE).map(s => (
                  <option key={s.ID} value={s.ID}>{s.SHORTNAME} – {s.NAME}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Wochentag (0=alle)</label>
              <select
                value={formWeekday}
                onChange={e => setFormWeekday(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value={0}>Alle Wochentage</option>
                {WEEKDAY_LABELS.map((l, i) => (
                  <option key={i + 1} value={i + 1}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Begründung</label>
              <input
                type="text"
                value={formReason}
                onChange={e => setFormReason(e.target.value)}
                placeholder="z.B. Ausbildung, Gesundheit..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={saving || !formEmpId || !formShiftId}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <span className="animate-spin">⟳</span>}
              Einschränkung speichern
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
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
          className="px-3 py-1.5 border rounded-lg shadow-sm text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <span className="text-xs text-gray-400">
          {restrictions.length} Einschränkung{restrictions.length !== 1 ? 'en' : ''} gesamt
        </span>
      </div>

      {/* Employee list with restrictions */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">⟳ Lade...</div>
      ) : (
        <div className="space-y-3">
          {filteredEmps
            .filter(e => empRestrictions(e.ID).length > 0 || !search)
            .map(emp => {
              const empRestr = empRestrictions(emp.ID);
              return (
                <div key={emp.ID} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-800">{emp.NAME}, {emp.FIRSTNAME}</span>
                      <span className="ml-2 text-xs text-gray-400">{emp.NUMBER}</span>
                    </div>
                    {empRestr.length === 0 ? (
                      <span className="text-xs text-gray-300 italic">Keine Einschränkungen</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                        {empRestr.length} Einschränkung{empRestr.length !== 1 ? 'en' : ''}
                      </span>
                    )}
                  </div>
                  {empRestr.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {empRestr.map(r => {
                        const shift = getShift(r.shift_id);
                        const key = `${r.employee_id}-${r.shift_id}-${r.weekday}`;
                        return (
                          <div key={r.id ?? key} className="px-4 py-2.5 flex items-center gap-3">
                            {/* Shift badge */}
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold flex-shrink-0"
                              style={{
                                backgroundColor: shift?.COLORBK_HEX ?? '#e5e7eb',
                                color: shift?.COLORTEXT_HEX ?? '#374151',
                              }}
                            >
                              {shift?.SHORTNAME?.[0] ?? '?'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">
                                {getShiftName(r.shift_id)}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span>
                                  {r.weekday === 0
                                    ? '🔒 Alle Wochentage'
                                    : `📅 Nur ${WEEKDAY_LABELS[r.weekday - 1]}`}
                                </span>
                                {r.reason && (
                                  <>
                                    <span className="text-gray-300">|</span>
                                    <span className="italic">{r.reason}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {canAdmin && <button
                              onClick={() => handleDelete(r.employee_id, r.shift_id, r.weekday)}
                              disabled={deleting === key}
                              className="ml-auto text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50 flex-shrink-0"
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
            <div className="text-center py-10 text-gray-400">
              <div className="text-4xl mb-2">🔍</div>
              <div>Keine Mitarbeiter gefunden</div>
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-start gap-2">
        <span className="text-base flex-shrink-0">ℹ️</span>
        <span>
          Schichteinschränkungen verhindern die automatische Zuweisung bestimmter Schichten an Mitarbeiter.
          Ein Wochentag von 0 bedeutet die Einschränkung gilt für alle Tage.
        </span>
      </div>
    </div>
  );
}
