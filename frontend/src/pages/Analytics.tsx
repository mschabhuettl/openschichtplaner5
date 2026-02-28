import { useState, useEffect } from 'react';

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
    <div style={{
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: '#64748b' }}>
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

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
      <div style={{ fontSize: 32 }}>📊</div>
      <div style={{ marginTop: 8 }}>Lade Analytics-Daten…</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#dc2626' }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ marginTop: 8 }}>Fehler: {error}</div>
    </div>
  );

  // Compute derived data
  const monthly = data?.monthly ?? [];
  const labels = monthly.map(m => MONTH_NAMES_SHORT[m.month - 1]);

  const sickValues = monthly.map(m => m.sick_days);
  const otValues = monthly.map(m => Math.max(0, m.overtime));
  const staffingValues = monthly.map(m => {
    const days = new Date(year, m.month, 0).getDate();
    return parseFloat((m.shifts_count / days).toFixed(1));
  });

  const sickMean = mean(sickValues);
  const sickSd = stddev(sickValues);
  const otMean = mean(otValues);
  const otSd = stddev(otValues);
  const staffMean = mean(staffingValues);
  const staffSd = stddev(staffingValues);

  const sickAnomalies = sickValues.map(v => isAnomaly(v, sickMean, sickSd));
  const otAnomalies = otValues.map(v => isAnomaly(v, otMean, otSd));
  // For staffing, low staffing can also be notable — but spec says anomaly = > 2σ
  const staffingAnomalies = staffingValues.map(v => isAnomaly(v, staffMean, staffSd));

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e293b' }}>
            📈 Analytics & Trends
          </h1>
          <div style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
            Trend-Analysen über 12 Monate — Anomalie-Erkennung via 2σ-Regel
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
        </div>
      </div>

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
