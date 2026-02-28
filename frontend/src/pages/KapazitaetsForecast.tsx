import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────
interface AbsentEmployee {
  id: number;
  name: string;
  absence_type: string;
}

interface DayForecast {
  day: number;
  date: string;
  weekday: number; // 0=Mon
  scheduled_count: number;
  absent_count: number;
  absent_employees: AbsentEmployee[];
  required_min: number;
  coverage_status: 'ok' | 'low' | 'critical' | 'unplanned' | 'unknown';
  conflict_flag: boolean;
  total_employees: number;
}

interface ForecastSummary {
  critical_count: number;
  low_count: number;
  conflict_count: number;
  unplanned_count: number;
  ok_count: number;
}

interface CapacityForecast {
  year: number;
  month: number;
  total_employees: number;
  days: DayForecast[];
  summary: ForecastSummary;
}

interface Group {
  ID: number;
  NAME: string;
}

// ─── Jahres-Heatmap Types ──────────────────────────────────
interface MonthCapacity {
  month: number;
  num_days: number;
  avg_staffing: number;
  coverage_pct: number;
  ok_days: number;
  low_days: number;
  critical_days: number;
  unplanned_days: number;
  planned_days: number;
  worst_status: 'ok' | 'low' | 'critical' | 'unplanned';
  total_employees: number;
}

interface YearCapacity {
  year: number;
  total_employees: number;
  months: MonthCapacity[];
}

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

const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ─── Status config ─────────────────────────────────────────
const STATUS_CONFIG = {
  ok: {
    label: 'Gut besetzt',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
    barColor: '#22c55e',
  },
  low: {
    label: 'Knapp',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-800',
    dot: 'bg-yellow-400',
    barColor: '#eab308',
  },
  critical: {
    label: 'Kritisch',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-800',
    dot: 'bg-red-500',
    barColor: '#ef4444',
  },
  unplanned: {
    label: 'Nicht geplant',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-600',
    badge: 'bg-gray-100 text-gray-500',
    dot: 'bg-gray-300',
    barColor: '#d1d5db',
  },
  unknown: {
    label: 'Unbekannt',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-600',
    badge: 'bg-gray-100 text-gray-500',
    dot: 'bg-gray-300',
    barColor: '#d1d5db',
  },
};

