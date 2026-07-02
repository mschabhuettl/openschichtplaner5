import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState, ApiErrorState } from '../components/EmptyState';
import { useApiData } from '../hooks/useApiData';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import type { OrmMirrorSyncResult } from '../api/client';

// ─── Component ────────────────────────────────────────────────
export default function OrmMirror() {
  const { showToast } = useToast();
  const { data, loading, error, refresh } = useApiData(() => api.getOrmMirrorStatus(), []);

  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncedCounts, setSyncedCounts] = useState<Record<string, number> | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res: OrmMirrorSyncResult = await api.syncOrmMirror();
      setSyncedCounts(res.synced);
      setLastSync(
        new Date().toLocaleString('de-AT', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }),
      );
      const total = Object.values(res.synced).reduce((a, b) => a + b, 0);
      showToast(`ORM-Spiegel synchronisiert: ${total} Zeilen ✓`, 'success');
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Synchronisierung fehlgeschlagen';
      showToast(msg, 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <LoadingSpinner message="ORM-Spiegel wird geladen …" />;
  if (error) return <ApiErrorState message={error} onRetry={refresh} />;
  if (!data) {
    return (
      <EmptyState
        title="Keine Daten"
        description="Der Status des ORM-Spiegels konnte nicht geladen werden."
      />
    );
  }

  const tableEntries = Object.entries(data.counts).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="ORM-Spiegel"
        subtitle="🗄️ Status & Synchronisierung der ORM-Spiegel-Datenbank"
        actions={
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            {syncing && (
              <span
                className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            {syncing ? 'Synchronisiere …' : '🔄 Jetzt synchronisieren'}
          </button>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={data.mirror_db_exists ? '✅' : '⚠️'}
          label="Spiegel-Datenbank"
          value={data.mirror_db_exists ? 'Vorhanden' : 'Fehlt'}
          accent={data.mirror_db_exists ? 'green' : 'orange'}
        />
        <StatCard icon="📊" label="Tabellen" value={data.table_count} accent="blue" />
        <StatCard icon="🔢" label="Zeilen gesamt" value={data.total_rows} accent="purple" />
      </div>

      {lastSync && (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Zuletzt synchronisiert: <span className="font-medium">{lastSync}</span>
        </p>
      )}

      {/* Per-table counts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">
          📋 Tabellen ({data.table_count})
        </h3>
        {tableEntries.length === 0 ? (
          <EmptyState title="Keine Tabellen" description="Der ORM-Spiegel enthält keine Tabellen." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">
                    Tabelle
                  </th>
                  <th scope="col" className="text-right px-3 py-2 font-medium text-gray-600 dark:text-gray-300">
                    Zeilen
                  </th>
                  <th scope="col" className="text-right px-3 py-2 font-medium text-gray-600 dark:text-gray-300">
                    Zuletzt synchronisiert
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableEntries.map(([name, count]) => (
                  <tr
                    key={name}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-slate-400">
                      {syncedCounts && name in syncedCounts ? syncedCounts[name] : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
