/**
 * RecurringShifts — Q073
 *
 * UI for managing recurring shift patterns.
 * - List view with filters (by group, by employee)
 * - Create modal (employee, shift, recurrence type, day of week, valid_from, valid_until)
 * - Delete with confirmation dialog
 * - Generate button per pattern: opens date range picker → calls generate endpoint → shows toast
 * - Admin/Planer only
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import type {
  RecurringShift,
  RecurringShiftCreate,
  RecurringShiftRecurrence,
} from '../api/client';
import type { Employee, Group, ShiftType } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const RECURRENCE_LABELS: Record<RecurringShiftRecurrence, string> = {
  weekly: 'Wöchentlich',
  biweekly: 'Zweiwöchentlich',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function twoMonthsLater(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().split('T')[0];
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastMsg {
  id: number;
  text: string;
  type: 'success' | 'error';
}

let _toastId = 0;

function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return { toasts, addToast };
}

function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50" role="status" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
            t.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <p className="text-sm text-slate-700 dark:text-slate-200 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generate Modal ─────────────────────────────────────────────────────────────

interface GenerateModalProps {
  pattern: RecurringShift;
  onClose: () => void;
  onSuccess: (created: number, skipped: number) => void;
}

function GenerateModal({ pattern, onClose, onSuccess }: GenerateModalProps) {
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(twoMonthsLater());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.generateRecurringShift(pattern.id, fromDate, toDate);
      onSuccess(result.created, result.skipped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Generieren');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Schichten generieren">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Schichten generieren</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {pattern.employee_name} — {pattern.shift_name} ({RECURRENCE_LABELS[pattern.recurrence]}, {WEEKDAYS[pattern.day_of_week]})
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Von</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              aria-label="Startdatum"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Bis</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              aria-label="Enddatum"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Abbrechen
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !fromDate || !toDate}
            className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Generiere…' : 'Generieren'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Modal ───────────────────────────────────────────────────────────────

interface CreateModalProps {
  employees: Employee[];
  shifts: ShiftType[];
  onClose: () => void;
  onCreated: (pattern: RecurringShift) => void;
}

function CreateModal({ employees, shifts, onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState<RecurringShiftCreate>({
    employee_id: 0,
    shift_id: 0,
    recurrence: 'weekly',
    day_of_week: 0,
    valid_from: today(),
    valid_until: null,
  });
  const [empSearch, setEmpSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.toLowerCase();
    if (!q) return employees;
    return employees.filter(e =>
      `${e.FIRSTNAME} ${e.NAME} ${e.SHORTNAME}`.toLowerCase().includes(q)
    );
  }, [employees, empSearch]);

  const valid = form.employee_id > 0 && form.shift_id > 0 && form.valid_from;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const created = await api.createRecurringShift({
        ...form,
        valid_until: form.valid_until || null,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Wiederkehrende Schicht erstellen"
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Wiederkehrende Schicht erstellen</h2>

        <div className="space-y-4">
          {/* Employee search */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mitarbeiter *</label>
            <input
              type="text"
              placeholder="Suchen…"
              value={empSearch}
              onChange={e => setEmpSearch(e.target.value)}
              aria-label="Mitarbeiter suchen"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 mb-1"
            />
            <select
              value={form.employee_id || ''}
              onChange={e => setForm(f => ({ ...f, employee_id: Number(e.target.value) }))}
              aria-label="Mitarbeiter wählen"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              size={4}
            >
              <option value="">— Mitarbeiter wählen —</option>
              {filteredEmployees.map(e => (
                <option key={e.ID} value={e.ID}>
                  {e.FIRSTNAME} {e.NAME} ({e.SHORTNAME})
                </option>
              ))}
            </select>
          </div>

          {/* Shift */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Schicht *</label>
            <select
              value={form.shift_id || ''}
              onChange={e => setForm(f => ({ ...f, shift_id: Number(e.target.value) }))}
              aria-label="Schicht wählen"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="">— Schicht wählen —</option>
              {shifts.map(s => (
                <option key={s.ID} value={s.ID}>
                  {s.NAME} ({s.SHORTNAME})
                </option>
              ))}
            </select>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Wiederholung *</label>
            <select
              value={form.recurrence}
              onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as RecurringShiftRecurrence }))}
              aria-label="Wiederholung wählen"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="weekly">Wöchentlich</option>
              <option value="biweekly">Zweiwöchentlich</option>
            </select>
          </div>

          {/* Day of week */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Wochentag *</label>
            <div className="flex gap-1 flex-wrap">
              {WEEKDAYS_SHORT.map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, day_of_week: i }))}
                  aria-label={WEEKDAYS[i]}
                  aria-pressed={form.day_of_week === i}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    form.day_of_week === i
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* valid_from */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Gültig ab *</label>
            <input
              type="date"
              value={form.valid_from}
              onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
              aria-label="Gültig ab"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* valid_until */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Gültig bis (optional)</label>
            <input
              type="date"
              value={form.valid_until ?? ''}
              onChange={e => setForm(f => ({ ...f, valid_until: e.target.value || null }))}
              aria-label="Gültig bis"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || loading}
            className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Erstelle…' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RecurringShifts() {
  const [patterns, setPatterns] = useState<RecurringShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterGroupId, setFilterGroupId] = useState<number | null>(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState<number | null>(null);

  // UI state
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecurringShift | null>(null);
  const [generateTarget, setGenerateTarget] = useState<RecurringShift | null>(null);

  const { toasts, addToast } = useToasts();

  // ── Load data ────────────────────────────────────────────────

  const loadPatterns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { employee_id?: number; group_id?: number } = {};
      if (filterEmployeeId != null) params.employee_id = filterEmployeeId;
      if (filterGroupId != null) params.group_id = filterGroupId;
      const data = await api.getRecurringShifts(params);
      setPatterns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [filterEmployeeId, filterGroupId]);

  useEffect(() => {
    Promise.all([
      api.getEmployees(),
      api.getGroups(),
      api.getShifts(),
    ]).then(([emps, grps, shts]) => {
      setEmployees(emps);
      setGroups(grps);
      setShifts(shts);
    }).catch(() => {/* ignore stammdaten errors */});
  }, []);

  useEffect(() => {
    void loadPatterns();
  }, [loadPatterns]);

  // ── Group filter applies client-side too (employee list filtered by group) ──

  const employeesInGroup = useMemo(() => {
    if (filterGroupId == null) return employees;
    // Filter employees displayed in the employee dropdown when a group is selected
    // (we don't have group memberships loaded here, so just show all)
    return employees;
  }, [employees, filterGroupId]);

  // ── Filtered patterns (client-side) ──────────────────────────

  const filteredPatterns = useMemo(() => {
    let p = patterns;
    if (filterGroupId != null) {
      // Group filter is handled server-side via the API query, patterns already match
    }
    if (filterEmployeeId != null) {
      p = p.filter(r => r.employee_id === filterEmployeeId);
    }
    return p;
  }, [patterns, filterGroupId, filterEmployeeId]);

  // ── Handlers ─────────────────────────────────────────────────

  const handleCreated = (pattern: RecurringShift) => {
    setShowCreate(false);
    setPatterns(prev => [pattern, ...prev]);
    addToast('Wiederkehrende Schicht erstellt', 'success');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteRecurringShift(deleteTarget.id);
      setPatterns(prev => prev.filter(p => p.id !== deleteTarget.id));
      addToast('Muster gelöscht', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Fehler beim Löschen', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleGenerated = (created: number, skipped: number) => {
    setGenerateTarget(null);
    addToast(`${created} Schichten erstellt, ${skipped} übersprungen`, 'success');
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Wiederkehrende Schichten</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Regelmäßige Schichtmuster verwalten und automatisch generieren
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          aria-label="Neues Muster erstellen"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
        >
          + Neues Muster
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="filter-group">Gruppe</label>
          <select
            id="filter-group"
            value={filterGroupId ?? ''}
            onChange={e => {
              setFilterGroupId(e.target.value ? Number(e.target.value) : null);
              setFilterEmployeeId(null);
            }}
            aria-label="Nach Gruppe filtern"
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => (
              <option key={g.ID} value={g.ID}>{g.NAME}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="filter-employee">Mitarbeiter</label>
          <select
            id="filter-employee"
            value={filterEmployeeId ?? ''}
            onChange={e => setFilterEmployeeId(e.target.value ? Number(e.target.value) : null)}
            aria-label="Nach Mitarbeiter filtern"
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Alle Mitarbeiter</option>
            {employeesInGroup.map(e => (
              <option key={e.ID} value={e.ID}>{e.FIRSTNAME} {e.NAME}</option>
            ))}
          </select>
        </div>
        {(filterGroupId != null || filterEmployeeId != null) && (
          <div className="flex items-end">
            <button
              onClick={() => { setFilterGroupId(null); setFilterEmployeeId(null); }}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-slate-500" aria-label="Lade Daten">
          <div className="text-3xl mb-2">⏳</div>
          <p className="text-sm">Lade Muster…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          Fehler: {error}
        </div>
      ) : filteredPatterns.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <div className="text-4xl mb-3">🔁</div>
          <p className="font-medium">Keine wiederkehrenden Schichten</p>
          <p className="text-sm mt-1">Erstellen Sie das erste Muster mit „+ Neues Muster"</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Mitarbeiter</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Schicht</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Wiederholung</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Wochentag</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Gültig ab</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Gültig bis</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPatterns.map(pattern => (
                <tr key={pattern.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    {pattern.employee_name}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-mono">
                        {pattern.shift_short}
                      </span>
                      {pattern.shift_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      pattern.recurrence === 'weekly'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {RECURRENCE_LABELS[pattern.recurrence]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {WEEKDAYS[pattern.day_of_week]}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 tabular-nums">
                    {formatDate(pattern.valid_from)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 tabular-nums">
                    {formatDate(pattern.valid_until)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setGenerateTarget(pattern)}
                        aria-label={`Schichten generieren für ${pattern.employee_name}`}
                        title="Schichten generieren"
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                      >
                        ⚡ Generieren
                      </button>
                      <button
                        onClick={() => setDeleteTarget(pattern)}
                        aria-label={`Muster löschen für ${pattern.employee_name}`}
                        title="Muster löschen"
                        className="px-2 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-slate-400 dark:text-slate-600 border-t border-slate-100 dark:border-slate-800">
            {filteredPatterns.length} Muster
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateModal
          employees={employees}
          shifts={shifts}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          message={`Wiederkehrendes Muster für „${deleteTarget.employee_name}" (${deleteTarget.shift_name}, ${RECURRENCE_LABELS[deleteTarget.recurrence]}, ${WEEKDAYS[deleteTarget.day_of_week]}) wirklich löschen?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {generateTarget && (
        <GenerateModal
          pattern={generateTarget}
          onClose={() => setGenerateTarget(null)}
          onSuccess={handleGenerated}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
