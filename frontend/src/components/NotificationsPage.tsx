/**
 * NotificationsPage — Full-page view of all notifications with filtering and bulk actions.
 */
import { useState, useEffect, useCallback } from 'react';

const BASE = import.meta.env.VITE_API_URL ?? '';

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  recipient_employee_id: number | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

function typeIcon(type: string): string {
  switch (type) {
    case 'absence_status': return '📋';
    case 'swap_request': return '🔄';
    case 'conflict': return '⚠️';
    case 'info': return 'ℹ️';
    case 'shift_change': return '📅';
    default: return '🔔';
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'absence_status': return 'Abwesenheit';
    case 'swap_request': return 'Tausch';
    case 'conflict': return 'Konflikt';
    case 'info': return 'Info';
    case 'shift_change': return 'Schichtänderung';
    default: return 'Sonstige';
  }
}

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return isoStr; }
}

function formatAge(isoStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diff < 60) return 'gerade eben';
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
    if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
    return `vor ${Math.floor(diff / 86400)} Tag(en)`;
  } catch { return ''; }
}

type FilterType = 'all' | 'unread' | 'read';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      // Fetch planner-wide notifications (limit 200 for full page)
      const res = await fetch(`${BASE}/api/notifications?limit=200`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = async (id: number) => {
    try {
      await fetch(`${BASE}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch(`${BASE}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* ignore */ } finally {
      setMarkingAll(false);
    }
  };

  const dismiss = async (id: number) => {
    try {
      await fetch(`${BASE}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* ignore */ }
  };

  // Derive unique notification types for filter
  const availableTypes = Array.from(new Set(notifications.map(n => n.type))).sort();

  // Apply filters
  const filtered = notifications.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (filter === 'read' && !n.read) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            🔔 Benachrichtigungen
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-sm bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-full font-bold">
                {unreadCount} ungelesen
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {notifications.length} Benachrichtigungen insgesamt
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
          >
            {markingAll ? 'Wird markiert…' : '✓ Alle als gelesen markieren'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {([['all', 'Alle'], ['unread', 'Ungelesen'], ['read', 'Gelesen']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {availableTypes.length > 1 && (
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300"
          >
            <option value="all">Alle Typen</option>
            {availableTypes.map(t => (
              <option key={t} value={t}>{typeIcon(t)} {typeLabel(t)}</option>
            ))}
          </select>
        )}
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full mb-3" />
          <p className="text-sm">Lade Benachrichtigungen…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-lg font-medium mb-1">
            {filter === 'unread' ? 'Keine ungelesenen Benachrichtigungen' : 'Keine Benachrichtigungen'}
          </p>
          <p className="text-sm">
            {filter === 'unread' ? 'Du bist auf dem neusten Stand!' : 'Hier erscheinen zukünftige Benachrichtigungen.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div
              key={n.id}
              className={`relative flex gap-4 p-4 rounded-xl border transition-all ${
                !n.read
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* Icon */}
              <div className="text-2xl shrink-0 mt-0.5">{typeIcon(n.type)}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className={`text-sm font-semibold leading-snug ${
                      !n.read ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      {n.title}
                      {!n.read && (
                        <span className="inline-block ml-2 w-2 h-2 rounded-full bg-blue-500 align-middle" />
                      )}
                    </h3>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
                      {typeLabel(n.type)}
                    </span>
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    aria-label="Entfernen"
                    title="Entfernen"
                    className="text-gray-400 hover:text-red-500 transition-colors shrink-0 p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{n.message}</p>

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500" title={formatDate(n.created_at)}>
                    {formatAge(n.created_at)}
                  </span>
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      Als gelesen markieren
                    </button>
                  )}
                  {n.link && (
                    <a
                      href={n.link}
                      onClick={() => markRead(n.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      Ansehen →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
