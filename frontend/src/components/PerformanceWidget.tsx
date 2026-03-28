import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthResponse {
  status: string;
  checks: {
    db: string;
    disk: string;
    memory: string;
  };
  version: string;
  uptime: string;
  uptime_seconds: number;
  started_at: string;
  db: {
    status: string;
    dbf_ok: number;
    dbf_missing: string[];
    last_modified?: string;
  };
  disk: {
    free_mb: number;
    total_mb: number;
    used_percent: number;
    db_dir_size_mb?: number;
  };
  memory: {
    rss_mb: number;
    system_used_percent: number;
    system_available_mb: number;
  };
  sessions: {
    active: number;
  };
}

interface PerformanceData {
  health: HealthResponse;
  responseTimeMs: number;
  fetchedAt: Date;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;

// Response time thresholds (ms)
const RESPONSE_GOOD = 200;
const RESPONSE_WARN = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string): { dot: string; text: string; bg: string } {
  switch (status) {
    case 'ok':
    case 'healthy':
      return { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50' };
    case 'warning':
    case 'degraded':
      return { dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50' };
    default:
      return { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' };
  }
}

function responseTimeColor(ms: number): { dot: string; text: string; label: string } {
  if (ms <= RESPONSE_GOOD) return { dot: 'bg-green-500', text: 'text-green-700', label: 'Schnell' };
  if (ms <= RESPONSE_WARN) return { dot: 'bg-yellow-500', text: 'text-yellow-700', label: 'OK' };
  return { dot: 'bg-red-500', text: 'text-red-700', label: 'Langsam' };
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PerformanceWidget() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const start = performance.now();
      const res = await fetch('/api/v1/health');
      const responseTimeMs = Math.round(performance.now() - start);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const health: HealthResponse = await res.json();
      setData({ health, responseTimeMs, fetchedAt: new Date() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchHealth(false);
  }, [fetchHealth]);

  // Auto-refresh
  useEffect(() => {
    timerRef.current = setInterval(() => fetchHealth(true), REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchHealth]);

  // ── Loading skeleton ──
  if (loading && !data) {
    return (
      <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-3" data-testid="performance-widget-skeleton">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="text-lg">⚡</span>
          <div className="animate-pulse bg-gray-200 rounded h-4 w-40" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg p-3 h-16" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error && !data) {
    return (
      <div className="bg-white rounded-xl shadow p-5" data-testid="performance-widget-error">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-3">
          <span className="text-lg">⚡</span>
          <h2 className="font-semibold text-gray-700 text-sm">System-Performance</h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ Health-Check fehlgeschlagen: {error}
          <button
            onClick={() => fetchHealth(false)}
            className="ml-2 underline hover:no-underline"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { health, responseTimeMs, fetchedAt } = data;
  const rtColor = responseTimeColor(responseTimeMs);
  const overallColor = statusColor(health.status);
  const dbColor = statusColor(health.checks.db);
  const memColor = statusColor(health.checks.memory);
  const diskColor = statusColor(health.checks.disk);

  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-3" data-testid="performance-widget">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
        <span className="text-lg">⚡</span>
        <h2 className="font-semibold text-gray-700 text-sm flex-1">System-Performance</h2>
        {/* Overall status badge */}
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${overallColor.bg} ${overallColor.text}`}>
          {health.status}
        </span>
        {/* Manual refresh */}
        <button
          onClick={() => fetchHealth(true)}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-50"
          title="Manuell aktualisieren"
          data-testid="performance-refresh-btn"
        >
          🔄
        </button>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* API Response Time */}
        <div className="rounded-lg border border-gray-100 p-3 flex flex-col gap-1" data-testid="metric-response-time">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            <span className={`w-2 h-2 rounded-full ${rtColor.dot}`} />
            Antwortzeit
          </div>
          <div className={`text-xl font-black ${rtColor.text}`} data-testid="response-time-value">
            {`${responseTimeMs} ms`}
          </div>
          <div className="text-[10px] text-gray-400" data-testid="response-time-label">{rtColor.label}</div>
        </div>

        {/* DB Status */}
        <div className="rounded-lg border border-gray-100 p-3 flex flex-col gap-1" data-testid="metric-db-status">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            <span className={`w-2 h-2 rounded-full ${dbColor.dot}`} />
            Datenbank
          </div>
          <div className={`text-xl font-black ${dbColor.text}`}>
            {health.checks.db === 'ok' ? '✓' : '✗'}
          </div>
          <div className="text-[10px] text-gray-400">
            {health.db.dbf_ok} DBF OK
            {health.db.dbf_missing.length > 0 && `, ${health.db.dbf_missing.length} fehlt`}
          </div>
        </div>

        {/* Uptime */}
        <div className="rounded-lg border border-gray-100 p-3 flex flex-col gap-1" data-testid="metric-uptime">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Uptime
          </div>
          <div className="text-xl font-black text-blue-700">
            {health.uptime}
          </div>
          <div className="text-[10px] text-gray-400">v{health.version}</div>
        </div>

        {/* Memory (Process RSS) */}
        <div className="rounded-lg border border-gray-100 p-3 flex flex-col gap-1" data-testid="metric-memory">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            <span className={`w-2 h-2 rounded-full ${memColor.dot}`} />
            Speicher (RSS)
          </div>
          <div className={`text-xl font-black ${memColor.text}`}>
            {formatBytes(health.memory.rss_mb)}
          </div>
          <div className="text-[10px] text-gray-400">
            System: {health.memory.system_used_percent}% belegt
          </div>
        </div>

        {/* Disk */}
        <div className="rounded-lg border border-gray-100 p-3 flex flex-col gap-1" data-testid="metric-disk">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            <span className={`w-2 h-2 rounded-full ${diskColor.dot}`} />
            Festplatte
          </div>
          <div className={`text-xl font-black ${diskColor.text}`}>
            {health.disk.used_percent}%
          </div>
          <div className="text-[10px] text-gray-400">
            {formatBytes(health.disk.free_mb)} frei
          </div>
        </div>

        {/* Sessions */}
        <div className="rounded-lg border border-gray-100 p-3 flex flex-col gap-1" data-testid="metric-sessions">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Sessions
          </div>
          <div className="text-xl font-black text-purple-700">
            {health.sessions.active}
          </div>
          <div className="text-[10px] text-gray-400">aktive Sitzungen</div>
        </div>
      </div>

      {/* Footer: last refresh time */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-50">
        <span>
          Aktualisiert: {fetchedAt.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span className="flex items-center gap-1">
          <span className="animate-pulse text-green-400">●</span>
          Auto-Refresh 30s
        </span>
        {error && (
          <span className="text-orange-500">⚠ Letzter Refresh fehlgeschlagen</span>
        )}
      </div>
    </div>
  );
}
