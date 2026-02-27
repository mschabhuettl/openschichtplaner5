import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { ShiftRequirement, StaffingRequirements, SpecialStaffingReq } from '../api/client';
import type { ShiftType, Group } from '../types';

// ─── Constants ─────────────────────────────────────────────
const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ─── Cell: Min/Max display ─────────────────────────────────
interface RequirementCellProps {
  req: ShiftRequirement | null;
  onEdit: () => void;
  actual?: number; // actual staffing count for this weekday/shift (if known)
}

function RequirementCell({ req, onEdit, actual }: RequirementCellProps) {
  if (!req) {
    return (
      <td className="border border-gray-200 px-2 py-2 text-center">
        <button
          onClick={onEdit}
          className="text-xs text-gray-300 hover:text-blue-400 transition-colors w-full"
          title="Bedarf festlegen" aria-label="Bedarf festlegen"
        >
          <span className="block font-mono">–</span>
        </button>
      </td>
    );
  }
  const { min, max } = req;
  const isOverMax = actual !== undefined && max > 0 && actual > max;

  return (
    <td className={`border border-gray-200 px-2 py-2 text-center ${isOverMax ? 'bg-red-50' : ''}`}>
      <button
        onClick={onEdit}
        className="w-full rounded hover:bg-blue-50 transition-colors px-1 py-0.5"
        title={isOverMax ? `Ist-Besetzung (${actual}) überschreitet Maximum (${max})` : 'Bearbeiten'}
      >
        <span className="block text-xs font-mono">
          {max > 0 ? (
            <>
              <span className="text-green-700 font-bold">{min}</span>
              <span className="text-gray-400">–</span>
              <span className={`font-bold ${isOverMax ? 'text-red-600' : 'text-blue-700'}`}>{max}</span>
            </>
          ) : (
            <span className="text-green-700 font-bold">{min}</span>
          )}
        </span>
        {isOverMax && (
          <span className="block text-xs font-bold text-red-600 mt-0.5">⚠ Ist: {actual}</span>
        )}
      </button>
    </td>
  );
}

// ─── Edit Modal (weekly) ───────────────────────────────────
interface EditModalProps {
  shiftName: string;
  weekdayName: string;
  existing: ShiftRequirement | null;
  onSave: (min: number, max: number) => Promise<void>;
  onClose: () => void;
}

