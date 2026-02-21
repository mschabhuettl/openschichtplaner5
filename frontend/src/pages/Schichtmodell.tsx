import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { ShiftCycle, CycleAssignment, CycleDay } from '../api/client';
import type { Employee, Group, ShiftType } from '../types';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';

// ─── Types ─────────────────────────────────────────────────
type CycleExceptionRecord = {
  id: number;
  employee_id: number;
  cycle_assignment_id: number;
  date: string;
  type: number; // 0 = freier Tag, >0 = shift_id
};

// ─── Weekday Labels ────────────────────────────────────────
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ─── Cycle Preview Component ──────────────────────────────
function CycleWeekGrid({ schedule }: { schedule: CycleDay[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-1 text-gray-400 font-normal text-right pr-3">Woche</th>
            {WEEKDAYS.map(d => (
              <th key={d} className="px-2 py-1 text-gray-500 font-semibold text-center w-8">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map((week, wi) => (
            <tr key={wi}>
              <td className="px-2 py-0.5 text-gray-400 text-right pr-3 font-mono">{wi + 1}</td>
              {week.map((day, di) => (
                <td key={di} className="px-1 py-0.5 text-center">
                  {day.shift_id ? (
                    <span
                      className="inline-block w-6 h-6 leading-6 rounded text-xs font-bold"
                      style={{ background: day.color_bk, color: day.color_text }}
                      title={day.shift_name}
                    >
                      {day.shift_short}
                    </span>
                  ) : (
                    <span className="inline-block w-6 h-6 leading-6 rounded text-xs text-gray-300">–</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Create Cycle Modal ─────────────────────────────────────
interface CreateCycleModalProps {
  onCreated: (cycle: ShiftCycle) => void;
  onClose: () => void;
}

function CreateCycleModal({ onCreated, onClose }: CreateCycleModalProps) {
  const [name, setName] = useState('');
  const [sizeWeeks, setSizeWeeks] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Bitte einen Namen eingeben.'); return; }
    if (sizeWeeks < 1 || sizeWeeks > 12) { setError('Anzahl Wochen: 1–12'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await api.createShiftCycle(name.trim(), sizeWeeks);
      onCreated(res.cycle);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Neuen Zyklus erstellen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. 2-Wochen-Wechsel"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Wochen (1–12)</label>
            <input
              type="number"
              min={1}
              max={12}
              value={sizeWeeks}
              onChange={e => setSizeWeeks(Math.max(1, Math.min(12, Number(e.target.value))))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Abbrechen</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <span className="inline-block animate-spin">⟳</span>}
            Erstellen & Bearbeiten →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Cycle Modal ───────────────────────────────────────
interface EditCycleModalProps {
  cycle: ShiftCycle;
  shifts: ShiftType[];
  onSaved: (cycle: ShiftCycle) => void;
  onClose: () => void;
}

function EditCycleModal({ cycle, shifts, onSaved, onClose }: EditCycleModalProps) {
  const [name, setName] = useState(cycle.name);
  const [sizeWeeks, setSizeWeeks] = useState(cycle.weeks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build grid: grid[week][weekday] = shift_id | null
  const buildGrid = (c: ShiftCycle, weeks: number): (number | null)[][] => {
    const g: (number | null)[][] = Array.from({ length: weeks }, () => Array(7).fill(null));
    c.schedule.forEach((week, wi) => {
      if (wi < weeks) {
        week.forEach((day, di) => {
          g[wi][di] = day.shift_id ?? null;
        });
      }
    });
    return g;
  };

  const [grid, setGrid] = useState<(number | null)[][]>(() => buildGrid(cycle, cycle.weeks));

  // Rebuild grid when sizeWeeks changes
  const handleWeeksChange = (newWeeks: number) => {
    const clamped = Math.max(1, Math.min(12, newWeeks));
    setSizeWeeks(clamped);
    setGrid(prev => {
      const next: (number | null)[][] = Array.from({ length: clamped }, (_, wi) =>
        wi < prev.length ? [...prev[wi]] : Array(7).fill(null)
      );
      return next;
    });
  };

  const setCell = (week: number, day: number, shiftId: number | null) => {
    setGrid(prev => {
      const next = prev.map(w => [...w]);
      next[week][day] = shiftId;
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name darf nicht leer sein.'); return; }
    setSaving(true);
    setError(null);
    // Build entries: only non-null cells
    const entries: { index: number; shift_id: number | null }[] = [];
    grid.forEach((week, wi) => {
      week.forEach((shiftId, di) => {
        if (shiftId !== null) {
          entries.push({ index: wi * 7 + di, shift_id: shiftId });
        }
      });
    });
    try {
      const res = await api.updateShiftCycle(cycle.ID, name.trim(), sizeWeeks, entries);
      onSaved(res.cycle);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-800">Zyklus bearbeiten</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Body – scrollable */}
        <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
          )}

          {/* Name + Weeks */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-36">
              <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Wochen</label>
              <input
                type="number"
                min={1}
                max={12}
                value={sizeWeeks}
                onChange={e => handleWeeksChange(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Week grid */}
          <div>
            <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Wochenplan</div>
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse w-full">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-16">Tag</th>
                    {Array.from({ length: sizeWeeks }, (_, wi) => (
                      <th key={wi} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 min-w-[130px]">
                        Woche {wi + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAYS.map((dayLabel, di) => (
                    <tr key={di} className={di % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 text-xs font-semibold text-gray-600 w-16">{dayLabel}</td>
                      {Array.from({ length: sizeWeeks }, (_, wi) => {
                        const shiftId = grid[wi]?.[di] ?? null;
                        const shift = shifts.find(s => s.ID === shiftId);
                        return (
                          <td key={wi} className="px-2 py-1.5 text-center">
                            <div className="flex items-center gap-1.5">
                              {shift && (
                                <span
                                  className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold flex-shrink-0"
                                  style={{ background: shift.COLORBK_HEX, color: shift.COLORTEXT_HEX }}
                                  title={shift.NAME}
                                >
                                  {shift.SHORTNAME}
                                </span>
                              )}
                              <select
                                value={shiftId ?? ''}
                                onChange={e => setCell(wi, di, e.target.value ? Number(e.target.value) : null)}
                                className="flex-1 border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0"
                              >
                                <option value="">– Frei –</option>
                                {shifts.filter(s => !s.HIDE).map(s => (
                                  <option key={s.ID} value={s.ID}>{s.NAME}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <span className="inline-block animate-spin">⟳</span>}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Assign Modal ──────────────────────────────────
interface EditModalProps {
  employee: Employee;
  groupName: string;
  currentAssignment: CycleAssignment | null;
  cycles: ShiftCycle[];
  onSave: (assignment: CycleAssignment) => void;
  onClose: () => void;
}

function EditModal({ employee, groupName, currentAssignment, cycles, onSave, onClose }: EditModalProps) {
  const [cycleId, setCycleId] = useState<number | null>(currentAssignment?.cycle_id ?? null);
  const [startDate, setStartDate] = useState(currentAssignment?.start ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCycle = cycles.find(c => c.ID === cycleId);

  const handleSave = async () => {
    if (!cycleId) {
      setError('Bitte ein Schichtmodell wählen.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.assignCycle(employee.ID, cycleId, startDate);
      onSave(res.record);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Schichtmodell zuweisen</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {employee.FIRSTNAME} {employee.NAME} · {groupName}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
          )}

          {/* Cycle selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schichtmodell / Zyklus</label>
            <select
              value={cycleId ?? ''}
              onChange={e => setCycleId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">– Kein Modell –</option>
              {cycles.map(c => (
                <option key={c.ID} value={c.ID}>{c.name} ({c.weeks}W)</option>
              ))}
            </select>
          </div>

          {/* Pattern preview */}
          {selectedCycle && (
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Wochenplan-Vorschau — {selectedCycle.weeks} Woche(n)
              </div>
              <CycleWeekGrid schedule={selectedCycle.schedule} />
              <div className="mt-2 text-xs text-gray-400">
                Muster: <span className="font-mono">{selectedCycle.pattern}</span>
              </div>
            </div>
          )}

          {/* Start date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum des Zyklus</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              disabled={!cycleId}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Ab diesem Datum wird der Zyklus auf den Dienstplan angewendet.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !cycleId}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <span className="inline-block animate-spin">⟳</span>}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Exception Modal ────────────────────────────────────
interface AddExceptionModalProps {
  employees: Employee[];
  assignments: CycleAssignment[];
  shifts: ShiftType[];
  onCreated: () => void;
  onClose: () => void;
}

function AddExceptionModal({ employees, assignments, shifts, onCreated, onClose }: AddExceptionModalProps) {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shiftId, setShiftId] = useState<number | null>(null); // null = freier Tag
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeesWithCycle = employees.filter(emp => assignments.some(a => a.employee_id === emp.ID));

  const getAssignmentId = (empId: number): number | null =>
    assignments.find(a => a.employee_id === empId)?.id ?? null;

  const handleSave = async () => {
    if (!employeeId) { setError('Bitte einen Mitarbeiter auswählen.'); return; }
    const assignmentId = getAssignmentId(employeeId);
    if (assignmentId === null) { setError('Dieser Mitarbeiter hat keinen aktiven Schichtzyklus.'); return; }
    if (!date) { setError('Bitte ein Datum angeben.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.setCycleException({
        employee_id: employeeId,
        cycle_assignment_id: assignmentId,
        date,
        type: shiftId ?? 0,
      });
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">🚫 Zyklus-Ausnahme hinzufügen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter</label>
            <select
              value={employeeId ?? ''}
              onChange={e => setEmployeeId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">– Mitarbeiter auswählen –</option>
              {employeesWithCycle.map(emp => (
                <option key={emp.ID} value={emp.ID}>{emp.NAME}, {emp.FIRSTNAME}</option>
              ))}
            </select>
            {employeesWithCycle.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">⚠️ Keine Mitarbeiter mit zugewiesenem Zyklus gefunden.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ausnahme-Schicht</label>
            <select
              value={shiftId ?? ''}
              onChange={e => setShiftId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">🏖️ Freier Tag (kein Dienst)</option>
              {shifts.filter(s => !s.HIDE).map(s => (
                <option key={s.ID} value={s.ID}>{s.NAME} [{s.SHORTNAME}]</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Leer lassen = freier Tag. Eine Schicht auswählen = diese Schicht wird statt der Zyklus-Schicht eingetragen.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <span className="inline-block animate-spin">⟳</span>}
            Ausnahme speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────
export default function Schichtmodell() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [cycles, setCycles] = useState<ShiftCycle[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [assignments, setAssignments] = useState<CycleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<number | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<number, number[]>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCycle, setEditingCycle] = useState<ShiftCycle | null>(null);
  const { toasts, showToast, removeToast } = useToast();

  // ─── Cycle Exceptions state ────────────────────────────────
  const [exceptions, setExceptions] = useState<CycleExceptionRecord[]>([]);
  const [loadingExceptions, setLoadingExceptions] = useState(false);
  const [showAddExceptionModal, setShowAddExceptionModal] = useState(false);

  // ─── Active tab ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'zyklen' | 'mitarbeiter' | 'ausnahmen'>('zyklen');

  const loadExceptions = useCallback(async () => {
    setLoadingExceptions(true);
    try {
      const data = await api.getCycleExceptions();
      setExceptions(data as CycleExceptionRecord[]);
    } catch (e) {
      console.error('Fehler beim Laden der Ausnahmen:', e);
    } finally {
      setLoadingExceptions(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.getEmployees(),
      api.getGroups(),
      api.getShiftCycles(),
      api.getCycleAssignments(),
      api.getShifts(),
    ])
      .then(([emps, grps, cycs, asgns, shfts]) => {
        setEmployees(emps);
        setGroups(grps);
        setCycles(cycs);
        setAssignments(asgns);
        setShifts(shfts);
        return Promise.all(grps.map(g => api.getGroupMembers(g.ID).then(members => ({ gid: g.ID, members: members.map(m => m.ID) }))));
      })
      .then(memberData => {
        const map: Record<number, number[]> = {};
        memberData.forEach(({ gid, members }) => { map[gid] = members; });
        setGroupMembers(map);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));

    loadExceptions();
  }, [loadExceptions]);

  const getGroupName = (employee: Employee): string => {
    for (const [gid, memberIds] of Object.entries(groupMembers)) {
      if (memberIds.includes(employee.ID)) {
        const g = groups.find(g => g.ID === Number(gid));
        if (g) return g.NAME;
      }
    }
    return '—';
  };

  const getAssignment = (empId: number): CycleAssignment | null =>
    assignments.find(a => a.employee_id === empId) ?? null;

  const getCycleName = (cycleId: number | null): string => {
    if (!cycleId) return '—';
    return cycles.find(c => c.ID === cycleId)?.name ?? '—';
  };

  const getAssignedCount = (cycleId: number): number =>
    assignments.filter(a => a.cycle_id === cycleId).length;

  const getEmployeeName = (employeeId: number): string => {
    const emp = employees.find(e => e.ID === employeeId);
    if (!emp) return `MA #${employeeId}`;
    return `${emp.NAME}, ${emp.FIRSTNAME}`;
  };

  const getShiftLabel = (type: number): { label: string; color?: string; bg?: string } => {
    if (type === 0) return { label: '🏖️ Freier Tag' };
    const shift = shifts.find(s => s.ID === type);
    if (!shift) return { label: `Schicht #${type}` };
    return {
      label: shift.NAME,
      color: shift.COLORTEXT_HEX,
      bg: shift.COLORBK_HEX,
    };
  };

  // Filter employees
  const filtered = employees.filter(emp => {
    const matchSearch = `${emp.NAME} ${emp.FIRSTNAME} ${emp.NUMBER ?? ''}`.toLowerCase()
      .includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterGroup) {
      const members = groupMembers[filterGroup] ?? [];
      if (!members.includes(emp.ID)) return false;
    }
    return true;
  });

  const handleSave = (newAssignment: CycleAssignment) => {
    setAssignments(prev => {
      const filtered = prev.filter(a => a.employee_id !== newAssignment.employee_id);
      return [...filtered, newAssignment];
    });
    setEditingEmployee(null);
    showToast('Schichtmodell zugewiesen ✓', 'success');
  };

  const handleRemove = async (emp: Employee) => {
    if (!confirm(`Zyklus-Zuweisung für ${emp.FIRSTNAME} ${emp.NAME} wirklich entfernen?`)) return;
    try {
      await api.removeCycleAssignment(emp.ID);
      setAssignments(prev => prev.filter(a => a.employee_id !== emp.ID));
      showToast('Zuweisung entfernt', 'success');
    } catch (e) {
      showToast('Fehler beim Entfernen: ' + String(e), 'error');
    }
  };

  // ─── Cycle CRUD handlers ───────────────────────────────────

  const handleCycleCreated = (newCycle: ShiftCycle) => {
    setShowCreateModal(false);
    // Immediately open edit modal with the fresh full cycle
    api.getShiftCycle(newCycle.ID)
      .then(full => {
        setCycles(prev => [...prev, full]);
        setEditingCycle(full);
      })
      .catch(() => {
        setCycles(prev => [...prev, newCycle]);
        setEditingCycle(newCycle);
      });
    showToast(`Zyklus "${newCycle.name}" erstellt`, 'success');
  };

  const handleCycleSaved = (updatedCycle: ShiftCycle) => {
    setCycles(prev => prev.map(c => c.ID === updatedCycle.ID ? updatedCycle : c));
    setEditingCycle(null);
    showToast(`Zyklus "${updatedCycle.name}" gespeichert ✓`, 'success');
  };

  const handleDeleteCycle = async (cycle: ShiftCycle) => {
    const assignedCount = getAssignedCount(cycle.ID);
    let confirmMsg = `Zyklus "${cycle.name}" wirklich löschen?`;
    if (assignedCount > 0) {
      confirmMsg = `⚠️ Zyklus "${cycle.name}" ist ${assignedCount} Mitarbeiter${assignedCount !== 1 ? 'n' : ''} zugewiesen!\n\nTrotzdem löschen?`;
    }
    if (!confirm(confirmMsg)) return;
    try {
      await api.deleteShiftCycle(cycle.ID);
      setCycles(prev => prev.filter(c => c.ID !== cycle.ID));
      // Remove related assignments from local state
      setAssignments(prev => prev.filter(a => a.cycle_id !== cycle.ID));
      showToast(`Zyklus "${cycle.name}" gelöscht`, 'success');
    } catch (e) {
      showToast('Fehler beim Löschen: ' + String(e), 'error');
    }
  };

  const handleDeleteException = async (exc: CycleExceptionRecord) => {
    if (!confirm(`Ausnahme für ${getEmployeeName(exc.employee_id)} am ${exc.date} wirklich löschen?`)) return;
    try {
      await api.deleteCycleException(exc.id);
      setExceptions(prev => prev.filter(e => e.id !== exc.id));
      showToast('Ausnahme gelöscht', 'success');
    } catch (e) {
      showToast('Fehler beim Löschen: ' + String(e), 'error');
    }
  };

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🔄 Schichtmodelle</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Weise Mitarbeitern wiederkehrende Schichtzyklen zu
            {cycles.length > 0 && <span className="ml-2 text-blue-600 font-medium">{cycles.length} Modell{cycles.length !== 1 ? 'e' : ''} geladen</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterGroup ?? ''}
            onChange={e => setFilterGroup(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-1.5 border rounded shadow-sm text-sm"
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
          </select>
          <input
            type="text"
            placeholder="Suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 border rounded shadow-sm text-sm w-40"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* ─── Tab Navigation ────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'zyklen' as const, label: '📋 Zyklen-Verwaltung' },
          { key: 'mitarbeiter' as const, label: '👥 Mitarbeiter-Zuweisungen' },
          { key: 'ausnahmen' as const, label: `🚫 Zyklus-Ausnahmen${exceptions.length > 0 ? ` (${exceptions.length})` : ''}` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-700 border-gray-200 -mb-px z-10'
                : 'bg-gray-50 text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Zyklen-Verwaltung ────────────────────────── */}
      {activeTab === 'zyklen' && (
        <>
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                📋 Zyklen-Verwaltung
              </h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              >
                + Neuer Zyklus
              </button>
            </div>

            {loading ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">⟳ Lade Zyklen...</div>
            ) : cycles.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm italic">
                Noch keine Schichtzyklen vorhanden. Erstelle einen mit "+ Neuer Zyklus".
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-center">Wochen</th>
                    <th className="px-4 py-2 text-center">Zugewiesene MAs</th>
                    <th className="px-4 py-2 text-center">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle, i) => {
                    const assignedCount = getAssignedCount(cycle.ID);
                    return (
                      <tr
                        key={cycle.ID}
                        className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                      >
                        <td className="px-4 py-2.5 font-semibold text-gray-800">{cycle.name}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                            {cycle.weeks}W
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {assignedCount > 0 ? (
                            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                              {assignedCount} MA{assignedCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => setEditingCycle(cycle)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors mr-2"
                          >
                            ✏️ Bearbeiten
                          </button>
                          <button
                            onClick={() => handleDeleteCycle(cycle)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                          >
                            🗑️ Löschen
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Cycle catalog */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Verfügbare Schichtmodelle ({cycles.length})
            </h2>
            {loading ? (
              <div className="text-gray-400 text-sm">⟳ Lade Modelle...</div>
            ) : cycles.length === 0 ? (
              <div className="text-gray-400 text-sm italic">Keine Schichtmodelle in der Datenbank gefunden.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cycles.map(cycle => (
                  <div key={cycle.ID} className="bg-white rounded-lg border p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-gray-800">{cycle.name}</span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {cycle.weeks}W
                      </span>
                    </div>
                    <CycleWeekGrid schedule={cycle.schedule} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Tab: Mitarbeiter-Zuweisungen ─────────────────── */}
      {activeTab === 'mitarbeiter' && (
        <div className="bg-white rounded-lg shadow overflow-x-auto mb-6">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">👥 Mitarbeiter-Zuweisungen</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-700 text-white text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Nr.</th>
                <th className="px-4 py-2 text-left">Mitarbeiter</th>
                <th className="px-4 py-2 text-left">Gruppe</th>
                <th className="px-4 py-2 text-left">Aktuelles Modell</th>
                <th className="px-4 py-2 text-left">Startdatum</th>
                <th className="px-4 py-2 text-center">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">⟳ Lade Daten...</td></tr>
              )}
              {!loading && filtered.map((emp, i) => {
                const asgn = getAssignment(emp.ID);
                const hasAssignment = !!asgn;
                return (
                  <tr
                    key={emp.ID}
                    className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                  >
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{emp.NUMBER}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-gray-800">{emp.NAME}, {emp.FIRSTNAME}</div>
                      <div className="text-xs text-gray-400">{emp.SHORTNAME}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-sm">{getGroupName(emp)}</td>
                    <td className="px-4 py-2.5">
                      {hasAssignment ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                          {getCycleName(asgn.cycle_id)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Kein Modell</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">
                      {asgn?.start ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => setEditingEmployee(emp)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        ✏️ Bearbeiten
                      </button>
                      {hasAssignment && (
                        <button
                          onClick={() => handleRemove(emp)}
                          className="ml-2 inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                        >
                          🗑️ Entfernen
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Keine Mitarbeiter gefunden</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Tab: Zyklus-Ausnahmen ──────────────────────────── */}
      {activeTab === 'ausnahmen' && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                🚫 Zyklus-Ausnahmen
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Einmalige Abweichungen vom Schichtzyklus — z.B. ein freier Tag oder eine andere Schicht an einem bestimmten Datum.
              </p>
            </div>
            <button
              onClick={() => setShowAddExceptionModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors font-medium"
            >
              + Ausnahme hinzufügen
            </button>
          </div>

          {loadingExceptions ? (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">⟳ Lade Ausnahmen...</div>
          ) : exceptions.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-400 text-sm italic">
              Keine Zyklus-Ausnahmen vorhanden.
              <br />
              <span className="text-xs">Klicke "+ Ausnahme hinzufügen", um eine einmalige Abweichung einzutragen.</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-orange-50 text-xs uppercase tracking-wide text-orange-700 border-b border-orange-100">
                <tr>
                  <th className="px-4 py-2 text-left">Mitarbeiter</th>
                  <th className="px-4 py-2 text-center">Datum</th>
                  <th className="px-4 py-2 text-center">Ausnahme-Schicht</th>
                  <th className="px-4 py-2 text-center">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((exc, i) => {
                  const shiftInfo = getShiftLabel(exc.type);
                  return (
                    <tr
                      key={exc.id}
                      className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-orange-50/30'} hover:bg-orange-50 transition-colors`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-gray-800">{getEmployeeName(exc.employee_id)}</div>
                        <div className="text-xs text-gray-400">MA #{exc.employee_id}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-mono text-sm text-gray-700">{exc.date}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {exc.type === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            🏖️ Freier Tag
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
                            style={shiftInfo.bg ? { background: shiftInfo.bg, color: shiftInfo.color } : {}}
                          >
                            {shiftInfo.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => handleDeleteException(exc)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                        >
                          🗑️ Löschen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-400 rounded-b-lg">
            {exceptions.length} Ausnahme{exceptions.length !== 1 ? 'n' : ''} gesamt
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateCycleModal
          onCreated={handleCycleCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingCycle && (
        <EditCycleModal
          cycle={editingCycle}
          shifts={shifts}
          onSaved={handleCycleSaved}
          onClose={() => setEditingCycle(null)}
        />
      )}

      {editingEmployee && (
        <EditModal
          employee={editingEmployee}
          groupName={getGroupName(editingEmployee)}
          currentAssignment={getAssignment(editingEmployee.ID)}
          cycles={cycles}
          onSave={handleSave}
          onClose={() => setEditingEmployee(null)}
        />
      )}

      {showAddExceptionModal && (
        <AddExceptionModal
          employees={employees}
          assignments={assignments}
          shifts={shifts}
          onCreated={() => {
            setShowAddExceptionModal(false);
            loadExceptions();
            showToast('Ausnahme hinzugefügt ✓', 'success');
          }}
          onClose={() => setShowAddExceptionModal(false)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
