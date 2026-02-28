import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { ChangelogEntry } from '../api/client';
import { Badge } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import { PageHeader } from '../components/PageHeader';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Erstellt',
  UPDATE: 'Geändert',
  DELETE: 'Gelöscht',
};

const ENTITY_LABELS: Record<string, string> = {
  employee: 'Mitarbeiter',
  group: 'Gruppe',
  shift: 'Schichtart',
  leave_type: 'Abwesenheitsart',
  holiday: 'Feiertag',
  workplace: 'Arbeitsplatz',
  schedule: 'Dienstplan',
  absence: 'Abwesenheit',
  user: 'Benutzer',
  extracharge: 'Zeitzuschlag',
  api: 'API',
};

const ACTION_BADGE_VARIANT: Record<string, 'green' | 'blue' | 'red' | 'gray'> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
};

function ActionBadge({ action }: { action: string }) {
  return (
    <Badge variant={ACTION_BADGE_VARIANT[action] ?? 'gray'}>
      {ACTION_LABELS[action] ?? action}
    </Badge>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function Protokoll() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterEntity, setFilterEntity] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(200);

  const load = () => {
    setLoading(true);
    setError(null);
    api.getChangelog({
      limit,
      user: filterUser || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    })
      .then(data => {
        setEntries(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // Client-side filter for action + entity + full-text search
  const filtered = entries.filter(e => {
    if (filterAction && e.action !== filterAction) return false;
    if (filterEntity && e.entity !== filterEntity) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const detailsMatch = (e.details || '').toLowerCase().includes(q);
      const entityMatch = (ENTITY_LABELS[e.entity] ?? e.entity).toLowerCase().includes(q);
      const userMatch = e.user.toLowerCase().includes(q);
      if (!detailsMatch && !entityMatch && !userMatch) return false;
    }
    return true;
  });

  // Collect unique users + entities for filter dropdowns
  const uniqueUsers = [...new Set(entries.map(e => e.user))].sort();
  const uniqueEntities = [...new Set(entries.map(e => e.entity))].sort();

  // Summary counts
  const creates = entries.filter(e => e.action === 'CREATE').length;
  const updates = entries.filter(e => e.action === 'UPDATE').length;
  const deletes = entries.filter(e => e.action === 'DELETE').length;

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      {/* Header */}
      <PageHeader
        title="📋 Aktivitätsprotokoll"
        subtitle={`${filtered.length} Einträge${loading ? ' – Lade…' : ''}${error ? ` – Fehler: ${error}` : ''}`}
        actions={
          <button
            onClick={() => window.print()}
            className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard accent="green" label="Erstellt" value={creates} icon="✅" />
        <StatCard accent="blue"  label="Geändert" value={updates} icon="✏️" />
        <StatCard accent="red"   label="Gelöscht" value={deletes} icon="🗑️" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
        <span className="text-xs font-semibold text-gray-500">🔍 Filter:</span>

        {/* Full-text search */}
        <input
          type="text"
          placeholder="Volltextsuche..."
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="text-xs px-2 py-1 border rounded bg-white w-36"
        />

        {/* Action filter */}
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="text-xs px-2 py-1 border rounded bg-white"
        >
          <option value="">Alle Aktionen</option>
          <option value="CREATE">Erstellt</option>
          <option value="UPDATE">Geändert</option>
          <option value="DELETE">Gelöscht</option>
        </select>

        {/* Entity filter */}
        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
          className="text-xs px-2 py-1 border rounded bg-white"
        >
          <option value="">Alle Objekte</option>
          {uniqueEntities.map(en => (
            <option key={en} value={en}>{ENTITY_LABELS[en] ?? en}</option>
          ))}
        </select>

        {/* User filter */}
        <select
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          className="text-xs px-2 py-1 border rounded bg-white"
        >
          <option value="">Alle Benutzer</option>
          {uniqueUsers.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">Von:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-xs px-2 py-1 border rounded bg-white"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">Bis:</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-xs px-2 py-1 border rounded bg-white"
          />
        </div>

        {/* Limit */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">Max:</label>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="text-xs px-2 py-1 border rounded bg-white"
          >
            <option value={50}>50</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </div>

        <button
          onClick={load}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 ml-auto"
        >
          🔄 Aktualisieren
        </button>

        {(filterSearch || filterAction || filterEntity || filterUser || dateFrom || dateTo) && (
          <button
            onClick={() => { setFilterSearch(''); setFilterAction(''); setFilterEntity(''); setFilterUser(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
          >
            × Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow border border-gray-200">
        {filtered.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📋</div>
            <div className="text-lg font-medium mb-1">Keine Protokolleinträge</div>
            <div className="text-sm">Aktionen werden ab sofort automatisch protokolliert.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left border border-gray-200 font-semibold whitespace-nowrap text-xs">Zeitpunkt</th>
                <th className="px-3 py-2 text-left border border-gray-200 font-semibold text-xs">Benutzer</th>
                <th className="px-3 py-2 text-left border border-gray-200 font-semibold text-xs">Aktion</th>
                <th className="px-3 py-2 text-left border border-gray-200 font-semibold text-xs">Objekt</th>
                <th className="px-3 py-2 text-right border border-gray-200 font-semibold text-xs">ID</th>
                <th className="px-3 py-2 text-left border border-gray-200 font-semibold text-xs">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => {
                const rowBg =
                  entry.action === 'DELETE' ? (i % 2 === 0 ? 'bg-red-50' : 'bg-red-50/70') :
                  entry.action === 'CREATE' ? (i % 2 === 0 ? 'bg-green-50' : 'bg-green-50/70') :
                  i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                return (
                  <tr key={i} className={`${rowBg} hover:brightness-95 transition-all`}>
                    <td className="px-3 py-1.5 border border-gray-100 text-gray-600 whitespace-nowrap text-xs font-mono">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-3 py-1.5 border border-gray-100 text-xs">
                      <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                        {entry.user}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border border-gray-100 text-xs">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-3 py-1.5 border border-gray-100 text-xs font-medium text-gray-700">
                      {ENTITY_LABELS[entry.entity] ?? entry.entity}
                    </td>
                    <td className="px-3 py-1.5 border border-gray-100 text-right text-xs text-gray-500 font-mono">
                      {entry.entity_id > 0 ? entry.entity_id : '—'}
                    </td>
                    <td className="px-3 py-1.5 border border-gray-100 text-xs text-gray-500 max-w-xs truncate" title={entry.details}>
                      {entry.details || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        Protokoll wird automatisch bei Erstellen, Ändern und Löschen von Daten geschrieben. Max. 1000 Einträge werden gespeichert.
      </div>
    </div>
  );
}
