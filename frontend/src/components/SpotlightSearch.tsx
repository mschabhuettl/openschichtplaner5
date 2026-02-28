import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import type { SearchResult } from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../i18n/context';

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Navigation pages ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { title: 'Dashboard',         subtitle: 'Übersicht',             path: '/',                    icon: '🗂', keywords: ['dashboard', 'übersicht', 'g d'] },
  { title: 'Dienstplan',        subtitle: 'Schichtplanung',        path: '/schedule',             icon: '🗂', keywords: ['dienstplan', 'schedule', 'schicht', 'g p'] },
  { title: 'Mitarbeiter',       subtitle: 'Mitarbeiterverwaltung', path: '/employees',            icon: '🗂', keywords: ['mitarbeiter', 'employees', 'personal', 'g m'] },
  { title: 'Konflikte',         subtitle: 'Konfliktübersicht',     path: '/konflikte',            icon: '🗂', keywords: ['konflikte', 'conflicts', 'g k'] },
  { title: 'Statistiken',       subtitle: 'Auswertungen',          path: '/statistiken',          icon: '🗂', keywords: ['statistiken', 'statistics', 'auswertung', 'g s'] },
  { title: 'Urlaub',            subtitle: 'Urlaubsplanung',        path: '/urlaub',               icon: '🗂', keywords: ['urlaub', 'ferien', 'abwesenheit', 'g u'] },
  { title: 'Einsatzplan',       subtitle: 'Einsatzplanung',        path: '/einsatzplan',          icon: '🗂', keywords: ['einsatzplan', 'g e'] },
  { title: 'Schichtwünsche',    subtitle: 'Wunschverwaltung',      path: '/schichtwuensche',      icon: '🗂', keywords: ['schichtwünsche', 'wünsche', 'g w'] },
  { title: 'Notizen',           subtitle: 'Notizen & Aufgaben',    path: '/notizen',              icon: '🗂', keywords: ['notizen', 'notes', 'aufgaben', 'g n'] },
  { title: 'Analytics',         subtitle: 'Erweiterte Analysen',   path: '/analytics',            icon: '🗂', keywords: ['analytics', 'analyse', 'g a'] },
  { title: 'Kompetenz-Matrix',  subtitle: 'Qualifikationen',       path: '/kompetenz-matrix',     icon: '🗂', keywords: ['kompetenz', 'matrix', 'qualifikation', 'g q'] },
  { title: 'Tauschbörse',       subtitle: 'Schichttausch',         path: '/tauschboerse',         icon: '🗂', keywords: ['tausch', 'tauschbörse', 'g t'] },
  { title: 'Team-Übersicht',    subtitle: 'Team & Mitglieder',     path: '/team',                 icon: '👥', keywords: ['team', 'team-übersicht', 'alt+t', 'g v'] },
  { title: 'Team-Kalender',     subtitle: 'Teamkalender',          path: '/teamkalender',         icon: '🗓️', keywords: ['teamkalender', 'team kalender'] },
  { title: 'Health Dashboard',  subtitle: 'System-Status',         path: '/health',               icon: '🩺', keywords: ['health', 'system health', 'status', 'alt+h', 'g h'] },
  { title: 'Gruppen',           subtitle: 'Gruppenübersicht',      path: '/groups',               icon: '🗂', keywords: ['gruppen', 'groups'] },
  { title: 'Schichtmodell',     subtitle: 'Schichtmodelle',        path: '/schichtmodell',        icon: '🗂', keywords: ['schichtmodell', 'modell'] },
  { title: 'Einschränkungen',   subtitle: 'Einschränkungen',       path: '/einschraenkungen',     icon: '🗂', keywords: ['einschränkungen', 'restrictions'] },
  { title: 'Protokoll',         subtitle: 'Änderungsprotokoll',    path: '/protokoll',            icon: '🗂', keywords: ['protokoll', 'log', 'history'] },
];

// ── Actions ─────────────────────────────────────────────────────────────────
interface ActionItem {
  title: string;
  subtitle: string;
  icon: string;
  path?: string;
  action?: string; // named callback action
  keywords: string[];
}

