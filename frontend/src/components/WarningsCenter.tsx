import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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

// ─── localStorage helpers ─────────────────────────────────────
const STORAGE_KEY = 'sp5_dismissed_warnings';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(dismissed: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
  } catch {
    // ignore storage errors
  }
}

function makeWarningKey(w: Warning): string {
  // Key combines type + date + employee_id to allow re-trigger if data changes
  return `${w.type}|${w.date ?? ''}|${w.employee_id ?? ''}|${w.title}`;
}

// ─── Icon by type ─────────────────────────────────────────────
function warningIcon(type: Warning['type'], severity: Warning['severity']): string {
  if (severity === 'error') return '🔴';
  if (type === 'next_month_unplanned') return '📅';
  if (type === 'overtime_exceeded') return '⏰';
  if (type === 'understaffing') return '👥';
  if (type === 'conflict') return '⚠️';
  return '🟡';
}

// ─── Severity badge color ─────────────────────────────────────
function severityClass(severity: Warning['severity']): string {
  if (severity === 'error') return 'text-red-600 dark:text-red-400';
  if (severity === 'warning') return 'text-amber-600 dark:text-amber-400';
  return 'text-blue-600 dark:text-blue-400';
}

// ─── Type label (DE) ──────────────────────────────────────────
function typeLabel(type: Warning['type']): string {
  const map: Record<Warning['type'], string> = {
    next_month_unplanned: 'Planung fehlt',
    overtime_exceeded: 'Überstunden',
    understaffing: 'Unterbesetzung',
    conflict: 'Konflikt',
  };
  return map[type] ?? type;
}

// ─── Main component ───────────────────────────────────────────
export default function WarningsCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch warnings from backend
  const fetchWarnings = useCallback(async () => {
    setLoading(true);
    try {
      const BASE = import.meta.env.VITE_API_URL ?? '';
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const res = await fetch(`${BASE}/api/warnings?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Laden fehlgeschlagen');
      const data: WarningsResponse = await res.json();
      setWarnings(data.warnings ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + every 5 minutes
  useEffect(() => {
    fetchWarnings();
    const timer = setInterval(fetchWarnings, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchWarnings]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Filter out dismissed
  const activeWarnings = warnings.filter(w => !dismissed.has(makeWarningKey(w)));
  const activeCount = activeWarnings.length;

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

  // Dismiss all
  const dismissAll = useCallback(() => {
    setDismissed(prev => {
      const next = new Set(prev);
      activeWarnings.forEach(w => next.add(makeWarningKey(w)));
      saveDismissed(next);
      return next;
    });
  }, [activeWarnings]);

  // Reset dismissed (for testing — clears localStorage)
  const resetDismissed = useCallback(() => {
    setDismissed(new Set());
    saveDismissed(new Set());
  }, []);

  // Navigate and close
  const handleLink = useCallback((link: string) => {
    setOpen(false);
    navigate(link);
  }, [navigate]);

  // Group by type for display order
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
        title="Warnungen & Hinweise"
        aria-label={`${activeCount} Warnungen`}
        className="relative text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
      >
        <span className="text-base leading-none">🔔</span>
        {activeCount > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex items-center justify-center
                       min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white
                       text-[10px] font-bold leading-none"
          >
            {activeCount > 99 ? '99+' : activeCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 w-96 max-h-[80vh] overflow-hidden
                     bg-white dark:bg-slate-800 rounded-xl shadow-2xl border
                     border-slate-200 dark:border-slate-700 flex flex-col"
          style={{ minWidth: '320px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span>🔔</span>
              <span className="font-semibold text-slate-800 dark:text-white text-sm">
                Warnungen
              </span>
              {activeCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full
                                 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400
                                 text-xs font-bold">
                  {activeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              )}
              {activeCount > 0 && (
                <button
                  onClick={dismissAll}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700
                             dark:hover:text-white transition-colors"
                >
                  Alle ignorieren
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

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {activeCount === 0 ? (
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
                    {/* Group header */}
                    <div className="px-4 py-1.5 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {typeLabel(type as Warning['type'])}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        ({items.length})
                      </span>
                    </div>
                    {/* Items */}
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
                          {/* Dismiss button */}
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
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between">
            <button
              onClick={fetchWarnings}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              🔄 Aktualisieren
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Monat {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