// ─── Tooltip ────────────────────────────────────────────────
interface TooltipProps {
  day: DayForecast;
  onClose: () => void;
}
function DayTooltip({ day, onClose }: TooltipProps) {
  const cfg = STATUS_CONFIG[day.coverage_status] ?? STATUS_CONFIG.unknown;
  const dateObj = new Date(day.date + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 rounded-t-2xl ${cfg.bg} border-b ${cfg.border}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{MONTHS[day.day <= 0 ? 0 : dateObj.getMonth()]}</p>
              <h2 className="text-2xl font-bold text-gray-800">{String(day.day).padStart(2, '0')}.</h2>
              <p className="text-sm text-gray-600 mt-0.5">{dateLabel}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold mt-1 ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-blue-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-blue-700">{day.scheduled_count}</p>
              <p className="text-xs text-blue-500 mt-0.5">Geplant</p>
            </div>
            <div className="text-center bg-orange-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-orange-700">{day.absent_count}</p>
              <p className="text-xs text-orange-500 mt-0.5">Abwesend</p>
            </div>
            <div className="text-center bg-gray-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-gray-700">{day.required_min > 0 ? day.required_min : '–'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Minimum</p>
            </div>
          </div>

          {/* Coverage bar */}
          {day.scheduled_count > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Besetzung</span>
                <span>{day.required_min > 0
                  ? `${day.scheduled_count}/${day.required_min} (${Math.round(day.scheduled_count/day.required_min*100)}%)`
                  : `${day.scheduled_count}/${day.total_employees}`}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, day.required_min > 0
                      ? (day.scheduled_count / day.required_min * 100)
                      : (day.scheduled_count / Math.max(day.total_employees, 1) * 100)
                    )}%`,
                    backgroundColor: cfg.barColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* Conflict warning */}
          {day.conflict_flag && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="text-amber-500">⚠️</span>
              <p className="text-xs text-amber-700 font-medium">
                Urlaubskonflikt: {day.absent_count} Abwesenheiten (&gt;30% des Teams)
              </p>
            </div>
          )}

          {/* Absent list */}
          {day.absent_employees.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Abwesend</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {day.absent_employees.map((emp, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-sm text-gray-700 truncate">{emp.name}</span>
                    <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {emp.absence_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {day.absent_employees.length === 0 && day.scheduled_count === 0 && (
            <p className="text-sm text-gray-600 text-center py-2">Noch keine Planung für diesen Tag</p>
          )}
        </div>

        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-600 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar grid ──────────────────────────────────────────
interface CalendarProps {
  days: DayForecast[];
  year: number;
  month: number;
  onDayClick: (day: DayForecast) => void;
}

function CalendarGrid({ days, year, month, onDayClick }: CalendarProps) {
  // Build 7-column calendar
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // shift to Mon=0

  const cells: (DayForecast | null)[] = Array(startOffset).fill(null).concat(days);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-1 min-w-[480px]">
        {/* Header */}
        {WEEKDAY_SHORT.map(wd => (
          <div key={wd} className="text-center text-xs font-semibold text-gray-600 uppercase py-1.5">{wd}</div>
        ))}

        {/* Cells */}
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="h-16 rounded-xl" />;
          const cfg = STATUS_CONFIG[day.coverage_status] ?? STATUS_CONFIG.unknown;
          const isWeekend = day.weekday >= 5;
          return (
            <button
              key={day.date}
              onClick={() => onDayClick(day)}
              className={`
                relative h-16 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-md cursor-pointer text-left p-1.5
                ${cfg.bg} ${day.conflict_flag ? 'border-amber-400' : cfg.border}
                ${isWeekend ? 'opacity-75' : ''}
              `}
              title={`${day.date}: ${day.scheduled_count} geplant, ${day.absent_count} abwesend`}
            >
              {/* Day number */}
              <span className={`text-xs font-bold ${cfg.text}`}>{day.day}</span>

              {/* Conflict badge */}
              {day.conflict_flag && (
                <span className="absolute top-1 right-1 text-[10px]">⚠️</span>
              )}

              {/* Stats */}
              <div className="absolute bottom-1 left-1 right-1">
                <div className="flex items-center justify-between gap-0.5">
                  {day.coverage_status !== 'unplanned' && day.coverage_status !== 'unknown' ? (
                    <>
                      <span className="text-[11px] font-bold text-blue-600">{day.scheduled_count}</span>
                      {day.absent_count > 0 && (
                        <span className="text-[10px] text-orange-500">-{day.absent_count}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-300">–</span>
                  )}
                </div>
                {/* Mini coverage bar */}
                {day.coverage_status !== 'unplanned' && day.total_employees > 0 && (
                  <div className="h-1 bg-gray-200 rounded-full mt-0.5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, day.scheduled_count / Math.max(day.total_employees, 1) * 100)}%`,
                        backgroundColor: cfg.barColor,
                      }}
                    />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Problem Days List ──────────────────────────────────────
