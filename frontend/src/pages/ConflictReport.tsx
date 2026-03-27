import React, { useState, useCallback } from 'react';
import { api } from '../api/client';
import type {
  ConflictReportResult,
  ConflictReportEntry,
  ConflictType,
} from '../api/client';
import type { Group } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  type: ConflictType;
}

const TYPE_LABELS: Record<ConflictType, string> = {
  overlap: 'Überschneidung',
  double_booked: 'Doppelbuchung',
  understaffed: 'Unterbesetzt',
};

const TYPE_COLORS: Record<ConflictType, string> = {
  overlap: '#f59e0b',       // amber
  double_booked: '#ef4444', // red
  understaffed: '#3b82f6',  // blue
};

function ConflictBadge({ type }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 700,
        color: '#fff',
        background: TYPE_COLORS[type] ?? '#6b7280',
        whiteSpace: 'nowrap',
      }}
      data-testid={`badge-${type}`}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────

interface SummaryBarProps {
  overlaps: number;
  double_booked: number;
  understaffed: number;
  total: number;
}

function SummaryBar({ overlaps, double_booked, understaffed, total }: SummaryBarProps) {
  return (
    <div
      data-testid="summary-bar"
      style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        margin: '1rem 0',
      }}
    >
      <SummaryCard label="Gesamt" value={total} color="#6b7280" testId="summary-total" />
      <SummaryCard label="Überschneidungen" value={overlaps} color={TYPE_COLORS.overlap} testId="summary-overlaps" />
      <SummaryCard label="Doppelbuchungen" value={double_booked} color={TYPE_COLORS.double_booked} testId="summary-double-booked" />
      <SummaryCard label="Unterbesetzt" value={understaffed} color={TYPE_COLORS.understaffed} testId="summary-understaffed" />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  testId,
}: {
  label: string;
  value: number;
  color: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        background: '#1e293b',
        border: `2px solid ${color}`,
        borderRadius: '0.5rem',
        padding: '0.75rem 1.25rem',
        minWidth: '120px',
        textAlign: 'center',
        flex: '1 1 120px',
      }}
    >
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

// ─── Conflict Row ─────────────────────────────────────────────────────────────

interface ConflictRowProps {
  conflict: ConflictReportEntry;
}

function ConflictRow({ conflict }: ConflictRowProps) {
  const severityIcon = conflict.severity === 'error' ? '🔴' : '⚠️';
  return (
    <tr
      data-testid="conflict-row"
      style={{ borderBottom: '1px solid #334155' }}
    >
      <td style={{ padding: '0.6rem 0.75rem' }}>
        <ConflictBadge type={conflict.type} />
      </td>
      <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', color: '#cbd5e1' }}>
        {conflict.date}
      </td>
      <td style={{ padding: '0.6rem 0.75rem', color: '#cbd5e1' }}>
        {conflict.employee_name ?? <span style={{ color: '#64748b' }}>–</span>}
      </td>
      <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.875rem' }}>
        {conflict.description}
      </td>
      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }} title={conflict.severity}>
        {severityIcon}
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type FilterType = ConflictType | 'all';

const FILTER_LABELS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'overlap', label: 'Überschneidungen' },
  { key: 'double_booked', label: 'Doppelbuchungen' },
  { key: 'understaffed', label: 'Unterbesetzt' },
];

