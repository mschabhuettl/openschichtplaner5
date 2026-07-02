/**
 * ExportScheduler — Q075
 * Manage scheduled exports: list, create/edit, delete, enable/disable, manual trigger.
 * Admin only.
 */

import { useState, useEffect, useCallback } from 'react';
import { api, type ExportSchedule } from '../api/client';
import type { Group } from '../types/index';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PageHeader } from '../components/PageHeader';
import { groupTreeOptions } from '../utils/groupTree';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleForm {
  name: string;
  frequency: 'weekly';
  day_of_week: number;
  time: string;
  format: 'xlsx' | 'csv';
  group_id: number | null;
  email_to: string[];
  enabled: boolean;
}

const EMPTY_FORM: ScheduleForm = {
  name: '',
  frequency: 'weekly',
  day_of_week: 1,
  time: '08:00',
  format: 'xlsx',
  group_id: null,
  email_to: [],
  enabled: true,
};

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// ─── Email Tag Input ───────────────────────────────────────────────────────────

interface EmailTagInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
}

function EmailTagInput({ value, onChange, disabled }: EmailTagInputProps) {
  const [input, setInput] = useState('');

  const addEmail = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    // Basic email validation
    if (!trimmed.includes('@')) return;
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  }, [input, value, onChange]);

  const removeEmail = (email: string) => {
    onChange(value.filter(e => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail();
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[40px] p-1.5 border border-gray-300 dark:border-gray-600
                 rounded-lg bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500"
    >
      {value.map(email => (
        <span
          key={email}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900
                     text-blue-800 dark:text-blue-200 rounded text-sm"
        >
          {email}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeEmail(email)}
              aria-label={`E-Mail ${email} entfernen`}
              className="hover:text-blue-600 dark:hover:text-blue-300 font-bold leading-none"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="email"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addEmail}
          placeholder={value.length === 0 ? 'E-Mail eingeben, Enter drücken …' : ''}
          className="flex-1 min-w-[200px] outline-none bg-transparent text-sm
                     text-gray-900 dark:text-gray-100 placeholder-gray-400"
          aria-label="E-Mail-Adresse eingeben"
        />
      )}
    </div>
  );
}

// ─── Schedule Form Modal ──────────────────────────────────────────────────────

