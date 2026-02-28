import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ChangelogEntry } from '../api/client';
import type { Employee, ShiftType, ScheduleEntry } from '../types';

const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function calcAge(birthday: string): number {
  const b = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

function calcTenure(empstart: string): string {
  const start = new Date(empstart);
  const today = new Date();
  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years === 0) return `${months} Mon.`;
  if (months === 0) return `${years} J.`;
  return `${years} J. ${months} M.`;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface MiniBar { value: number; max: number; color: string; label: string; sub?: string; }
function MiniBar({ value, max, color, label, sub }: MiniBar) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-6 text-right text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 relative">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-gray-700 shrink-0">{sub ?? value.toFixed(0)}</span>
    </div>
  );
}

interface KPICard { label: string; value: string | number; icon: string; color: string; sub?: string; }
interface MonthStat { month: number; actual_hours: number; target_hours: number; shifts_count: number; difference: number; weekend_shifts: number; night_shifts: number; vacation_days: number; }
function KPICard({ label, value, icon, color, sub }: KPICard) {
  return (
    <div className={`rounded-xl p-3 border ${color} flex flex-col gap-1`}>
      <div className="flex items-center gap-1 text-xs font-medium opacity-70">{icon} {label}</div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
    </div>
  );
}

export default function MitarbeiterProfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [groupName, setGroupName] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [yearStats, setYearStats] = useState<any>(null);
  const [schedule7, setSchedule7] = useState<ScheduleEntry[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [absences, setAbsences] = useState<{ date: string; leave_type_name: string; leave_type_short: string }[]>([]);
  const [tab, setTab] = useState<'overview' | 'stats' | 'schedule' | 'log'>('overview');
  const [loading, setLoading] = useState(true);
  const [year] = useState(new Date().getFullYear());

  const employeeId = id ? parseInt(id) : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, grps, shts] = await Promise.all([
        api.getEmployees(),
        api.getGroups(),
        api.getShifts(),
      ]);
      setEmployees(emps);
      setShifts(shts);

      if (!employeeId) {
        setLoading(false);
        return;
      }

      const emp = emps.find(e => e.ID === employeeId);
      if (!emp) { setLoading(false); return; }
      setEmployee(emp);

      // Group name via group assignments
      const [assignments, stats, absData, clog] = await Promise.all([
        api.getGroupAssignments(),
        api.getEmployeeStatsYear(employeeId, year),
        api.getAbsences({ employee_id: employeeId, year }),
        api.getChangelog({ limit: 100 }),
      ]);
      const ga = assignments.find(a => a.employee_id === employeeId);
      if (ga) {
        const g = grps.find(g => g.ID === ga.group_id);
        setGroupName(g?.NAME ?? '');
      }
      setYearStats(stats);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAbsences(absData as any);
      // Filter changelog for this employee where possible
      const empLog = clog.filter(e =>
        (e.entity === 'employee' && e.entity_id === employeeId) ||
        (e.entity === 'schedule' && e.details?.includes(String(employeeId))) ||
        e.entity === 'schedule'
      ).slice(0, 30);
      setChangelog(empLog);

      // Fetch current month schedule for this employee
      const now = new Date();
      const [schM1, schM2] = await Promise.all([
        api.getSchedule(now.getFullYear(), now.getMonth() + 1),
        // Also get next month if we're in last 7 days
        now.getDate() >= 25
          ? api.getSchedule(now.getFullYear(), now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2)
          : Promise.resolve([]),
      ]);
      const allSch = [...schM1, ...schM2].filter(e => e.employee_id === employeeId);
      const todayStr = now.toISOString().slice(0, 10);
      const in7 = new Date(now);
      in7.setDate(now.getDate() + 7);
      const in7Str = in7.toISOString().slice(0, 10);
      setSchedule7(allSch.filter(e => e.date >= todayStr && e.date < in7Str).sort((a, b) => a.date.localeCompare(b.date)));
    } finally {
      setLoading(false);
    }
  }, [employeeId, year]);

  useEffect(() => { load(); }, [load]);

  if (!employeeId) {
    // Employee picker
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">👤 Mitarbeiter-Profil</h1>
        <p className="text-gray-500 mb-4">Wähle einen Mitarbeiter:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {employees.map(emp => (
            <button
              key={emp.ID}
              onClick={() => navigate(`/mitarbeiter/${emp.ID}`)}
              className="border rounded-xl p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
            >
              <div className="font-semibold">{emp.FIRSTNAME} {emp.NAME}</div>
              <div className="text-xs text-gray-500">{emp.SHORTNAME} · #{emp.NUMBER}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Lade Profil…</div>;
  if (!employee) return <div className="p-8 text-center text-red-500">Mitarbeiter nicht gefunden.</div>;

  const totals = yearStats?.totals;
   
  const months: MonthStat[] = yearStats?.months ?? [];
   
  const maxHours = Math.max(...months.map((m) => m.actual_hours), 1);

  // Upcoming absences (next 30 days)
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);
  const upcomingAbsences = absences
    .filter(a => a.date >= nowStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const workdayLabels = (employee.WORKDAYS_LIST ?? [false,false,false,false,false,false,false])
    .map((v, i) => v ? WEEKDAY_LABELS[i] : null)
    .filter(Boolean);

  const tabs = [
    { id: 'overview', label: '📋 Übersicht' },
    { id: 'stats', label: '📈 Jahres-Statistik' },
    { id: 'schedule', label: '📅 Nächste 7 Tage' },
    { id: 'log', label: '🕐 Protokoll' },
  ] as const;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-2xl">‹</button>
        <div>
          <h1 className="text-2xl font-bold">{employee.FIRSTNAME} {employee.NAME}</h1>
          <div className="text-gray-500 text-sm flex items-center gap-2 flex-wrap">
            <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">{employee.SHORTNAME}</span>
            {employee.NUMBER && <span>Nr. {employee.NUMBER}</span>}
            {groupName && <span>· {groupName}</span>}
            {employee.FUNCTION && <span>· {employee.FUNCTION}</span>}
            {employee.EMPEND && <span className="text-red-500">· Ausgetreten {formatDate(employee.EMPEND)}</span>}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={employeeId}
            onChange={e => navigate(`/mitarbeiter/${e.target.value}`)}
          >
            {employees.map(e => (
              <option key={e.ID} value={e.ID}>{e.FIRSTNAME} {e.NAME}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <KPICard label="Schichten" value={totals.shifts_count} icon="📋" color="bg-blue-50 border-blue-200 text-blue-900" sub={`${year}`} />
          <KPICard label="Ist-Stunden" value={`${totals.actual_hours.toFixed(0)}h`} icon="⏱️" color="bg-green-50 border-green-200 text-green-900" sub={`Soll: ${totals.target_hours.toFixed(0)}h`} />
          <KPICard label="Urlaub" value={`${totals.vacation_days}d`} icon="🏖️" color="bg-yellow-50 border-yellow-200 text-yellow-900" sub="Verbrauch" />
          <KPICard label="Wochenend-Schichten" value={totals.weekend_shifts} icon="📅" color="bg-purple-50 border-purple-200 text-purple-900" sub={`Nacht: ${totals.night_shifts}`} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Übersicht */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stammdaten */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-gray-700">👤 Stammdaten</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {[
                  ['Anrede', employee.SALUTATION || '–'],
                  ['Geburtsdatum', employee.BIRTHDAY ? `${formatDate(employee.BIRTHDAY)} (${calcAge(employee.BIRTHDAY)} J.)` : '–'],
                  ['Eintritt', employee.EMPSTART ? `${formatDate(employee.EMPSTART)} (${calcTenure(employee.EMPSTART)})` : '–'],
                  ['Austritt', formatDate(employee.EMPEND)],
                  ['Std/Tag', `${employee.HRSDAY}h`],
                  ['Std/Woche', `${employee.HRSWEEK}h`],
                  ['Std/Monat', `${employee.HRSMONTH}h`],
                  ['Arbeitstage', workdayLabels.length ? workdayLabels.join(', ') : '–'],
                ].map(([k, v]) => (
                  <tr key={k} className="hover:bg-gray-50">
                    <td className="py-1.5 pr-3 text-gray-500 w-32">{k}</td>
                    <td className="py-1.5 font-medium">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kontakt */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-gray-700">📞 Kontakt & Notizen</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {[
                  ['Telefon', employee.PHONE || '–'],
                  ['E-Mail', employee.EMAIL || '–'],
                  ['Straße', employee.STREET || '–'],
                  ['PLZ/Ort', employee.ZIP && employee.TOWN ? `${employee.ZIP} ${employee.TOWN}` : '–'],
                  ['Notiz 1', employee.NOTE1 || '–'],
                  ['Notiz 2', employee.NOTE2 || '–'],
                  ['Notiz 3', employee.NOTE3 || '–'],
                  ['Notiz 4', employee.NOTE4 || '–'],
                ].map(([k, v]) => (
                  <tr key={k} className="hover:bg-gray-50">
                    <td className="py-1.5 pr-3 text-gray-500 w-24">{k}</td>
                    <td className="py-1.5 font-medium break-all">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kommende Abwesenheiten */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-gray-700">🗓️ Bevorstehende Abwesenheiten</h2>
            {upcomingAbsences.length === 0
              ? <p className="text-gray-400 text-sm">Keine geplanten Abwesenheiten</p>
              : (
                <div className="space-y-1">
                  {upcomingAbsences.map(a => (
                    <div key={a.date} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 w-24 shrink-0">{formatDate(a.date)}</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{a.leave_type_short}</span>
                      <span>{a.leave_type_name}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* Nächste 7 Tage */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-gray-700">📅 Nächste 7 Tage</h2>
            {schedule7.length === 0
              ? <p className="text-gray-400 text-sm">Keine Schichten in den nächsten 7 Tagen</p>
              : (
                <div className="space-y-1">
                  {schedule7.map(e => {
                    const d = new Date(e.date);
                    const isToday = e.date === new Date().toISOString().slice(0, 10);
                    return (
                      <div key={e.date} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${isToday ? 'bg-blue-50' : ''}`}>
                        <span className={`w-24 shrink-0 ${isToday ? 'font-bold text-blue-700' : 'text-gray-400'}`}>
                          {d.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          {isToday && ' (Heute)'}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: `#${e.color_bk}22`, color: `#${e.color_bk}`, border: `1px solid #${e.color_bk}44` }}
                        >
                          {e.display_name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* Tab: Jahres-Statistik */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {/* Monthly hours bars */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-gray-700">⏱️ Stunden pro Monat {year}</h2>
            <div className="space-y-1.5">
              {months.map((m) => (
                <MiniBar
                  key={m.month}
                  label={MONTH_NAMES[m.month - 1]}
                  value={m.actual_hours}
                  max={maxHours}
                  color={m.actual_hours >= m.target_hours ? 'bg-green-400' : 'bg-orange-400'}
                  sub={`${m.actual_hours.toFixed(0)}h / ${m.target_hours.toFixed(0)}h`}
                />
              ))}
            </div>
          </div>

          {/* Monthly detail table */}
          <div className="border rounded-xl p-4 overflow-x-auto">
            <h2 className="font-semibold mb-3 text-gray-700">📊 Monatsdetails {year}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left py-1 pr-2">Monat</th>
                  <th className="text-right py-1 pr-2">Schichten</th>
                  <th className="text-right py-1 pr-2">Ist-h</th>
                  <th className="text-right py-1 pr-2">Soll-h</th>
                  <th className="text-right py-1 pr-2">Diff</th>
                  <th className="text-right py-1 pr-2">WE</th>
                  <th className="text-right py-1 pr-2">Nacht</th>
                  <th className="text-right py-1">Urlaub</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {months.map((m) => (
                  <tr key={m.month} className="hover:bg-gray-50">
                    <td className="py-1 pr-2 font-medium">{MONTH_NAMES[m.month - 1]}</td>
                    <td className="py-1 pr-2 text-right">{m.shifts_count}</td>
                    <td className="py-1 pr-2 text-right">{m.actual_hours.toFixed(1)}</td>
                    <td className="py-1 pr-2 text-right text-gray-400">{m.target_hours.toFixed(1)}</td>
                    <td className={`py-1 pr-2 text-right font-medium ${m.difference >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {m.difference >= 0 ? '+' : ''}{m.difference.toFixed(1)}
                    </td>
                    <td className="py-1 pr-2 text-right">{m.weekend_shifts}</td>
                    <td className="py-1 pr-2 text-right">{m.night_shifts}</td>
                    <td className="py-1 text-right">{m.vacation_days}</td>
                  </tr>
                ))}
                {totals && (
                  <tr className="font-bold bg-gray-50">
                    <td className="py-1 pr-2">Gesamt</td>
                    <td className="py-1 pr-2 text-right">{totals.shifts_count}</td>
                    <td className="py-1 pr-2 text-right">{totals.actual_hours.toFixed(1)}</td>
                    <td className="py-1 pr-2 text-right text-gray-400">{totals.target_hours.toFixed(1)}</td>
                    <td className={`py-1 pr-2 text-right ${totals.difference >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {totals.difference >= 0 ? '+' : ''}{totals.difference.toFixed(1)}
                    </td>
                    <td className="py-1 pr-2 text-right">{totals.weekend_shifts}</td>
                    <td className="py-1 pr-2 text-right">{totals.night_shifts}</td>
                    <td className="py-1 text-right">{totals.vacation_days}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Nächste 7 Tage (extended) */}
      {tab === 'schedule' && (
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-4 text-gray-700">📅 Nächste 7 Tage im Detail</h2>
          {schedule7.length === 0
            ? <p className="text-gray-400">Keine Einträge gefunden.</p>
            : (
              <div className="space-y-2">
                {schedule7.map(e => {
                  const d = new Date(e.date);
                  const isToday = e.date === new Date().toISOString().slice(0, 10);
                  const shift = e.shift_id ? shifts.find(s => s.ID === e.shift_id) : null;
                  return (
                    <div
                      key={e.date}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                    >
                      <div className="w-20 shrink-0">
                        <div className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                          {d.toLocaleDateString('de-AT', { weekday: 'short' })}
                        </div>
                        <div className="text-xs text-gray-400">
                          {d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })}
                        </div>
                        {isToday && <div className="text-xs text-blue-500 font-medium">Heute</div>}
                      </div>
                      <div className="flex-1">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                          style={{
                            background: `#${e.color_bk}33`,
                            color: `#${e.color_bk}`,
                            border: `1px solid #${e.color_bk}55`,
                          }}
                        >
                          {e.display_name}
                        </span>
                        {shift && shift.STARTEND0 && (
                          <div className="text-xs text-gray-400 mt-1">{shift.STARTEND0}</div>
                        )}
                        {e.kind === 'absence' && (
                          <div className="text-xs text-gray-500 mt-1">Abwesenheit</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
          {/* Also show absences this week */}
          {upcomingAbsences.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Bevorstehende Abwesenheiten</h3>
              <div className="space-y-1">
                {upcomingAbsences.map(a => (
                  <div key={a.date} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-24">{formatDate(a.date)}</span>
                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs">{a.leave_type_short}</span>
                    <span>{a.leave_type_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Protokoll */}
      {tab === 'log' && (
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-3 text-gray-700">🕐 Änderungs-Protokoll</h2>
          <p className="text-xs text-gray-400 mb-3">Letzte 30 System-Einträge (alle Entitäten)</p>
          {changelog.length === 0
            ? <p className="text-gray-400 text-sm">Keine Einträge.</p>
            : (
              <div className="space-y-2 text-sm">
                {changelog.map((e, i) => {
                  const actionColor: Record<string, string> = {
                    CREATE: 'bg-green-100 text-green-800',
                    UPDATE: 'bg-blue-100 text-blue-800',
                    DELETE: 'bg-red-100 text-red-800',
                  };
                  const entityLabels: Record<string, string> = {
                    employee: '👤 Mitarbeiter', schedule: '📅 Dienstplan', absence: '🏖️ Abwesenheit',
                    shift: '🕐 Schicht', group: '🏢 Gruppe', user: '🔑 Benutzer', wishes: '💬 Wunsch',
                  };
                  return (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                      <div className="w-32 shrink-0 text-gray-400 text-xs">
                        {new Date(e.timestamp).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${actionColor[e.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {e.action === 'CREATE' ? 'Neu' : e.action === 'UPDATE' ? 'Geänd.' : 'Gelösch.'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-500">{entityLabels[e.entity] ?? e.entity}</span>
                        {e.details && <span className="text-gray-400 ml-1 text-xs truncate">· {e.details.slice(0, 60)}</span>}
                      </div>
                      <div className="shrink-0 text-gray-400 text-xs">{e.user}</div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}
