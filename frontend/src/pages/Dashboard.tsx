import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  DashboardSummary,
  DashboardToday,
  DashboardUpcoming,
  DashboardStats,
} from '../api/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatDateDE(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formatHolidayDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: 'long' });
}

function formatHoursSign(h: number): string {
  const sign = h < 0 ? '−' : '+';
  return `${sign}${Math.abs(h).toFixed(1)} h`;
}

function isCurrentMonth(year: number, month: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() + 1 === month;
}

const MONTH_NAMES_DE = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-2 w-32" />
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-3">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray' | 'teal';
}

const accentMap: Record<string, { bg: string; text: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
  gray:   { bg: 'bg-gray-50',   text: 'text-gray-600' },
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-600' },
};

function KpiCard({ icon, label, value, sub, accent = 'blue' }: KpiCardProps) {
  const ac = accentMap[accent] ?? accentMap.blue;
  return (
    <div className={`rounded-xl shadow p-5 flex flex-col gap-1 ${ac.bg}`}>
      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-3xl font-black ${ac.text}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

// ── Widget wrapper ────────────────────────────────────────────────────────────

function Widget({
  title,
  icon,
  children,
  className = '',
  badge,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
  badge?: string | number;
}) {
  return (
    <div className={`bg-white rounded-xl shadow p-5 flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold text-gray-700 text-sm flex-1">{title}</h2>
        {badge !== undefined && (
          <span className="text-xs font-bold bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 italic text-center py-2">{text}</p>;
}

// ── "Heute im Dienst" Widget ──────────────────────────────────────────────────

function TodayOnDutyWidget({ todayData }: { todayData: DashboardToday | null }) {
  if (!todayData) return <WidgetSkeleton />;
  const { on_duty } = todayData;

  return (
    <Widget title="Heute im Dienst" icon="👷" badge={on_duty.length}>
      {on_duty.length === 0 ? (
        <Empty text="Heute sind keine Mitarbeiter eingeplant." />
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto">
          {on_duty.map((emp) => (
            <li
              key={emp.employee_id}
              className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5"
              style={{ background: emp.color_bk + '18' }}
            >
              <span
                className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold min-w-[2.5rem] shrink-0"
                style={{ background: emp.color_bk, color: emp.color_text }}
              >
                {emp.shift_short || '–'}
              </span>
              <span className="flex-1 font-medium text-gray-700 truncate">
                {emp.employee_name}
              </span>
              {emp.workplace_name && (
                <span className="text-xs text-gray-400 shrink-0 hidden sm:block truncate max-w-[80px]">
                  {emp.workplace_name}
                </span>
              )}
              <span className="text-xs text-gray-400 shrink-0 font-mono">
                {emp.employee_short}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

// ── "Abwesenheiten heute" Widget ──────────────────────────────────────────────

function TodayAbsencesWidget({ todayData }: { todayData: DashboardToday | null }) {
  if (!todayData) return <WidgetSkeleton />;
  const { absences } = todayData;

  return (
    <Widget title="Abwesenheiten heute" icon="🏥" badge={absences.length}>
      {absences.length === 0 ? (
        <Empty text="Keine Abwesenheiten für heute. ✅" />
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto">
          {absences.map((emp) => (
            <li
              key={emp.employee_id}
              className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 bg-orange-50"
            >
              <span
                className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold min-w-[3rem] shrink-0"
                style={{ background: emp.color_bk, color: emp.color_text || '#fff' }}
              >
                {emp.leave_name.substring(0, 5) || '—'}
              </span>
              <span className="flex-1 font-medium text-gray-700 truncate">
                {emp.employee_name}
              </span>
              <span className="text-xs text-gray-400 shrink-0 font-mono">
                {emp.employee_short}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

// ── "Nächste Feiertage" Widget ────────────────────────────────────────────────

function UpcomingHolidaysWidget({ upcomingData }: { upcomingData: DashboardUpcoming | null }) {
  if (!upcomingData) return <WidgetSkeleton />;
  const { holidays } = upcomingData;

  return (
    <Widget title="Nächste Feiertage" icon="🎉">
      {holidays.length === 0 ? (
        <Empty text="Keine Feiertage in der Datenbank hinterlegt." />
      ) : (
        <ul className="space-y-2.5">
          {holidays.map((h, i) => {
            const today = new Date().toISOString().split('T')[0];
            const diffDays = Math.round(
              (new Date(h.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime())
              / 86400000
            );
            return (
              <li key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 flex flex-col items-center justify-center text-xs font-bold text-indigo-600">
                  <span className="text-base leading-none">
                    {new Date(h.date + 'T00:00:00').getDate()}
                  </span>
                  <span className="text-[9px] leading-none text-indigo-400">
                    {MONTH_NAMES_DE[new Date(h.date + 'T00:00:00').getMonth() + 1]?.substring(0, 3) ?? ''}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-800 truncate">{h.name}</div>
                  <div className="text-xs text-gray-400">{formatHolidayDate(h.date)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    diffDays === 0
                      ? 'bg-green-100 text-green-700'
                      : diffDays <= 7
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diffDays === 0 ? 'Heute' : diffDays === 1 ? 'Morgen' : `in ${diffDays}d`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

// ── "Geburtstage diese Woche" Widget ──────────────────────────────────────────

function BirthdaysThisWeekWidget({ upcomingData }: { upcomingData: DashboardUpcoming | null }) {
  if (!upcomingData) return <WidgetSkeleton />;
  const { birthdays_this_week } = upcomingData;

  return (
    <Widget title="Geburtstage diese Woche" icon="🎂" badge={birthdays_this_week.length}>
      {birthdays_this_week.length === 0 ? (
        <Empty text="Keine Geburtstage diese Woche." />
      ) : (
        <ul className="space-y-2">
          {birthdays_this_week.map((b) => (
            <li key={b.employee_id} className="flex items-center gap-2 text-sm">
              <span className="text-xl">
                {b.days_until === 0 ? '🎂' : '🎁'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-700 truncate">{b.name}</div>
                <div className="text-xs text-gray-400">{b.display_date}</div>
              </div>
              {b.days_until === 0 ? (
                <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full shrink-0">
                  Heute! 🎉
                </span>
              ) : b.days_until < 0 ? (
                <span className="text-xs text-gray-400 shrink-0">
                  {Math.abs(b.days_until)}d her
                </span>
              ) : (
                <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                  in {b.days_until}d
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

// ── CSS Bar Chart: Monatliche Abdeckung ───────────────────────────────────────

function MonthCoverageChart({ statsData }: { statsData: DashboardStats | null }) {
  if (!statsData) return <WidgetSkeleton />;
  const { coverage_by_day, month, year } = statsData;

  const maxCount = Math.max(...coverage_by_day.map((d) => d.count), 1);

  return (
    <Widget
      title={`Dienstplan-Abdeckung — ${MONTH_NAMES_DE[month]} ${year}`}
      icon="📊"
      className="col-span-1 md:col-span-2"
    >
      <div className="flex items-end gap-0.5 h-28 w-full">
        {coverage_by_day.map((d) => {
          const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
          const barColor = d.is_today
            ? '#6366f1'   // indigo for today
            : d.is_weekend
            ? '#e5e7eb'   // gray for weekends
            : d.count === 0
            ? '#fca5a5'   // light red for no coverage
            : pct >= 75
            ? '#4ade80'   // green for good coverage
            : pct >= 40
            ? '#fbbf24'   // yellow for ok
            : '#f97316';  // orange for low

          return (
            <div
              key={d.day}
              className="flex-1 flex flex-col items-center gap-0.5 group relative"
              title={`${d.day}. ${MONTH_NAMES_DE[month]}: ${d.count} Schichten${d.is_weekend ? ' (WE)' : ''}`}
            >
              {/* Bar */}
              <div className="w-full flex items-end" style={{ height: '96px' }}>
                <div
                  className="w-full rounded-t transition-all duration-500"
                  style={{
                    height: d.count === 0 ? '4px' : `${Math.max((pct / 100) * 96, 4)}px`,
                    background: barColor,
                    opacity: d.is_weekend && !d.is_today ? 0.6 : 1,
                  }}
                />
              </div>
              {/* Day label */}
              <span
                className={`text-[8px] font-medium select-none ${
                  d.is_today
                    ? 'text-indigo-600 font-black'
                    : d.is_weekend
                    ? 'text-gray-400'
                    : 'text-gray-500'
                }`}
              >
                {d.day}
              </span>

              {/* Tooltip */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                {WEEKDAY_SHORT[d.weekday]} {d.day}. | {d.count}
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-1 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#4ade80] inline-block" />
          Gut belegt
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#fbbf24] inline-block" />
          Mittel
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#f97316] inline-block" />
          Niedrig
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#fca5a5] inline-block" />
          Leer
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#6366f1] inline-block" />
          Heute
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#e5e7eb] inline-block" />
          Wochenende
        </span>
      </div>
    </Widget>
  );
}

// ── Staffing Warnings widget ──────────────────────────────────────────────────

function StaffingWarnings({ warnings }: { warnings: DashboardSummary['staffing_warnings'] }) {
  if (warnings.length === 0) {
    return <Empty text="Keine Unterbesetzungen in den nächsten 7 Tagen. ✅" />;
  }
  return (
    <ul className="space-y-1.5 max-h-52 overflow-y-auto">
      {warnings.map((w, i) => (
        <li
          key={i}
          className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-red-50 border border-red-100"
        >
          <span className="text-base">⚠️</span>
          <span className="font-medium text-red-700">{w.shift}</span>
          <span className="text-gray-500 text-xs">{formatDateDE(w.date)}</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="font-bold text-red-600">{w.actual}</span>
            <span className="text-gray-400 text-xs">/ {w.required}</span>
            <span className="text-gray-400 text-xs">geplant</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Zeitkonto Alerts widget ───────────────────────────────────────────────────

function ZeitkontoAlerts({ alerts }: { alerts: DashboardSummary['zeitkonto_alerts'] }) {
  if (alerts.length === 0) {
    return <Empty text="Keine Zeitkonto-Warnung diesen Monat. 👍" />;
  }
  const top5 = alerts.slice(0, 5);
  const worst = Math.abs(top5[0]?.hours_diff ?? 1);

  return (
    <ul className="space-y-1.5">
      {top5.map((a, i) => {
        const pct = worst > 0 ? Math.abs(a.hours_diff) / worst : 0;
        return (
          <li key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700 truncate max-w-[160px]">
                {a.employee}
              </span>
              <span className="font-bold text-red-600 shrink-0">
                {formatHoursSign(a.hours_diff)}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-red-400 h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
      {alerts.length > 5 && (
        <p className="text-xs text-gray-400 text-right">
          + {alerts.length - 5} weitere Mitarbeiter
        </p>
      )}
    </ul>
  );
}

// ── Absences by type widget ───────────────────────────────────────────────────

function AbsencesByType({ data }: { data: DashboardSummary['absences_this_month'] }) {
  if (data.total === 0) {
    return <Empty text="Keine Abwesenheiten diesen Monat." />;
  }
  return (
    <div className="flex flex-col gap-2">
      {data.by_type.map((t) => (
        <div key={t.short} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white shrink-0"
            style={{ background: t.color }}
          >
            {t.short}
          </span>
          <span className="flex-1 text-gray-600 truncate">{t.name}</span>
          <span className="font-bold text-gray-700 shrink-0">{t.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Month Navigator ───────────────────────────────────────────────────────────

function MonthNav({
  year,
  month,
  label,
  onPrev,
  onNext,
  disableNext,
}: {
  year: number;
  month: number;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  disableNext: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Vorheriger Monat"
      >
        ‹
      </button>
      <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
        {label || `${month}/${year}`}
      </span>
      <button
        onClick={onNext}
        disabled={disableNext}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Nächster Monat"
      >
        ›
      </button>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { year: todayYear, month: todayMonth } = todayYearMonth();
  const [year, setYear] = useState(todayYear);
  const [month, setMonth] = useState(todayMonth);
  const [summaryData, setSummaryData] = useState<DashboardSummary | null>(null);
  const [todayData, setTodayData] = useState<DashboardToday | null>(null);
  const [upcomingData, setUpcomingData] = useState<DashboardUpcoming | null>(null);
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(null);

    const summaryP = api.getDashboardSummary(year, month);
    const todayP = api.getDashboardToday();
    const upcomingP = api.getDashboardUpcoming();
    const statsP = api.getDashboardStats();

    Promise.all([summaryP, todayP, upcomingP, statsP])
      .then(([summary, today, upcoming, stats]) => {
        setSummaryData(summary);
        setTodayData(today);
        setUpcomingData(upcoming);
        setStatsData(stats);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const isCurrentMon = isCurrentMonth(year, month);
  const cov = summaryData?.shifts_this_month.coverage_pct ?? 0;
  const covAccent: KpiCardProps['accent'] =
    cov >= 80 ? 'green' : cov >= 50 ? 'orange' : 'red';

  const todayLocale = new Date().toLocaleDateString('de-AT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📊 Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">{todayLocale}</p>
        </div>
        <MonthNav
          year={year}
          month={month}
          label={summaryData?.month_label ?? ''}
          onPrev={prevMonth}
          onNext={nextMonth}
          disableNext={isCurrentMon}
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          ⚠️ Fehler beim Laden der Dashboard-Daten: {error}
          <button
            onClick={fetchAll}
            className="ml-3 underline hover:no-underline"
          >
            Nochmals versuchen
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              icon="👥"
              label="Mitarbeiter"
              value={statsData?.total_employees ?? summaryData?.employees.total ?? '—'}
              sub={`${summaryData?.groups ?? 0} Gruppen`}
              accent="blue"
            />
            <KpiCard
              icon="🕐"
              label={isCurrentMon ? 'Schichten heute' : 'Schichten geplant'}
              value={
                isCurrentMon
                  ? todayData?.on_duty_count ?? summaryData?.shifts_today.count ?? '—'
                  : statsData?.shifts_this_month ?? summaryData?.shifts_this_month.scheduled ?? '—'
              }
              sub={
                isCurrentMon
                  ? todayData
                    ? todayData.on_duty_count === 0
                      ? 'Heute noch nichts geplant'
                      : `${todayData.absences_count} Abwesenheiten`
                    : 'Lädt…'
                  : `im ${summaryData?.month_label ?? ''}`
              }
              accent="purple"
            />
            <KpiCard
              icon="🏖️"
              label="Urlaubstage verbraucht"
              value={statsData?.vacation_days_used ?? '—'}
              sub={`in ${year}`}
              accent={statsData && statsData.vacation_days_used > 0 ? 'orange' : 'gray'}
            />
            <KpiCard
              icon="📈"
              label="Auslastung"
              value={
                summaryData && summaryData.shifts_this_month.scheduled > 0
                  ? `${cov} %`
                  : '—'
              }
              sub={
                summaryData && summaryData.shifts_this_month.scheduled > 0
                  ? cov >= 80 ? 'Gut besetzt ✅' : cov >= 50 ? 'Teilweise besetzt' : 'Unterbesetzt ⚠️'
                  : 'Keine Schichtdaten'
              }
              accent={
                summaryData && summaryData.shifts_this_month.scheduled > 0
                  ? covAccent
                  : 'gray'
              }
            />
          </>
        )}
      </div>

      {/* Chart: Monatliche Abdeckung (full width) */}
      {isCurrentMon && (
        loading
          ? <WidgetSkeleton />
          : <MonthCoverageChart statsData={statsData} />
      )}

      {/* Today's grid: "Heute im Dienst" + "Abwesenheiten heute" */}
      {isCurrentMon && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TodayOnDutyWidget todayData={todayData} />
          <TodayAbsencesWidget todayData={todayData} />
        </div>
      )}

      {/* Upcoming & Birthdays */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <UpcomingHolidaysWidget upcomingData={upcomingData} />
        <BirthdaysThisWeekWidget upcomingData={upcomingData} />
      </div>

      {/* Absences + Staffing warnings + Zeitkonto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Absences by type */}
        <Widget
          title={`Abwesenheiten ${summaryData?.month_label ?? ''}`}
          icon="📋"
          badge={summaryData?.absences_this_month.total}
        >
          {loading ? (
            <WidgetSkeleton />
          ) : summaryData ? (
            <AbsencesByType data={summaryData.absences_this_month} />
          ) : null}
        </Widget>

        {/* Staffing warnings */}
        <Widget
          title={
            isCurrentMon
              ? 'Staffing-Warnungen (nächste 7 Tage)'
              : 'Staffing-Anforderungen'
          }
          icon="⚠️"
          badge={summaryData?.staffing_warnings.length ?? 0}
        >
          {loading ? (
            <WidgetSkeleton />
          ) : summaryData ? (
            <StaffingWarnings warnings={summaryData.staffing_warnings} />
          ) : null}
        </Widget>

        {/* Zeitkonto alerts */}
        <Widget
          title={`Zeitkonto-Defizit (${summaryData?.month_label ?? ''})`}
          icon="⏱️"
          badge={summaryData?.zeitkonto_alerts.length ?? 0}
        >
          {loading ? (
            <WidgetSkeleton />
          ) : summaryData ? (
            <ZeitkontoAlerts alerts={summaryData.zeitkonto_alerts} />
          ) : null}
        </Widget>

        {/* Quick stats box */}
        <Widget title="Monatsüberblick" icon="📅">
          {loading || !summaryData || !statsData ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Schichten geplant</span>
                <span className="font-bold text-gray-700">
                  {summaryData.shifts_this_month.scheduled > 0
                    ? summaryData.shifts_this_month.scheduled
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Aktive Schichtarten</span>
                <span className="font-bold text-gray-700">
                  {statsData.active_shift_types}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Abwesenheiten</span>
                <span className="font-bold text-gray-700">
                  {summaryData.absences_this_month.total > 0
                    ? summaryData.absences_this_month.total
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Urlaubstage {year}</span>
                <span className="font-bold text-gray-700">
                  {statsData.vacation_days_used}
                </span>
              </div>
              {summaryData.shifts_this_month.scheduled > 0 && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Auslastung</span>
                    <span
                      className={`font-bold ${
                        cov >= 80
                          ? 'text-green-600'
                          : cov >= 50
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {cov} %
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-700 ${
                        cov >= 80 ? 'bg-green-500' : cov >= 50 ? 'bg-yellow-400' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(cov, 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </Widget>
      </div>
    </div>
  );
}
