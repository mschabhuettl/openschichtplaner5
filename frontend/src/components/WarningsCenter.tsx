import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}

// ─── Warning types ────────────────────────────────────────────
export interface Warning {
  id: number;
  type: 'next_month_unplanned' | 'overtime_exceeded' | 'understaffing' | 'conflict';
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  link: string;
  link_label: string;
  employee_id?: number;
  date?: string;
}

interface WarningsResponse {
  warnings: Warning[];
  count: number;
  year: number;
  month: number;
  generated_at: string;
}

// ─── Activity types ───────────────────────────────────────────
interface ActivityEntry {
  id?: number;
  user: string;
  action: string;       // CREATE / UPDATE / DELETE
  entity: string;
  entity_id: number;
  details?: string;
  timestamp: string;    // ISO datetime
}

interface ChangelogResponse {
  entries: ActivityEntry[];
}

// ─── localStorage helpers ─────────────────────────────────────
const STORAGE_KEY = 'sp5_dismissed_warnings';
const LAST_SEEN_KEY = 'sp5_notifications_last_seen';
const LAST_ACTIVITY_SEEN_KEY = 'sp5_activity_last_seen';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

function saveDismissed(dismissed: Set<string>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed])); } catch { /* ignore */ }
}

function makeWarningKey(w: Warning): string {
  return `${w.type}|${w.date ?? ''}|${w.employee_id ?? ''}|${w.title}`;
}

function getLastSeen(key: string): number {
  try { return parseInt(localStorage.getItem(key) ?? '0', 10) || 0; } catch { return 0; }
}
function setLastSeen(key: string): void {
  try { localStorage.setItem(key, Date.now().toString()); } catch { /* ignore */ }
}

// ─── Icon / label helpers ─────────────────────────────────────
function warningIcon(type: Warning['type'], severity: Warning['severity']): string {
  if (severity === 'error') return '🔴';
  if (type === 'next_month_unplanned') return '📅';
  if (type === 'overtime_exceeded') return '⏰';
  if (type === 'understaffing') return '👥';
  if (type === 'conflict') return '⚠️';
  return '🟡';
}

function severityClass(severity: Warning['severity']): string {
  if (severity === 'error') return 'text-red-600 dark:text-red-400';
  if (severity === 'warning') return 'text-amber-600 dark:text-amber-400';
  return 'text-blue-600 dark:text-blue-400';
}

function typeLabel(type: Warning['type']): string {
  const map: Record<Warning['type'], string> = {
    next_month_unplanned: 'Planung fehlt',
    overtime_exceeded: 'Überstunden',
    understaffing: 'Unterbesetzung',
    conflict: 'Konflikt',
  };
  return map[type] ?? type;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE: 'erstellt',
    UPDATE: 'geändert',
    DELETE: 'gelöscht',
  };
  return map[action.toUpperCase()] ?? action.toLowerCase();
}

function entityLabel(entity: string): string {
  const map: Record<string, string> = {
    employee: 'Mitarbeiter',
    shift: 'Schichtart',
    schedule: 'Dienstplan',
    absence: 'Abwesenheit',
    group: 'Gruppe',
    workplace: 'Arbeitsplatz',
    holiday: 'Feiertag',
    leave_type: 'Abwesenheitsart',
    wish: 'Schichtwunsch',
    note: 'Notiz',
  };
  return map[entity.toLowerCase()] ?? entity;
}

function actionIcon(action: string): string {
  if (action === 'CREATE') return '✨';
  if (action === 'DELETE') return '🗑️';
  return '✏️';
}

