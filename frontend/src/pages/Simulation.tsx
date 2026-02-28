/**
 * Schichtplan-Simulation — "Was wäre wenn?"
 * Simuliert den Ausfall eines oder mehrerer Mitarbeiter und zeigt die Auswirkungen
 * auf die Tagesbesetzung im gewählten Monat.
 */
import { useState, useEffect, useCallback } from 'react';
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

interface Employee {
  ID: number;
  NAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
  CBKLABEL_HEX: string;
  CBKLABEL_LIGHT: boolean;
}

interface DayStat {
  date: string;
  day: number;
  weekday: number; // 0=Mon ... 6=Sun
  baseline_count: number;
  simulated_count: number;
  lost_shifts: number;
  status: 'ok' | 'degraded' | 'critical';
  missing: { emp_id: number; name: string; shortname: string; shift_name: string }[];
  cover_candidates: { emp_id: number; name: string; shortname: string }[];
}

interface SimSummary {
  total_lost_shifts: number;
  critical_days: number;
  degraded_days: number;
  ok_days: number;
  affected_employees: number;
}

interface EmpImpact {
  emp_id: number;
  name: string;
  shortname: string;
  total_shifts_in_month: number;
  absent_shifts: number;
  absent_days: string[];
}

interface SimResult {
  scenario_name: string;
  year: number;
  month: number;
  days: DayStat[];
  summary: SimSummary;
  employee_impacts: EmpImpact[];
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function statusColor(status: string) {
  if (status === 'critical') return 'bg-red-100 border-red-400 text-red-800';
  if (status === 'degraded') return 'bg-yellow-50 border-yellow-400 text-yellow-800';
  return 'bg-green-50 border-green-300 text-green-800';
}

function statusBadge(status: string) {
  if (status === 'critical') return 'bg-red-500 text-white';
  if (status === 'degraded') return 'bg-yellow-400 text-yellow-900';
  return 'bg-green-400 text-white';
}

export default function Simulation() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmps, setSelectedEmps] = useState<number[]>([]);
  const [absenceMode, setAbsenceMode] = useState<'all' | 'custom'>('all');
  const [customDates, setCustomDates] = useState<Record<number, string[]>>({}); // emp_id -> dates
  const [scenarioName, setScenarioName] = useState('Simulation');
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<DayStat | null>(null);
  const [empSearch, setEmpSearch] = useState('');

  useEffect(() => {
    fetch(BASE + '/api/employees', { headers: getAuthHeaders() }).then(r => r.json()).then((data: Employee[]) => setEmployees(data)).catch(() => {});
  }, []);

  const daysInMonth = new Date(year, month, 0).getDate();
  const allDates = Array.from({ length: daysInMonth }, (_, i) =>
    `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  );

  const toggleEmp = (id: number) => {
    setSelectedEmps(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleDate = (empId: number, date: string) => {
    setCustomDates(prev => {
      const current = prev[empId] || [];
      const updated = current.includes(date)
        ? current.filter(d => d !== date)
        : [...current, date];
      return { ...prev, [empId]: updated };
    });
  };

  const runSimulation = useCallback(async () => {
    if (selectedEmps.length === 0) {
      setError('Bitte mindestens einen Mitarbeiter auswählen.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveDay(null);

    const absences = selectedEmps.map(emp_id => ({
      emp_id,
      dates: absenceMode === 'all' ? ['all'] : (customDates[emp_id] || []),
    }));

    try {
      const data = await fetch(BASE + '/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ year, month, absences, scenario_name: scenarioName }),
      });
      const json = await data.json();
      setResult(json as SimResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler bei der Simulation');
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedEmps, absenceMode, customDates, scenarioName]);

  const filteredEmps = employees.filter(e =>
    `${e.FIRSTNAME} ${e.NAME} ${e.SHORTNAME}`.toLowerCase().includes(empSearch.toLowerCase())
  );

  const daysWithIssues = result?.days.filter(d => d.status !== 'ok') || [];

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">🧪</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Schichtplan-Simulation</h1>
          <p className="text-sm text-gray-500">„Was wäre wenn?" — Ausfall-Szenarien testen</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Config Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Scenario Name */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>📝</span> Szenario
            </h2>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={scenarioName}
              onChange={e => setScenarioName(e.target.value)}
              placeholder="z.B. Sommer-Urlaubswelle"
            />
          </div>

          {/* Month/Year */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>📅</span> Zeitraum
            </h2>
            <div className="flex gap-2">
              <select
                className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm"
                value={month}
                onChange={e => { setMonth(+e.target.value); setResult(null); }}
              >
                {MONTH_NAMES.slice(1).map((n, i) => (
                  <option key={i + 1} value={i + 1}>{n}</option>
                ))}
              </select>
              <input
                type="number"
                className="w-24 border border-gray-300 rounded px-2 py-2 text-sm"
                value={year}
                onChange={e => { setYear(+e.target.value); setResult(null); }}
                min={2020} max={2030}
              />
            </div>
          </div>

          {/* Employee Selection */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>👥</span> Ausfall-Mitarbeiter
              {selectedEmps.length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {selectedEmps.length}
                </span>
              )}
            </h2>
            <input
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Suche..."
              value={empSearch}
              onChange={e => setEmpSearch(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto space-y-1">
              {filteredEmps.map(emp => {
                const sel = selectedEmps.includes(emp.ID);
                return (
                  <label key={emp.ID} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${sel ? 'bg-red-50 border border-red-300' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => toggleEmp(emp.ID)}
                      className="accent-red-500"
                    />
                    <span
                      className="inline-block w-8 text-center text-xs font-bold rounded px-1"
                      style={{ backgroundColor: emp.CBKLABEL_HEX, color: emp.CBKLABEL_LIGHT ? '#333' : '#fff' }}
                    >
                      {emp.SHORTNAME}
                    </span>
                    <span className="flex-1">{emp.FIRSTNAME} {emp.NAME}</span>
                  </label>
                );
              })}
            </div>
            {selectedEmps.length > 0 && (
              <button
                className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                onClick={() => { setSelectedEmps([]); setCustomDates({}); }}
              >
                Alle abwählen
              </button>
            )}
          </div>

          {/* Absence Mode */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>🗓️</span> Ausfall-Zeitraum
            </h2>
            <div className="flex gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={absenceMode === 'all'} onChange={() => setAbsenceMode('all')} className="accent-red-500" />
                Ganzer Monat
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={absenceMode === 'custom'} onChange={() => setAbsenceMode('custom')} className="accent-blue-500" />
                Bestimmte Tage
              </label>
            </div>

            {absenceMode === 'custom' && selectedEmps.length > 0 && (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {selectedEmps.map(empId => {
                  const emp = employees.find(e => e.ID === empId);
                  if (!emp) return null;
                  const empDates = customDates[empId] || [];
                  return (
                    <div key={empId}>
                      <p className="text-xs font-semibold text-gray-600 mb-1">{emp.FIRSTNAME} {emp.NAME}</p>
                      <div className="flex flex-wrap gap-1">
                        {allDates.map(date => {
                          const d = parseInt(date.split('-')[2]);
                          const wd = new Date(date).getDay(); // 0=Sun
                          const isWeekend = wd === 0 || wd === 6;
                          const sel = empDates.includes(date);
                          return (
                            <button
                              key={date}
                              onClick={() => toggleDate(empId, date)}
                              className={`w-7 h-7 text-xs rounded font-medium transition-colors ${
                                sel
                                  ? 'bg-red-500 text-white'
                                  : isWeekend
                                  ? 'bg-gray-100 text-gray-400 hover:bg-red-100'
                                  : 'bg-gray-50 text-gray-600 hover:bg-red-100'
                              }`}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Run Button */}
          <button
            onClick={runSimulation}
            disabled={loading || selectedEmps.length === 0}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Simuliere...
              </>
            ) : (
              <>🧪 Simulation starten</>
            )}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* RIGHT: Results */}
        <div className="lg:col-span-2 space-y-4">
          {!result && !loading && (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <div className="text-5xl mb-4">🧪</div>
              <p className="text-lg font-medium">Szenario konfigurieren</p>
              <p className="text-sm mt-1">Mitarbeiter auswählen → Simulation starten</p>
              <div className="mt-6 grid grid-cols-2 gap-4 max-w-sm mx-auto text-left">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Beispiele</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Urlaubswelle im Sommer</li>
                    <li>• Krankenstand 2 MA gleichzeitig</li>
                    <li>• Kündigung Schlüsselkraft</li>
                  </ul>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Ergebnis</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Kritische Tage sehen</li>
                    <li>• Besetzungslücken prüfen</li>
                    <li>• Einspringer finden</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Summary KPIs */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">📊</span>
                  <h2 className="font-bold text-gray-800">Ergebnis: {result.scenario_name}</h2>
                  <span className="text-sm text-gray-500 ml-1">
                    {MONTH_NAMES[result.month]} {result.year}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{result.summary.critical_days}</div>
                    <div className="text-xs text-red-500 mt-1">Kritische Tage</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{result.summary.degraded_days}</div>
                    <div className="text-xs text-yellow-500 mt-1">Reduzierte Tage</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">{result.summary.total_lost_shifts}</div>
                    <div className="text-xs text-orange-500 mt-1">Verlorene Schichten</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{result.summary.ok_days}</div>
                    <div className="text-xs text-green-500 mt-1">Normale Tage</div>
                  </div>
                </div>
              </div>

              {/* Employee Impact */}
              {result.employee_impacts.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>👤</span> Mitarbeiter-Auswirkung
                  </h2>
                  <div className="space-y-2">
                    {result.employee_impacts.map(imp => (
                      <div key={imp.emp_id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                        <span className="font-bold text-sm text-gray-700 w-24">{imp.name || imp.shortname}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <span>{imp.absent_shifts} von {imp.total_shifts_in_month} Schichten betroffen</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-red-400 h-2 rounded-full"
                              style={{ width: `${imp.total_shifts_in_month > 0 ? (imp.absent_shifts / imp.total_shifts_in_month) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-red-600 w-12 text-right">
                          {imp.total_shifts_in_month > 0 ? Math.round((imp.absent_shifts / imp.total_shifts_in_month) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calendar Grid */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span>📅</span> Tages-Übersicht
                  <span className="ml-auto flex gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded-full inline-block" /> OK</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded-full inline-block" /> Reduziert</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-full inline-block" /> Kritisch</span>
                  </span>
                </h2>

                {/* Weekday header */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAY_LABELS.map(d => (
                    <div key={d} className="text-center text-xs text-gray-400 font-semibold py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar */}
                <CalendarGrid days={result.days} year={year} month={month} onDayClick={setActiveDay} />
              </div>

              {/* Issues List */}
              {daysWithIssues.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>⚠️</span> Problematische Tage ({daysWithIssues.length})
                  </h2>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {daysWithIssues.map(day => (
                      <div
                        key={day.date}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity ${statusColor(day.status)}`}
                        onClick={() => setActiveDay(day)}
                      >
                        <div className="text-center min-w-[3rem]">
                          <div className="text-xs text-gray-500">{WEEKDAY_LABELS[day.weekday]}</div>
                          <div className="text-xl font-bold">{day.day}.</div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge(day.status)}`}>
                              {day.status === 'critical' ? '🚨 Kritisch' : '⚠️ Reduziert'}
                            </span>
                            <span className="text-xs">
                              {day.simulated_count}/{day.baseline_count} Schichten besetzt
                            </span>
                          </div>
                          {day.missing.length > 0 && (
                            <div className="text-xs flex flex-wrap gap-1">
                              <span className="text-gray-500">Fehlt:</span>
                              {day.missing.map((m, i) => (
                                <span key={i} className="bg-white/70 px-1.5 py-0.5 rounded font-medium">
                                  {m.shortname || m.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.summary.critical_days === 0 && result.summary.degraded_days === 0 && (
                <div className="bg-green-50 border border-green-300 rounded-xl p-6 text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-semibold text-green-800">Keine kritischen Auswirkungen</p>
                  <p className="text-sm text-green-600 mt-1">
                    Der Schichtplan bleibt auch bei diesem Szenario stabil.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Day Detail Modal */}
      {activeDay && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-backdropIn"
          onClick={() => setActiveDay(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {WEEKDAY_LABELS[activeDay.weekday]}, {activeDay.day}. {MONTH_NAMES[month]} {year}
                </h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge(activeDay.status)}`}>
                  {activeDay.status === 'critical' ? '🚨 Kritisch' : activeDay.status === 'degraded' ? '⚠️ Reduziert' : '✅ Normal'}
                </span>
              </div>
              <button aria-label="Schließen"
                className="text-gray-400 hover:text-gray-600 text-2xl"
                onClick={() => setActiveDay(null)}
              >×</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700">{activeDay.baseline_count}</div>
                  <div className="text-xs text-gray-500">Schichten geplant</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${activeDay.lost_shifts > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className={`text-2xl font-bold ${activeDay.lost_shifts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {activeDay.simulated_count}
                  </div>
                  <div className="text-xs text-gray-500">Nach Simulation</div>
                </div>
              </div>

              {activeDay.missing.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">🔴 Fehlende Mitarbeiter</p>
                  <div className="space-y-1">
                    {activeDay.missing.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-red-50 rounded px-3 py-1.5">
                        <span className="font-medium text-red-700">{m.shortname}</span>
                        <span className="text-gray-600">{m.name}</span>
                        {m.shift_name && <span className="ml-auto text-xs text-gray-400">{m.shift_name}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeDay.cover_candidates.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">🟢 Anwesende Kollegen</p>
                  <div className="flex flex-wrap gap-2">
                    {activeDay.cover_candidates.map((c, i) => (
                      <span key={i} className="bg-green-50 border border-green-200 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                        {c.shortname || c.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Diese Mitarbeiter sind geplant und könnten einspringen.</p>
                </div>
              )}

              {activeDay.missing.length === 0 && (
                <div className="text-center py-3 text-green-600 text-sm">
                  ✅ Kein Ausfall an diesem Tag
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar Grid Component ──────────────────────────────────────────────────

function CalendarGrid({ days, year, month, onDayClick }: {
  days: DayStat[];
  year: number;
  month: number;
  onDayClick: (d: DayStat) => void;
}) {
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
  // Convert to Mon-based: Sun(0) → 6, Mon(1) → 0, ...
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  // const dayMap = Object.fromEntries(days.map(d => [d.day, d]));

  const cells: (DayStat | null)[] = [
    ...Array(offset).fill(null),
    ...days,
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((day, idx) => {
        if (!day) {
          return <div key={idx} className="h-16 rounded-lg" />;
        }
        const colors = {
          ok: 'bg-green-50 border-green-200 hover:bg-green-100',
          degraded: 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100',
          critical: 'bg-red-50 border-red-400 hover:bg-red-100',
        };
        const dotColors = {
          ok: 'bg-green-400',
          degraded: 'bg-yellow-400',
          critical: 'bg-red-500',
        };
        return (
          <div
            key={day.day}
            className={`h-16 rounded-lg border p-1.5 cursor-pointer transition-colors ${colors[day.status]}`}
            onClick={() => onDayClick(day)}
          >
            <div className="text-xs font-semibold text-gray-600">{day.day}</div>
            <div className="flex items-center gap-1 mt-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColors[day.status]}`} />
              <span className="text-xs text-gray-500 truncate">{day.simulated_count}/{day.baseline_count}</span>
            </div>
            {day.lost_shifts > 0 && (
              <div className="text-xs text-red-500 font-bold mt-0.5">-{day.lost_shifts}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
