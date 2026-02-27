import { useState, useEffect } from 'react';

const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? '';

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}

// ── Types ──────────────────────────────────────────────────────────────────
interface CoverageDay {
  day: number;
  date: string;
  weekday: number;
  is_weekend: boolean;
  scheduled: number;
  required: number;
  status: 'ok' | 'low' | 'critical' | 'unplanned';
}

interface HoursIssue {
  employee_id: number;
  name: string;
  short: string;
  target_hours: number;
  actual_hours: number;
  deviation_pct: number;
  issue_type: 'over' | 'under';
  shifts_count: number;
}

interface Finding {
  severity: 'ok' | 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  days?: number[];
  employees?: string[];
}

interface QualityReport {
  year: number;
  month: number;
  month_name: string;
  overall_score: number;
  grade: string;
  grade_label: string;
  grade_color: string;
  active_employees: number;
  work_days: number;
  total_days: number;
  required_min_per_day: number;
  coverage: {
    ok_days: number;
    low_days: number;
    critical_days: number;
    unplanned_days: number;
    score: number;
  };
  hours: {
    total_target: number;
    total_actual: number;
    employees_ok: number;
    employees_issues: number;
    issues: HoursIssue[];
    score: number;
  };
  conflicts: {
    score: number;
    critical_days: number[];
    unplanned_days: number[];
  };
  findings: Finding[];
  coverage_days: CoverageDay[];
}

