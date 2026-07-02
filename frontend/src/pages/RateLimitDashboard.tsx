import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
const BASE_URL = import.meta.env.VITE_API_URL ?? '';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────
interface RateLimitEvent {
  timestamp: string;
  user: string;
  ip: string;
  endpoint: string;
  detail: string;
}

interface TopEntry {
  name: string;
  count: number;
}

interface RateLimitResponse {
  count: number;
  events: RateLimitEvent[];
  summary: {
    top_users: TopEntry[];
    top_endpoints: TopEntry[];
    top_ips: TopEntry[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function buildTimelineData(events: RateLimitEvent[]): { time: string; count: number }[] {
  const buckets: Record<string, number> = {};
  for (const evt of events) {
    const hour = evt.timestamp.slice(0, 13);
    buckets[hour] = (buckets[hour] || 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({
      time: time.replace('T', ' ') + ':00',
      count,
    }));
}

function getPresetSince(preset: string): string | undefined {
  const now = new Date();
  switch (preset) {
    case '1h':  return new Date(now.getTime() - 3600_000).toISOString();
    case '24h': return new Date(now.getTime() - 86400_000).toISOString();
    case '7d':  return new Date(now.getTime() - 7 * 86400_000).toISOString();
    case '30d': return new Date(now.getTime() - 30 * 86400_000).toISOString();
    default:    return undefined;
  }
}

// ─── Component ────────────────────────────────────────────────
export default function RateLimitDashboard() {
  const [data, setData] = useState<RateLimitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState('24h');
  const [userFilter, setUserFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const since = getPresetSince(preset);
      if (since) params.set('since', since);
      if (userFilter.trim()) params.set('user', userFilter.trim());
      params.set('limit', '2000');

      const token = document.cookie.split('; ').find(c => c.startsWith('sp5_token='))?.split('=')[1] ?? '';
      const headers: Record<string, string> = {};
      if (token) headers['X-Auth-Token'] = token;
      const res = await fetch(`${BASE_URL}/api/v1/admin/rate-limits?${params.toString()}`, { headers, credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Laden';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [preset, userFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-6 text-red-500">❌ {error}</div>;
  if (!data) return <EmptyState title="Keine Daten" description="Rate-Limit-Events konnten nicht geladen werden." />;

  const timeline = buildTimelineData(data.events);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Rate-Limit Dashboard"
        subtitle="🚦 Übersicht aller 429-Events (Zu viele Anfragen)"
        
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {['1h', '24h', '7d', '30d', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                preset === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {p === 'all' ? 'Alle' : p}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="User filtern…"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="px-3 py-1 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
        />
        <button
          onClick={fetchData}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-500"
        >
          🔄 Aktualisieren
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Events gesamt" value={data.count}  />
        <StatCard
          label="Top-User"
          value={data.summary.top_users[0]?.name || '–'}
          icon="👤"
        />
        <StatCard
          label="Top-Endpoint"
          value={data.summary.top_endpoints[0]?.name || '–'}
          icon="🔗"
        />
      </div>

      {data.count === 0 ? (
        <EmptyState
          title="Keine Rate-Limit-Events"
          description="Im gewählten Zeitraum wurden keine Anfragen limitiert. 🎉"
        />
      ) : (
        <>
          {/* Timeline Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">
              📈 Timeline (pro Stunde)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#ef4444"
                  fill="#fecaca"
                  name="Events"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top Users + Top Endpoints */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">
                👤 Top-User (limitiert)
              </h3>
              {data.summary.top_users.length === 0 ? (
                <p className="text-gray-500 text-sm">Keine Daten</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.summary.top_users.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" name="Events" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">
                🔗 Top-Endpoints
              </h3>
              {data.summary.top_endpoints.length === 0 ? (
                <p className="text-gray-500 text-sm">Keine Daten</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.summary.top_endpoints.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" name="Events" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Event Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">
              📋 Letzte Events ({data.count})
            </h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Zeitpunkt</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">User</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">IP</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Endpoint</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.slice(0, 200).map((evt, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                        {formatDate(evt.timestamp)}
                      </td>
                      <td className="px-3 py-2">
                        {evt.user || <span className="text-gray-400 italic">anonym</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{evt.ip}</td>
                      <td className="px-3 py-2 font-mono text-xs">{evt.endpoint}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">
                        {evt.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
