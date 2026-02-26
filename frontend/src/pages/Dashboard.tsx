import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type {
  DashboardSummary,
  DashboardToday,
  DashboardUpcoming,
  DashboardStats,
  WeekDayData,
  BurnoutRadarEntry,
} from '../api/client';

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

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
              {emp.startend && (
                <span className="text-xs text-gray-500 shrink-0 font-mono bg-gray-100 rounded px-1">
                  {emp.startend}
                </span>
              )}
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

// ── "Wochenpeak" Widget ───────────────────────────────────────────────────────

function WochenpeakWidget({ todayData }: { todayData: DashboardToday | null }) {
  if (!todayData) return <WidgetSkeleton />;
  const { week_days, week_peak } = todayData;

  const maxCount = Math.max(...week_days.map((d: WeekDayData) => d.count), 1);

  return (
    <Widget title="Wochenpeak — Besetzung diese Woche" icon="📈">
      <div className="flex flex-col gap-1">
        {/* Peak summary */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl font-black text-indigo-600">{week_peak.count}</span>
          <span className="text-sm text-gray-500">
            Mitarbeiter am <strong className="text-gray-700">{week_peak.day}</strong>
            {' '}({new Date(week_peak.date + 'T00:00:00').toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })})
          </span>
          {week_peak.count > 0 && <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 font-bold rounded-full px-2 py-0.5">Peak 📈</span>}
        </div>

        {/* Day bars */}
        <div className="flex items-end gap-1 h-20 w-full">
          {week_days.map((d: WeekDayData) => {
            const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
            const isPeak = d.date === week_peak.date && !d.is_weekend;
            const barColor = d.is_today
              ? '#6366f1'
              : isPeak
              ? '#10b981'
              : d.is_weekend
              ? '#e5e7eb'
              : d.count === 0
              ? '#fca5a5'
              : '#93c5fd';

            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-0.5 group relative"
                title={`${d.weekday_name}: ${d.count} Mitarbeiter`}
              >
                <div className="w-full flex items-end" style={{ height: '64px' }}>
                  <div
                    className="w-full rounded-t transition-all duration-500"
                    style={{
                      height: d.count === 0 ? '3px' : `${Math.max((pct / 100) * 64, 4)}px`,
                      background: barColor,
                    }}
                  />
                </div>
                {/* Count label */}
                {d.count > 0 && (
                  <span className="text-[9px] font-bold text-gray-600">{d.count}</span>
                )}
                {/* Day label */}
                <span
                  className={`text-[10px] font-medium select-none ${
                    d.is_today ? 'text-indigo-600 font-black' : d.is_weekend ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {d.weekday_short}
                </span>
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                  {d.weekday_name}: {d.count}
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-1">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#10b981] inline-block" />Peak</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#6366f1] inline-block" />Heute</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#93c5fd] inline-block" />Normal</span>
          {todayData.is_holiday && (
            <span className="ml-auto text-orange-500 font-bold">🎉 Heute ist Feiertag</span>
          )}
        </div>
      </div>
    </Widget>
  );
}

// ── "Besetzungs-Heatmap" Widget ───────────────────────────────────────────────

function MonthHeatmapWidget({ statsData }: { statsData: DashboardStats | null }) {
  if (!statsData) return <WidgetSkeleton />;
  const { coverage_by_day, month, year } = statsData;

  if (coverage_by_day.length === 0) return null;

  // Build calendar grid: find first day's weekday (0=Mon)
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon=0

  const maxCount = Math.max(...coverage_by_day.map((d) => d.count), 1);

  function getColor(d: { count: number; is_weekend: boolean; is_today: boolean }): string {
    if (d.is_today) return '#6366f1';
    if (d.is_weekend && d.count === 0) return '#f3f4f6';
    if (d.count === 0) return '#fee2e2';
    const pct = d.count / maxCount;
    if (pct >= 0.75) return '#4ade80';
    if (pct >= 0.5) return '#86efac';
    if (pct >= 0.25) return '#fbbf24';
    return '#f97316';
  }

  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  // Build grid cells: empty slots + day cells
  const cells: (typeof coverage_by_day[0] | null)[] = [
    ...Array(startOffset).fill(null),
    ...coverage_by_day,
  ];

  return (
    <Widget
      title={`Besetzungs-Heatmap — ${MONTH_NAMES_DE[month]} ${year}`}
      icon="🗓️"
    >
      <div className="max-w-xs mx-auto">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-gray-400">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }
          const color = getColor(cell);
          const textColor = cell.is_today || (cell.count / maxCount) >= 0.75 ? '#fff' : '#374151';
          return (
            <div
              key={cell.day}
              className={`aspect-square rounded flex flex-col items-center justify-center text-[10px] font-bold relative group cursor-default transition-transform hover:scale-110 ${cell.is_today ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
              style={{ background: color, color: textColor }}
              title={`${cell.day}. ${MONTH_NAMES_DE[month]}: ${cell.count} Schichten${cell.is_weekend ? ' (WE)' : ''}`}
            >
              <span className="leading-none">{cell.day}</span>
              {cell.count > 0 && (
                <span className="text-[8px] leading-none opacity-80">{cell.count}</span>
              )}
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                {WEEKDAY_SHORT[cell.weekday]} {cell.day}. | {cell.count}
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-2 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#4ade80] inline-block" />Sehr gut</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#86efac] inline-block" />Gut</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#fbbf24] inline-block" />Mittel</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#f97316] inline-block" />Niedrig</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#fee2e2] inline-block" />Leer</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#6366f1] inline-block" />Heute</span>
      </div>
      </div>
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

// ── Burnout-Radar Widget ──────────────────────────────────────────────────────

function BurnoutRadarWidget({ year, month }: { year: number; month: number }) {
  const [entries, setEntries] = useState<BurnoutRadarEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getBurnoutRadar({ year, month })
      .then(data => { setEntries(data); setLoading(false); })
      .catch(() => { setEntries([]); setLoading(false); });
  }, [year, month]);

  if (loading) return <WidgetSkeleton />;

  const total = (entries?.length ?? 0);

  return (
    <Widget
      title="🔥 Burnout-Radar"
      icon=""
      badge={total > 0 ? `${total} ⚠️` : undefined}
    >
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 gap-2">
          <div className="text-2xl">✅</div>
          <p className="text-sm text-green-600 font-medium">Alles im grünen Bereich!</p>
          <p className="text-xs text-gray-400">Keine Überlastungsrisiken erkannt</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries?.map(e => (
            <div
              key={e.employee_id}
              className={`rounded-lg p-2.5 border ${
                e.risk_level === 'high'
                  ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base flex-shrink-0">
                    {e.risk_level === 'high' ? '🔴' : '🟡'}
                  </span>
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">
                    {e.employee_name}
                  </span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {e.streak > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded-full font-mono font-bold whitespace-nowrap">
                      🔁 {e.streak}d
                    </span>
                  )}
                  {e.overtime_pct >= 20 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-full font-mono font-bold whitespace-nowrap">
                      ⏱ +{e.overtime_pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 ml-7">
                {e.reasons.map((r, i) => (
                  <span key={i} className="text-[11px] text-gray-500 dark:text-gray-400 mr-2">• {r}</span>
                ))}
              </div>
              {e.target_hours > 0 && (
                <div className="mt-1.5 ml-7">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 relative">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        e.overtime_pct >= 30 ? 'bg-red-500' : e.overtime_pct >= 20 ? 'bg-amber-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (e.actual_hours / (e.target_hours * 1.5)) * 100)}%` }}
                    />
                    <div
                      className="absolute top-0 h-1.5 w-0.5 bg-gray-500 dark:bg-gray-300"
                      style={{ left: `${Math.min(100, (e.target_hours / (e.target_hours * 1.5)) * 100)}%` }}
                      title={`Soll: ${e.target_hours}h`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>Ist: <span className="font-semibold text-gray-600 dark:text-gray-300">{e.actual_hours}h</span></span>
                    <span>Soll: {e.target_hours}h</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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

// ── Morning Briefing ─────────────────────────────────────────────────────────

const WEEKDAY_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTH_DE = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 14) return 'Guten Mittag';
  if (h < 18) return 'Guten Nachmittag';
  return 'Guten Abend';
}

interface MorningBriefingProps {
  todayData: DashboardToday | null;
  upcomingData: DashboardUpcoming | null;
  summaryData: DashboardSummary | null;
  loading: boolean;
}

function MorningBriefingWidget({ todayData, upcomingData, summaryData, loading }: MorningBriefingProps) {
  const now = new Date();
  const weekday = WEEKDAY_DE[now.getDay()];
  const day = now.getDate();
  const month = MONTH_DE[now.getMonth() + 1];
  const year = now.getFullYear();

  // Next holiday
  const nextHoliday = upcomingData?.holidays?.[0];
  let holidayInfo: string | null = null;
  if (nextHoliday) {
    const hDate = new Date(nextHoliday.date + 'T00:00:00');
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = hDate.getTime() - todayMidnight.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays === 0) holidayInfo = `🎉 Heute ist ${nextHoliday.name}!`;
    else if (diffDays === 1) holidayInfo = `🗓️ Morgen: ${nextHoliday.name}`;
    else if (diffDays <= 14) holidayInfo = `🗓️ ${nextHoliday.name} in ${diffDays} Tagen`;
  }

  // Birthdays today
  const birthdaysToday = (upcomingData?.birthdays_this_week ?? []).filter(b => b.days_until === 0);

  // Staffing warnings today
  const todayStr = now.toISOString().slice(0, 10);
  const todayWarnings = (summaryData?.staffing_warnings ?? []).filter(w => w.date === todayStr);

  // Absence types breakdown
  const absencesByType = (todayData?.absences ?? []).reduce<Record<string, number>>((acc, a) => {
    const key = a.absence_type ?? 'Abwesend';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const absenceSummary = Object.entries(absencesByType)
    .map(([type, count]) => `${count}× ${type}`)
    .join(', ');

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl shadow-lg p-5 animate-pulse">
        <div className="h-5 bg-slate-600 rounded w-64 mb-3" />
        <div className="h-3 bg-slate-600 rounded w-48 mb-2" />
        <div className="h-3 bg-slate-600 rounded w-56" />
      </div>
    );
  }

  const onDutyCount = todayData?.on_duty_count ?? 0;
  const absenceCount = todayData?.absences_count ?? 0;
  const isHoliday = todayData?.is_holiday ?? false;

  return (
    <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 rounded-xl shadow-lg p-5 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-48 h-48 opacity-5 text-[10rem] leading-none select-none pointer-events-none">☀️</div>

      {/* Header: greeting + date */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-0.5">{getGreeting()}</p>
          <h2 className="text-xl font-bold text-white">
            {weekday}, {day}. {month} {year}
            {isHoliday && (
              <span className="ml-2 text-sm font-normal bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">
                🎉 Feiertag
              </span>
            )}
          </h2>
        </div>
        <div className="text-right text-slate-400 text-xs hidden sm:block">
          Tages-Briefing
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-600 my-3" />

      {/* Stats pills */}
      <div className="flex flex-wrap gap-3">
        {/* On duty */}
        <div className="flex items-center gap-2 bg-slate-600/60 rounded-lg px-3 py-2 text-sm">
          <span className="text-2xl leading-none">👷</span>
          <div>
            <div className="font-bold text-white text-base leading-tight">{onDutyCount}</div>
            <div className="text-slate-300 text-xs">im Dienst</div>
          </div>
        </div>

        {/* Absences */}
        {absenceCount > 0 && (
          <div className="flex items-center gap-2 bg-red-800/50 rounded-lg px-3 py-2 text-sm">
            <span className="text-2xl leading-none">🏥</span>
            <div>
              <div className="font-bold text-white text-base leading-tight">{absenceCount}</div>
              <div className="text-slate-300 text-xs">{absenceSummary || 'abwesend'}</div>
            </div>
          </div>
        )}

        {/* Staffing warnings */}
        {todayWarnings.length > 0 && (
          <div className="flex items-center gap-2 bg-orange-700/50 rounded-lg px-3 py-2 text-sm">
            <span className="text-2xl leading-none">⚠️</span>
            <div>
              <div className="font-bold text-white text-base leading-tight">{todayWarnings.length}</div>
              <div className="text-slate-300 text-xs">
                {todayWarnings.length === 1 ? 'Stelle unterbesetzt' : 'Stellen unterbesetzt'}
              </div>
            </div>
          </div>
        )}

        {/* Holiday countdown */}
        {holidayInfo && !isHoliday && (
          <div className="flex items-center gap-2 bg-teal-700/50 rounded-lg px-3 py-2 text-sm">
            <span className="text-xl leading-none">📅</span>
            <div className="text-slate-200 text-xs leading-snug max-w-[160px]">{holidayInfo}</div>
          </div>
        )}

        {/* Birthdays */}
        {birthdaysToday.length > 0 && (
          <div className="flex items-center gap-2 bg-pink-700/50 rounded-lg px-3 py-2 text-sm">
            <span className="text-2xl leading-none">🎂</span>
            <div>
              <div className="text-slate-200 text-xs leading-snug">
                {birthdaysToday.map(b => b.name).join(', ')}
              </div>
              <div className="text-slate-400 text-xs">
                {birthdaysToday.length === 1 ? 'hat heute Geburtstag' : 'haben heute Geburtstag'}
              </div>
            </div>
          </div>
        )}

        {/* All good */}
        {absenceCount === 0 && todayWarnings.length === 0 && birthdaysToday.length === 0 && onDutyCount > 0 && (
          <div className="flex items-center gap-2 bg-green-700/40 rounded-lg px-3 py-2 text-sm">
            <span className="text-2xl leading-none">✅</span>
            <div className="text-slate-200 text-xs">Alles im grünen Bereich</div>
          </div>
        )}
      </div>
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
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback((silent = false) => {
    if (!silent) setLoading(true);
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
        setLastRefresh(new Date());
      })
      .catch((err) => setError(String(err)))
      .finally(() => { if (!silent) setLoading(false); });
  }, [year, month]);

  // Initial load
  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(() => {
      fetchAll(true); // silent refresh — no loading spinner
    }, AUTO_REFRESH_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
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
        <div className="flex items-center gap-2">
          {/* Auto-refresh indicator */}
          <span
            className="hidden sm:flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 cursor-pointer hover:bg-gray-100"
            onClick={() => { fetchAll(true); }}
            title="Klicken zum manuellen Aktualisieren"
          >
            <span className="animate-pulse text-green-500">●</span>
            <span>Auto-Refresh</span>
            <span className="font-mono text-gray-500">
              {lastRefresh.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </span>
          <MonthNav
            year={year}
            month={month}
            label={summaryData?.month_label ?? ''}
            onPrev={prevMonth}
            onNext={nextMonth}
            disableNext={isCurrentMon}
          />
          <button
            onClick={() => window.print()}
            className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          ⚠️ Fehler beim Laden der Dashboard-Daten: {error}
          <button
            onClick={() => fetchAll(false)}
            className="ml-3 underline hover:no-underline"
          >
            Nochmals versuchen
          </button>
        </div>
      )}

      {/* Morning Briefing — only for current month */}
      {isCurrentMon && (
        <MorningBriefingWidget
          todayData={todayData}
          upcomingData={upcomingData}
          summaryData={summaryData}
          loading={loading}
        />
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

      {/* Today's grid: "Heute im Dienst" + "Abwesenheiten heute" */}
      {isCurrentMon && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TodayOnDutyWidget todayData={todayData} />
          <TodayAbsencesWidget todayData={todayData} />
        </div>
      )}

      {/* Wochenpeak: busiest day this week */}
      {isCurrentMon && (
        loading
          ? <WidgetSkeleton />
          : <WochenpeakWidget todayData={todayData} />
      )}

      {/* Besetzungs-Heatmap: calendar heatmap (full width) */}
      {isCurrentMon && (
        loading
          ? <WidgetSkeleton />
          : <MonthHeatmapWidget statsData={statsData} />
      )}

      {/* Chart: Monatliche Abdeckung (full width) — shown for non-current months too */}
      {!isCurrentMon && (
        loading
          ? <WidgetSkeleton />
          : <MonthCoverageChart statsData={statsData} />
      )}

      {/* Upcoming & Birthdays */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <UpcomingHolidaysWidget upcomingData={upcomingData} />
        <BirthdaysThisWeekWidget upcomingData={upcomingData} />
      </div>

      {/* Burnout-Radar */}
      <BurnoutRadarWidget year={year} month={month} />

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
