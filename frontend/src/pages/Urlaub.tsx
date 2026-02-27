import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import type { Employee, LeaveType, Group } from '../types';
import { useToast } from '../hooks/useToast';
import { usePermissions } from '../hooks/usePermissions';

// ─── Types ────────────────────────────────────────────────
interface Absence {
  ID: number;
  EMPLOYEE_ID: number;
  DATE: string;
  LEAVE_TYPE_ID: number;
}

interface LeaveBalance {
  employee_id: number;
  year: number;
  entitlement: number;
  carry_forward: number;
  total: number;
  used: number;
  remaining: number;
  forfeiture_date: string;
  has_custom_entitlement: boolean;
  employee_name?: string;
  employee_number?: string;
}

interface HolidayBan {
  id: number;
  group_id: number;
  group_name: string;
  start_date: string;
  end_date: string;
  restrict: number;
  reason: string;
}

type UrlaubTab = 'antraege' | 'abwesenheiten' | 'ansprueche' | 'sperren' | 'timeline';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const API = import.meta.env.VITE_API_URL ?? '';
function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}

// ─── Shared: Detail Modal (Abwesenheiten) ─────────────────
interface DetailModalProps {
  employee: Employee;
  month: number;
  year: number;
  absences: Absence[];
  leaveTypes: LeaveType[];
  onClose: () => void;
}
function DetailModal({ employee, month, year, absences, leaveTypes, onClose }: DetailModalProps) {
  const monthAbs = absences.filter(a => {
    const d = new Date(a.DATE);
    return d.getFullYear() === year && d.getMonth() === month && a.EMPLOYEE_ID === employee.ID;
  });
  const getLT = (id: number) => leaveTypes.find(lt => lt.ID === id);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{employee.FIRSTNAME} {employee.NAME}</h2>
            <p className="text-sm text-gray-500">{MONTHS[month]} {year}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="px-6 py-4">
          {monthAbs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Keine Abwesenheiten</p>
          ) : (
            <div className="space-y-2">
              {monthAbs.map(ab => {
                const lt = getLT(ab.LEAVE_TYPE_ID);
                return (
                  <div key={ab.ID} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                    <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: lt?.COLORBK_HEX ?? '#e5e7eb', color: lt?.COLORBK_LIGHT ? '#333' : '#fff' }}>
                      {lt?.SHORTNAME ?? '?'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{new Date(ab.DATE).toLocaleDateString('de-AT')}</div>
                      <div className="text-xs text-gray-500">{lt?.NAME ?? 'Unbekannt'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Schließen</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared: New Absence Modal ────────────────────────────
interface NewAbsenceModalProps {
  employees: Employee[];
  leaveTypes: LeaveType[];
  onSave: (a: Omit<Absence, 'ID'>) => void;
  onClose: () => void;
}
function NewAbsenceModal({ employees, leaveTypes, onSave, onClose }: NewAbsenceModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState(employees[0]?.ID ?? 0);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.ID ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = () => {
    setSaving(true);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        onSave({ EMPLOYEE_ID: employeeId, DATE: d.toISOString().slice(0, 10), LEAVE_TYPE_ID: leaveTypeId });
      }
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Abwesenheit beantragen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-700">
          <span>🚧</span><span><strong>Lokale Vorschau.</strong> Backend-Speicherung folgt.</span>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter</label>
            <select value={employeeId} onChange={e => setEmployeeId(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {employees.map(e => <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
              <input type="date" value={fromDate}
                onChange={e => { setFromDate(e.target.value); if (e.target.value > toDate) setToDate(e.target.value); }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
              <input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Art der Abwesenheit</label>
            <select value={leaveTypeId} onChange={e => setLeaveTypeId(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {leaveTypes.map(lt => <option key={lt.ID} value={lt.ID}>{lt.NAME} ({lt.SHORTNAME})</option>)}
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Abbrechen</button>
          <button onClick={handleSubmit} disabled={saving || !employeeId || !leaveTypeId}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? '⟳' : 'Beantragen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Kalender View ────────────────────────────────────────
const WEEKDAYS_LONG = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES_LONG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

interface KalenderEntry {
  absence: Absence;
  employee: Employee;
  leaveType: LeaveType | undefined;
}

interface AbsenceKalenderDetailProps {
  entries: KalenderEntry[];
  dateLabel: string;
  onClose: () => void;
}
function AbsenceKalenderDetail({ entries, dateLabel, onClose }: AbsenceKalenderDetailProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">🗓️ Abwesenheiten</h2>
            <p className="text-sm text-gray-500">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="px-6 py-4 overflow-y-auto space-y-2">
          {entries.map((entry, i) => {
            const lt = entry.leaveType;
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: lt?.COLORBK_HEX ?? '#6b7280', color: lt?.COLORBK_LIGHT ? '#1f2937' : '#fff' }}
                >
                  {lt?.SHORTNAME ?? '?'}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{entry.employee.NAME}, {entry.employee.FIRSTNAME}</div>
                  <div className="text-xs text-gray-500">{lt?.NAME ?? 'Unbekannt'} · Nr. {entry.employee.NUMBER}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-6 py-3 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Schließen</button>
        </div>
      </div>
    </div>
  );
}

interface AbwesenheitenKalenderProps {
  employees: Employee[];
  leaveTypes: LeaveType[];
  absences: Absence[];
  loading: boolean;
}
function AbwesenheitenKalender({ employees, leaveTypes, absences, loading }: AbwesenheitenKalenderProps) {
  const todayObj = new Date();
  const [month, setMonth] = useState(todayObj.getMonth());
  const [year, setYear] = useState(todayObj.getFullYear());
  const [detail, setDetail] = useState<{ entries: KalenderEntry[]; label: string } | null>(null);

  const goToday = () => { setMonth(todayObj.getMonth()); setYear(todayObj.getFullYear()); };
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Build map: dateKey → KalenderEntry[]
  const entriesByDay = useMemo(() => {
    const map = new Map<string, KalenderEntry[]>();
    absences.forEach(ab => {
      const d = new Date(ab.DATE);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const key = ab.DATE.slice(0, 10);
      const emp = employees.find(e => e.ID === ab.EMPLOYEE_ID);
      if (!emp) return;
      const lt = leaveTypes.find(l => l.ID === ab.LEAVE_TYPE_ID);
      const entry: KalenderEntry = { absence: ab, employee: emp, leaveType: lt };
      const existing = map.get(key) ?? [];
      existing.push(entry);
      map.set(key, existing);
    });
    return map;
  }, [absences, employees, leaveTypes, year, month]);

  // Build calendar weeks
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday-based
    const weeksArr: (number | null)[][] = [];
    let currentWeek: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      currentWeek.push(d);
      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeksArr.push(currentWeek);
    }
    return weeksArr;
  }, [year, month]);

  const todayKey = todayObj.toISOString().slice(0, 10);

  const handleDayClick = (day: number) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entries = entriesByDay.get(key);
    if (!entries || entries.length === 0) return;
    const label = new Date(year, month, day).toLocaleDateString('de-AT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    setDetail({ entries, label });
  };

  // Stats for current month
  const totalAbsenceDays = entriesByDay.size > 0
    ? [...entriesByDay.values()].reduce((sum, e) => sum + e.length, 0)
    : 0;
  const uniqueEmployees = new Set(
    absences
      .filter(a => {
        const d = new Date(a.DATE);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map(a => a.EMPLOYEE_ID)
  ).size;

  return (
    <div>
      {/* Navigation bar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth}
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            ‹
          </button>
          <h2 className="text-base sm:text-lg font-bold text-gray-800 min-w-[160px] sm:min-w-[200px] text-center">
            {MONTH_NAMES_LONG[month]} {year}
          </h2>
          <button onClick={nextMonth}
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            ›
          </button>
          <button onClick={goToday}
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-xs sm:text-sm transition-colors">
            Heute
          </button>
        </div>
        {/* Quick stats */}
        <div className="flex gap-3 text-xs text-gray-500">
          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-semibold">
            {uniqueEmployees} MA betroffen
          </span>
          <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-semibold">
            {totalAbsenceDays} Abwesenheitstage
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {leaveTypes.map(lt => (
          <span key={lt.ID}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
            style={{
              backgroundColor: lt.COLORBK_HEX,
              color: lt.COLORBK_LIGHT ? '#374151' : '#fff',
              borderColor: lt.COLORBAR_HEX,
            }}>
            {lt.SHORTNAME} – {lt.NAME}
          </span>
        ))}
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-slate-700 text-white">
            {WEEKDAYS_LONG.map((d, i) => (
              <div key={d}
                className={`py-2 text-center text-xs font-semibold ${i >= 5 ? 'text-slate-300' : ''}`}>
                {d}
              </div>
            ))}
          </div>
          {/* Week rows */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-t border-gray-100">
              {week.map((day, di) => {
                if (day === null) {
                  return (
                    <div key={di}
                      className="min-h-[80px] sm:min-h-[110px] bg-gray-50/60 border-r border-gray-100 last:border-r-0 p-1" />
                  );
                }
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const entries = entriesByDay.get(key) ?? [];
                const isToday = key === todayKey;
                const isWeekend = di >= 5;
                const hasEntries = entries.length > 0;

                return (
                  <div
                    key={di}
                    className={`min-h-[80px] sm:min-h-[110px] border-r border-gray-100 last:border-r-0 p-1 transition-colors ${
                      isWeekend ? 'bg-slate-50/70' : 'bg-white'
                    } ${hasEntries ? 'cursor-pointer hover:bg-blue-50/50' : ''}`}
                    onClick={() => hasEntries && handleDayClick(day)}
                  >
                    {/* Day number */}
                    <div className="flex justify-end mb-1">
                      <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full leading-none ${
                        isToday
                          ? 'bg-blue-600 text-white'
                          : isWeekend
                          ? 'text-gray-400'
                          : 'text-gray-700'
                      }`}>
                        {day}
                      </span>
                    </div>
                    {/* Absence bars */}
                    <div className="space-y-0.5">
                      {entries.slice(0, 4).map((entry, ei) => {
                        const lt = entry.leaveType;
                        const initials = entry.employee.SHORTNAME
                          || `${entry.employee.FIRSTNAME.slice(0, 1)}${entry.employee.NAME.slice(0, 1)}`;
                        return (
                          <div
                            key={ei}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate leading-tight"
                            style={{
                              backgroundColor: lt?.COLORBK_HEX ?? '#6b7280',
                              color: lt?.COLORBK_LIGHT ? '#1f2937' : '#fff',
                            }}
                            title={`${entry.employee.NAME}, ${entry.employee.FIRSTNAME} – ${lt?.NAME ?? 'Unbekannt'}`}
                          >
                            <span className="font-bold truncate">{initials}</span>
                            <span className="hidden sm:inline truncate opacity-80 text-[10px]">
                              {lt?.SHORTNAME ?? ''}
                            </span>
                          </div>
                        );
                      })}
                      {entries.length > 4 && (
                        <div className="text-center text-[10px] text-gray-400 font-semibold">
                          +{entries.length - 4} mehr
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Hint */}
      <p className="mt-2 text-xs text-gray-400 text-center">
        Klick auf einen Tag mit Abwesenheiten für Details
      </p>

      {/* Detail popup */}
      {detail && (
        <AbsenceKalenderDetail
          entries={detail.entries}
          dateLabel={detail.label}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// ─── Tab 1: Abwesenheiten ─────────────────────────────────
interface AbwesenheitenTabProps {
  year: number;
  employees: Employee[];
  leaveTypes: LeaveType[];
  absences: Absence[];
  setAbsences: React.Dispatch<React.SetStateAction<Absence[]>>;
  loading: boolean;
}
function AbwesenheitenTab({ year, employees, leaveTypes, absences, setAbsences, loading }: AbwesenheitenTabProps) {
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [detailTarget, setDetailTarget] = useState<{ employee: Employee; month: number } | null>(null);
  const [viewMode, setViewMode] = useState<'liste' | 'kalender'>('kalender');

  const filteredEmployees = employees.filter(e =>
    `${e.NAME} ${e.FIRSTNAME} ${e.NUMBER}`.toLowerCase().includes(search.toLowerCase())
  );

  const getMonthCount = (empId: number, month: number) =>
    absences.filter(a => {
      const d = new Date(a.DATE);
      return a.EMPLOYEE_ID === empId && d.getFullYear() === year && d.getMonth() === month;
    }).length;

  const getCellStyle = (empId: number, month: number) => {
    const monthAbs = absences.filter(a => {
      const d = new Date(a.DATE);
      return a.EMPLOYEE_ID === empId && d.getFullYear() === year && d.getMonth() === month;
    });
    if (!monthAbs.length) return { bg: null, light: true };
    const counts: Record<number, number> = {};
    monthAbs.forEach(a => { counts[a.LEAVE_TYPE_ID] = (counts[a.LEAVE_TYPE_ID] ?? 0) + 1; });
    const domId = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
    const lt = leaveTypes.find(l => l.ID === domId);
    return { bg: lt?.COLORBK_HEX ?? null, light: lt?.COLORBK_LIGHT ?? true };
  };

  const vacTypeIds = new Set(leaveTypes.filter(lt => lt.ENTITLED).map(lt => lt.ID));
  const getUsed = (empId: number) =>
    absences.filter(a => a.EMPLOYEE_ID === empId && vacTypeIds.has(a.LEAVE_TYPE_ID)).length;

  return (
    <>
      {/* View toggle + actions */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('kalender')}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'kalender'
                ? 'bg-white shadow text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            🗓️ <span className="hidden sm:inline">Kalender</span>
          </button>
          <button
            onClick={() => setViewMode('liste')}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'liste'
                ? 'bg-white shadow text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            📋 <span className="hidden sm:inline">Jahresübersicht</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'liste' && (
            <input type="text" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 border rounded shadow-sm text-sm w-32" />
          )}
          <button onClick={() => setShowNewModal(true)}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
            ＋ <span className="hidden sm:inline">Abwesenheit</span>
          </button>
        </div>
      </div>

      {/* Kalender-View */}
      {viewMode === 'kalender' && (
        <AbwesenheitenKalender
          employees={employees}
          leaveTypes={leaveTypes}
          absences={absences}
          loading={loading}
        />
      )}

      {/* Listen-View (Jahresübersicht) */}
      {viewMode === 'liste' && (<>
      <div className="flex flex-wrap gap-2 mb-3">
        {leaveTypes.map(lt => (
          <span key={lt.ID} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
            style={{ backgroundColor: lt.COLORBK_HEX, color: lt.COLORBK_LIGHT ? '#374151' : '#fff', borderColor: lt.COLORBAR_HEX }}>
            {lt.SHORTNAME} – {lt.NAME}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto mb-6">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-slate-700 text-white">
              <th className="px-3 py-2 text-left sticky left-0 bg-slate-700 min-w-[160px]">Mitarbeiter</th>
              {MONTHS.map(m => <th key={m} className="px-2 py-2 text-center min-w-[44px]">{m}</th>)}
              <th className="px-3 py-2 text-center min-w-[52px]">Σ</th>
              <th className="px-3 py-2 text-center min-w-[52px]">Rest</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={15} className="text-center py-10 text-gray-400">⟳ Lade...</td></tr>}
            {!loading && filteredEmployees.map((emp, i) => {
              const used = getUsed(emp.ID);
              const remaining = 30 - used; // simplified
              return (
                <tr key={emp.ID} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                  <td className={`px-3 py-2 sticky left-0 font-semibold text-gray-800 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <div>{emp.NAME}, {emp.FIRSTNAME}</div>
                    <div className="text-gray-400 font-normal">{emp.NUMBER}</div>
                  </td>
                  {MONTHS.map((_, mi) => {
                    const count = getMonthCount(emp.ID, mi);
                    const { bg, light } = getCellStyle(emp.ID, mi);
                    return (
                      <td key={mi} className="px-1 py-1.5 text-center cursor-pointer hover:opacity-80"
                        onClick={() => count > 0 && setDetailTarget({ employee: emp, month: mi })}>
                        {count > 0 ? (
                          <span className="inline-flex items-center justify-center w-7 h-6 rounded font-bold text-xs"
                            style={{ backgroundColor: bg ?? '#6b7280', color: light ? '#1f2937' : '#fff' }}>
                            {count}
                          </span>
                        ) : <span className="text-gray-200">·</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-bold text-gray-700">{used}</td>
                  <td className={`px-3 py-2 text-center font-bold ${remaining < 0 ? 'text-red-600' : remaining <= 5 ? 'text-amber-600' : 'text-green-600'}`}>
                    {remaining}
                  </td>
                </tr>
              );
            })}
            {!loading && filteredEmployees.length === 0 && (
              <tr><td colSpan={15} className="text-center py-8 text-gray-400">Keine Mitarbeiter gefunden</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </>)}

      {/* Modals (immer sichtbar, unabhängig vom View-Mode) */}
      {detailTarget && (
        <DetailModal employee={detailTarget.employee} month={detailTarget.month} year={year}
          absences={absences} leaveTypes={leaveTypes} onClose={() => setDetailTarget(null)} />
      )}
      {showNewModal && (
        <NewAbsenceModal employees={employees} leaveTypes={leaveTypes}
          onSave={a => { setAbsences(prev => [...prev, { ...a, ID: Date.now() }]); setShowNewModal(false); }}
          onClose={() => setShowNewModal(false)} />
      )}
    </>
  );
}

// ─── Tab 2: Urlaubsansprüche ──────────────────────────────
interface AnsprüecheTabProps {
  year: number;
  employees: Employee[];
  groups: Group[];
}
function AnsprüecheTab({ year, employees, groups }: AnsprüecheTabProps) {
  const { canEditAbsences } = usePermissions();
  const [groupId, setGroupId] = useState<number | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (groupId !== null) {
        const res = await fetch(`${API}/api/leave-balance/group?year=${year}&group_id=${groupId}`, { headers: getAuthHeaders() });
        if (res.ok) { setBalances(await res.json()); return; }
      }
      // Load all employees individually
      const results: LeaveBalance[] = [];
      const empsToLoad = employees;
      await Promise.all(empsToLoad.map(async emp => {
        try {
          const res = await fetch(`${API}/api/leave-balance?year=${year}&employee_id=${emp.ID}`, { headers: getAuthHeaders() });
          if (res.ok) {
            const b = await res.json() as LeaveBalance;
            b.employee_name = `${emp.NAME}, ${emp.FIRSTNAME}`;
            b.employee_number = emp.NUMBER;
            results.push(b);
          }
        } catch { /* ignore */ }
      }));
      results.sort((a, b) => (a.employee_name ?? '').localeCompare(b.employee_name ?? ''));
      setBalances(results);
    } finally {
      setLoading(false);
    }
  }, [year, groupId, employees]);

  useEffect(() => { load(); }, [load]);

  const saveEntitlement = async (empId: number, days: number) => {
    setSaving(true);
    try {
      const balance = balances.find(b => b.employee_id === empId);
      await fetch(`${API}/api/leave-entitlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          employee_id: empId,
          year,
          days,
          carry_forward: balance?.carry_forward ?? 0,
        }),
      });
      await load();
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  };

  const filtered = balances.filter(b =>
    `${b.employee_name ?? ''} ${b.employee_number ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const restColor = (remaining: number) =>
    remaining > 5 ? 'text-green-600 bg-green-50' : remaining > 0 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={groupId ?? ''} onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Alle Gruppen</option>
          {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
        </select>
        <input type="text" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border rounded shadow-sm text-sm w-36" />
        <button onClick={load} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">↻ Neu laden</button>
        <span className="text-xs text-gray-400">Klicken Sie auf Anspruch-Zahl zum Bearbeiten</span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="bg-slate-700 text-white text-xs">
              <th className="px-4 py-3 text-left">Mitarbeiter</th>
              <th className="px-3 py-3 text-center">Anspruch</th>
              <th className="px-3 py-3 text-center">Übertrag</th>
              <th className="px-3 py-3 text-center">Gesamt</th>
              <th className="px-3 py-3 text-center">Genommen</th>
              <th className="px-3 py-3 text-center">Rest</th>
              <th className="px-3 py-3 text-center">Verfall bis</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">⟳ Lade Urlaubskonten...</td></tr>
            )}
            {!loading && filtered.map((b, i) => (
              <tr key={b.employee_id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                <td className="px-4 py-2">
                  <div className="font-semibold text-gray-800">{b.employee_name}</div>
                  <div className="text-xs text-gray-400">{b.employee_number}</div>
                </td>
                {/* Anspruch - editable */}
                <td className="px-3 py-2 text-center">
                  {editingId === b.employee_id ? (
                    <div className="flex items-center gap-1 justify-center">
                      <input
                        type="number" value={editValue} min="0" max="365" step="1"
                        onChange={e => setEditValue(e.target.value)}
                        className="w-14 border rounded px-1 py-0.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEntitlement(b.employee_id, Number(editValue));
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <button onClick={() => saveEntitlement(b.employee_id, Number(editValue))} disabled={saving}
                        className="text-green-600 hover:text-green-800 text-xs font-bold">✓</button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                    </div>
                  ) : canEditAbsences ? (
                    <button
                      onClick={() => { setEditingId(b.employee_id); setEditValue(String(b.entitlement)); }}
                      className="font-bold text-blue-600 hover:underline hover:text-blue-800 cursor-pointer px-2 py-0.5 rounded hover:bg-blue-50"
                      title="Klicken zum Bearbeiten">
                      {b.entitlement}
                    </button>
                  ) : (
                    <span className="font-bold text-gray-700">{b.entitlement}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-gray-600">{b.carry_forward}</td>
                <td className="px-3 py-2 text-center font-semibold text-gray-700">{b.total}</td>
                <td className="px-3 py-2 text-center text-amber-600 font-semibold">{b.used}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${restColor(b.remaining)}`}>
                    {b.remaining}
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-xs text-gray-500">
                  {b.forfeiture_date ? new Date(b.forfeiture_date).toLocaleDateString('de-AT') : '–'}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Keine Einträge gefunden</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary cards */}
      {!loading && filtered.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Mitarbeiter', value: filtered.length, color: 'text-gray-700' },
            { label: 'Ø Anspruch', value: (filtered.reduce((s, b) => s + b.entitlement, 0) / filtered.length).toFixed(1), color: 'text-blue-700' },
            { label: 'Gesamt genommen', value: filtered.reduce((s, b) => s + b.used, 0), color: 'text-amber-700' },
            { label: 'Gesamt Rest', value: filtered.reduce((s, b) => s + b.remaining, 0), color: filtered.reduce((s, b) => s + b.remaining, 0) > 0 ? 'text-green-700' : 'text-red-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg border p-3 shadow-sm text-center">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Urlaubssperren ────────────────────────────────
interface SperrenTabProps {
  groups: Group[];
}
function SperrenTab({ groups }: SperrenTabProps) {
  const { canEditAbsences } = usePermissions();
  const [groupId, setGroupId] = useState<number | null>(null);
  const [bans, setBans] = useState<HolidayBan[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ group_id: groups[0]?.ID ?? 0, start_date: '', end_date: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = groupId !== null
        ? `${API}/api/holiday-bans?group_id=${groupId}`
        : `${API}/api/holiday-bans`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) setBans(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const createBan = async () => {
    if (!form.start_date || !form.end_date) { setError('Bitte Von- und Bis-Datum angeben.'); return; }
    if (form.end_date < form.start_date) { setError('Bis-Datum muss >= Von-Datum sein.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/holiday-bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ...form, group_id: Number(form.group_id) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowForm(false);
      setForm({ group_id: groups[0]?.ID ?? 0, start_date: '', end_date: '', reason: '' });
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteBan = async (id: number) => {
    if (!confirm('Urlaubssperre wirklich löschen?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API}/api/holiday-bans/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) await load();
    } finally {
      setDeleting(null);
    }
  };

  const groupName = (gid: number) => groups.find(g => g.ID === gid)?.NAME ?? `Gruppe ${gid}`;

  const formatDateRange = (start: string, end: string) => {
    const s = start ? new Date(start).toLocaleDateString('de-AT') : '?';
    const e = end ? new Date(end).toLocaleDateString('de-AT') : '?';
    return start === end ? s : `${s} – ${e}`;
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={groupId ?? ''} onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Alle Gruppen</option>
          {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
        </select>
        {canEditAbsences && (
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center gap-1.5">
          ＋ Urlaubssperre anlegen
        </button>
        )}
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-4 bg-white rounded-lg border shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Neue Urlaubssperre</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Gruppe</label>
              <select value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: Number(e.target.value) }))}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Von</label>
              <input type="date" value={form.start_date}
                onChange={e => { setForm(f => ({ ...f, start_date: e.target.value })); if (e.target.value > form.end_date) setForm(f => ({ ...f, end_date: e.target.value })); }}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bis</label>
              <input type="date" value={form.end_date} min={form.start_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Grund</label>
              <input type="text" value={form.reason} placeholder="z.B. Messewoche, Hochsaison..."
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={createBan} disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
              {saving && <span className="animate-spin">⟳</span>} Sperre anlegen
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Abbrechen</button>
          </div>
        </div>
      )}

      {/* Bans list */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">⟳ Lade...</div>
      ) : bans.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
          <div className="text-4xl mb-2">🚫</div>
          <div>Keine Urlaubssperren eingetragen</div>
          <div className="text-xs mt-1">Klicken Sie auf "Urlaubssperre anlegen" um eine neue anzulegen.</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="bg-slate-700 text-white text-xs">
                <th className="px-4 py-3 text-left">Zeitraum</th>
                <th className="px-4 py-3 text-left">Gruppe</th>
                <th className="px-4 py-3 text-left">Grund</th>
                <th className="px-4 py-3 text-center">Tage</th>
                <th className="px-4 py-3 text-center">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {bans.map((ban, i) => {
                const start = ban.start_date ? new Date(ban.start_date) : null;
                const end = ban.end_date ? new Date(ban.end_date) : null;
                const days = start && end
                  ? Math.round((end.getTime() - start.getTime()) / 86400000) + 1
                  : 0;
                return (
                  <tr key={ban.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-red-50`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-red-700 flex items-center gap-2">
                        <span>🚫</span>
                        {formatDateRange(ban.start_date, ban.end_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{ban.group_name || groupName(ban.group_id)}</td>
                    <td className="px-4 py-3 text-gray-600">{ban.reason || <span className="text-gray-300 italic">Kein Grund angegeben</span>}</td>
                    <td className="px-4 py-3 text-center text-gray-600 font-semibold">{days}</td>
                    <td className="px-4 py-3 text-center">
                      {canEditAbsences && (
                      <button onClick={() => deleteBan(ban.id)} disabled={deleting === ban.id}
                        className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50">
                        {deleting === ban.id ? '⟳' : '🗑️'}
                      </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info box */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-2">
        <span className="text-base flex-shrink-0">ℹ️</span>
        <span>Urlaubssperren verhindern die Genehmigung von Urlaubsanträgen in gesperrten Zeiträumen.
          Gesperrte Tage werden im Kalender rot/schraffiert angezeigt.</span>
      </div>
    </div>
  );
}

// ─── Tab 4: Anträge (Genehmigung / Ablehnung) ────────────────
type AbsenceStatus = 'pending' | 'approved' | 'rejected';

interface AntraegeTabProps {
  year: number;
  employees: Employee[];
  leaveTypes: LeaveType[];
  absences: Absence[];
  loading: boolean;
}

function AntraegeTab({ year, employees, leaveTypes, absences, loading }: AntraegeTabProps) {
  const [statusMap, setStatusMap] = useState<Record<string, AbsenceStatus>>({});
  const [statusLoading, setStatusLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<AbsenceStatus | ''>('pending');
  const [search, setSearch] = useState('');

  // Load status from backend
  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`${API}/api/absences/status`, { headers: getAuthHeaders() });
      if (res.ok) setStatusMap(await res.json());
    } catch { /* ignore */ } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const getStatus = (id: number): AbsenceStatus =>
    (statusMap[String(id)] as AbsenceStatus) ?? 'pending';

  const updateStatus = async (id: number, status: AbsenceStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API}/api/absences/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setStatusMap(prev => ({ ...prev, [String(id)]: status }));
      }
    } catch { /* ignore */ } finally {
      setUpdatingId(null);
    }
  };

  const getEmp = (id: number) => employees.find(e => e.ID === id);
  const getLT = (id: number) => leaveTypes.find(lt => lt.ID === id);

  // Filter absences by year, search, and status filter
  const filtered = absences.filter(a => {
    if (!a.DATE?.startsWith(String(year))) return false;
    const emp = getEmp(a.EMPLOYEE_ID);
    const empName = emp ? `${emp.NAME} ${emp.FIRSTNAME}` : '';
    if (search && !empName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== '' && getStatus(a.ID) !== filterStatus) return false;
    return true;
  }).sort((a, b) => b.DATE.localeCompare(a.DATE));

  const statusBadge = (status: AbsenceStatus) => {
    if (status === 'approved') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✅ Genehmigt</span>;
    if (status === 'rejected') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">❌ Abgelehnt</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">⏳ Beantragt</span>;
  };

  const pendingCount = absences.filter(a => a.DATE?.startsWith(String(year)) && getStatus(a.ID) === 'pending').length;

  return (
    <div>
      {/* Summary + Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as AbsenceStatus | '')}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Alle Status</option>
          <option value="pending">⏳ Beantragt ({pendingCount})</option>
          <option value="approved">✅ Genehmigt</option>
          <option value="rejected">❌ Abgelehnt</option>
        </select>
        <input
          type="text"
          placeholder="Mitarbeiter suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border rounded shadow-sm text-sm w-44"
        />
        <span className="text-xs text-gray-400">{filtered.length} Einträge</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="bg-slate-700 text-white text-xs">
              <th className="px-4 py-3 text-left">Mitarbeiter</th>
              <th className="px-4 py-3 text-left">Datum</th>
              <th className="px-4 py-3 text-left">Abwesenheitsart</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {(loading || statusLoading) && (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">⟳ Lade...</td></tr>
            )}
            {!loading && !statusLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Keine Einträge gefunden</td></tr>
            )}
            {!loading && !statusLoading && filtered.map((ab, i) => {
              const emp = getEmp(ab.EMPLOYEE_ID);
              const lt = getLT(ab.LEAVE_TYPE_ID);
              const status = getStatus(ab.ID);
              const isUpdating = updatingId === ab.ID;
              return (
                <tr key={ab.ID} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-gray-800">
                      {emp ? `${emp.NAME}, ${emp.FIRSTNAME}` : `MA #${ab.EMPLOYEE_ID}`}
                    </div>
                    <div className="text-xs text-gray-400">{emp?.NUMBER}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {new Date(ab.DATE).toLocaleDateString('de-AT')}
                  </td>
                  <td className="px-4 py-2.5">
                    {lt ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ backgroundColor: lt.COLORBK_HEX, color: lt.COLORBK_LIGHT ? '#374151' : '#fff' }}
                      >
                        {lt.SHORTNAME} – {lt.NAME}
                      </span>
                    ) : (
                      <span className="text-gray-400">Art #{ab.LEAVE_TYPE_ID}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {statusBadge(status)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {status === 'pending' ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => updateStatus(ab.ID, 'approved')}
                          disabled={isUpdating}
                          className="px-2.5 py-1 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                          title="Genehmigen"
                        >
                          {isUpdating ? '⟳' : '✅ Genehmigen'}
                        </button>
                        <button
                          onClick={() => updateStatus(ab.ID, 'rejected')}
                          disabled={isUpdating}
                          className="px-2.5 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                          title="Ablehnen"
                        >
                          {isUpdating ? '⟳' : '❌ Ablehnen'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => updateStatus(ab.ID, 'pending')}
                        disabled={isUpdating}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border rounded hover:bg-gray-50 disabled:opacity-60"
                        title="Zurücksetzen"
                      >
                        {isUpdating ? '⟳' : '↺ Zurücksetzen'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-start gap-2">
        <span className="text-base flex-shrink-0">ℹ️</span>
        <span>
          Der Genehmigungsstatus wird lokal im System gespeichert und hat keinen Einfluss auf die Abwesenheitseinträge in der Datenbank.
          Abwesenheiten mit Status "Beantragt" sind noch zu bearbeiten.
        </span>
      </div>
    </div>
  );
}


// ─── Tab 5: Urlaub-Timeline (Gantt-View) ─────────────────────
interface TimelineTabProps {
  year: number;
  employees: Employee[];
  leaveTypes: LeaveType[];
  absences: Absence[];
  groups: Group[];
  loading: boolean;
}

function TimelineTab({ year, employees, leaveTypes, absences, loading }: TimelineTabProps) {
  const [filterLeaveType, setFilterLeaveType] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [tooltip, setTooltip] = useState<{x: number; y: number; text: string} | null>(null);

  const MONTH_DAYS = Array.from({length: 12}, (_, m) =>
    new Date(year, m + 1, 0).getDate()
  );
  const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  // Build a lookup: "employeeId_YYYY-MM-DD" → absence
  const absMap = useMemo(() => {
    const m = new Map<string, Absence>();
    absences.forEach(a => {
      const date = (a.DATE ?? (a as any).date ?? '');
      const eid = a.EMPLOYEE_ID ?? (a as any).employee_id;
      if (date && eid) m.set(`${eid}_${date}`, a);
    });
    return m;
  }, [absences]);

  // Count per employee
  const countByEmployee = useMemo(() => {
    const c = new Map<number, number>();
    absences.forEach(a => {
      const eid = a.EMPLOYEE_ID ?? (a as any).employee_id;
      if (!eid || eid < 0) return;
      if (filterLeaveType && (a.LEAVE_TYPE_ID ?? (a as any).leave_type_id) !== filterLeaveType) return;
      c.set(eid, (c.get(eid) ?? 0) + 1);
    });
    return c;
  }, [absences, filterLeaveType]);

  const filteredEmployees = useMemo(() => employees.filter(e => {
    if (search && !(`${e.FIRSTNAME} ${e.NAME}`).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [employees, search]);

  const getLT = (id: number) => leaveTypes.find(lt => lt.ID === id);

  // Used leave types in current data
  const usedLeaveTypeIds = useMemo(() => {
    const ids = new Set<number>();
    absences.forEach(a => {
      const eid = a.EMPLOYEE_ID ?? (a as any).employee_id;
      if (eid && eid > 0) ids.add(a.LEAVE_TYPE_ID ?? (a as any).leave_type_id);
    });
    return ids;
  }, [absences]);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin text-3xl">⏳</div></div>;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="🔍 Mitarbeiter suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border rounded-lg w-48"
        />
        <select
          value={filterLeaveType ?? ''}
          onChange={e => setFilterLeaveType(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-1.5 text-sm border rounded-lg"
        >
          <option value="">Alle Abwesenheitsarten</option>
          {leaveTypes.filter(lt => usedLeaveTypeIds.has(lt.ID)).map(lt => (
            <option key={lt.ID} value={lt.ID}>{lt.NAME}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filteredEmployees.length} Mitarbeiter</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {leaveTypes.filter(lt => usedLeaveTypeIds.has(lt.ID)).map(lt => (
          <span key={lt.ID} className="flex items-center gap-1 px-2 py-0.5 rounded-full border"
            style={{backgroundColor: lt.COLORBK_HEX ?? '#e5e7eb', color: lt.COLORBK_LIGHT ? '#333' : '#fff'}}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{backgroundColor: lt.COLORBAR_HEX ?? lt.COLORBK_HEX ?? '#aaa'}}></span>
            {lt.SHORTNAME} = {lt.NAME}
          </span>
        ))}
      </div>

      {/* Gantt Grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="text-xs w-full border-collapse" style={{minWidth: '900px'}}>
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="sticky left-0 z-10 bg-gray-100 text-left px-3 py-2 font-semibold text-gray-700 min-w-[160px] border-r">
                Mitarbeiter
              </th>
              {MONTH_NAMES.map((m, mi) => (
                <th key={mi} colSpan={MONTH_DAYS[mi]}
                  className="text-center font-semibold text-gray-600 py-1 border-r border-gray-300"
                  style={{minWidth: `${MONTH_DAYS[mi] * 8}px`}}>
                  {m}
                </th>
              ))}
              <th className="text-center px-2 py-2 font-semibold text-gray-700 min-w-[40px]">∑</th>
            </tr>
            <tr className="bg-gray-50 border-b">
              <th className="sticky left-0 z-10 bg-gray-50 border-r"></th>
              {MONTH_NAMES.map((_, mi) =>
                Array.from({length: MONTH_DAYS[mi]}, (__, d) => (
                  <th key={`${mi}-${d}`}
                    className={`text-center font-normal py-0.5 border-r border-gray-100 ${
                      new Date(year, mi, d + 1).getDay() === 0 || new Date(year, mi, d + 1).getDay() === 6
                        ? 'bg-gray-200 text-gray-400' : 'text-gray-300'
                    }`}
                    style={{width: '8px', fontSize: '7px', padding: '1px 0'}}>
                    {d + 1 === 1 || d + 1 === 5 || d + 1 === 10 || d + 1 === 15 || d + 1 === 20 || d + 1 === 25 ? d + 1 : ''}
                  </th>
                ))
              )}
              <th className="border-r"></th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={366 + 2} className="text-center text-gray-400 py-8">
                  Keine Mitarbeiter gefunden
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp, rowIdx) => {
                const empCount = countByEmployee.get(emp.ID) ?? 0;
                return (
                  <tr key={emp.ID}
                    className={`border-b transition-colors hover:bg-blue-50/30 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className={`sticky left-0 z-10 px-3 py-1 border-r font-medium text-gray-800 whitespace-nowrap ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      {emp.FIRSTNAME} {emp.NAME}
                    </td>
                    {MONTH_NAMES.map((_, mi) =>
                      Array.from({length: MONTH_DAYS[mi]}, (__, d) => {
                        const dayNum = d + 1;
                        const dateStr = `${year}-${String(mi + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
                        const absence = absMap.get(`${emp.ID}_${dateStr}`);
                        const isWeekend = new Date(year, mi, dayNum).getDay() === 0 || new Date(year, mi, dayNum).getDay() === 6;
                        const lt = absence ? getLT(absence.LEAVE_TYPE_ID ?? (absence as any).leave_type_id) : null;
                        const show = !filterLeaveType || !absence || (absence.LEAVE_TYPE_ID ?? (absence as any).leave_type_id) === filterLeaveType;

                        return (
                          <td key={`${mi}-${d}`}
                            style={{
                              width: '8px',
                              minWidth: '8px',
                              maxWidth: '8px',
                              padding: 0,
                              backgroundColor: absence && show && lt
                                ? (lt.COLORBAR_HEX ?? lt.COLORBK_HEX ?? '#3b82f6')
                                : isWeekend ? '#f3f4f6' : undefined,
                            }}
                            className={`border-r border-gray-100 ${absence && show ? 'cursor-pointer' : ''}`}
                            onMouseEnter={absence && show && lt ? (e) => {
                              setTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                text: `${emp.FIRSTNAME} ${emp.NAME}\n${new Date(dateStr).toLocaleDateString('de-AT')}\n${lt.NAME}`
                              });
                            } : undefined}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        );
                      })
                    )}
                    <td className="text-center px-1 font-bold text-gray-600 border-l">
                      {empCount > 0 ? <span className="text-blue-600">{empCount}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none whitespace-pre"
          style={{left: tooltip.x + 12, top: tooltip.y - 10}}
        >
          {tooltip.text}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {leaveTypes.filter(lt => usedLeaveTypeIds.has(lt.ID)).map(lt => {
          const count = absences.filter(a => {
            const eid = a.EMPLOYEE_ID ?? (a as any).employee_id;
            return eid && eid > 0 && (a.LEAVE_TYPE_ID ?? (a as any).leave_type_id) === lt.ID;
          }).length;
          return count > 0 ? (
            <div key={lt.ID} className="bg-white rounded-xl border p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{backgroundColor: lt.COLORBK_HEX ?? '#e5e7eb', color: lt.COLORBK_LIGHT ? '#333' : '#fff',
                  border: `2px solid ${lt.COLORBAR_HEX ?? '#aaa'}`}}>
                {lt.SHORTNAME}
              </div>
              <div>
                <div className="text-lg font-bold text-gray-800">{count}</div>
                <div className="text-xs text-gray-500">{lt.NAME}</div>
              </div>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function Urlaub() {
  const currentYear = new Date().getFullYear();
  const { showToast } = useToast();
  const [year, setYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState<UrlaubTab>('antraege');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);

  // Load absences
  const loadAbsences = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/absences?year=${year}`, { headers: getAuthHeaders() });
      if (res.ok) { setAbsences(await res.json()); return; }
    } catch { /* try without year filter */ }
    try {
      const res = await fetch(`${API}/api/absences`, { headers: getAuthHeaders() });
      if (res.ok) {
        const all = await res.json() as Absence[];
        setAbsences(all.filter(a => a.DATE?.startsWith(String(year))));
      }
    } catch { setAbsences([]); }
  }, [year]);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getEmployees(), api.getLeaveTypes(), api.getGroups()])
      .then(([emps, lts, grps]) => {
        setEmployees(emps);
        setLeaveTypes(lts);
        setGroups(grps);
      })
      .catch(e => showToast(String(e), 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAbsences(); }, [loadAbsences]);

  const tabs: { id: UrlaubTab; label: string; icon: string }[] = [
    { id: 'antraege', label: 'Anträge', icon: '✅' },
    { id: 'abwesenheiten', label: 'Abwesenheiten', icon: '📋' },
    { id: 'ansprueche', label: 'Urlaubsansprüche', icon: '📊' },
    { id: 'sperren', label: 'Urlaubssperren', icon: '🚫' },
    { id: 'timeline', label: 'Jahres-Timeline', icon: '📅' },
  ];

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🏖️ Urlaubsverwaltung</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ansprüche, Abwesenheiten und Sperrzeiten</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="px-2 py-1.5 min-w-[32px] rounded border hover:bg-gray-50 text-sm">‹</button>
          <span className="px-3 py-1 font-bold text-gray-800 text-sm">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-2 py-1.5 min-w-[32px] rounded border hover:bg-gray-50 text-sm">›</button>
          <button
            onClick={() => window.print()}
            className="no-print ml-2 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 sm:gap-1 mb-4 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white border border-b-white text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            <span>{tab.icon}</span> <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'antraege' && (
        <AntraegeTab year={year} employees={employees} leaveTypes={leaveTypes}
          absences={absences} loading={loading} />
      )}
      {activeTab === 'abwesenheiten' && (
        <AbwesenheitenTab year={year} employees={employees} leaveTypes={leaveTypes}
          absences={absences} setAbsences={setAbsences} loading={loading} />
      )}
      {activeTab === 'ansprueche' && (
        <AnsprüecheTab year={year} employees={employees} groups={groups} />
      )}
      {activeTab === 'sperren' && (
        <SperrenTab groups={groups} />
      )}
      {activeTab === 'timeline' && (
        <TimelineTab year={year} employees={employees} leaveTypes={leaveTypes}
          absences={absences} groups={groups} loading={loading} />
      )}
    </div>
  );
}