function EditModal({ shiftName, weekdayName, existing, onSave, onClose }: EditModalProps) {
  const [min, setMin] = useState(existing?.min ?? 0);
  const [max, setMax] = useState(existing?.max ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(min, max);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Personalbedarf</h2>
            <p className="text-sm text-gray-500 mt-0.5">{shiftName} · {weekdayName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum <span className="text-green-600">(min)</span>
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={min}
                onChange={e => setMin(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum <span className="text-blue-600">(max)</span>
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={max}
                onChange={e => setMax(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            <span>💾 </span>
            <span>Änderungen werden direkt in die Datenbank (5SHDEM.DBF) geschrieben.</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Übernehmen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Special Staffing Modal ────────────────────────────────
interface SpecialEditModalProps {
  shifts: ShiftType[];
  groups: Group[];
  existing: SpecialStaffingReq | null;
  onSave: (data: {
    group_id: number; date: string; shift_id: number;
    workplace_id: number; min: number; max: number;
  }) => Promise<void>;
  onClose: () => void;
  defaultDate?: string;
  defaultGroupId?: number;
}

function SpecialEditModal({ shifts, groups, existing, onSave, onClose, defaultDate, defaultGroupId }: SpecialEditModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(existing?.date || defaultDate || today);
  const [groupId, setGroupId] = useState<number>(existing?.group_id || defaultGroupId || (groups[0]?.ID ?? 0));
  const [shiftId, setShiftId] = useState<number>(existing?.shift_id || (shifts[0]?.ID ?? 0));
  const [min, setMin] = useState(existing?.min ?? 1);
  const [max, setMax] = useState(existing?.max ?? 3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!date) { setError('Datum ist Pflichtfeld'); return; }
    if (!groupId) { setError('Gruppe ist Pflichtfeld'); return; }
    if (!shiftId) { setError('Schichtart ist Pflichtfeld'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ group_id: groupId, date, shift_id: shiftId, workplace_id: 0, min, max });
      onClose();
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
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {existing ? 'Eintrag bearbeiten' : 'Datumsspezifischen Bedarf hinzufügen'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">5SPDEM.DBF</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gruppe</label>
            <select
              value={groupId}
              onChange={e => setGroupId(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schichtart</label>
            <select
              value={shiftId}
              onChange={e => setShiftId(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {shifts.map(s => <option key={s.ID} value={s.ID}>{s.NAME} ({s.SHORTNAME})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum <span className="text-green-600">(min)</span>
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={min}
                onChange={e => setMin(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum <span className="text-blue-600">(max)</span>
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={max}
                onChange={e => setMax(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Speichern…' : existing ? 'Änderungen speichern' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Wöchentlich (original content) ──────────────────
function WeeklyTab({
  shifts,
  groups,
  requirements,
  loading,
  error,
}: {
  shifts: ShiftType[];
  groups: Group[];
  requirements: StaffingRequirements | null;
  loading: boolean;
  error: string | null;
}) {
  const [filterGroup, setFilterGroup] = useState<number | null>(null);
  const [editing, setEditing] = useState<{
    shiftId: number; weekday: number; shiftName: string; groupId: number;
  } | null>(null);
  const [reqs, setReqs] = useState<StaffingRequirements | null>(requirements);

  // Sync reqs when requirements changes
  useEffect(() => {
    setReqs(requirements);
  }, [requirements]);

  const loadRequirements = async () => {
    const req = await api.getStaffingRequirements();
    setReqs(req);
  };

  const reqMap: Record<number, Record<number, ShiftRequirement>> = {};
  if (reqs) {
    for (const r of reqs.shift_requirements) {
      if (filterGroup !== null && r.group_id !== filterGroup) continue;
      if (!reqMap[r.shift_id]) reqMap[r.shift_id] = {};
      reqMap[r.shift_id][r.weekday] = r;
    }
  }

  const getEffective = (shiftId: number, weekday: number): ShiftRequirement | null =>
    reqMap[shiftId]?.[weekday] ?? null;

  const handleSave = async (shiftId: number, weekday: number, min: number, max: number, groupId: number) => {
    await api.setStaffingRequirement({ shift_id: shiftId, weekday, min, max, group_id: groupId });
    await loadRequirements();
  };

  const totalDefined = shifts.reduce((acc, sh) =>
    acc + WEEKDAYS.reduce((a2, _, d) => a2 + (getEffective(sh.ID, d) ? 1 : 0), 0), 0);
  const totalCells = shifts.length * 7;
  const editingShift = editing ? shifts.find(s => s.ID === editing.shiftId) : null;

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <select
          value={filterGroup ?? ''}
          onChange={e => setFilterGroup(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-1.5 border rounded shadow-sm text-sm"
        >
          <option value="">Alle Gruppen</option>
          {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
        </select>
        {!loading && (
          <span className="text-sm text-blue-600 font-medium ml-2">
            {totalDefined}/{totalCells} Zellen definiert
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-white border border-gray-300 inline-block" />
          <span>Nicht definiert</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-green-700 font-bold">2</span>
          <span className="text-gray-400">–</span>
          <span className="font-mono text-blue-700 font-bold">4</span>
          <span>= min–max Mitarbeiter (max=0: nur min)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />
          <span>Ist-Besetzung über Maximum</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">⟳ Lade Personalbedarf...</div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">Keine Schichtarten gefunden.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="text-sm border-collapse w-full">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide font-semibold border-r border-slate-600 min-w-[160px]">
                  Schicht
                </th>
                {WEEKDAY_SHORT.map((d, i) => (
                  <th key={i} className="px-3 py-3 text-center text-xs uppercase tracking-wide font-semibold w-20">
                    {d}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs uppercase tracking-wide font-semibold border-l border-slate-600">
                  Σ def.
                </th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift, si) => {
                const definedCount = WEEKDAYS.reduce((acc, _, d) => acc + (getEffective(shift.ID, d) ? 1 : 0), 0);
                return (
                  <tr key={shift.ID} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 border border-gray-200 border-r border-r-gray-300">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-6 h-6 leading-6 rounded text-xs font-bold text-center flex-shrink-0"
                          style={{ background: shift.COLORBK_HEX || '#EEE', color: shift.COLORTEXT_HEX || '#000' }}
                        >
                          {shift.SHORTNAME}
                        </span>
                        <span className="font-medium text-gray-800 text-sm">{shift.NAME}</span>
                      </div>
                    </td>
                    {WEEKDAYS.map((_, d) => {
                      const req = getEffective(shift.ID, d);
                      return (
                        <RequirementCell
                          key={d}
                          req={req}
                          onEdit={() => setEditing({
                            shiftId: shift.ID,
                            weekday: d,
                            shiftName: shift.NAME,
                            groupId: filterGroup ?? 0,
                          })}
                        />
                      );
                    })}
                    <td className="px-4 py-2 text-center border border-gray-200 border-l border-l-gray-300">
                      <span className={`text-xs font-semibold ${definedCount === 7 ? 'text-green-600' : definedCount > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                        {definedCount}/7
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="px-4 py-2 text-xs text-gray-500 font-semibold">Summe definiert</td>
                {WEEKDAYS.map((_, d) => {
                  const count = shifts.reduce((acc, sh) => acc + (getEffective(sh.ID, d) ? 1 : 0), 0);
                  return (
                    <td key={d} className="px-3 py-2 text-center border-x border-gray-200">
                      <span className={`text-xs font-semibold ${count === shifts.length ? 'text-green-600' : count > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                        {count}/{shifts.length}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs font-bold ${totalDefined === totalCells ? 'text-green-600' : 'text-amber-600'}`}>
                    {totalDefined}/{totalCells}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && reqs && reqs.shift_requirements.length === 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <strong>ℹ️ Keine Anforderungen in der Datenbank.</strong> Die Tabelle <code>5SHDEM</code> ist leer.
          Klicke auf eine Zelle um lokale Anforderungen zu hinterlegen.
        </div>
      )}

      {editing && editingShift && (
        <EditModal
          shiftName={editingShift.NAME}
          weekdayName={WEEKDAYS[editing.weekday]}
          existing={getEffective(editing.shiftId, editing.weekday)}
          onSave={(min, max) => handleSave(editing.shiftId, editing.weekday, min, max, editing.groupId)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// ─── Tab: Datumsspezifisch ─────────────────────────────────
function DateSpecificTab({ shifts, groups }: { shifts: ShiftType[]; groups: Group[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<number | null>(null);
  const [specialReqs, setSpecialReqs] = useState<SpecialStaffingReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingReq, setEditingReq] = useState<SpecialStaffingReq | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSpecialStaffing(
        filterDate || undefined,
        filterGroup ?? undefined,
      );
      setSpecialReqs(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterDate, filterGroup]);

  const groupMap = Object.fromEntries(groups.map(g => [g.ID, g]));

  const handleSave = async (data: {
    group_id: number; date: string; shift_id: number;
    workplace_id: number; min: number; max: number;
  }) => {
    if (editingReq) {
      await api.updateSpecialStaffing(editingReq.id, data);
    } else {
      await api.createSpecialStaffing(data);
    }
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Eintrag löschen?')) return;
    setDeleting(id);
    try {
      await api.deleteSpecialStaffing(id);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(null);
    }
  };

  const openAdd = () => {
    setEditingReq(null);
    setShowModal(true);
  };

  const openEdit = (req: SpecialStaffingReq) => {
    setEditingReq(req);
    setShowModal(true);
  };

  // Group rows by date for display
  const byDate: Record<string, SpecialStaffingReq[]> = {};
  for (const r of specialReqs) {
    const d = r.date || '?';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  }
  const sortedDates = Object.keys(byDate).sort();

  const formatDate = (d: string) => {
    if (!d || d.length < 10) return d;
    return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  };

  return (
    <div>
      {/* Filters + Add */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Datum</label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-1.5 border rounded shadow-sm text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Gruppe</label>
          <select
            value={filterGroup ?? ''}
            onChange={e => setFilterGroup(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-1.5 border rounded shadow-sm text-sm"
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
          </select>
        </div>
        {filterDate && (
          <button
            onClick={() => setFilterDate('')}
            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 border rounded"
          >
            ✕ Datum löschen
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={openAdd}
          disabled={groups.length === 0 || shifts.length === 0}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium shadow"
        >
          + Datumsspezifischer Bedarf
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
      )}

      {loading && (
        <div className="text-center py-10 text-gray-400">⟳ Lade...</div>
      )}

      {!loading && specialReqs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm">Keine datumsspezifischen Anforderungen gefunden.</p>
          <p className="text-xs text-gray-300 mt-1">Klicke "+ Datumsspezifischer Bedarf" um einen Eintrag anzulegen.</p>
        </div>
      )}

      {!loading && sortedDates.length > 0 && (
        <div className="space-y-4">
          {sortedDates.map(date => (
            <div key={date} className="bg-white rounded-lg shadow overflow-x-auto">
              <div className="bg-slate-700 text-white px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold">📅 {formatDate(date)}</span>
                <span className="text-xs text-slate-400">{byDate[date].length} Eintrag/Einträge</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Gruppe</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Schicht</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-500 font-semibold">Min</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-500 font-semibold">Max</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {byDate[date].map(req => {
                    const grp = groupMap[req.group_id];
                    return (
                      <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <span className="text-sm text-gray-700">{grp?.NAME || `Gruppe ${req.group_id}`}</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-xs font-bold"
                              style={{ background: req.color_bk, color: req.color_text }}
                            >
                              {req.shift_short}
                            </span>
                            <span className="text-sm text-gray-700">{req.shift_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="font-mono font-bold text-green-700">{req.min}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="font-mono font-bold text-blue-700">{req.max}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(req)}
                              className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                              ✏️ Bearbeiten
                            </button>
                            <button
                              onClick={() => handleDelete(req.id)}
                              disabled={deleting === req.id}
                              className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-red-50 hover:border-red-300 text-red-600 transition-colors disabled:opacity-50"
                            >
                              {deleting === req.id ? '⟳' : '🗑️ Löschen'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        <strong>ℹ️ Datumsspezifischer Personalbedarf</strong> überschreibt oder ergänzt den wöchentlichen
        Bedarf (5SHDEM.DBF) für einzelne Tage. Gespeichert in <code>5SPDEM.DBF</code>.
      </div>

      {/* Modal */}
      {showModal && (
        <SpecialEditModal
          shifts={shifts}
          groups={groups}
          existing={editingReq}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingReq(null); }}
          defaultDate={filterDate || today}
          defaultGroupId={filterGroup ?? undefined}
        />
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────
export default function Personalbedarf() {
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [requirements, setRequirements] = useState<StaffingRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'weekly' | 'special'>('weekly');

  useEffect(() => {
    Promise.all([
      api.getShifts(),
      api.getGroups(),
      api.getStaffingRequirements(),
    ])
      .then(([sh, gr, req]) => {
        setShifts(sh);
        setGroups(gr);
        setRequirements(req);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">👥 Personalbedarf</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Min/Max-Besetzung pro Schicht — wöchentlich oder datumsspezifisch
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
          title="Seite drucken"
        >
          🖨️ <span className="hidden sm:inline">Drucken</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('weekly')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'weekly'
              ? 'bg-white border border-b-white border-gray-200 text-blue-700 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📅 Wöchentlich
        </button>
        <button
          onClick={() => setActiveTab('special')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'special'
              ? 'bg-white border border-b-white border-gray-200 text-blue-700 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📆 Datumsspezifisch
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'weekly' && (
        <WeeklyTab
          shifts={shifts}
          groups={groups}
          requirements={requirements}
          loading={loading}
          error={error}
        />
      )}
      {activeTab === 'special' && (
        <DateSpecificTab
          shifts={shifts}
          groups={groups}
        />
      )}
    </div>
  );
}
