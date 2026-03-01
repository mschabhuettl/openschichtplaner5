/**
 * NotificationBell — In-App Benachrichtigungen mit Badge-Counter.
 * Pollt alle 60s nach neuen Notifications. Unterstützt "gelesen markieren".
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const BASE = import.meta.env.VITE_API_URL ?? '';
const POLL_INTERVAL_MS = 60_000;

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
    default: return '🔔';
  }
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

interface Props {
  /** The logged-in employee id, if known (for employee-specific notifications) */
  employeeId?: number | null;
}

export function NotificationBell({ employeeId }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      // Fetch planner-wide + optionally employee-specific notifications
      const headers = getAuthHeaders();
      const urls = [`${BASE}/api/notifications`]; // planner-wide (no employee_id = None on server)
      if (employeeId) {
        urls.push(`${BASE}/api/notifications?employee_id=${employeeId}`);
      }
      const results = await Promise.all(
        urls.map(url => fetch(url, { headers }).then(r => r.ok ? r.json() : { notifications: [] }))
      );
      const merged: Notification[] = [];
      const seen = new Set<number>();
      for (const res of results) {
        for (const n of (res.notifications ?? [])) {
          if (!seen.has(n.id)) { seen.add(n.id); merged.push(n); }
        }
      }
      merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setNotifications(merged);
    } catch { /* network error — ignore */ }
  }, [employeeId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.read).length;

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
    setLoading(true);
    try {
      // Mark planner-wide
      await fetch(`${BASE}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      // Mark employee-specific if needed
      if (employeeId) {
        await fetch(`${BASE}/api/notifications/read-all?employee_id=${employeeId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
        });
      }
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* ignore */ } finally {
      setLoading(false);
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

  const handleBellClick = () => {
    setOpen(o => !o);
    if (!open) fetchNotifications(); // refresh on open
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleBellClick}
        aria-label={`Benachrichtigungen${unreadCount > 0 ? ` (${unreadCount} ungelesen)` : ''}`}
        title="Benachrichtigungen"
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
              🔔 Benachrichtigungen
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 rounded-full font-bold">
                  {unreadCount} neu
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium disabled:opacity-50"
              >
                Alle gelesen
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                <div className="text-3xl mb-2">🎉</div>
                Keine Benachrichtigungen
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`relative flex gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${!n.read ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
                >
                  {/* Unread dot */}
                  {!n.read && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                  <span className="text-xl shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-snug ${!n.read ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
                        {n.title}
                      </p>
                      <button
                        onClick={() => dismiss(n.id)}
                        aria-label="Entfernen"
                        className="text-gray-400 hover:text-gray-600 text-xs shrink-0 leading-none mt-0.5"
                      >✕</button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-gray-400">{formatAge(n.created_at)}</span>
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                        >
                          Als gelesen markieren
                        </button>
                      )}
                      {n.link && (
                        <a
                          href={n.link}
                          onClick={() => { markRead(n.id); setOpen(false); }}
                          className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                        >
                          Ansehen →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