const ACTION_ITEMS: ActionItem[] = [
  { title: 'Neue Schicht anlegen',    subtitle: 'Öffnet Schichtmodelle',      icon: '⚡', path: '/schichtmodell',   keywords: ['neue schicht', 'schicht anlegen', 'schicht erstellen'] },
  { title: 'Mitarbeiter anlegen',     subtitle: 'Neuen Mitarbeiter erfassen',  icon: '⚡', path: '/employees?new=1', keywords: ['mitarbeiter anlegen', 'neuer mitarbeiter', 'mitarbeiter erstellen'] },
  { title: 'Konflikt lösen',          subtitle: 'Zur Konfliktübersicht',       icon: '⚡', path: '/konflikte',        keywords: ['konflikt lösen', 'konflikte', 'konflikt beheben'] },
  { title: 'Urlaub eintragen',        subtitle: 'Urlaubsantrag erfassen',      icon: '⚡', path: '/urlaub',           keywords: ['urlaub eintragen', 'urlaub anlegen', 'urlaub erfassen'] },
  { title: 'Schichtwunsch erfassen',  subtitle: 'Wunsch eintragen',            icon: '⚡', path: '/schichtwuensche',  keywords: ['schichtwunsch', 'wunsch erfassen', 'wunsch eintragen'] },
  { title: 'Tausch anbieten',         subtitle: 'Schichttausch starten',       icon: '⚡', path: '/tauschboerse',     keywords: ['tausch anbieten', 'schichttausch', 'tauschen'] },
  { title: 'Dark Mode umschalten',    subtitle: 'Hell/Dunkel-Modus wechseln',  icon: '🌙', action: 'toggleTheme',    keywords: ['dark mode', 'dunkel', 'hell', 'theme', 'nachtmodus', 'darkmode'] },
  { title: 'Sprache wechseln',        subtitle: 'Deutsch / English',           icon: '🌐', action: 'toggleLanguage', keywords: ['sprache', 'language', 'deutsch', 'english', 'sprache wechseln'] },
  { title: 'Seite drucken',           subtitle: 'Aktuelle Seite drucken',      icon: '🖨️', action: 'print',          keywords: ['drucken', 'print', 'ausdrucken'] },
];

// ── Recent pages ─────────────────────────────────────────────────────────────
const RECENT_KEY = 'sp5_recent_pages';
const MAX_RECENT = 5;

interface RecentPage { path: string; title: string; ts: number }

function getRecentPages(): RecentPage[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

// eslint-disable-next-line react-refresh/only-export-components
export function trackRecentPage(path: string) {
  const allNav = NAV_ITEMS.find(n => n.path === path);
  const title = allNav?.title ?? path;
  const pages = getRecentPages().filter(p => p.path !== path);
  pages.unshift({ path, title, ts: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(pages.slice(0, MAX_RECENT)));
}

// ── Fuzzy matching ────────────────────────────────────────────────────────────
function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return 1 + (t.startsWith(q) ? 0.5 : 0);
  // character-by-character fuzzy
  let qi = 0, score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { score++; qi++; }
  }
  return qi === q.length ? score / t.length : 0;
}

function scoreItem(query: string, title: string, keywords: string[]): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const scores = [fuzzyMatch(q, title), ...keywords.map(k => fuzzyMatch(q, k))];
  return Math.max(...scores);
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ItemType = 'recent' | 'nav' | 'action' | 'api';

interface PaletteItem {
  id: string;
  type: ItemType;
  title: string;
  subtitle?: string;
  icon: string;
  path?: string;
  callbackAction?: string; // named callback for non-navigation actions
  score?: number;
}

const TYPE_LABELS: Record<ItemType | string, string> = {
  recent: 'Zuletzt',
  nav: 'Navigation',
  action: 'Aktion',
  api: 'Ergebnis',
  employee: 'Mitarbeiter',
  shift: 'Schichtart',
  leave_type: 'Abwesenheitsart',
  group: 'Gruppe',
};

const THRESHOLD = 0.15;

