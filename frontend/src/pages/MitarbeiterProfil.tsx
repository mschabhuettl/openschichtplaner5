import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ChangelogEntry, EmployeeYearStats } from '../api/client';
import type { Employee, ShiftType, ScheduleEntry } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';

const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WEEKDAY_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

// ── Types for skills / availability ──────────────────────────────
interface Skill { id: string; name: string; description?: string; color?: string; icon?: string; category?: string; }
interface SkillAssignment { id: string; employee_id: number; skill_id: string; level: number; assigned_at?: string; }
interface DayAvailability { day: number; available: boolean; time_windows: { start: string; end: string }[]; }
interface AvailabilityData { employee_id: number; days: DayAvailability[]; updated_at: string | null; }

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
  const [yearStats, setYearStats] = useState<EmployeeYearStats | null>(null);
  const [schedule7, setSchedule7] = useState<ScheduleEntry[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [absences, setAbsences] = useState<{ date: string; leave_type_name: string; leave_type_short: string }[]>([]);
  const [tab, setTab] = useState<'overview' | 'stats' | 'schedule' | 'log' | 'profile'>('overview');
  const [loading, setLoading] = useState(true);
  const [year] = useState(new Date().getFullYear());

  // Q039: Skills, Availability, Contract Hours
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [empSkillAssignments, setEmpSkillAssignments] = useState<SkillAssignment[]>([]);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // Editable copies
  const [editHrsWeek, setEditHrsWeek] = useState<number>(0);
  const [editHrsDay, setEditHrsDay] = useState<number>(0);
  const [editHrsMonth, setEditHrsMonth] = useState<number>(0);
  const [editAvailDays, setEditAvailDays] = useState<DayAvailability[]>([]);
  const [editSkillIds, setEditSkillIds] = useState<Set<string>>(new Set());

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

      // Group name via group assignments + Q039 data
      const [assignments, stats, absData, clog, skillsList, skillAssigns, availData] = await Promise.all([
        api.getGroupAssignments(),
        api.getEmployeeStatsYear(employeeId, year),
        api.getAbsences({ employee_id: employeeId, year }),
        api.getChangelog({ limit: 100 }),
        api.getSkills() as Promise<Skill[]>,
        api.getSkillAssignments({ employee_id: employeeId }) as Promise<SkillAssignment[]>,
        api.getAvailability(employeeId) as Promise<AvailabilityData>,
      ]);
      setAllSkills(skillsList);
      setEmpSkillAssignments(skillAssigns);
      setAvailability(availData);
      // Init editable state
      setEditHrsWeek(emp.HRSWEEK);
      setEditHrsDay(emp.HRSDAY);
      setEditHrsMonth(emp.HRSMONTH);
      setEditSkillIds(new Set(skillAssigns.map(a => a.skill_id)));
      if (availData?.days) {
        setEditAvailDays(availData.days.map(d => ({ ...d, time_windows: [...d.time_windows] })));
      } else {
        setEditAvailDays(Array.from({ length: 7 }, (_, i) => ({ day: i, available: true, time_windows: [] })));
      }
      const ga = assignments.find(a => a.employee_id === employeeId);
      if (ga) {
        const g = grps.find(g => g.ID === ga.group_id);
        setGroupName(g?.NAME ?? '');
      }
      setYearStats(stats);
      setAbsences(absData);
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

  if (loading) return <LoadingSpinner message="Mitarbeiterprofil laden…" />;
  if (!employee) return <div className="p-8 text-center text-red-500">Mitarbeiter nicht gefunden.</div>;

  const totals = yearStats?.totals;
   
  const months: MonthStat[] = yearStats?.months ?? [];
   
  const maxHours = Math.max(...months.map((m) => m.actual_hours), 1);

  // Upcoming absences (next 30 days)
  const now = new Date();

  // Current month stats for KPI strip
  const currentMonthNum = now.getMonth() + 1;
  const currentMonthStat = months.find(m => m.month === currentMonthNum);
  const nowStr = now.toISOString().slice(0, 10);
  const upcomingAbsences = absences
    .filter(a => a.date >= nowStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const workdayLabels = (employee.WORKDAYS_LIST ?? [false,false,false,false,false,false,false])
    .map((v, i) => v ? WEEKDAY_LABELS[i] : null)
    .filter(Boolean);

  const tabs = [
    { id: 'overview' as const, label: '📋 Übersicht' },
    { id: 'profile' as const, label: '🎓 Profil & Qualifikationen' },
    { id: 'stats' as const, label: '📈 Jahres-Statistik' },
    { id: 'schedule' as const, label: '📅 Nächste 7 Tage' },
    { id: 'log' as const, label: '🕐 Protokoll' },
  ];

  // Q039: Save handler for profile tab
  const handleProfileSave = async () => {
    if (!employeeId || !employee) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      // 1. Update contract hours
      await api.updateEmployee(employeeId, {
        HRSWEEK: editHrsWeek,
        HRSDAY: editHrsDay,
        HRSMONTH: editHrsMonth,
      });

      // 2. Update availability
      await api.setAvailability(employeeId, { days: editAvailDays });

      // 3. Update skill assignments — diff against current
      const currentSkillIds = new Set(empSkillAssignments.map(a => a.skill_id));
      // Add new skills
      for (const sid of editSkillIds) {
        if (!currentSkillIds.has(sid)) {
          await api.createSkillAssignment({ employee_id: employeeId, skill_id: sid, level: 1 });
        }
      }
      // Remove deselected skills
      for (const a of empSkillAssignments) {
        if (!editSkillIds.has(a.skill_id)) {
          await api.deleteSkillAssignment(a.id);
        }
      }

      setProfileMsg({ type: 'ok', text: 'Profil gespeichert!' });
      // Reload data
      await load();
    } catch (e: unknown) {
      setProfileMsg({ type: 'err', text: `Fehler: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button aria-label="Zurück" onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-600 text-2xl">‹</button>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
          {currentMonthStat && (
            <KPICard
              label={`${MONTH_NAMES[currentMonthNum - 1]} Ist/Soll`}
              value={`${currentMonthStat.actual_hours.toFixed(0)}h`}
              icon="📆"
              color={currentMonthStat.difference >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}
              sub={`Soll: ${currentMonthStat.target_hours.toFixed(0)}h (${currentMonthStat.difference >= 0 ? '+' : ''}${currentMonthStat.difference.toFixed(0)}h)`}
            />
          )}
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
              ? <p className="text-gray-600 text-sm">Keine geplanten Abwesenheiten</p>
              : (
                <div className="space-y-1">
                  {upcomingAbsences.map(a => (
                    <div key={a.date} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 w-24 shrink-0">{formatDate(a.date)}</span>
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
              ? <p className="text-gray-600 text-sm">Keine Schichten in den nächsten 7 Tagen</p>
              : (
                <div className="space-y-1">
                  {schedule7.map(e => {
                    const d = new Date(e.date);
                    const isToday = e.date === new Date().toISOString().slice(0, 10);
                    return (
                      <div key={e.date} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${isToday ? 'bg-blue-50' : ''}`}>
                        <span className={`w-24 shrink-0 ${isToday ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
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
                    <td className="py-1 pr-2 text-right text-gray-600">{m.target_hours.toFixed(1)}</td>
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
                    <td className="py-1 pr-2 text-right text-gray-600">{totals.target_hours.toFixed(1)}</td>
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
            ? <p className="text-gray-600">Keine Einträge gefunden.</p>
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
                        <div className="text-xs text-gray-600">
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
                          <div className="text-xs text-gray-600 mt-1">{shift.STARTEND0}</div>
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
                    <span className="text-gray-600 w-24">{formatDate(a.date)}</span>
                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs">{a.leave_type_short}</span>
                    <span>{a.leave_type_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Profil & Qualifikationen (Q039) */}
      {tab === 'profile' && (
        <div className="space-y-4">
          {/* Feedback */}
          {profileMsg && (
            <div className={`rounded-lg p-3 text-sm ${profileMsg.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {profileMsg.text}
            </div>
          )}

          {/* Contract Hours */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-gray-700">⏱️ Vertragsstunden</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stunden / Tag</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={editHrsDay}
                  onChange={e => setEditHrsDay(parseFloat(e.target.value) || 0)}
                  className="border rounded-lg px-3 py-2 w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stunden / Woche</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="168"
                  value={editHrsWeek}
                  onChange={e => setEditHrsWeek(parseFloat(e.target.value) || 0)}
                  className="border rounded-lg px-3 py-2 w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stunden / Monat</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="744"
                  value={editHrsMonth}
                  onChange={e => setEditHrsMonth(parseFloat(e.target.value) || 0)}
                  className="border rounded-lg px-3 py-2 w-full text-sm"
                />
              </div>
            </div>
          </div>

          {/* Qualifications / Skills */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-gray-700">🎓 Qualifikationen</h2>
            {allSkills.length === 0 ? (
              <p className="text-gray-500 text-sm">Keine Qualifikationen definiert. Erstelle welche unter Kompetenz-Matrix.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {allSkills.map(skill => {
                  const active = editSkillIds.has(skill.id);
                  return (
                    <label
                      key={skill.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${active ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {
                          setEditSkillIds(prev => {
                            const next = new Set(prev);
                            if (next.has(skill.id)) next.delete(skill.id);
                            else next.add(skill.id);
                            return next;
                          });
                        }}
                        className="rounded"
                      />
                      <span className="text-lg">{skill.icon || '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{skill.name}</div>
                        {skill.category && <div className="text-xs text-gray-500">{skill.category}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Availability */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-gray-700">📅 Verfügbarkeit (Wochenplan)</h2>
            {availability?.updated_at && (
              <p className="text-xs text-gray-400 mb-2">Zuletzt aktualisiert: {new Date(availability.updated_at).toLocaleString('de-AT')}</p>
            )}
            <div className="space-y-2">
              {editAvailDays.sort((a, b) => a.day - b.day).map(dayData => (
                <div key={dayData.day} className={`flex items-center gap-3 p-2 rounded-lg border ${dayData.available ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-2 w-32 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dayData.available}
                      onChange={() => {
                        setEditAvailDays(prev => prev.map(d =>
                          d.day === dayData.day ? { ...d, available: !d.available, time_windows: !d.available ? d.time_windows : [] } : d
                        ));
                      }}
                      className="rounded"
                    />
                    <span className={`text-sm font-medium ${dayData.available ? 'text-gray-900' : 'text-gray-400'}`}>
                      {WEEKDAY_FULL[dayData.day]}
                    </span>
                  </label>
                  {dayData.available && (
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      {dayData.time_windows.length === 0 ? (
                        <span className="text-xs text-green-600">Ganztägig verfügbar</span>
                      ) : (
                        dayData.time_windows.map((tw, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-sm">
                            <input
                              type="time"
                              value={tw.start}
                              onChange={e => {
                                setEditAvailDays(prev => prev.map(d => {
                                  if (d.day !== dayData.day) return d;
                                  const windows = [...d.time_windows];
                                  windows[idx] = { ...windows[idx], start: e.target.value };
                                  return { ...d, time_windows: windows };
                                }));
                              }}
                              className="border rounded px-1 py-0.5 text-xs w-20"
                            />
                            <span className="text-gray-400">–</span>
                            <input
                              type="time"
                              value={tw.end}
                              onChange={e => {
                                setEditAvailDays(prev => prev.map(d => {
                                  if (d.day !== dayData.day) return d;
                                  const windows = [...d.time_windows];
                                  windows[idx] = { ...windows[idx], end: e.target.value };
                                  return { ...d, time_windows: windows };
                                }));
                              }}
                              className="border rounded px-1 py-0.5 text-xs w-20"
                            />
                            <button
                              onClick={() => {
                                setEditAvailDays(prev => prev.map(d => {
                                  if (d.day !== dayData.day) return d;
                                  return { ...d, time_windows: d.time_windows.filter((_, i) => i !== idx) };
                                }));
                              }}
                              className="text-red-400 hover:text-red-600 text-xs"
                              title="Zeitfenster entfernen"
                            >✕</button>
                          </div>
                        ))
                      )}
                      <button
                        onClick={() => {
                          setEditAvailDays(prev => prev.map(d => {
                            if (d.day !== dayData.day) return d;
                            return { ...d, time_windows: [...d.time_windows, { start: '08:00', end: '17:00' }] };
                          }));
                        }}
                        className="text-blue-500 hover:text-blue-700 text-xs px-1"
                        title="Zeitfenster hinzufügen"
                      >+ Zeitfenster</button>
                    </div>
                  )}
                  {!dayData.available && (
                    <span className="text-xs text-gray-400">Nicht verfügbar</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm transition-colors"
            >
              {profileSaving ? 'Speichern…' : '💾 Profil speichern'}
            </button>
            {profileMsg && profileMsg.type === 'ok' && (
              <span className="text-green-600 text-sm">✓ {profileMsg.text}</span>
            )}
          </div>
        </div>
      )}

      {/* Tab: Protokoll */}
      {tab === 'log' && (
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-3 text-gray-700">🕐 Änderungs-Protokoll</h2>
          <p className="text-xs text-gray-600 mb-3">Letzte 30 System-Einträge (alle Entitäten)</p>
          {changelog.length === 0
            ? <p className="text-gray-600 text-sm">Keine Einträge.</p>
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
                      <div className="w-32 shrink-0 text-gray-600 text-xs">
                        {new Date(e.timestamp).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${actionColor[e.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {e.action === 'CREATE' ? 'Neu' : e.action === 'UPDATE' ? 'Geänd.' : 'Gelösch.'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-500">{entityLabels[e.entity] ?? e.entity}</span>
                        {e.details && <span className="text-gray-600 ml-1 text-xs truncate">· {e.details.slice(0, 60)}</span>}
                      </div>
                      <div className="shrink-0 text-gray-600 text-xs">{e.user}</div>
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
