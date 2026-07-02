/**
 * WorkTimeRules.tsx — Arbeitszeit-Regelwerk UI (Q081)
 *
 * Allows Admins to configure work time rules and both Admins/Planer
 * to run violation checks per employee or group.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { groupTreeOptions } from '../utils/groupTree';
import type {
  WorkTimeRulesConfig,
  WorkTimeViolation,
  WorkTimeCheckResult,
  WorkTimeCheckAllResult,
} from '../api/client';

// ─── Helpers ───────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function severityBadge(severity: 'warning' | 'error') {
  if (severity === 'error') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 border border-red-300">
        ⛔ Fehler
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">
      ⚠️ Warnung
    </span>
  );
}

const VIOLATION_LABELS: Record<string, string> = {
  max_hours_per_day:             'Tägliche Höchstarbeitszeit überschritten',
  max_hours_per_week:            'Wöchentliche Höchstarbeitszeit überschritten',
  min_rest_hours_between_shifts: 'Mindestruhezeit zwischen Schichten unterschritten',
  max_consecutive_days:          'Maximale Anzahl aufeinanderfolgender Arbeitstage überschritten',
};

function violationLabel(type: string): string {
  return VIOLATION_LABELS[type] ?? type;
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface ViolationListProps {
  violations: WorkTimeViolation[];
  label?: string;
}

function ViolationList({ violations, label }: ViolationListProps) {
  if (violations.length === 0) {
    return (
      <div className="mt-3 p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
        ✅ Keine Verstöße gefunden{label ? ` für ${label}` : ''}.
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      {violations.map((v, i) => (
        <div
          key={i}
          className={`p-3 rounded border text-sm ${
            v.severity === 'error'
              ? 'bg-red-50 border-red-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {severityBadge(v.severity)}
            <span className="font-medium">{violationLabel(v.rule_type)}</span>
            <span className="ml-auto text-gray-400 text-xs">{v.date}</span>
          </div>
          <div className="text-gray-600">{v.message}</div>
          {v.value !== undefined && v.limit !== undefined && (
            <div className="text-xs text-gray-500 mt-1">
              Wert: <strong>{v.value}</strong> — Limit: <strong>{v.limit}</strong>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

interface Employee { ID: number; NAME: string; FIRSTNAME: string; SHORTNAME: string }
interface Group    { ID: number; NAME: string }

interface WorkTimeRulesProps {
  /** Injected from context for testing; defaults to AuthContext role */
  role?: 'Admin' | 'Planer' | 'Leser';
}

