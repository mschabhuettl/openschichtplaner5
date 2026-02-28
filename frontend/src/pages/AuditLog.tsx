import { useState, useEffect, useCallback } from 'react';
import { StatCard } from '../components/StatCard';
import { PageHeader } from '../components/PageHeader';

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

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChangelogEntry {
  timestamp: string;
  user: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  entity: string;
  entity_id: number;
  details: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  CREATE: '#22c55e',
  UPDATE: '#f59e0b',
  DELETE: '#ef4444',
};

const ACTION_ICON: Record<string, string> = {
  CREATE: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
};

const ENTITY_ICON: Record<string, string> = {
  employee: '👤',
  shift: '🔵',
  schedule: '📅',
  absence: '🏖️',
  notes: '📝',
  group: '👥',
  workplace: '🏢',
  leaveType: '📋',
  holiday: '🎉',
  handover: '🤝',
  tausch: '🔄',
  default: '📌',
};

function entityIcon(entity: string) {
  return ENTITY_ICON[entity] ?? ENTITY_ICON.default;
}

function fmtDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function relTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'gerade eben';
  if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)} Min`;
  if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} Std`;
  return `vor ${Math.floor(diff / 86_400_000)} Tagen`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AuditLog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filter state
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(200);

  // Search
  const [search, setSearch] = useState('');

  // Stats
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (filterUser) params.set('user', filterUser);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const res = await fetch(`${API}/api/changelog?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const data: ChangelogEntry[] = await res.json();
      setEntries(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [limit, filterUser, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  // Derived list after client-side filters
  const visible = entries.filter(e => {
    if (filterAction && e.action !== filterAction) return false;
    if (filterEntity && e.entity !== filterEntity) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(e.entity.toLowerCase().includes(q) ||
            e.details.toLowerCase().includes(q) ||
            e.user.toLowerCase().includes(q) ||
            e.action.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Unique values for filter dropdowns
  const allActions = [...new Set(entries.map(e => e.action))].sort();
  const allEntities = [...new Set(entries.map(e => e.entity))].sort();

  // Stats
  const stats = {
    total: entries.length,
    creates: entries.filter(e => e.action === 'CREATE').length,
    updates: entries.filter(e => e.action === 'UPDATE').length,
    deletes: entries.filter(e => e.action === 'DELETE').length,
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <PageHeader
        title="🔍 Audit-Log"
        subtitle="Vollständige Änderungshistorie — wer hat wann was geändert"
        actions={
          <>
            <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
              />
              Auto-Refresh (10s)
            </label>
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? '⏳ Laden…' : '🔄 Aktualisieren'}
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard icon="📊" label="Gesamt"  value={stats.total}   accent="blue" />
        <StatCard icon="➕" label="Erstellt" value={stats.creates} accent="green" />
        <StatCard icon="✏️" label="Geändert" value={stats.updates} accent="yellow" />
        <StatCard icon="🗑️" label="Gelöscht" value={stats.deletes} accent="red" />
      </div>

      {/* Filters */}
      <div style={{
        background: '#f8fafc', borderRadius: '12px', padding: '1rem',
        marginBottom: '1.25rem', border: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {/* Search */}
          <div style={{ gridColumn: '1 / -1' }}>
            <input
              type="text"
              placeholder="🔎 Suche in Details, Entity, User…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
                border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Action filter */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Aktion</label>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
            >
              <option value="">Alle</option>
              {allActions.map(a => <option key={a} value={a}>{ACTION_ICON[a] ?? ''} {a}</option>)}
            </select>
          </div>

          {/* Entity filter */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Objekt-Typ</label>
            <select
              value={filterEntity}
              onChange={e => setFilterEntity(e.target.value)}
              style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
            >
              <option value="">Alle</option>
              {allEntities.map(a => <option key={a} value={a}>{entityIcon(a)} {a}</option>)}
            </select>
          </div>

          {/* User filter */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Benutzer</label>
            <input
              type="text"
              placeholder="z.B. api"
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* Date from */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Von</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* Date to */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Bis</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* Limit */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Max. Einträge</label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
            >
              {[50, 100, 200, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Reset */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => { setFilterAction(''); setFilterEntity(''); setFilterUser(''); setDateFrom(''); setDateTo(''); setSearch(''); }}
              style={{
                width: '100%', padding: '0.4rem', borderRadius: '6px',
                border: '1px solid #d1d5db', background: '#fff',
                fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              ✕ Filter zurücksetzen
            </button>
          </div>
        </div>
      </div>

      {/* Result info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
          {visible.length} Einträge
          {visible.length !== entries.length ? ` (gefiltert aus ${entries.length})` : ''}
        </span>
        {entries.length > 0 && (
          <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
            Letzter Eintrag: {relTime(entries[0]?.timestamp)}
          </span>
        )}
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
          padding: '0.75rem 1rem', color: '#dc2626', marginBottom: '1rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Zeitpunkt</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Aktion</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Objekt-Typ</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>ID</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Benutzer</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                  {loading ? '⏳ Lade…' : '📭 Keine Einträge gefunden'}
                </td>
              </tr>
            )}
            {visible.map((e, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  background: i % 2 === 0 ? '#fff' : '#fafafa',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={ev => (ev.currentTarget.style.background = '#eff6ff')}
                onMouseLeave={ev => (ev.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
              >
                {/* Timestamp */}
                <td style={{ padding: '0.6rem 1rem', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 500 }}>{fmtDate(e.timestamp)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{relTime(e.timestamp)}</div>
                </td>

                {/* Action badge */}
                <td style={{ padding: '0.6rem 1rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.2rem 0.6rem', borderRadius: '99px',
                    fontSize: '0.78rem', fontWeight: 700,
                    background: (ACTION_COLOR[e.action] ?? '#6b7280') + '20',
                    color: ACTION_COLOR[e.action] ?? '#6b7280',
                    border: `1px solid ${(ACTION_COLOR[e.action] ?? '#6b7280')}40`,
                  }}>
                    {ACTION_ICON[e.action] ?? '•'} {e.action}
                  </span>
                </td>

                {/* Entity */}
                <td style={{ padding: '0.6rem 1rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    {entityIcon(e.entity)} <span style={{ fontWeight: 500 }}>{e.entity}</span>
                  </span>
                </td>

                {/* ID */}
                <td style={{ padding: '0.6rem 1rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                  {e.entity_id > 0 ? `#${e.entity_id}` : '–'}
                </td>

                {/* User */}
                <td style={{ padding: '0.6rem 1rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.2rem 0.5rem', borderRadius: '6px',
                    background: '#f3f4f6', fontSize: '0.8rem',
                  }}>
                    👤 {e.user}
                  </span>
                </td>

                {/* Details */}
                <td style={{ padding: '0.6rem 1rem', color: '#6b7280', maxWidth: '320px' }}>
                  <span title={e.details} style={{
                    display: 'block', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {e.details || <em style={{ color: '#d1d5db' }}>–</em>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length > 0 && (
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.75rem' }}>
          {visible.length} Einträge angezeigt
        </p>
      )}
    </div>
  );
}
