import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────
interface Conflict {
  employee_id: number;
  employee_name: string;
  date: string;
  type: string;
  shift_name: string;
  absence_name: string;
  message: string;
}

interface ConflictsResponse {
  conflicts: Conflict[];
}

type ActionState = 'idle' | 'loading' | 'done' | 'error';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}


const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

async function apiDelete(path: string): Promise<{ ok: boolean; deleted: number }> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Confirmation Modal ───────────────────────────────────
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-bold text-gray-800">{title}</h2>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="px-6 py-3 border-t flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 text-gray-700"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg text-white font-medium ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────
export default function Konflikte() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [confirmAction, setConfirmAction] = useState<{
    type: 'shift' | 'absence';
    conflict: Conflict;
  } | null>(null);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/schedule/conflicts?year=${year}&month=${month}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ConflictsResponse = await res.json();
      setConflicts(data.conflicts ?? []);
    } catch (e) {
      setError('Fehler beim Laden der Konflikte.');
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const handleDelete = async (type: 'shift' | 'absence', conflict: Conflict) => {
    const key = `${type}-${conflict.employee_id}-${conflict.date}`;
    setActionState(s => ({ ...s, [key]: 'loading' }));
    try {
      if (type === 'shift') {
        await apiDelete(`/api/schedule-shift/${conflict.employee_id}/${conflict.date}`);
      } else {
        await apiDelete(`/api/absences/${conflict.employee_id}/${conflict.date}`);
      }
      setActionState(s => ({ ...s, [key]: 'done' }));
      // Refresh list after short delay
      setTimeout(() => fetchConflicts(), 300);
    } catch {
      setActionState(s => ({ ...s, [key]: 'error' }));
      setTimeout(() => setActionState(s => ({ ...s, [key]: 'idle' })), 3000);
    }
    setConfirmAction(null);
  };

  const getActionState = (type: 'shift' | 'absence', conflict: Conflict) =>
    actionState[`${type}-${conflict.employee_id}-${conflict.date}`] ?? 'idle';

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            ⚠️ Konflikte
            {!loading && conflicts.length > 0 && (
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold">
                {conflicts.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Mitarbeiter mit gleichzeitiger Schicht &amp; Abwesenheit am selben Tag
          </p>
        </div>

        {/* Month / Year Filter */}
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="text-sm border rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="text-sm border rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={fetchConflicts}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '…' : '↻'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            <span className="text-sm">Konflikte werden geladen…</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && conflicts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-lg font-medium text-gray-600">Keine Konflikte</p>
          <p className="text-sm mt-1">Für {MONTHS[month - 1]} {year} gibt es keine Planungskonflikte.</p>
        </div>
      )}

      {/* Conflicts Table */}
      {!loading && conflicts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-red-50 flex items-center gap-2">
            <span className="text-red-600 font-medium text-sm">
              🔴 {conflicts.length} Konflikt{conflicts.length !== 1 ? 'e' : ''} in {MONTHS[month - 1]} {year}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Mitarbeiter</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Datum</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Schicht</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Abwesenheit</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {conflicts.map((c, idx) => {
                  const shiftState = getActionState('shift', c);
                  const absState = getActionState('absence', c);
                  return (
                    <tr
                      key={`${c.employee_id}-${c.date}-${idx}`}
                      className="hover:bg-red-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {c.employee_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(c.date)}
                      </td>
                      <td className="px-4 py-3">
                        {c.shift_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                            📅 {c.shift_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Sonderschicht</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.absence_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-xs font-medium">
                            🏖️ {c.absence_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Abwesenheit</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setConfirmAction({ type: 'shift', conflict: c })}
                            disabled={shiftState === 'loading' || shiftState === 'done'}
                            className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                              shiftState === 'loading'
                                ? 'bg-gray-300 text-gray-500 cursor-wait'
                                : shiftState === 'done'
                                ? 'bg-green-100 text-green-700'
                                : shiftState === 'error'
                                ? 'bg-red-100 text-red-700 border border-red-300'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {shiftState === 'loading' ? '…' : shiftState === 'done' ? '✓ Schicht gelöscht' : shiftState === 'error' ? '✕ Fehler' : '🗑 Schicht löschen'}
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: 'absence', conflict: c })}
                            disabled={absState === 'loading' || absState === 'done'}
                            className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                              absState === 'loading'
                                ? 'bg-gray-300 text-gray-500 cursor-wait'
                                : absState === 'done'
                                ? 'bg-green-100 text-green-700'
                                : absState === 'error'
                                ? 'bg-red-100 text-red-700 border border-red-300'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                          >
                            {absState === 'loading' ? '…' : absState === 'done' ? '✓ Abwesenheit gelöscht' : absState === 'error' ? '✕ Fehler' : '🗑 Abwesenheit löschen'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t text-xs text-gray-400 bg-gray-50">
            Tipp: Löschen Sie entweder die Schicht oder die Abwesenheit, um den Konflikt zu bereinigen.
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.type === 'shift' ? 'Schicht löschen?' : 'Abwesenheit löschen?'}
          message={
            confirmAction.type === 'shift'
              ? `Schicht "${confirmAction.conflict.shift_name || 'Sonderschicht'}" von ${confirmAction.conflict.employee_name} am ${formatDate(confirmAction.conflict.date)} wirklich löschen?`
              : `Abwesenheit "${confirmAction.conflict.absence_name || 'Abwesenheit'}" von ${confirmAction.conflict.employee_name} am ${formatDate(confirmAction.conflict.date)} wirklich löschen?`
          }
          confirmLabel={confirmAction.type === 'shift' ? 'Schicht löschen' : 'Abwesenheit löschen'}
          confirmClass={confirmAction.type === 'shift' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'}
          onConfirm={() => handleDelete(confirmAction.type, confirmAction.conflict)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

// ─── Export hook for conflict count (used in App.tsx badge) ─
export async function fetchConflictCount(year: number, month: number): Promise<number> {
  const BASE = import.meta.env.VITE_API_URL ?? '';

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}

  try {
    const res = await fetch(`${BASE}/api/schedule/conflicts?year=${year}&month=${month}`, { headers: getAuthHeaders() });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.conflicts ?? []).length;
  } catch {
    return 0;
  }
}