// ── Component ─────────────────────────────────────────────────────────────────
export default function SpotlightSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track current page as recent
  useEffect(() => {
    if (location.pathname) trackRecentPage(location.pathname);
  }, [location.pathname]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setApiResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced API search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setApiResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.search(q);
        setApiResults(data.results);
        setSelectedIndex(0);
      } catch { setApiResults([]); }
      finally { setLoading(false); }
    }, 200);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  };

  // Build combined palette items
  const items: PaletteItem[] = (() => {
    const q = query.trim();

    if (!q) {
      // Empty state: show recent pages
      const recent = getRecentPages().map(r => ({
        id: `recent-${r.path}`,
        type: 'recent' as ItemType,
        title: r.title,
        subtitle: r.path,
        icon: '🕐',
        path: r.path,
      }));
      // + top nav items
      const topNav = NAV_ITEMS.slice(0, 5).map(n => ({
        id: `nav-${n.path}`,
        type: 'nav' as ItemType,
        title: n.title,
        subtitle: n.subtitle,
        icon: n.icon,
        path: n.path,
      }));
      return [...recent, ...topNav];
    }

    // Scored nav items
    const navMatches: PaletteItem[] = NAV_ITEMS
      .map(n => ({ ...n, score: scoreItem(q, n.title, n.keywords) }))
      .filter(n => n.score > THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(n => ({
        id: `nav-${n.path}`,
        type: 'nav' as ItemType,
        title: n.title,
        subtitle: n.subtitle,
        icon: n.icon,
        path: n.path,
      }));

    // Scored action items
    const actionMatches: PaletteItem[] = ACTION_ITEMS
      .map(a => ({ ...a, score: scoreItem(q, a.title, a.keywords) }))
      .filter(a => a.score > THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(a => ({
        id: `action-${(a.path ?? a.action)}-${a.title}`,
        type: 'action' as ItemType,
        title: a.title,
        subtitle: a.subtitle,
        icon: a.icon,
        path: a.path,
        callbackAction: a.action,
      }));

    // API results
    const apiItems: PaletteItem[] = apiResults.map(r => ({
      id: `api-${r.type}-${r.id}`,
      type: 'api' as ItemType,
      title: r.title,
      subtitle: r.subtitle,
      icon: r.icon ?? (r.type === 'employee' ? '👤' : '📋'),
      path: r.path,
    }));

    return [...navMatches, ...actionMatches, ...apiItems];
  })();

  const openItem = useCallback((item: PaletteItem) => {
    if (item.callbackAction) {
      switch (item.callbackAction) {
        case 'toggleTheme': toggleTheme(); break;
        case 'toggleLanguage': setLanguage(language === 'de' ? 'en' : 'de'); break;
        case 'print': window.print(); break;
      }
      onClose();
      return;
    }
    if (item.path) navigate(item.path);
    onClose();
  }, [navigate, onClose, toggleTheme, setLanguage, language]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault();
      openItem(items[selectedIndex]);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Group items for display
  const grouped = new Map<string, { item: PaletteItem; globalIdx: number }[]>();
  let gi = 0;
  for (const item of items) {
    const key = item.type;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ item, globalIdx: gi++ });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--sp-search-bg, #1e293b)', border: '1px solid rgba(255,255,255,0.1)' }}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <span className="text-slate-400 text-lg flex-shrink-0">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            placeholder="Suchen, navigieren, Aktionen… (Ctrl+K)"
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-base"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-slate-500 border-t-white rounded-full animate-spin flex-shrink-0" />
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-slate-600 flex-shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 && query.trim() && !loading && (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">
              Keine Ergebnisse für „{query}"
            </div>
          )}

          {items.length === 0 && !query.trim() && (
            <div className="px-5 py-6 text-center text-slate-600 text-sm">
              <div className="text-3xl mb-2">⌨️</div>
              Tippe um zu suchen oder zu navigieren
              <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-400">🗂 Navigation</span>
                <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-400">👤 Mitarbeiter</span>
                <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-400">⚡ Aktionen</span>
                <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-400">🕐 Zuletzt besucht</span>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="py-1">
              {Array.from(grouped.entries()).map(([type, entries]) => (
                <div key={type}>
                  {/* Group header */}
                  <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-600 font-semibold flex items-center gap-1.5">
                    {type === 'recent' && '🕐'}
                    {type === 'nav' && '🗂'}
                    {type === 'action' && '⚡'}
                    {type === 'api' && '👤'}
                    {' '}
                    {type === 'recent' ? 'Zuletzt besucht'
                      : type === 'nav' ? 'Navigation'
                      : type === 'action' ? 'Aktionen'
                      : 'Suchergebnisse'}
                  </div>

                  {entries.map(({ item, globalIdx: idx }) => (
                    <button
                      key={item.id}
                      data-idx={idx}
                      onClick={() => openItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        idx === selectedIndex
                          ? 'bg-blue-600/40 text-white'
                          : 'text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-lg flex-shrink-0 w-7 text-center">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-[10px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded uppercase tracking-wide">
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      {idx === selectedIndex && (
                        <kbd className="flex-shrink-0 text-[10px] text-slate-400 border border-slate-600 px-1 py-0.5 rounded">↵</kbd>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-[10px] text-slate-600">
          <span>↑↓ navigieren · ↵ öffnen · ESC schließen</span>
          <span className="flex gap-2">
            <span>Ctrl+K</span>
            <span>/</span>
          </span>
        </div>
      </div>
    </div>
  );
}