export default function WorkTimeRules({ role: roleProp }: WorkTimeRulesProps = {}) {
  // Auth
  const [userRole, setUserRole] = useState<'Admin' | 'Planer' | 'Leser'>(roleProp ?? 'Planer');

  useEffect(() => {
    if (roleProp) { setUserRole(roleProp); return; }
    try {
      const raw = localStorage.getItem('sp5_session');
      if (raw) {
        const session = JSON.parse(raw) as { user?: { role?: string } };
        const r = session?.user?.role;
        if (r === 'Admin' || r === 'Planer' || r === 'Leser') setUserRole(r);
      }
    } catch { /* ignore */ }
  }, [roleProp]);

  const isAdmin = userRole === 'Admin';

  // ── Rules Config ────────────────────────────────────────────────────────
  const [config, setConfig] = useState<WorkTimeRulesConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Local form state
  const [maxHoursDay, setMaxHoursDay]           = useState<number>(10);
  const [maxHoursWeek, setMaxHoursWeek]         = useState<number>(48);
  const [minRestHours, setMinRestHours]         = useState<number>(11);
  const [maxConsecDays, setMaxConsecDays]       = useState<number>(6);
  const [rulesEnabled, setRulesEnabled]         = useState<boolean>(true);

  useEffect(() => {
    setConfigLoading(true);
    api.getWorkTimeRules()
      .then(cfg => {
        setConfig(cfg);
        setMaxHoursDay(cfg.max_hours_per_day);
        setMaxHoursWeek(cfg.max_hours_per_week);
        setMinRestHours(cfg.min_rest_hours_between_shifts);
        setMaxConsecDays(cfg.max_consecutive_days);
        setRulesEnabled(cfg.enabled);
      })
      .catch(e => setConfigError(String(e)))
      .finally(() => setConfigLoading(false));
  }, []);

  const saveConfig = useCallback(async () => {
    setConfigSaving(true);
    setConfigError(null);
    try {
      const updated = await api.updateWorkTimeRules({
        max_hours_per_day: maxHoursDay,
        max_hours_per_week: maxHoursWeek,
        min_rest_hours_between_shifts: minRestHours,
        max_consecutive_days: maxConsecDays,
        enabled: rulesEnabled,
      });
      setConfig(updated);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2500);
    } catch (e) {
      setConfigError(String(e));
    } finally {
      setConfigSaving(false);
    }
  }, [maxHoursDay, maxHoursWeek, minRestHours, maxConsecDays, rulesEnabled]);

  // ── Employee Check ───────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups]       = useState<Group[]>([]);

  useEffect(() => {
    api.getEmployees().then(setEmployees).catch(() => {});
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  const [checkEmpId, setCheckEmpId]       = useState<number | ''>('');
  const [checkFrom, setCheckFrom]         = useState<string>(monthAgo());
  const [checkTo, setCheckTo]             = useState<string>(today());
  const [checkLoading, setCheckLoading]   = useState(false);
  const [checkError, setCheckError]       = useState<string | null>(null);
  const [checkResult, setCheckResult]     = useState<WorkTimeCheckResult | null>(null);

  const runCheck = useCallback(async () => {
    if (!checkEmpId) return;
    setCheckLoading(true);
    setCheckError(null);
    setCheckResult(null);
    try {
      const result = await api.checkWorkTimeRules({
        employee_id: Number(checkEmpId),
        date_from: checkFrom,
        date_to: checkTo,
      });
      setCheckResult(result);
    } catch (e) {
      setCheckError(String(e));
    } finally {
      setCheckLoading(false);
    }
  }, [checkEmpId, checkFrom, checkTo]);

  // ── Group Check ─────────────────────────────────────────────────────────
  const [checkAllGroupId, setCheckAllGroupId]   = useState<number | ''>('');
  const [checkAllFrom, setCheckAllFrom]         = useState<string>(monthAgo());
  const [checkAllTo, setCheckAllTo]             = useState<string>(today());
  const [checkAllLoading, setCheckAllLoading]   = useState(false);
  const [checkAllError, setCheckAllError]       = useState<string | null>(null);
  const [checkAllResult, setCheckAllResult]     = useState<WorkTimeCheckAllResult | null>(null);

  const runCheckAll = useCallback(async () => {
    setCheckAllLoading(true);
    setCheckAllError(null);
    setCheckAllResult(null);
    try {
      const result = await api.checkAllWorkTimeRules({
        group_id: checkAllGroupId !== '' ? Number(checkAllGroupId) : undefined,
        date_from: checkAllFrom,
        date_to: checkAllTo,
      });
      setCheckAllResult(result);
    } catch (e) {
      setCheckAllError(String(e));
    } finally {
      setCheckAllLoading(false);
    }
  }, [checkAllGroupId, checkAllFrom, checkAllTo]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">⚖️ Arbeitszeit-Regelwerk</h1>
        <p className="text-gray-500 text-sm mt-1">
          Konfiguriere Arbeitszeitregeln und prüfe Verstöße für Mitarbeiter oder Gruppen.
        </p>
      </div>

      {/* ── Rules Config (Admin only) ─────────────────────────────────────── */}
      {isAdmin && (
        <section
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
          aria-label="Regelkonfiguration"
        >
          <h2 className="text-lg font-semibold text-gray-700 mb-4">🔧 Regelkonfiguration</h2>

          {configLoading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="animate-spin">⏳</span> Lade Konfiguration…
            </div>
          )}

          {!configLoading && (
            <>
              {configError && (
                <div className="mb-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                  {configError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* Enabled toggle */}
                <div className="sm:col-span-2 flex items-center gap-3">
                  <input
                    id="rules-enabled"
                    type="checkbox"
                    checked={rulesEnabled}
                    onChange={e => setRulesEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                    aria-label="Regelwerk aktiviert"
                  />
                  <label htmlFor="rules-enabled" className="text-sm font-medium text-gray-700">
                    Regelwerk aktiviert
                  </label>
                </div>

                {/* max_hours_per_day */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="max-hours-day">
                    Max. Stunden pro Tag
                  </label>
                  <input
                    id="max-hours-day"
                    type="number"
                    min={1}
                    max={24}
                    value={maxHoursDay}
                    onChange={e => setMaxHoursDay(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label="Max. Stunden pro Tag"
                  />
                </div>

                {/* max_hours_per_week */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="max-hours-week">
                    Max. Stunden pro Woche
                  </label>
                  <input
                    id="max-hours-week"
                    type="number"
                    min={1}
                    max={168}
                    value={maxHoursWeek}
                    onChange={e => setMaxHoursWeek(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label="Max. Stunden pro Woche"
                  />
                </div>

                {/* min_rest_hours_between_shifts */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="min-rest-hours">
                    Mindestruhezeit zwischen Schichten (h)
                  </label>
                  <input
                    id="min-rest-hours"
                    type="number"
                    min={0}
                    max={24}
                    value={minRestHours}
                    onChange={e => setMinRestHours(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label="Mindestruhezeit zwischen Schichten"
                  />
                </div>

                {/* max_consecutive_days */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="max-consec-days">
                    Max. aufeinanderfolgende Arbeitstage
                  </label>
                  <input
                    id="max-consec-days"
                    type="number"
                    min={1}
                    max={31}
                    value={maxConsecDays}
                    onChange={e => setMaxConsecDays(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label="Max. aufeinanderfolgende Arbeitstage"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={saveConfig}
                  disabled={configSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium"
                  aria-label="Speichern"
                >
                  {configSaving ? '⏳ Speichern…' : '💾 Speichern'}
                </button>
                {configSaved && (
                  <span className="text-green-600 text-sm">✅ Gespeichert!</span>
                )}
              </div>

              {config && (
                <div className="mt-3 text-xs text-gray-400">
                  Zuletzt geändert: {config.updated_at ?? '–'}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Per-Employee Violation Check ──────────────────────────────────── */}
      <section
        className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
        aria-label="Einzelprüfung"
      >
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🔍 Mitarbeiter prüfen</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="check-employee">
              Mitarbeiter
            </label>
            <select
              id="check-employee"
              value={checkEmpId}
              onChange={e => setCheckEmpId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Mitarbeiter auswählen"
            >
              <option value="">— Mitarbeiter wählen —</option>
              {employees.map(emp => (
                <option key={emp.ID} value={emp.ID}>
                  {emp.NAME} {emp.FIRSTNAME} ({emp.SHORTNAME})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="check-from">
              Von
            </label>
            <input
              id="check-from"
              type="date"
              value={checkFrom}
              onChange={e => setCheckFrom(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Startdatum"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="check-to">
              Bis
            </label>
            <input
              id="check-to"
              type="date"
              value={checkTo}
              onChange={e => setCheckTo(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Enddatum"
            />
          </div>
        </div>

        <button
          onClick={runCheck}
          disabled={checkLoading || !checkEmpId}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium"
          aria-label="Mitarbeiter prüfen"
        >
          {checkLoading ? '⏳ Prüfe…' : '🔍 Prüfen'}
        </button>

        {checkError && (
          <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
            {checkError}
          </div>
        )}

        {checkResult && (
          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-1">
              Mitarbeiter: <strong>{checkResult.employee_name}</strong> — Zeitraum:{' '}
              {checkResult.date_from} bis {checkResult.date_to} —{' '}
              <span className={checkResult.violation_count > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                {checkResult.violation_count} Verstoß{checkResult.violation_count !== 1 ? 'e' : ''}
              </span>
            </div>
            <ViolationList
              violations={checkResult.violations}
              label={checkResult.employee_name}
            />
          </div>
        )}
      </section>

      {/* ── Group Violation Check ─────────────────────────────────────────── */}
      <section
        className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
        aria-label="Gruppenprüfung"
      >
        <h2 className="text-lg font-semibold text-gray-700 mb-4">👥 Gruppe prüfen</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="check-all-group">
              Gruppe (optional)
            </label>
            <select
              id="check-all-group"
              value={checkAllGroupId}
              onChange={e => setCheckAllGroupId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Gruppe auswählen"
            >
              <option value="">— Alle Gruppen —</option>
              {groupTreeOptions(groups).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="check-all-from">
              Von
            </label>
            <input
              id="check-all-from"
              type="date"
              value={checkAllFrom}
              onChange={e => setCheckAllFrom(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Startdatum Gruppe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="check-all-to">
              Bis
            </label>
            <input
              id="check-all-to"
              type="date"
              value={checkAllTo}
              onChange={e => setCheckAllTo(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Enddatum Gruppe"
            />
          </div>
        </div>

        <button
          onClick={runCheckAll}
          disabled={checkAllLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium"
          aria-label="Alle prüfen"
        >
          {checkAllLoading ? '⏳ Prüfe…' : '👥 Alle prüfen'}
        </button>

        {checkAllError && (
          <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
            {checkAllError}
          </div>
        )}

        {checkAllResult && (
          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-2">
              Geprüfte Mitarbeiter: <strong>{checkAllResult.employee_count}</strong> —{' '}
              Verstöße gesamt:{' '}
              <span className={checkAllResult.total_violations > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                {checkAllResult.total_violations}
              </span>
            </div>

            {checkAllResult.results.length === 0 ? (
              <div className="p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
                ✅ Keine Verstöße in der gesamten Gruppe gefunden.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600">Mitarbeiter</th>
                      <th scope="col" className="text-center px-3 py-2 font-medium text-gray-600">Verstöße</th>
                      <th scope="col" className="text-center px-3 py-2 font-medium text-gray-600">Fehler</th>
                      <th scope="col" className="text-center px-3 py-2 font-medium text-gray-600">Warnungen</th>
                      <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkAllResult.results.map((row, i) => {
                      const errors   = row.violations.filter(v => v.severity === 'error').length;
                      const warnings = row.violations.filter(v => v.severity === 'warning').length;
                      return (
                        <tr
                          key={i}
                          className={`border-b border-gray-100 ${
                            errors > 0
                              ? 'bg-red-50'
                              : warnings > 0
                              ? 'bg-yellow-50'
                              : ''
                          }`}
                        >
                          <td className="px-3 py-2 font-medium">{row.employee_name}</td>
                          <td className="px-3 py-2 text-center">{row.violation_count}</td>
                          <td className="px-3 py-2 text-center">
                            {errors > 0 ? (
                              <span className="text-red-600 font-semibold">{errors}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {warnings > 0 ? (
                              <span className="text-yellow-600 font-semibold">{warnings}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {errors > 0
                              ? <span className="text-red-600">⛔ Fehler</span>
                              : warnings > 0
                              ? <span className="text-yellow-600">⚠️ Warnung</span>
                              : <span className="text-green-600">✅ OK</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