interface ScheduleModalProps {
  schedule: ExportSchedule | null; // null = create
  groups: Group[];
  onSave: (form: ScheduleForm) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function ScheduleModal({ schedule, groups, onSave, onClose, saving }: ScheduleModalProps) {
  const [form, setForm] = useState<ScheduleForm>(() =>
    schedule
      ? {
          name: schedule.name,
          frequency: schedule.frequency,
          day_of_week: schedule.day_of_week,
          time: schedule.time,
          format: schedule.format,
          group_id: schedule.group_id ?? null,
          email_to: schedule.email_to ?? [],
          enabled: schedule.enabled,
        }
      : { ...EMPTY_FORM }
  );

  const isEdit = schedule !== null;

  const set = <K extends keyof ScheduleForm>(key: K, val: ScheduleForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Export-Zeitplan bearbeiten' : 'Export-Zeitplan erstellen'}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? '✏️ Zeitplan bearbeiten' : '➕ Neuer Export-Zeitplan'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="sched-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="sched-name"
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              placeholder="z.B. Wöchentlicher Dienstplanexport"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Frequency + Day + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="sched-frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Häufigkeit
              </label>
              <select
                id="sched-frequency"
                value={form.frequency}
                onChange={e => set('frequency', e.target.value as 'weekly')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="weekly">Wöchentlich</option>
              </select>
            </div>
            <div>
              <label htmlFor="sched-day" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Wochentag
              </label>
              <select
                id="sched-day"
                value={form.day_of_week}
                onChange={e => set('day_of_week', Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DAY_NAMES.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sched-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Uhrzeit
              </label>
              <input
                id="sched-time"
                type="time"
                value={form.time}
                onChange={e => set('time', e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Format + Group */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sched-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Format
              </label>
              <select
                id="sched-format"
                value={form.format}
                onChange={e => set('format', e.target.value as 'xlsx' | 'csv')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
              </select>
            </div>
            <div>
              <label htmlFor="sched-group" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gruppe (optional)
              </label>
              <select
                id="sched-group"
                value={form.group_id ?? ''}
                onChange={e => set('group_id', e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Alle Gruppen</option>
                {groupTreeOptions(groups).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Email recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Empfänger (E-Mail)
            </label>
            <EmailTagInput
              value={form.email_to}
              onChange={emails => set('email_to', emails)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              E-Mail eingeben und Enter drücken, um mehrere Empfänger hinzuzufügen.
            </p>
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-2">
            <input
              id="sched-enabled"
              type="checkbox"
              checked={form.enabled}
              onChange={e => set('enabled', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="sched-enabled" className="text-sm text-gray-700 dark:text-gray-300">
              Zeitplan aktiviert
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                         text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                         transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                         font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExportScheduler() {
  const { showToast } = useToast();
  const { user, isDevMode } = useAuth();
  const { confirm, dialogProps } = useConfirm();

  const [schedules, setSchedules] = useState<ExportSchedule[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExportSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<number | null>(null); // schedule ID being run

  // Access guard
  const isAdmin = user?.ADMIN === true || user?.role === 'Admin' || isDevMode;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scheds, grps] = await Promise.all([
        api.getExportSchedules(),
        api.getGroups(),
      ]);
      setSchedules(scheds);
      setGroups(grps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Open create
  const openCreate = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  // Open edit
  const openEdit = (schedule: ExportSchedule) => {
    setEditTarget(schedule);
    setModalOpen(true);
  };

  // Save (create or update)
  const handleSave = async (form: ScheduleForm) => {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await api.updateExportSchedule(editTarget.id, form);
        setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast('Zeitplan aktualisiert.', 'success');
      } else {
        const created = await api.createExportSchedule(form);
        setSchedules(prev => [...prev, created]);
        showToast('Zeitplan erstellt.', 'success');
      }
      setModalOpen(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (schedule: ExportSchedule) => {
    const ok = await confirm({
      title: 'Zeitplan löschen',
      message: `Zeitplan „${schedule.name}" wirklich löschen?`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteExportSchedule(schedule.id);
      setSchedules(prev => prev.filter(s => s.id !== schedule.id));
      showToast('Zeitplan gelöscht.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.', 'error');
    }
  };

  // Toggle enabled
  const handleToggle = async (schedule: ExportSchedule) => {
    const newEnabled = !schedule.enabled;
    try {
      const updated = await api.updateExportSchedule(schedule.id, { ...schedule, enabled: newEnabled });
      setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
      showToast(newEnabled ? 'Zeitplan aktiviert.' : 'Zeitplan deaktiviert.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Aktualisieren.', 'error');
    }
  };

  // Run now
  const handleRunNow = async (schedule: ExportSchedule) => {
    setRunning(schedule.id);
    try {
      const result = await api.runExportSchedule(schedule.id);
      if (result.smtp_not_configured) {
        showToast('⚠️ SMTP nicht konfiguriert — E-Mail konnte nicht gesendet werden.', 'warning');
      } else {
        showToast(`✅ Export gesendet an ${result.sent_to} Empfänger.`, 'success');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export fehlgeschlagen.', 'error');
    } finally {
      setRunning(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center px-6">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold text-slate-700 dark:text-slate-200">Kein Zugriff</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nur Admins können Export-Zeitpläne verwalten.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="📤 Export-Zeitpläne"
        subtitle="Geplante Exporte verwalten — Dienstplan automatisch per E-Mail versenden"
        actions={
          <button
            onClick={openCreate}
            aria-label="Neuen Export-Zeitplan erstellen"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium rounded-lg transition-colors"
          >
            ➕ Neuer Zeitplan
          </button>
        }
      />

      {/* Error state */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                        rounded-lg text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          ⚠️ {error}
          <button onClick={load} className="ml-auto text-red-600 underline hover:no-underline text-xs">
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        // LoadingSpinner itself provides role="status" + an accessible label,
        // so this wrapper stays a plain layout container (no nested live region).
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : schedules.length === 0 && !error ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="text-6xl">📤</div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Keine Export-Zeitpläne vorhanden
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Erstellen Sie einen Zeitplan, um den Dienstplan automatisch per E-Mail zu versenden.
          </p>
          <button
            onClick={openCreate}
            className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm
                       font-medium rounded-lg transition-colors"
          >
            Ersten Zeitplan erstellen
          </button>
        </div>
      ) : (
        /* Table */
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-semibold
                               text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Häufigkeit</th>
                  <th scope="col" className="px-4 py-3">Zeit</th>
                  <th scope="col" className="px-4 py-3">Format</th>
                  <th scope="col" className="px-4 py-3">Empfänger</th>
                  <th scope="col" className="px-4 py-3 text-center">Aktiv</th>
                  <th scope="col" className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {schedules.map(s => (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {s.name}
                      {s.group_id && groups.find(g => g.ID === s.group_id) && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({groups.find(g => g.ID === s.group_id)?.NAME})
                        </span>
                      )}
                    </td>
                    {/* Frequency */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <span className="inline-flex items-center gap-1">
                        🔄 Wöchentlich
                      </span>
                    </td>
                    {/* Day + Time */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {DAY_NAMES[s.day_of_week]}, {s.time} Uhr
                    </td>
                    {/* Format */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                        ${s.format === 'xlsx'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        }`}>
                        {s.format.toUpperCase()}
                      </span>
                    </td>
                    {/* Recipients */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {s.email_to.length === 0 ? (
                        <span className="text-gray-400 dark:text-gray-500 text-xs italic">Keine</span>
                      ) : (
                        <span
                          title={s.email_to.join(', ')}
                          className="cursor-default"
                        >
                          📧 {s.email_to.length} Empfänger
                        </span>
                      )}
                    </td>
                    {/* Enabled toggle */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(s)}
                        aria-label={s.enabled ? 'Zeitplan deaktivieren' : 'Zeitplan aktivieren'}
                        title={s.enabled ? 'Aktiv — klicken zum Deaktivieren' : 'Inaktiv — klicken zum Aktivieren'}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full
                          border-2 border-transparent transition-colors duration-200 focus:outline-none
                          focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                          ${s.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white
                            shadow transform transition-transform duration-200
                            ${s.enabled ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </button>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Run now */}
                        <button
                          onClick={() => handleRunNow(s)}
                          disabled={running === s.id}
                          title="Jetzt ausführen"
                          aria-label="Jetzt ausführen"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50
                                     dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50"
                        >
                          {running === s.id
                            ? <span className="inline-block w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            : '▶'}
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(s)}
                          title="Bearbeiten"
                          aria-label={`Zeitplan ${s.name} bearbeiten`}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50
                                     dark:hover:bg-blue-900/30 transition-colors"
                        >
                          ✏️
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(s)}
                          title="Löschen"
                          aria-label={`Zeitplan ${s.name} löschen`}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50
                                     dark:hover:bg-red-900/30 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500">
            {schedules.length} Zeitplan{schedules.length !== 1 ? 'e' : ''}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ScheduleModal
          schedule={editTarget}
          groups={groups}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          saving={saving}
        />
      )}

      {/* Confirm dialog */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