export default function ConflictReport() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(monthAgo());
  const [toDate, setToDate] = useState<string>(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConflictReportResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // ── Load groups once ───────────────────────────────────────────────────────
  const loadGroups = useCallback(() => {
    if (groupsLoaded) return;
    api.getGroups()
      .then((gs) => {
        setGroups(gs);
        setGroupsLoaded(true);
      })
      .catch(() => {
        setGroupsLoaded(true);
      });
  }, [groupsLoaded]);

  // Use useEffect equivalent via lazy init on first render
  React.useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // ── Run check ─────────────────────────────────────────────────────────────
  const handleCheck = useCallback(async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    setActiveFilter('all');
    try {
      const params: { from: string; to: string; group_id?: number } = {
        from: fromDate,
        to: toDate,
      };
      if (selectedGroup) params.group_id = parseInt(selectedGroup, 10);
      const data = await api.getConflictReport(params);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, selectedGroup]);

  // ── Filtered conflicts ────────────────────────────────────────────────────
  const filteredConflicts: ConflictReportEntry[] = result
    ? activeFilter === 'all'
      ? result.conflicts
      : result.conflicts.filter((c) => c.type === activeFilter)
    : [];

  // ── Export URL ────────────────────────────────────────────────────────────
  const exportParams = {
    from: fromDate,
    to: toDate,
    group_id: selectedGroup ? parseInt(selectedGroup, 10) : undefined,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      data-testid="conflict-report-page"
      style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto', color: '#e2e8f0' }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        🔍 Konflikt-Report
      </h1>

      {/* ── Filters ── */}
      <div
        data-testid="filter-form"
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          background: '#1e293b',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="group-select" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Gruppe
          </label>
          <select
            id="group-select"
            data-testid="group-select"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            style={{
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              padding: '0.4rem 0.75rem',
              minWidth: '160px',
            }}
          >
            <option value="">Alle Gruppen</option>
            {groups.map((g) => (
              <option key={g.ID} value={String(g.ID)}>
                {g.NAME}
              </option>
            ))}
          </select>
        </div>

        {/* From */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="from-date" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Von
          </label>
          <input
            id="from-date"
            data-testid="from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              padding: '0.4rem 0.75rem',
            }}
          />
        </div>

        {/* To */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="to-date" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Bis
          </label>
          <input
            id="to-date"
            data-testid="to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              padding: '0.4rem 0.75rem',
            }}
          />
        </div>

        {/* Submit */}
        <button
          data-testid="pruefen-btn"
          onClick={handleCheck}
          disabled={loading}
          style={{
            background: loading ? '#475569' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.5rem 1.25rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-end',
          }}
        >
          {loading ? 'Prüfe…' : 'Prüfen'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          data-testid="error-msg"
          style={{
            background: '#7f1d1d',
            color: '#fca5a5',
            padding: '0.75rem 1rem',
            borderRadius: '0.375rem',
            marginBottom: '1rem',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div data-testid="results-section">
          {/* Summary */}
          <SummaryBar
            overlaps={result.summary.overlaps}
            double_booked={result.summary.double_booked}
            understaffed={result.summary.understaffed}
            total={result.summary.total}
          />

          {/* Type filter buttons */}
          <div
            data-testid="type-filter-buttons"
            style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}
          >
            {FILTER_LABELS.map(({ key, label }) => (
              <button
                key={key}
                data-testid={`filter-btn-${key}`}
                onClick={() => setActiveFilter(key)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  border: activeFilter === key ? '2px solid #2563eb' : '1px solid #334155',
                  background: activeFilter === key ? '#1d4ed8' : '#1e293b',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: activeFilter === key ? 700 : 400,
                }}
              >
                {label}
              </button>
            ))}

            {/* Spacer + export */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <a
                data-testid="export-csv"
                href={api.getConflictReportExportUrl({ ...exportParams, format: 'csv' })}
                download
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '0.375rem',
                  background: '#065f46',
                  color: '#6ee7b7',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                ⬇ CSV
              </a>
              <a
                data-testid="export-xlsx"
                href={api.getConflictReportExportUrl({ ...exportParams, format: 'xlsx' })}
                download
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '0.375rem',
                  background: '#1e3a5f',
                  color: '#93c5fd',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                ⬇ Excel
              </a>
            </div>
          </div>

          {/* Table */}
          {filteredConflicts.length === 0 ? (
            <div
              data-testid="no-conflicts"
              style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#64748b',
                background: '#1e293b',
                borderRadius: '0.5rem',
              }}
            >
              ✅ Keine Konflikte gefunden.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '0.5rem', background: '#1e293b' }}>
              <table
                data-testid="conflict-table"
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}
              >
                <thead>
                  <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Typ</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Datum</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Mitarbeiter</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Beschreibung</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Schwere</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConflicts.map((c, i) => (
                    <ConflictRow key={`${c.type}-${c.date}-${c.employee_id ?? 'g'}-${i}`} conflict={c} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div
          data-testid="empty-state"
          style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#475569',
            background: '#1e293b',
            borderRadius: '0.5rem',
          }}
        >
          Wähle eine Gruppe und einen Zeitraum, dann klicke <strong>Prüfen</strong>.
        </div>
      )}
    </div>
  );
}
