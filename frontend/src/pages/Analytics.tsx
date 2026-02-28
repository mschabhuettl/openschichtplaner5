import { useState, useEffect, useMemo } from 'react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}

interface MonthData {
  month: number;
  actual_hours: number;
  target_hours: number;
  absence_days: number;
  vacation_days: number;
  sick_days: number;
  shifts_count: number;
  employee_count: number;
  overtime: number;
}

interface YearSummary {
  year: number;
  monthly: MonthData[];
}

// ── Stats helpers ──────────────────────────────────────────────
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function isAnomaly(value: number, m: number, sd: number): boolean {
  return sd > 0 && value > m + 2 * sd;
}

// ── CSS Bar Chart ──────────────────────────────────────────────
interface BarChartProps {
  title: string;
  icon: string;
  values: number[];
  labels: string[];
  anomalies: boolean[];
  unit: string;
  color: string;
  anomalyColor: string;
  description?: string;
}

function BarChart({ title, icon, values, labels, anomalies, unit, color, anomalyColor, description }: BarChartProps) {
  const maxVal = Math.max(...values, 1);
  const m = mean(values);
  const sd = stddev(values);
  const anomalyCount = anomalies.filter(Boolean).length;

  return (
    <div className="analytics-chart-card" style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 24,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{icon} {title}</div>
          {description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{description}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#64748b', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span>Ø {mean(values).toFixed(1)}{unit}</span>
          <span>σ {stddev(values).toFixed(1)}</span>
          {anomalyCount > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
              ⚠️ {anomalyCount} Anomalie{anomalyCount > 1 ? 'n' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, position: 'relative' }}>
        {/* Mean line */}
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          bottom: `${(m / maxVal) * 100}%`,
          borderTop: '1.5px dashed #94a3b8',
          zIndex: 1,
        }} />
        {/* 2σ line */}
        {sd > 0 && (m + 2 * sd) <= maxVal && (
          <div style={{
            position: 'absolute',
            left: 0, right: 0,
            bottom: `${((m + 2 * sd) / maxVal) * 100}%`,
            borderTop: '1.5px dashed #f87171',
            zIndex: 1,
          }} />
        )}

        {values.map((val, i) => {
          const anomaly = anomalies[i];
          const barColor = anomaly ? anomalyColor : color;
          const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{
                fontSize: 10,
                color: anomaly ? '#92400e' : '#475569',
                fontWeight: anomaly ? 700 : 400,
                marginBottom: 3,
              }}>
                {val > 0 ? val.toFixed(val < 10 ? 1 : 0) : ''}
              </div>
              <div
                title={`${labels[i]}: ${val}${unit}${anomaly ? ' ⚠️ Anomalie' : ''}`}
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  minHeight: val > 0 ? 4 : 0,
                  background: barColor,
                  borderRadius: '4px 4px 0 0',
                  position: 'relative',
                  transition: 'opacity 0.2s',
                  border: anomaly ? '2px solid #f59e0b' : '2px solid transparent',
                  boxSizing: 'border-box',
                }}
              />
              {anomaly && (
                <div style={{ fontSize: 12, marginTop: 2 }}>⚠️</div>
              )}
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {labels.map((lbl, i) => (
          <div key={i} style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 11,
            color: anomalies[i] ? '#92400e' : '#64748b',
            fontWeight: anomalies[i] ? 700 : 400,
          }}>
            {lbl}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#64748b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 24, borderTop: '1.5px dashed #94a3b8' }} /> Ø Mittelwert
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 24, borderTop: '1.5px dashed #f87171' }} /> Ø + 2σ (Anomalie-Schwelle)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, background: anomalyColor, borderRadius: 2, border: '1.5px solid #f59e0b' }} /> Anomalie
        </div>
      </div>
    </div>
  );
}

// ── SVG Multi-Line Chart ──────────────────────────────────────
interface LineChartSeries {
  label: string;
  values: number[];
  color: string;
  unit: string;
}

interface MultiLineChartProps {
  title: string;
  icon: string;
  labels: string[];
  series: LineChartSeries[];
  description?: string;
}

