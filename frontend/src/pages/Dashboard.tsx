import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { DashboardSummary } from '../api/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatDateDE(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formatHoursSign(h: number): string {
  const sign = h < 0 ? '−' : '+';
  return `${sign}${Math.abs(h).toFixed(1)} h`;
}

function isCurrentMonth(year: number, month: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() + 1 === month;
}

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
  accent?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray';
}

const accentMap: Record<string, { bg: string; text: string; bar: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   bar: 'bg-blue-500' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  bar: 'bg-green-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', bar: 'bg-orange-500' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    bar: 'bg-red-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-500' },
  gray:   { bg: 'bg-gray-50',   text: 'text-gray-600',   bar: 'bg-gray-400' },
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

// ── Coverage bar ──────────────────────────────────────────────────────────────

function CoverageBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-green-500' :
    pct >= 50 ? 'bg-yellow-400' :
    'bg-red-500';
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div
        className={`${color} h-1.5 rounded-full transition-all duration-700`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ── Widget wrapper ────────────────────────────────────────────────────────────

function Widget({
  title,
  icon,
  children,
  className = '',
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl shadow p-5 flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold text-gray-700 text-sm">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 italic text-center py-2">{text}</p>;
}

// ── Today's Shifts widget ─────────────────────────────────────────────────────

function TodayShifts({ data }: { data: DashboardSummary['shifts_today'] }) {
  if (data.count === 0) {
    return <Empty text="Keine Schichten für heute geplant." />;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {data.by_shift.map((s) => (
        <div
          key={s.name}
          className="flex items-center gap-2 rounded-lg px-3 py-2 shadow-sm border border-gray-100"
          style={{ background: s.color + '22' }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: s.color }}
          />
          <span className="font-bold text-sm" style={{ color: s.color }}>
            {s.name}
          </span>
          <span className="text-gray-500 text-xs font-medium">×{s.count}</span>
        </div>
      ))}
    </div>
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

// ── Upcoming Birthdays widget ─────────────────────────────────────────────────

function UpcomingBirthdays({ birthdays }: { birthdays: DashboardSummary['upcoming_birthdays'] }) {
  if (birthdays.length === 0) {
    return <Empty text="Keine Geburtstage in den nächsten 14 Tagen." />;
  }
  return (
    <ul className="space-y-1.5">
      {birthdays.map((b, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span>{b.days_until === 0 ? '🎂' : '🎁'}</span>
          <span className="font-medium text-gray-700 flex-1 truncate">{b.name}</span>
          <span className="text-xs text-gray-400 shrink-0">{b.date}</span>
          {b.days_until === 0 ? (
            <span className="text-xs font-bold text-pink-500 shrink-0">Heute!</span>
          ) : (
            <span className="text-xs text-gray-400 shrink-0">in {b.days_until}d</span>
          )}
        </li>
      ))}
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
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getDashboardSummary(year, month)
      .then(setData)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Coverage color
  const cov = data?.shifts_this_month.coverage_pct ?? 0;
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
          label={data?.month_label ?? ''}
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
            onClick={fetchData}
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
        ) : data ? (
          <>
            <KpiCard
              icon="👥"
              label="Mitarbeiter"
              value={data.employees.total}
              sub={`${data.groups} Gruppen`}
              accent="blue"
            />
            <KpiCard
              icon="🕐"
              label={isCurrentMon ? 'Schichten heute' : 'Schichten geplant'}
              value={isCurrentMon ? data.shifts_today.count : data.shifts_this_month.scheduled}
              sub={
                isCurrentMon
                  ? data.shifts_today.count === 0
                    ? 'Noch nichts geplant'
                    : `${data.shifts_today.by_shift.length} Schichtart(en)`
                  : `im ${data.month_label}`
              }
              accent="purple"
            />
            <KpiCard
              icon="🏖️"
              label="Abwesenheiten"
              value={data.absences_this_month.total}
              sub={`im ${data.month_label}`}
              accent={data.absences_this_month.total > 0 ? 'orange' : 'gray'}
            />
            <KpiCard
              icon="📈"
              label="Auslastung"
              value={data.shifts_this_month.scheduled > 0 ? `${cov} %` : '—'}
              sub={
                data.shifts_this_month.scheduled > 0
                  ? cov >= 80 ? 'Gut besetzt ✅' : cov >= 50 ? 'Teilweise besetzt' : 'Unterbesetzt ⚠️'
                  : 'Keine Schichtdaten'
              }
              accent={data.shifts_this_month.scheduled > 0 ? covAccent : 'gray'}
            />
          </>
        ) : null}
      </div>

      {/* Main grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <WidgetSkeleton key={i} />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Today's shifts */}
          {isCurrentMon && (
            <Widget title="Heutige Schichten" icon="👷">
              <TodayShifts data={data.shifts_today} />
              {data.shifts_today.count > 0 && (
                <p className="text-xs text-gray-400 text-right">
                  {data.shifts_today.count} Mitarbeiter im Dienst
                </p>
              )}
            </Widget>
          )}

          {/* Absences by type */}
          <Widget title={`Abwesenheiten ${data.month_label}`} icon="📋">
            <AbsencesByType data={data.absences_this_month} />
          </Widget>

          {/* Staffing warnings */}
          <Widget
            title={isCurrentMon ? 'Staffing-Warnungen (nächste 7 Tage)' : 'Staffing-Anforderungen'}
            icon="⚠️"
          >
            <StaffingWarnings warnings={data.staffing_warnings} />
          </Widget>

          {/* Zeitkonto alerts */}
          <Widget title={`Zeitkonto-Defizit (${data.month_label})`} icon="⏱️">
            <ZeitkontoAlerts alerts={data.zeitkonto_alerts} />
          </Widget>

          {/* Upcoming birthdays */}
          {(data.upcoming_birthdays.length > 0 || isCurrentMon) && (
            <Widget title="Geburtstage (nächste 14 Tage)" icon="🎂">
              <UpcomingBirthdays birthdays={data.upcoming_birthdays} />
            </Widget>
          )}

          {/* Month coverage bar */}
          <Widget title={`Monatsbelegung ${data.month_label}`} icon="📅">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Schichten geplant</span>
                <span className="font-bold text-gray-700">
                  {data.shifts_this_month.scheduled > 0
                    ? data.shifts_this_month.scheduled
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Abwesenheiten</span>
                <span className="font-bold text-gray-700">
                  {data.absences_this_month.total > 0
                    ? data.absences_this_month.total
                    : '—'}
                </span>
              </div>
              {data.shifts_this_month.scheduled > 0 && (
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
                  <CoverageBar pct={cov} />
                </>
              )}
              {data.shifts_this_month.scheduled === 0 && (
                <Empty text="Noch keine Schichtdaten für diesen Monat." />
              )}
            </div>
          </Widget>

        </div>
      ) : null}
    </div>
  );
}