interface ProblemDayProps {
  days: DayForecast[];
  onDayClick: (day: DayForecast) => void;
}
function ProblemDays({ days, onDayClick }: ProblemDayProps) {
  const problems = days.filter(d =>
    d.coverage_status === 'critical' || d.coverage_status === 'low' || d.conflict_flag
  );
  if (problems.length === 0) {
    return (
      <div className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3 border border-green-200">
        <span className="text-2xl">✅</span>
        <p className="text-sm text-green-700 font-medium">Keine kritischen Tage in diesem Monat</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {problems.map(day => {
        const cfg = STATUS_CONFIG[day.coverage_status] ?? STATUS_CONFIG.unknown;
        const dateObj = new Date(day.date + 'T00:00:00');
        const label = dateObj.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'short' });
        return (
          <button
            key={day.date}
            onClick={() => onDayClick(day)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border ${cfg.bg} ${cfg.border} hover:shadow-sm transition-all text-left`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${day.conflict_flag ? 'bg-amber-400' : cfg.dot}`} />
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {day.conflict_flag && (
                <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">Urlaubskonflikt</span>
              )}
              {(day.coverage_status === 'critical' || day.coverage_status === 'low') && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
              )}
              <span className="text-xs text-gray-500">{day.scheduled_count} MA</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Wochentag-Analyse ──────────────────────────────────────
interface WeekdayAnalysisProps {
  days: DayForecast[];
  totalEmployees: number;
}
function WeekdayAnalysis({ days, totalEmployees }: WeekdayAnalysisProps) {
  const WEEKDAY_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  // Aggregate per weekday
  const byWeekday: Record<number, { counts: number[]; absences: number[]; statuses: string[] }> = {};
  for (let wd = 0; wd < 7; wd++) {
    byWeekday[wd] = { counts: [], absences: [], statuses: [] };
  }
  for (const day of days) {
    if (day.coverage_status !== 'unplanned') {
      byWeekday[day.weekday].counts.push(day.scheduled_count);
      byWeekday[day.weekday].absences.push(day.absent_count);
      byWeekday[day.weekday].statuses.push(day.coverage_status);
    }
  }

  const stats = WEEKDAY_FULL.map((name, wd) => {
    const { counts, absences, statuses } = byWeekday[wd];
    if (counts.length === 0) return { name, wd, avg: 0, min: 0, max: 0, avgAbsence: 0, criticalCount: 0, occurrences: 0 };
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const avgAbsence = absences.reduce((a, b) => a + b, 0) / absences.length;
    const criticalCount = statuses.filter(s => s === 'critical' || s === 'low').length;
    return {
      name, wd,
      avg: Math.round(avg * 10) / 10,
      min: Math.min(...counts),
      max: Math.max(...counts),
      avgAbsence: Math.round(avgAbsence * 10) / 10,
      criticalCount,
      occurrences: counts.length,
    };
  });

  const maxAvg = Math.max(...stats.map(s => s.avg), 1);

  return (
    <div className="space-y-3">
      {stats.map(s => {
        const isWeekend = s.wd >= 5;
        const pct = (s.avg / Math.max(totalEmployees, 1)) * 100;
        const barColor = s.criticalCount > 1 ? '#ef4444' : s.criticalCount === 1 ? '#eab308' : '#22c55e';
        const barWidth = (s.avg / maxAvg) * 100;

        if (s.occurrences === 0) {
          return (
            <div key={s.wd} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isWeekend ? 'bg-gray-50 opacity-60' : 'bg-white border border-gray-100'}`}>
              <span className="text-sm font-medium text-gray-600 w-24 flex-shrink-0">{s.name}</span>
              <span className="text-xs text-gray-300 italic">Keine Daten</span>
            </div>
          );
        }

        return (
          <div key={s.wd} className={`rounded-xl border px-3 py-2.5 ${isWeekend ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold w-24 flex-shrink-0 ${isWeekend ? 'text-gray-600' : 'text-gray-700'}`}>{s.name}</span>
              {/* Bar */}
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-right">
                <span className="text-sm font-bold text-gray-700 w-8">{s.avg}</span>
                <span className="text-xs text-gray-600">({Math.round(pct)}%)</span>
              </div>
            </div>
            <div className="mt-1 ml-[7rem] flex items-center gap-3 text-xs text-gray-600">
              <span>Min: <b className="text-gray-600">{s.min}</b></span>
              <span>Max: <b className="text-gray-600">{s.max}</b></span>
              <span>Ø Abwes.: <b className="text-orange-500">{s.avgAbsence}</b></span>
              {s.criticalCount > 0 && (
                <span className="text-red-500 font-medium">⚠ {s.criticalCount}× kritisch/knapp</span>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-600 text-right">Basierend auf {days.filter(d => d.coverage_status !== 'unplanned').length} geplanten Tagen</p>
    </div>
  );
}

// ─── Jahres-Heatmap ─────────────────────────────────────────
const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTHS_FULL_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

interface YearHeatmapProps {
  yearData: YearCapacity;
  onMonthClick?: (month: number) => void;
}
function YearHeatmap({ yearData, onMonthClick }: YearHeatmapProps) {
  // maxPct unused — kept for reference
  void Math.max(...yearData.months.map(m => m.coverage_pct), 1);

  const getHeatColor = (m: MonthCapacity) => {
    if (m.planned_days === 0) return { bg: '#f3f4f6', text: '#9ca3af', border: '#e5e7eb' };
    if (m.worst_status === 'critical') return { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' };
    if (m.worst_status === 'low') return { bg: '#fefce8', text: '#ca8a04', border: '#fde047' };
    const intensity = Math.min(m.coverage_pct / 100, 1);
    const g = Math.round(80 + intensity * 100);
    return { bg: `rgb(240, ${g + 30}, 240)`.replace('240,', '240,').replace(/rgb\(.*\)/, `hsl(142, 70%, ${95 - intensity * 30}%)`), text: '#15803d', border: `hsl(142, 50%, ${80 - intensity * 20}%)` };
  };

  return (
    <div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
        {yearData.months.map(m => {
          const colors = getHeatColor(m);
          const hasData = m.planned_days > 0;
          return (
            <button
              key={m.month}
              onClick={() => onMonthClick?.(m.month)}
              className="rounded-xl border-2 p-2.5 text-center transition-all hover:scale-105 hover:shadow-md cursor-pointer"
              style={{ backgroundColor: colors.bg, borderColor: colors.border }}
              title={`${MONTHS_FULL_DE[m.month - 1]}: Ø ${m.avg_staffing} MA (${m.coverage_pct}%)`}
            >
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{MONTHS_DE[m.month - 1]}</p>
              {hasData ? (
                <>
                  <p className="text-lg font-bold mt-1" style={{ color: colors.text }}>{m.coverage_pct}%</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Ø {m.avg_staffing} MA</p>
                  <div className="mt-1.5 flex justify-center gap-0.5">
                    {m.critical_days > 0 && (
                      <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded-full">{m.critical_days}✗</span>
                    )}
                    {m.low_days > 0 && (
                      <span className="text-[9px] bg-yellow-100 text-yellow-600 px-1 rounded-full">{m.low_days}⚠</span>
                    )}
                    {m.critical_days === 0 && m.low_days === 0 && (
                      <span className="text-[9px] text-green-500">✓</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-300 mt-2">–</p>
              )}
            </button>
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 items-center text-xs text-gray-500">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-200 border border-green-300" /><span>Gut besetzt</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /><span>Knapp</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-100 border border-red-300" /><span>Kritisch</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" /><span>Nicht geplant</span></div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function KapazitaetsForecast() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [groupId, setGroupId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'monat' | 'wochentag' | 'jahresuebersicht'>('monat');
  const [forecast, setForecast] = useState<CapacityForecast | null>(null);
  const [yearData, setYearData] = useState<YearCapacity | null>(null);
  const [yearLoading, setYearLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayForecast | null>(null);

  // Load groups
  useEffect(() => {
    fetch(`${BASE_URL}/api/groups`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setGroups(d))
      .catch(() => {});
  }, []);

  // Load forecast
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (groupId) params.set('group_id', String(groupId));
      const res = await fetch(`${BASE_URL}/api/capacity-forecast?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setForecast(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [year, month, groupId]);

  useEffect(() => { load(); }, [load]);

  // Load year data
  const loadYear = useCallback(async () => {
    setYearLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (groupId) params.set('group_id', String(groupId));
      const res = await fetch(`${BASE_URL}/api/capacity-year?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setYearData(data);
    } catch { /* ignore */ } finally {
      setYearLoading(false);
    }
  }, [year, groupId]);

  useEffect(() => {
    if (activeTab === 'jahresuebersicht') loadYear();
  }, [activeTab, loadYear]);

  // Navigation
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const summary = forecast?.summary;

  // Calculate avg coverage for "current" month bar
  const avgCoverage = forecast && forecast.days.length > 0
    ? Math.round(
        forecast.days.filter(d => d.coverage_status !== 'unplanned').reduce((s, d) => s + d.scheduled_count, 0) /
        Math.max(1, forecast.days.filter(d => d.coverage_status !== 'unplanned').length)
      )
    : 0;

  return (
    <div className="flex flex-col gap-6 p-4 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📊 Kapazitäts-Forecast
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monatsvorschau: Besetzung, Abwesenheiten & Konflikt-Erkennung
          </p>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
          >◀</button>
          <div className="min-w-[130px] text-center">
            <span className="font-semibold text-gray-800">{MONTHS[month - 1]} {year}</span>
          </div>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
          >▶</button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'monat', label: '📅 Monatsvorschau' },
          { key: 'wochentag', label: '📊 Wochentag-Analyse' },
          { key: 'jahresuebersicht', label: '🗓 Jahresübersicht' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={groupId ?? ''}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
          className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
        >
          <option value="">Alle Gruppen</option>
          {groups.map(g => (
            <option key={g.ID} value={g.ID}>{g.NAME}</option>
          ))}
        </select>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? '…' : '↻ Aktualisieren'}
        </button>
        {forecast && (
          <span className="text-xs text-gray-600 ml-1">
            {forecast.total_employees} Mitarbeiter gesamt
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Fehler beim Laden: {error}
        </div>
      )}

      {loading && !forecast && (
        <div className="text-center py-16 text-gray-600">
          <div className="text-4xl mb-3 animate-pulse">📊</div>
          <p>Lade Forecast…</p>
        </div>
      )}

      {/* ── Wochentag-Analyse Tab ── */}
      {activeTab === 'wochentag' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Wochentag-Analyse</h2>
          <p className="text-sm text-gray-500 mb-4">Durchschnittliche Besetzung pro Wochentag — {MONTHS[month - 1]} {year}</p>
          {forecast ? (
            <WeekdayAnalysis days={forecast.days} totalEmployees={forecast.total_employees} />
          ) : loading ? (
            <div className="text-center py-8 text-gray-600 animate-pulse">Lade Daten…</div>
          ) : (
            <div className="text-center py-8 text-gray-600">Keine Daten verfügbar</div>
          )}
        </div>
      )}

      {/* ── Jahresübersicht Tab ── */}
      {activeTab === 'jahresuebersicht' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Jahres-Kapazitätsübersicht {year}</h2>
          <p className="text-sm text-gray-500 mb-4">12-Monats-Überblick der durchschnittlichen Besetzung — klicken zum Navigieren</p>
          {yearLoading ? (
            <div className="text-center py-8 text-gray-600 animate-pulse">Lade Jahresdaten…</div>
          ) : yearData ? (
            <YearHeatmap
              yearData={yearData}
              onMonthClick={m => { setMonth(m); setActiveTab('monat'); }}
            />
          ) : (
            <div className="text-center py-8 text-gray-600">Keine Daten — Tab wechseln zum Laden</div>
          )}
        </div>
      )}

      {activeTab === 'monat' && forecast && (
        <>
          {/* Summary KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-green-700">{summary?.ok_count ?? 0}</p>
              <p className="text-xs text-green-500 mt-0.5">Gut besetzte Tage</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{summary?.low_count ?? 0}</p>
              <p className="text-xs text-yellow-500 mt-0.5">Knappe Tage</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-700">{summary?.critical_count ?? 0}</p>
              <p className="text-xs text-red-500 mt-0.5">Kritische Tage</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{summary?.conflict_count ?? 0}</p>
              <p className="text-xs text-amber-500 mt-0.5">Urlaubskonflikte</p>
            </div>
          </div>

          {/* Avg staffing bar */}
          {avgCoverage > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600 font-medium">Ø Tagesbesetzung</span>
                <span className="font-bold text-blue-700">
                  {avgCoverage} / {forecast.total_employees} MA
                  ({Math.round(avgCoverage / Math.max(forecast.total_employees, 1) * 100)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, avgCoverage / Math.max(forecast.total_employees, 1) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Unplanned info */}
          {(summary?.unplanned_count ?? 0) > 0 && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-xl">📋</span>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{summary?.unplanned_count} Tage</span> noch nicht geplant
              </p>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Kalender — {MONTHS[month - 1]} {year}
              </h2>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-4">
                {(['ok', 'low', 'critical', 'unplanned'] as const).map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[s].dot}`} />
                    <span className="text-xs text-gray-500">{STATUS_CONFIG[s].label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs text-gray-500">Urlaubskonflikt</span>
                </div>
              </div>

              <CalendarGrid
                days={forecast.days}
                year={year}
                month={month}
                onDayClick={setSelectedDay}
              />
            </div>

            {/* Problem days sidebar */}
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span>⚠️</span> Handlungsbedarf
                </h2>
                <ProblemDays days={forecast.days} onDayClick={setSelectedDay} />
              </div>

              {/* Per-day bar chart (top 10) */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Tagesbesetzung</h2>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {forecast.days
                    .filter(d => d.coverage_status !== 'unplanned')
                    .slice(0, 20)
                    .map(day => {
                      const cfg = STATUS_CONFIG[day.coverage_status] ?? STATUS_CONFIG.unknown;
                      const pct = forecast.total_employees > 0
                        ? Math.min(100, day.scheduled_count / forecast.total_employees * 100)
                        : 0;
                      return (
                        <button
                          key={day.date}
                          onClick={() => setSelectedDay(day)}
                          className="w-full flex items-center gap-2 text-left hover:bg-gray-50 rounded-lg px-1 py-0.5 transition-colors"
                        >
                          <span className="text-xs text-gray-600 w-6 text-right flex-shrink-0">{day.day}.</span>
                          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: cfg.barColor }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600 w-8 text-right flex-shrink-0">
                            {day.scheduled_count}
                          </span>
                          {day.conflict_flag && <span className="text-xs">⚠️</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Day detail tooltip/modal */}
      {selectedDay && (
        <DayTooltip day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}