function MultiLineChart({ title, icon, labels, series, description }: MultiLineChartProps) {
  const W = 700;
  const H = 200;
  const PAD = { top: 20, right: 20, bottom: 32, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Compute overall min/max across all series
  const allValues = series.flatMap(s => s.values);
  const minVal = Math.min(...allValues, 0);
  const maxVal = Math.max(...allValues, 1);
  const range = maxVal - minVal || 1;

  const n = labels.length;

  function xPos(i: number): number {
    return n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW;
  }
  function yPos(v: number): number {
    return chartH - ((v - minVal) / range) * chartH;
  }

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => minVal + t * range);

  const [hoveredPoint, setHoveredPoint] = useState<{ si: number; pi: number } | null>(null);

  return (
    <div className="analytics-chart-card" style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 24,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{icon} {title}</div>
          {description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{description}</div>}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {series.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569' }}>
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={s.color} strokeWidth="2.5" /></svg>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Grid lines + Y-axis labels */}
          {yTicks.map((tick, i) => {
            const y = yPos(tick);
            return (
              <g key={i}>
                <line x1={0} y1={y} x2={chartW} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={-6} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#94a3b8">
                  {tick.toFixed(tick >= 10 ? 0 : 1)}
                </text>
              </g>
            );
          })}

          {/* X-axis baseline */}
          <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#e2e8f0" strokeWidth="1" />

          {/* X-axis labels */}
          {labels.map((lbl, i) => (
            <text key={i} x={xPos(i)} y={chartH + 14} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {lbl}
            </text>
          ))}

          {/* Lines + points per series */}
          {series.map((s, si) => {
            const points = s.values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
            return (
              <g key={si}>
                {/* Area fill (subtle) */}
                <polyline
                  points={`${xPos(0)},${chartH} ${s.values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')} ${xPos(s.values.length - 1)},${chartH}`}
                  fill={s.color}
                  fillOpacity="0.08"
                  stroke="none"
                />
                {/* Line */}
                <polyline
                  points={points}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Data points */}
                {s.values.map((v, pi) => {
                  const isHovered = hoveredPoint?.si === si && hoveredPoint?.pi === pi;
                  return (
                    <g key={pi}
                      onMouseEnter={() => setHoveredPoint({ si, pi })}
                      onMouseLeave={() => setHoveredPoint(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={xPos(pi)}
                        cy={yPos(v)}
                        r={isHovered ? 6 : 4}
                        fill="white"
                        stroke={s.color}
                        strokeWidth="2"
                      />
                      {/* Tooltip */}
                      {isHovered && (
                        <g>
                          <rect
                            x={xPos(pi) - 36}
                            y={yPos(v) - 32}
                            width={72}
                            height={22}
                            rx={4}
                            fill="#1e293b"
                            opacity={0.9}
                          />
                          <text
                            x={xPos(pi)}
                            y={yPos(v) - 17}
                            textAnchor="middle"
                            fontSize="11"
                            fill="white"
                            fontWeight="600"
                          >
                            {labels[pi]}: {v.toFixed(v < 10 ? 1 : 0)}{s.unit}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

// ── Donut Chart ────────────────────────────────────────────────
interface DonutSegment {
  label: string;
  value: number;
  color: string;
  icon: string;
}

interface DonutChartProps {
  title: string;
  icon: string;
  segments: DonutSegment[];
  description?: string;
}

function DonutChart({ title, icon, segments, description }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return null;

  const R = 70;       // outer radius
  const r = 44;       // inner radius
  const CX = 100;
  const CY = 100;
  const SIZE = 200;

  // Compute segments
  let cumulativeAngle = -Math.PI / 2; // start at top
  const segs = segments.map((s, i) => {
    const frac = s.value / total;
    const angle = frac * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    const endAngle = cumulativeAngle;
    const isHovered = hovered === i;
    const expandR = isHovered ? R + 6 : R;
    const x1 = CX + expandR * Math.cos(startAngle);
    const y1 = CY + expandR * Math.sin(startAngle);
    const x2 = CX + expandR * Math.cos(endAngle);
    const y2 = CY + expandR * Math.sin(endAngle);
    const x1i = CX + r * Math.cos(startAngle);
    const y1i = CY + r * Math.sin(startAngle);
    const x2i = CX + r * Math.cos(endAngle);
    const y2i = CY + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    // Mid-angle for label line
    const midAngle = startAngle + angle / 2;
    return { ...s, frac, startAngle, endAngle, x1, y1, x2, y2, x1i, y1i, x2i, y2i, largeArc, midAngle, isHovered };
  });

  const hoveredSeg = hovered !== null ? segs[hovered] : null;

  return (
    <div className="analytics-chart-card" style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 24,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{icon} {title}</div>
        {description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{description}</div>}
      </div>

      <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* SVG Donut */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ width: 180, height: 180, flexShrink: 0 }}
        >
          {segs.map((seg, i) => (
            <path
              key={i}
              d={`M ${seg.x1i} ${seg.y1i} L ${seg.x1} ${seg.y1} A ${seg.isHovered ? R + 6 : R} ${seg.isHovered ? R + 6 : R} 0 ${seg.largeArc} 1 ${seg.x2} ${seg.y2} L ${seg.x2i} ${seg.y2i} A ${r} ${r} 0 ${seg.largeArc} 0 ${seg.x1i} ${seg.y1i} Z`}
              fill={seg.color}
              opacity={hovered !== null && hovered !== i ? 0.5 : 1}
              stroke="white"
              strokeWidth="2"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
            />
          ))}
          {/* Center label */}
          <text x={CX} y={CY - 8} textAnchor="middle" fontSize="22" fontWeight="800" fill="#1e293b">
            {hoveredSeg ? hoveredSeg.value : total}
          </text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize="10" fill="#64748b">
            {hoveredSeg ? hoveredSeg.label : 'Gesamt'}
          </text>
          <text x={CX} y={CY + 24} textAnchor="middle" fontSize="10" fill="#64748b">
            {hoveredSeg ? `${(hoveredSeg.frac * 100).toFixed(1)}%` : 'Abwesenheitstage'}
          </text>
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {segs.map((seg, i) => (
            <div
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                opacity: hovered !== null && hovered !== i ? 0.45 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              <div style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: seg.color,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  {seg.icon} {seg.label}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {seg.value} Tage · {(seg.frac * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 800,
                color: seg.color,
                minWidth: 48,
                textAlign: 'right',
              }}>
                {seg.value}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8' }}>
            Gesamt: {total} Abwesenheitstage im Jahr {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Anomaly summary card ───────────────────────────────────────
interface AnomalySummaryProps {
  monthly: MonthData[];
  sickAnomalies: boolean[];
  otAnomalies: boolean[];
  staffingAnomalies: boolean[];
  staffingValues: number[];
}

function AnomalySummary({ monthly, sickAnomalies, otAnomalies, staffingAnomalies }: AnomalySummaryProps) {
  const anomalies: { month: number; type: string; value: string; icon: string }[] = [];

  monthly.forEach((m, i) => {
    if (sickAnomalies[i]) {
      anomalies.push({ month: m.month, type: 'Krankheitstage', value: `${m.sick_days} Tage`, icon: '🤒' });
    }
    if (otAnomalies[i]) {
      anomalies.push({ month: m.month, type: 'Überstunden', value: `${m.overtime.toFixed(0)}h`, icon: '⏰' });
    }
    if (staffingAnomalies[i]) {
      const daysInMonth = new Date(2026, m.month, 0).getDate();
      anomalies.push({ month: m.month, type: 'Besetzung', value: `${(m.shifts_count / daysInMonth).toFixed(1)} MA/Tag`, icon: '👥' });
    }
  });

  if (anomalies.length === 0) return null;

  return (
    <div style={{
      background: '#fffbeb',
      border: '1px solid #fde68a',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
        ⚠️ Anomalie-Zusammenfassung
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {anomalies.map((a, i) => (
          <div key={i} style={{
            background: 'white',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: '8px 14px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 18 }}>{a.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                {MONTH_NAMES_SHORT[a.month - 1]}: {a.type}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{a.value} — überdurchschnittlich hoch</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#78350f', marginTop: 10 }}>
        Anomalie-Kriterium: Wert &gt; Mittelwert + 2 Standardabweichungen (2σ-Regel)
      </div>
    </div>
  );
}

// ── Main Analytics Page ────────────────────────────────────────
export default function Analytics() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<YearSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/statistics/year-summary?year=${year}`, { headers: getAuthHeaders() })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<YearSummary>;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [year]);

  const currentYear = new Date().getFullYear();

  // Compute derived data (memoized to avoid recomputing on unrelated re-renders)
  // Must be before early returns to satisfy rules-of-hooks
  const {
    monthly, labels,
    sickValues, otValues, staffingValues,
    sickAnomalies, otAnomalies, staffingAnomalies,
  } = useMemo(() => {
    const monthly = data?.monthly ?? [];
    const labels = monthly.map((m: { month: number }) => MONTH_NAMES_SHORT[m.month - 1]);

    const sickValues = monthly.map((m: { sick_days: number }) => m.sick_days);
    const otValues = monthly.map((m: { overtime: number }) => Math.max(0, m.overtime));
    const staffingValues = monthly.map((m: { shifts_count: number; month: number }) => {
      const days = new Date(year, m.month, 0).getDate();
      return parseFloat((m.shifts_count / days).toFixed(1));
    });

    const sickMean = mean(sickValues);
    const sickSd = stddev(sickValues);
    const otMean = mean(otValues);
    const otSd = stddev(otValues);
    const staffMean = mean(staffingValues);
    const staffSd = stddev(staffingValues);

    const sickAnomalies = sickValues.map((v: number) => isAnomaly(v, sickMean, sickSd));
    const otAnomalies = otValues.map((v: number) => isAnomaly(v, otMean, otSd));
    // For staffing, low staffing can also be notable — but spec says anomaly = > 2σ
    const staffingAnomalies = staffingValues.map((v: number) => isAnomaly(v, staffMean, staffSd));

    return {
      monthly, labels,
      sickValues, otValues, staffingValues,
      sickAnomalies, otAnomalies, staffingAnomalies,
    };
  }, [data, year]);

  if (loading) return <LoadingSpinner message="Lade Analytics-Daten…" />;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500 dark:text-red-400">
      <span className="text-3xl">⚠️</span>
      <span className="text-sm font-medium">Fehler beim Laden: {error}</span>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 text-xs bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
      >
        Erneut versuchen
      </button>
    </div>
  );

  return (
    <div style={{ padding: '16px 16px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page { size: portrait; margin: 12mm 10mm; }
          .analytics-no-print { display: none !important; }
          .analytics-print-title { display: block !important; }
          /* Hide SVG tooltips/overlays */
          .analytics-tooltip { display: none !important; }
          /* Ensure charts fit on page */
          svg { max-width: 100% !important; height: auto !important; break-inside: avoid; }
          /* KPI cards: wrap nicely */
          .analytics-kpi-row { flex-wrap: wrap !important; }
          /* Chart cards: avoid page break inside */
          .analytics-chart-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px !important; box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
          /* Data table: show clearly */
          .analytics-data-table table { font-size: 10px !important; }
          /* Remove interactive hover styles */
          * { transition: none !important; animation: none !important; }
        }
        .analytics-print-title { display: none; }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e293b' }}>
            📈 Analytics & Trends
          </h1>
          <div style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
            Trend-Analysen über 12 Monate — Anomalie-Erkennung via 2σ-Regel
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="analytics-no-print">
          <button
            onClick={() => setYear(y => y - 1)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14 }}
          >←</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', minWidth: 48, textAlign: 'center' }}>{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            disabled={year >= currentYear}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: year >= currentYear ? '#f8fafc' : 'white', cursor: year >= currentYear ? 'default' : 'pointer', fontSize: 14 }}
          >→</button>
          <button
            onClick={() => window.print()}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14, marginLeft: 8 }}
            title="Drucken"
          >🖨️</button>
        </div>
        {/* Print-only year display */}
        <div className="analytics-print-title" style={{ fontSize: 14, color: '#64748b' }}>Jahr: {year}</div>
      </div>

      {!data && !loading && !error && (
        <EmptyState
          icon="📈"
          title="Keine Analysedaten verfügbar"
          description={`Für das Jahr ${year} sind keine Daten vorhanden.`}
        />
      )}

      {data && (
        <>
          {/* Summary KPIs */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Gesamte Krankheitstage', value: `${monthly.reduce((a, m) => a + m.sick_days, 0)}`, icon: '🤒', color: '#dc2626' },
              { label: 'Gesamte Überstunden', value: `${monthly.reduce((a, m) => a + Math.max(0, m.overtime), 0).toFixed(0)}h`, icon: '⏰', color: '#d97706' },
              { label: 'Ø Besetzung/Tag', value: `${mean(staffingValues).toFixed(1)} MA`, icon: '👥', color: '#2563eb' },
              { label: 'Gesamte Schichten', value: `${monthly.reduce((a, m) => a + m.shifts_count, 0)}`, icon: '📅', color: '#059669' },
              { label: 'Anomalien erkannt', value: `${[...sickAnomalies, ...otAnomalies, ...staffingAnomalies].filter(Boolean).length}`, icon: '⚠️', color: '#92400e' },
            ].map((kpi, i) => (
              <div key={i} style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '14px 18px',
                flex: '1 1 160px',
                minWidth: 150,
              }}>
                <div style={{ fontSize: 22 }}>{kpi.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Anomaly Summary */}
          <AnomalySummary
            monthly={monthly}
            sickAnomalies={sickAnomalies}
            otAnomalies={otAnomalies}
            staffingAnomalies={staffingAnomalies}
            staffingValues={staffingValues}
          />

          {/* Multi-Line Trend Chart — alle drei Metriken normalisiert */}
          {monthly.length > 1 && (
            <MultiLineChart
              title="Trend-Vergleich (normalisiert)"
              icon="📉"
              labels={labels}
              description="Alle drei Metriken im Vergleich — Maus über Punkte für Detailwerte"
              series={[
                { label: 'Kranktage', values: sickValues, color: '#ef4444', unit: ' Tage' },
                { label: 'Überstunden', values: otValues, color: '#f59e0b', unit: 'h' },
                { label: 'Ø MA/Tag', values: staffingValues, color: '#3b82f6', unit: ' MA' },
              ]}
            />
          )}

          {/* Abwesenheits-Donut */}
          {(() => {
            const totalSick = monthly.reduce((a, m) => a + m.sick_days, 0);
            const totalVac = monthly.reduce((a, m) => a + m.vacation_days, 0);
            const totalOther = monthly.reduce((a, m) => a + Math.max(0, m.absence_days - m.sick_days - m.vacation_days), 0);
            if (totalSick + totalVac + totalOther === 0) return null;
            return (
              <DonutChart
                title="Abwesenheits-Verteilung"
                icon="🍩"
                description="Aufschlüsselung der Abwesenheitstage nach Typ — Maus über Segmente für Details"
                segments={[
                  { label: 'Kranktage', value: totalSick, color: '#ef4444', icon: '🤒' },
                  { label: 'Urlaub', value: totalVac, color: '#3b82f6', icon: '🌴' },
                  { label: 'Sonstige', value: totalOther, color: '#8b5cf6', icon: '📋' },
                ].filter(s => s.value > 0)}
              />
            );
          })()}

          {/* Krankheitstage Trend */}
          <BarChart
            title="Krankheitstage-Trend"
            icon="🤒"
            values={sickValues}
            labels={labels}
            anomalies={sickAnomalies}
            unit=" Tage"
            color="#fca5a5"
            anomalyColor="#ef4444"
            description="Krankmeldungen pro Monat — Anomalie wenn > Ø + 2σ"
          />

          {/* Überstunden Trend */}
          <BarChart
            title="Überstunden-Trend"
            icon="⏰"
            values={otValues}
            labels={labels}
            anomalies={otAnomalies}
            unit="h"
            color="#fde68a"
            anomalyColor="#f59e0b"
            description="Gesamte Überstunden pro Monat (Ist – Soll) — Anomalie wenn > Ø + 2σ"
          />

          {/* Besetzungs Trend */}
          <BarChart
            title="Besetzungs-Trend"
            icon="👥"
            values={staffingValues}
            labels={labels}
            anomalies={staffingAnomalies}
            unit=" MA/Tag"
            color="#a5f3fc"
            anomalyColor="#0891b2"
            description="Durchschnittliche Mitarbeiter pro Tag (Schichten ÷ Tage im Monat)"
          />

          {/* Data Table */}
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              📋 Monatliche Rohdaten
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Monat</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Kranktage</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Überstunden</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Schichten</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Ø MA/Tag</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Anomalie</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m, i) => {
                    const rowAnomaly = sickAnomalies[i] || otAnomalies[i] || staffingAnomalies[i];
                    const tags = [
                      sickAnomalies[i] ? '🤒' : '',
                      otAnomalies[i] ? '⏰' : '',
                      staffingAnomalies[i] ? '👥' : '',
                    ].filter(Boolean);
                    return (
                      <tr key={i} style={{ background: rowAnomaly ? '#fffbeb' : (i % 2 === 0 ? 'white' : '#f8fafc') }}>
                        <td style={{ padding: '8px 16px', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>
                          {MONTH_NAMES_SHORT[m.month - 1]}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: sickAnomalies[i] ? '#dc2626' : '#374151', fontWeight: sickAnomalies[i] ? 700 : 400 }}>
                          {m.sick_days}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: otAnomalies[i] ? '#d97706' : '#374151', fontWeight: otAnomalies[i] ? 700 : 400 }}>
                          {m.overtime.toFixed(0)}h
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: '#374151' }}>
                          {m.shifts_count}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: staffingAnomalies[i] ? '#0891b2' : '#374151', fontWeight: staffingAnomalies[i] ? 700 : 400 }}>
                          {staffingValues[i]}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                          {tags.length > 0 ? tags.join(' ') : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