// ── Helpers ───────────────────────────────────────────────────────────────
const WEEKDAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function gradeColors(grade: string) {
  if (grade === 'A') return { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', badge: 'bg-green-100 text-green-800 border-green-300', ring: 'ring-green-400' };
  if (grade === 'B') return { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800 border-blue-300', ring: 'ring-blue-400' };
  if (grade === 'C') return { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', ring: 'ring-yellow-400' };
  return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'bg-red-100 text-red-800 border-red-300', ring: 'ring-red-400' };
}

function severityIcon(s: string) {
  if (s === 'ok') return '✅';
  if (s === 'info') return 'ℹ️';
  if (s === 'warning') return '⚠️';
  return '🔴';
}

function severityBg(s: string) {
  if (s === 'ok') return 'bg-green-50 border-green-200 text-green-800';
  if (s === 'info') return 'bg-blue-50 border-blue-200 text-blue-800';
  if (s === 'warning') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-800';
}

function dayStatusColor(status: string, isWeekend: boolean) {
  if (isWeekend) return 'bg-gray-100 text-gray-400';
  if (status === 'ok') return 'bg-green-100 text-green-700';
  if (status === 'low') return 'bg-yellow-100 text-yellow-700';
  if (status === 'critical') return 'bg-red-100 text-red-700 font-bold';
  if (status === 'unplanned') return 'bg-orange-100 text-orange-700';
  return 'bg-gray-50 text-gray-400';
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 85 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="35" cy="35" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 35 35)"
        />
        <text x="35" y="35" textAnchor="middle" dy="0.35em" fontSize="13" fontWeight="bold" fill={color}>{score}</text>
      </svg>
      <span className="text-xs text-gray-500 text-center leading-tight">{label}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function QualitaetsBericht() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/quality-report?year=${year}&month=${month}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReport(data);
    } catch (e: any) {
      setError(e.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReport(); }, [year, month]);

  const gc = report ? gradeColors(report.grade) : null;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            📋 Qualitätsbericht
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Monatsabschluss-Check — Besetzung, Stunden & Planungsqualität</p>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.slice(1).map((n, i) => (
              <option key={i + 1} value={i + 1}>{n}</option>
            ))}
          </select>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={loadReport}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '⏳' : '🔄 Neu berechnen'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>
      )}

      {loading && !report && (
        <div className="text-center py-12 text-gray-500">⏳ Berechne Qualitätsbericht…</div>
      )}

      {report && gc && (
        <>
          {/* Score Card */}
          <div className={`rounded-xl border-2 ${gc.border} ${gc.bg} p-5`}>
            <div className="flex flex-wrap items-center gap-6">
              {/* Big Grade */}
              <div className="flex flex-col items-center">
                <div className={`text-6xl font-black ${gc.text} leading-none`}>{report.grade}</div>
                <div className={`text-sm font-semibold ${gc.text} mt-1`}>{report.grade_label}</div>
              </div>

              {/* Score rings */}
              <div className="flex gap-5 flex-wrap">
                <ScoreRing score={report.overall_score} label="Gesamt" />
                <ScoreRing score={Math.round(report.coverage.score)} label="Besetzung" />
                <ScoreRing score={Math.round(report.hours.score)} label="Stunden" />
                <ScoreRing score={Math.round(report.conflicts.score)} label="Konflikte" />
              </div>

              {/* Quick facts */}
              <div className="flex-1 min-w-[200px] grid grid-cols-2 gap-2 text-sm">
                <div className="bg-white/70 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{report.active_employees}</div>
                  <div className="text-xs text-gray-500">Mitarbeiter</div>
                </div>
                <div className="bg-white/70 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{report.work_days}</div>
                  <div className="text-xs text-gray-500">Werktage</div>
                </div>
                <div className="bg-white/70 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{report.coverage.ok_days}</div>
                  <div className="text-xs text-gray-500">OK-Tage</div>
                </div>
                <div className="bg-white/70 rounded-lg p-2 text-center">
                  <div className={`text-lg font-bold ${report.coverage.critical_days > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {report.coverage.critical_days}
                  </div>
                  <div className="text-xs text-gray-500">Kritisch</div>
                </div>
              </div>
            </div>
          </div>

          {/* Findings */}
          <div className="space-y-2">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Befunde</h2>
            {report.findings.map((f, i) => (
              <div key={i} className={`flex items-start gap-3 border rounded-lg px-3 py-2 text-sm ${severityBg(f.severity)}`}>
                <span className="text-base mt-0.5">{severityIcon(f.severity)}</span>
                <div className="flex-1">
                  <span className="font-semibold mr-2">{f.category}:</span>
                  {f.message}
                  {f.days && f.days.length > 0 && (
                    <span className="ml-2 opacity-70">
                      (Tage: {f.days.slice(0, 8).join(', ')}{f.days.length > 8 ? '…' : ''})
                    </span>
                  )}
                  {f.employees && f.employees.length > 0 && (
                    <span className="ml-2 opacity-70">({f.employees.join(', ')})</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Stunden-Issues */}
          {report.hours.issues.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-2">Stunden-Abweichungen</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                      <th className="text-left px-3 py-2 rounded-tl">Mitarbeiter</th>
                      <th className="text-right px-3 py-2">Soll-Std</th>
                      <th className="text-right px-3 py-2">Ist-Std</th>
                      <th className="text-right px-3 py-2">Abw.</th>
                      <th className="text-right px-3 py-2 rounded-tr">Schichten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.hours.issues.map((issue, i) => (
                      <tr key={i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-3 py-1.5 font-medium">
                          <span className="inline-block bg-gray-200 text-gray-700 rounded px-1 mr-2 text-xs font-mono">
                            {issue.short}
                          </span>
                          {issue.name}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{issue.target_hours}h</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{issue.actual_hours}h</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${issue.issue_type === 'over' ? 'text-red-600' : 'text-orange-600'}`}>
                          {issue.deviation_pct > 0 ? '+' : ''}{issue.deviation_pct}%
                          <span className="ml-1 text-xs font-normal">
                            {issue.issue_type === 'over' ? '↑ Überstunden' : '↓ Unterstunden'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{issue.shifts_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Calendar heatmap */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Tages-Besetzungskalender — {MONTH_NAMES[report.month]} {report.year}
              </h2>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showDetails ? 'Kompakt' : 'Details'}
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> OK</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" /> Knapp</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Kritisch</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block" /> Ungeplant</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" /> Wochenende</span>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:grid-cols-7">
              {/* Day headers */}
              {WEEKDAY_NAMES.map(d => (
                <div key={d} className="text-xs text-center text-gray-400 font-medium py-1">{d}</div>
              ))}

              {/* Empty cells before first day */}
              {Array.from({ length: report.coverage_days[0]?.weekday ?? 0 }).map((_, i) => (
                <div key={`e${i}`} />
              ))}

              {/* Day cells */}
              {report.coverage_days.map(day => (
                <div
                  key={day.day}
                  title={`${day.date}: ${day.scheduled} von ${day.required} geplant (${day.status})`}
                  className={`rounded-md text-center p-1 cursor-default select-none ${dayStatusColor(day.status, day.is_weekend)}`}
                >
                  <div className="text-sm font-semibold">{day.day}</div>
                  {!day.is_weekend && showDetails && (
                    <div className="text-xs opacity-75">{day.scheduled}/{day.required}</div>
                  )}
                  {!showDetails && !day.is_weekend && (
                    <div className="text-xs opacity-60">{day.scheduled}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Hours summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
              <div className="text-xl font-bold text-gray-800">{report.hours.total_target.toLocaleString()}h</div>
              <div className="text-xs text-gray-500 mt-0.5">Soll-Stunden gesamt</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
              <div className={`text-xl font-bold ${report.hours.total_actual > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                {report.hours.total_actual.toLocaleString()}h
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Ist-Stunden gesamt</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
              <div className="text-xl font-bold text-green-700">{report.hours.employees_ok}</div>
              <div className="text-xs text-gray-500 mt-0.5">MAs ohne Abw.</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
              <div className={`text-xl font-bold ${report.hours.employees_issues > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {report.hours.employees_issues}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">MAs mit Abw.</div>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-xs text-gray-400 text-center pb-2">
            Mindestbesetzung: {report.required_min_per_day} MA/Tag (dynamisch) · Score = Besetzung 50% + Stunden 30% + Konflikte 20%
          </p>
        </>
      )}
    </div>
  );
}
