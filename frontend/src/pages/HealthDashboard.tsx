import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface HealthData {
  status: string;
  version: string;
  uptime_seconds: number;
  db: { status: string; path?: string; employees?: number; error?: string };
  cache: Record<string, unknown>;
  frontend_errors_count: number;
  recent_errors: Array<{ timestamp: string; level: string; message: string }>;
}

interface FrontendError {
  timestamp: string;
  error: string;
  component_stack?: string;
  url?: string;
  user_agent?: string;
  client_ip?: string;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function HealthDashboard() {
  const { token } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [feErrors, setFeErrors] = useState<FrontendError[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'backend-errors' | 'frontend-errors'>('overview');

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', {
        headers: token ? { 'x-auth-token': token } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (e) {
      setError(String(e));
    }
  }, [token]);

  const fetchFrontendErrors = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/frontend-errors', {
        headers: { 'x-auth-token': token },
      });
      if (!res.ok) return;
      const data = await res.json();
      setFeErrors(data.errors);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchHealth(), fetchFrontendErrors()]).finally(() => setLoading(false));
  }, [fetchHealth, fetchFrontendErrors]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin text-4xl mb-4">⟳</div>
        Lade System-Status…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        Fehler beim Laden: {error}
      </div>
    );
  }

  const statusColor = health?.status === 'ok' ? 'text-green-600' : 'text-red-600';
  const dbColor = health?.db?.status === 'connected' ? 'text-green-600' : 'text-red-600';

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">🩺 System Health Dashboard</h1>
        <button
          onClick={() => { fetchHealth(); fetchFrontendErrors(); }}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          ↻ Aktualisieren
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="text-xs text-slate-500 mb-1">Backend-Status</div>
          <div className={`text-xl font-bold ${statusColor}`}>
            {health?.status === 'ok' ? '✓ Online' : '✗ Fehler'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="text-xs text-slate-500 mb-1">Uptime</div>
          <div className="text-xl font-bold text-slate-800">
            {health ? formatUptime(health.uptime_seconds) : '-'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="text-xs text-slate-500 mb-1">Version</div>
          <div className="text-xl font-bold text-slate-800">{health?.version ?? '-'}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="text-xs text-slate-500 mb-1">Datenbank</div>
          <div className={`text-xl font-bold ${dbColor}`}>
            {health?.db?.status === 'connected' ? '✓ Verbunden' : '✗ Fehler'}
          </div>
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="text-xs text-slate-500 mb-1">Mitarbeiter in DB</div>
          <div className="text-2xl font-bold text-slate-800">{health?.db?.employees ?? '-'}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="text-xs text-slate-500 mb-1">Cache-Einträge</div>
          <div className="text-2xl font-bold text-slate-800">
            {health?.cache && typeof health.cache === 'object'
              ? (health.cache as Record<string, unknown>).entries !== undefined
                ? String((health.cache as Record<string, unknown>).entries)
                : Object.keys(health.cache as Record<string, unknown>).length
              : 0}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="text-xs text-slate-500 mb-1">Frontend-Fehler gesamt</div>
          <div className={`text-2xl font-bold ${(health?.frontend_errors_count ?? 0) > 0 ? 'text-orange-500' : 'text-slate-800'}`}>
            {health?.frontend_errors_count ?? 0}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex border-b border-slate-100">
          {(['overview', 'backend-errors', 'frontend-errors'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'overview' && 'Übersicht'}
              {tab === 'backend-errors' && `Backend-Fehler (${health?.recent_errors?.length ?? 0})`}
              {tab === 'frontend-errors' && `Frontend-Fehler (${health?.frontend_errors_count ?? 0})`}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">
                <span className="font-medium">DB-Pfad:</span>{' '}
                <code className="bg-slate-50 px-2 py-0.5 rounded text-xs">{health?.db?.path ?? '-'}</code>
              </div>
              {health?.db?.error && (
                <div className="text-sm text-red-600">
                  <span className="font-medium">DB-Fehler:</span> {health.db.error}
                </div>
              )}
              <div className="text-sm text-slate-500">
                Log-Datei: <code className="bg-slate-50 px-2 py-0.5 rounded text-xs">/tmp/sp5-api.log</code>
              </div>
            </div>
          )}

          {activeTab === 'backend-errors' && (
            <div className="space-y-2">
              {(health?.recent_errors?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">Keine Fehler in den letzten Logs 🎉</p>
              ) : (
                health?.recent_errors?.map((err, i) => (
                  <div key={i} className={`rounded-lg p-3 text-xs font-mono ${err.level === 'ERROR' ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-800'}`}>
                    <div className="flex justify-between mb-1">
                      <span className={`font-bold ${err.level === 'ERROR' ? 'text-red-600' : 'text-yellow-600'}`}>{err.level}</span>
                      <span className="text-slate-400">{err.timestamp}</span>
                    </div>
                    <div className="whitespace-pre-wrap break-all">{err.message}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'frontend-errors' && (
            <div className="space-y-2">
              {(feErrors?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">Keine Frontend-Fehler gemeldet 🎉</p>
              ) : (
                feErrors?.slice().reverse().map((err, i) => (
                  <div key={i} className="bg-orange-50 rounded-lg p-3 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-orange-700">Frontend-Fehler</span>
                      <span className="text-slate-400">{err.timestamp}</span>
                    </div>
                    <div className="text-orange-800 font-mono whitespace-pre-wrap break-all mb-1">{err.error.slice(0, 300)}</div>
                    {err.url && <div className="text-slate-500">URL: {err.url}</div>}
                    {err.client_ip && <div className="text-slate-400">IP: {err.client_ip}</div>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