function formatRelative(ts: string): string {
  try {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return `vor ${mins} Min.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'gestern';
    if (days < 7) return `vor ${days} Tagen`;
    return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
  } catch { return ''; }
}

// ─── Main component ───────────────────────────────────────────
export default function WarningsCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'warnings' | 'activity'>('warnings');
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  // Track "last seen" timestamps for unread badge
  const [, setLastWarningSeen] = useState<number>(() => getLastSeen(LAST_SEEN_KEY));
  const [lastActivitySeen, setLastActivitySeen] = useState<number>(() => getLastSeen(LAST_ACTIVITY_SEEN_KEY));

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch warnings from backend
  const fetchWarnings = useCallback(async () => {
    setLoading(true);
    try {
      const BASE = import.meta.env.VITE_API_URL ?? '';
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const res = await fetch(`${BASE}/api/warnings?year=${year}&month=${month}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Laden fehlgeschlagen');
      const data: WarningsResponse = await res.json();
      setWarnings(data.warnings ?? []);
    } catch { /* silently ignore */ } finally { setLoading(false); }
  }, []);

  // Fetch activity log
  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const BASE = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${BASE}/api/changelog?limit=20`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Laden fehlgeschlagen');
      const data: ChangelogResponse | ActivityEntry[] = await res.json();
      // Handle both array and {entries: [...]} formats
      const entries = Array.isArray(data) ? data : (data as ChangelogResponse).entries ?? [];
      setActivities(entries);
    } catch { /* silently ignore */ } finally { setActivityLoading(false); }
  }, []);

  // Fetch on mount + every 5 minutes
  useEffect(() => {
    fetchWarnings();
    fetchActivity();
    const timer = setInterval(() => { fetchWarnings(); fetchActivity(); }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchWarnings, fetchActivity]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // When dropdown opens, mark active tab as seen
  useEffect(() => {
    if (open) {
      if (activeTab === 'warnings') {
        setLastSeen(LAST_SEEN_KEY);
        setLastWarningSeen(Date.now());
      } else {
        setLastSeen(LAST_ACTIVITY_SEEN_KEY);
        setLastActivitySeen(Date.now());
      }
    }
  }, [open, activeTab]);

  // Filter out dismissed warnings
  const activeWarnings = warnings.filter(w => !dismissed.has(makeWarningKey(w)));

  // Unread warning count: warnings that were fetched but not "seen" yet
  // We track this by counting if there are any active warnings at all and last seen was before last fetch
  // Simpler: just count active (undismissed) warnings that exist
  const unreadWarnings = activeWarnings.length;

  // Unread activity count: activities newer than lastActivitySeen
  const newActivities = activities.filter(a => {
    try { return new Date(a.timestamp).getTime() > lastActivitySeen; } catch { return false; }
  });
  const unreadActivity = newActivities.length;

  const totalUnread = unreadWarnings + unreadActivity;

  // Dismiss a single warning
  const dismiss = useCallback((w: Warning, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = makeWarningKey(w);
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      saveDismissed(next);
      return next;
    });
  }, []);

  // Dismiss all warnings
  const dismissAll = useCallback(() => {
    setDismissed(prev => {
      const next = new Set(prev);
      activeWarnings.forEach(w => next.add(makeWarningKey(w)));
      saveDismissed(next);
      return next;
    });
  }, [activeWarnings]);

  // Mark all as read (update last_seen, clear unread badge)
  const markAllRead = useCallback(() => {
    setLastSeen(LAST_SEEN_KEY);
    setLastWarningSeen(Date.now());
    setLastSeen(LAST_ACTIVITY_SEEN_KEY);
    setLastActivitySeen(Date.now());
  }, []);

  // Reset dismissed (for testing)
  const resetDismissed = useCallback(() => {
    setDismissed(new Set());
    saveDismissed(new Set());
  }, []);

  // Navigate and close
  const handleLink = useCallback((link: string) => {
    setOpen(false);
    navigate(link);
  }, [navigate]);

  // Switch tab + mark as seen
  const switchTab = useCallback((tab: 'warnings' | 'activity') => {
    setActiveTab(tab);
    if (tab === 'warnings') {
      setLastSeen(LAST_SEEN_KEY);
      setLastWarningSeen(Date.now());
    } else {
      setLastSeen(LAST_ACTIVITY_SEEN_KEY);
      setLastActivitySeen(Date.now());
    }
  }, []);

  // Group warnings by type
  const grouped: Record<string, Warning[]> = {};
  for (const w of activeWarnings) {
    if (!grouped[w.type]) grouped[w.type] = [];
    grouped[w.type].push(w);
  }
  const typeOrder: Warning['type'][] = ['conflict', 'understaffing', 'overtime_exceeded', 'next_month_unplanned'];
  const sortedGroups = typeOrder
    .filter(t => grouped[t] && grouped[t].length > 0)
    .map(t => ({ type: t, items: grouped[t] }));

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        title="Benachrichtigungen & Warnungen"
        aria-label={`${totalUnread} ungelesene Benachrichtigungen`}
        className="relative text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
      >
        <span className="text-base leading-none">🔔</span>
        {totalUnread > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex items-center justify-center
                       min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white
                       text-[10px] font-bold leading-none"
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-50 w-96 max-h-[80vh] overflow-hidden
                     bg-white dark:bg-slate-800 rounded-xl shadow-2xl border
                     border-slate-200 dark:border-slate-700 flex flex-col"
          style={{ minWidth: '320px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span>🔔</span>
              <span className="font-semibold text-slate-800 dark:text-white text-sm">
                Benachrichtigungen
              </span>
              {totalUnread > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full
                                 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400
                                 text-xs font-bold">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(loading || activityLoading) && (
                <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              )}
              {totalUnread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800
                             dark:hover:text-blue-200 transition-colors font-medium"
                >
                  Alle gelesen
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-sm"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 px-2 pt-1">
            <button
              onClick={() => switchTab('warnings')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t transition-colors ${
                activeTab === 'warnings'
                  ? 'text-slate-800 dark:text-white border-b-2 border-blue-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              ⚠️ Warnungen
              {unreadWarnings > 0 && activeTab !== 'warnings' && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full
                                 bg-red-500 text-white text-[9px] font-bold">
                  {unreadWarnings > 9 ? '9+' : unreadWarnings}
                </span>
              )}
            </button>
            <button
              onClick={() => switchTab('activity')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t transition-colors ${
                activeTab === 'activity'
                  ? 'text-slate-800 dark:text-white border-b-2 border-blue-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              📋 Aktivitäten
              {unreadActivity > 0 && activeTab !== 'activity' && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full
                                 bg-blue-500 text-white text-[9px] font-bold">
                  {unreadActivity > 9 ? '9+' : unreadActivity}
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">

            {/* ── Warnings Tab ── */}
            {activeTab === 'warnings' && (
              activeWarnings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Keine aktiven Warnungen
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                    Alles im grünen Bereich!
                  </div>
                  {dismissed.size > 0 && (
                    <button
                      onClick={resetDismissed}
                      className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {dismissed.size} ignorierte Warnungen zurücksetzen
                    </button>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  {sortedGroups.map(({ type, items }) => (
                    <div key={type}>
                      <div className="px-4 py-1.5 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {typeLabel(type as Warning['type'])}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          ({items.length})
                        </span>
                      </div>
                      {items.map(w => (
                        <div
                          key={w.id}
                          className="mx-2 mb-1 rounded-lg border border-slate-100 dark:border-slate-700
                                     hover:border-slate-200 dark:hover:border-slate-600 transition-colors
                                     overflow-hidden"
                        >
                          <div className="flex items-start gap-2 px-3 py-2.5">
                            <span className="mt-0.5 flex-shrink-0 text-sm">{warningIcon(w.type, w.severity)}</span>
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-semibold truncate ${severityClass(w.severity)}`}>
                                {w.title}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                {w.message}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <button
                                  onClick={() => handleLink(w.link)}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                >
                                  → {w.link_label}
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={(e) => dismiss(w, e)}
                              title="Ignorieren"
                              className="flex-shrink-0 text-slate-300 dark:text-slate-600
                                         hover:text-slate-500 dark:hover:text-slate-400
                                         transition-colors text-xs leading-none mt-0.5"
                              aria-label="Warnung ignorieren"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {activeWarnings.length > 0 && (
                    <div className="px-4 pt-1 pb-2">
                      <button
                        onClick={dismissAll}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700
                                   dark:hover:text-white transition-colors"
                      >
                        Alle ignorieren
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {/* ── Activity Tab ── */}
            {activeTab === 'activity' && (
              activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Keine Aktivitäten
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                    Noch keine Änderungen protokolliert.
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  {activities.map((a, idx) => {
                    const isNew = (() => {
                      try { return new Date(a.timestamp).getTime() > lastActivitySeen; } catch { return false; }
                    })();
                    return (
                      <div
                        key={a.id ?? idx}
                        className={`mx-2 mb-1 rounded-lg border transition-colors overflow-hidden ${
                          isNew
                            ? 'border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
                            : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start gap-2 px-3 py-2.5">
                          <span className="mt-0.5 flex-shrink-0 text-sm">{actionIcon(a.action)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {entityLabel(a.entity)} #{a.entity_id} {actionLabel(a.action)}
                              </span>
                              {isNew && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full
                                                 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400
                                                 text-[9px] font-bold uppercase tracking-wide">
                                  NEU
                                </span>
                              )}
                            </div>
                            {a.details && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed truncate">
                                {a.details}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                👤 {a.user}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                · {formatRelative(a.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between">
            <button
              onClick={() => { fetchWarnings(); fetchActivity(); }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              🔄 Aktualisieren
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
