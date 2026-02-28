import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSSERefresh } from '../contexts/SSEContext';
import { HelpTooltip } from '../components/HelpTooltip';
import { EmptyState } from '../components/EmptyState';

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
type ViewMode = 'list' | 'grouped';

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

function conflictTypeLabel(type: string): { label: string; icon: string; color: string } {
  switch (type) {
    case 'shift_and_absence':
      return { label: 'Schicht + Abwesenheit', icon: '⚡', color: 'bg-red-100 text-red-700' };
    case 'holiday_ban':
      return { label: 'Urlaubssperre', icon: '🚫', color: 'bg-orange-100 text-orange-700' };
    default:
      return { label: type, icon: '⚠️', color: 'bg-yellow-100 text-yellow-700' };
  }
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

// ─── Bulk Delete Modal ────────────────────────────────────
interface BulkDeleteModalProps {
  count: number;
  deleteType: 'shift' | 'absence';
  onConfirm: (deleteType: 'shift' | 'absence') => void;
  onCancel: () => void;
}
function BulkDeleteModal({ count, deleteType, onConfirm, onCancel }: BulkDeleteModalProps) {
  const [selectedType, setSelectedType] = useState<'shift' | 'absence'>(deleteType);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-bold text-gray-800">🗑 Massenauflösung: {count} Konflikte</h2>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Was soll bei allen <strong>{count}</strong> ausgewählten Konflikten gelöscht werden?
          </p>
          <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-blue-50 transition-colors">
            <input
              type="radio"
              name="delType"
              value="shift"
              checked={selectedType === 'shift'}
              onChange={() => setSelectedType('shift')}
              className="text-blue-600"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">📅 Schichten löschen</div>
              <div className="text-xs text-gray-500">Die Schichtzuweisung wird entfernt, Abwesenheit bleibt erhalten</div>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-orange-50 transition-colors">
            <input
              type="radio"
              name="delType"
              value="absence"
              checked={selectedType === 'absence'}
              onChange={() => setSelectedType('absence')}
              className="text-orange-600"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">🏖️ Abwesenheiten löschen</div>
              <div className="text-xs text-gray-500">Die Abwesenheit wird entfernt, Schicht bleibt erhalten</div>
            </div>
          </label>
        </div>
        <div className="px-6 py-3 border-t flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 text-gray-700"
          >
            Abbrechen
          </button>
          <button
            onClick={() => onConfirm(selectedType)}
            className={`px-4 py-2 text-sm rounded-lg text-white font-medium ${selectedType === 'shift' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'}`}
          >
            {count} Konflikte auflösen
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

  // New state: filters, selection, view mode
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<number>>(new Set());

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedKeys(new Set());
    try {
      const res = await fetch(`${BASE_URL}/api/schedule/conflicts?year=${year}&month=${month}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ConflictsResponse = await res.json();
      setConflicts(data.conflicts ?? []);
    } catch (_e) {
      setError('Fehler beim Laden der Konflikte.');
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  // SSE: auto-refresh when conflicts change remotely
  useSSERefresh(['conflict_updated', 'schedule_changed', 'absence_changed'], fetchConflicts);

  // Derived: unique conflict types
  const conflictTypes = useMemo(() => {
    const types = new Set(conflicts.map(c => c.type));
    return Array.from(types);
  }, [conflicts]);

  // Filtered conflicts
  const filteredConflicts = useMemo(() => {
    return conflicts.filter(c => {
      if (filterType !== 'all' && c.type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.employee_name.toLowerCase().includes(q) &&
            !c.shift_name?.toLowerCase().includes(q) &&
            !c.absence_name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [conflicts, filterType, searchQuery]);

  // Grouped by employee
  const groupedConflicts = useMemo(() => {
    const groups: Map<number, { name: string; conflicts: Conflict[] }> = new Map();
    for (const c of filteredConflicts) {
      if (!groups.has(c.employee_id)) {
        groups.set(c.employee_id, { name: c.employee_name, conflicts: [] });
      }
      groups.get(c.employee_id)!.conflicts.push(c);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[1].conflicts.length - a[1].conflicts.length);
  }, [filteredConflicts]);

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
      setTimeout(() => fetchConflicts(), 300);
    } catch {
      setActionState(s => ({ ...s, [key]: 'error' }));
      setTimeout(() => setActionState(s => ({ ...s, [key]: 'idle' })), 3000);
    }
    setConfirmAction(null);
  };

  const handleBulkDelete = async (deleteType: 'shift' | 'absence') => {
    setShowBulkModal(false);
    const toDelete = filteredConflicts.filter(c => selectedKeys.has(conflictKey(c)));
    setBulkProgress({ done: 0, total: toDelete.length });
    let done = 0;
    for (const c of toDelete) {
      try {
        if (deleteType === 'shift') {
          await apiDelete(`/api/schedule-shift/${c.employee_id}/${c.date}`);
        } else {
          await apiDelete(`/api/absences/${c.employee_id}/${c.date}`);
        }
      } catch {
        // continue anyway
      }
      done++;
      setBulkProgress({ done, total: toDelete.length });
    }
    setBulkProgress(null);
    setSelectedKeys(new Set());
    fetchConflicts();
  };

  const conflictKey = (c: Conflict) => `${c.employee_id}-${c.date}`;

  const toggleSelect = (c: Conflict) => {
    const key = conflictKey(c);
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredConflicts.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredConflicts.map(conflictKey)));
    }
  };

  const toggleEmployeeExpand = (eid: number) => {
    setExpandedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(eid)) next.delete(eid);
      else next.add(eid);
      return next;
    });
  };

  const getActionState = (type: 'shift' | 'absence', conflict: Conflict) =>
    actionState[`${type}-${conflict.employee_id}-${conflict.date}`] ?? 'idle';

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i);

  // ─── Render conflict row ──────────────────────────────────
  const renderConflictRow = (c: Conflict, idx: number, showCheckbox = true) => {
    const shiftState = getActionState('shift', c);
    const absState = getActionState('absence', c);
    const key = conflictKey(c);
    const typeInfo = conflictTypeLabel(c.type);
    return (
      <tr
        key={`${c.employee_id}-${c.date}-${idx}`}
        className={`hover:bg-red-50/30 transition-colors ${selectedKeys.has(key) ? 'bg-blue-50' : ''}`}
      >
        {showCheckbox && (
          <td className="px-3 py-3">
            <input
              type="checkbox"
              checked={selectedKeys.has(key)}
              onChange={() => toggleSelect(c)}
              className="rounded text-blue-600"
            />
          </td>
        )}
        <td className="px-4 py-3 font-medium text-gray-800">
          {viewMode === 'list' && c.employee_name}
          {viewMode === 'grouped' && (
            <span className="text-gray-500 text-xs">{formatDate(c.date)}</span>
          )}
        </td>
        {viewMode === 'list' && (
          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
            {formatDate(c.date)}
          </td>
        )}
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${typeInfo.color}`}>
            {typeInfo.icon} {typeInfo.label}
          </span>
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
              {shiftState === 'loading' ? '…' : shiftState === 'done' ? '✓ Schicht gelöscht' : shiftState === 'error' ? '✕ Fehler' : '🗑 Schicht'}
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
              {absState === 'loading' ? '…' : absState === 'done' ? '✓ Abw. gelöscht' : absState === 'error' ? '✕ Fehler' : '🗑 Abwesenheit'}
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
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
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            Planungskonflikte: Schicht + Abwesenheit / Urlaubssperre
            <HelpTooltip
              position="right"
              text={"Konflikte entstehen wenn:\n• Ein Mitarbeiter gleichzeitig eine Schicht und eine Abwesenheit hat\n• Ein Mitarbeiter während einer Urlaubssperre eingeplant ist\n\nAuflösen: Schicht oder Abwesenheit löschen."}
            />
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

      {/* Bulk Progress */}
      {bulkProgress && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-blue-700 rounded-full animate-spin" />
          <span>Auflösung läuft: {bulkProgress.done} / {bulkProgress.total} Konflikte verarbeitet…</span>
          <div className="flex-1 bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && conflicts.length === 0 && (
        <EmptyState
          icon="✅"
          title="Alles in Ordnung"
          description={`Für ${MONTHS[month - 1]} ${year} gibt es keine Planungskonflikte.`}
        />
      )}

      {/* Filter + Toolbar */}
      {!loading && conflicts.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-3 items-center">
            {/* Search */}
            <input
              type="text"
              placeholder="🔍 Mitarbeiter / Schicht / Abwesenheit suchen…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-sm border rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
            />

            {/* Type Filter */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${filterType === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Alle ({conflicts.length})
              </button>
              {conflictTypes.map(t => {
                const info = conflictTypeLabel(t);
                const cnt = conflicts.filter(c => c.type === t).length;
                return (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${filterType === t ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {info.icon} {info.label} ({cnt})
                  </button>
                );
              })}
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${viewMode === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ☰ Liste
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${viewMode === 'grouped' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              >
                👥 Gruppiert
              </button>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedKeys.size > 0 && (
            <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-blue-800">
                {selectedKeys.size} Konflikte ausgewählt
              </span>
              <button
                onClick={() => setShowBulkModal(true)}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition-colors"
              >
                🗑 Massenauflösung…
              </button>
              <button
                onClick={() => setSelectedKeys(new Set())}
                className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50 text-gray-600 font-medium transition-colors"
              >
                ✕ Auswahl aufheben
              </button>
            </div>
          )}

          {/* Filtered count mismatch info */}
          {filteredConflicts.length !== conflicts.length && (
            <div className="mb-3 text-xs text-gray-500">
              {filteredConflicts.length} von {conflicts.length} Konflikten angezeigt
              {searchQuery && ` (Filter: "${searchQuery}")`}
            </div>
          )}
        </>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && filteredConflicts.length > 0 && viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-red-50 flex items-center justify-between">
            <span className="text-red-600 font-medium text-sm">
              🔴 {filteredConflicts.length} Konflikt{filteredConflicts.length !== 1 ? 'e' : ''} in {MONTHS[month - 1]} {year}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedKeys.size === filteredConflicts.length && filteredConflicts.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded text-blue-600"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Mitarbeiter</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Datum</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Typ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Schicht</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Abwesenheit</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredConflicts.map((c, idx) => renderConflictRow(c, idx, true))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t text-xs text-gray-400 bg-gray-50">
            Tipp: Wähle mehrere Konflikte aus und nutze die Massenauflösung, um schnell aufzuräumen.
          </div>
        </div>
      )}

      {/* ── GROUPED VIEW ── */}
      {!loading && filteredConflicts.length > 0 && viewMode === 'grouped' && (
        <div className="space-y-3">
          {groupedConflicts.map(([eid, group]) => {
            const isExpanded = expandedEmployees.has(eid);
            const empConflicts = group.conflicts;
            const allSelected = empConflicts.every(c => selectedKeys.has(conflictKey(c)));
            const someSelected = empConflicts.some(c => selectedKeys.has(conflictKey(c)));
            return (
              <div key={eid} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* Employee header */}
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleEmployeeExpand(eid)}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={e => {
                      e.stopPropagation();
                      setSelectedKeys(prev => {
                        const next = new Set(prev);
                        if (allSelected) {
                          empConflicts.forEach(c => next.delete(conflictKey(c)));
                        } else {
                          empConflicts.forEach(c => next.add(conflictKey(c)));
                        }
                        return next;
                      });
                    }}
                    onClick={e => e.stopPropagation()}
                    className="rounded text-blue-600"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-800">{group.name}</span>
                  </div>
                  <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    empConflicts.length >= 5 ? 'bg-red-100 text-red-700' :
                    empConflicts.length >= 3 ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {empConflicts.length} Konflikt{empConflicts.length !== 1 ? 'e' : ''}
                  </span>
                  <span className="text-gray-400 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded rows */}
                {isExpanded && (
                  <div className="border-t overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2"></th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">Datum</th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">Typ</th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">Schicht</th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">Abwesenheit</th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {empConflicts.map((c, idx) => renderConflictRow(c, idx, true))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No results after filter */}
      {!loading && conflicts.length > 0 && filteredConflicts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-base font-medium text-gray-600">Kein Ergebnis</p>
          <p className="text-sm mt-1">Keine Konflikte entsprechen dem aktuellen Filter.</p>
          <button
            onClick={() => { setSearchQuery(''); setFilterType('all'); }}
            className="mt-3 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Filter zurücksetzen
          </button>
        </div>
      )}

      {/* Confirm single delete Modal */}
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

      {/* Bulk delete modal */}
      {showBulkModal && (
        <BulkDeleteModal
          count={selectedKeys.size}
          deleteType="shift"
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkModal(false)}
        />
      )}
    </div>
  );
}

// ─── Export hook for conflict count (used in App.tsx badge) ─
// eslint-disable-next-line react-refresh/only-export-components
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
