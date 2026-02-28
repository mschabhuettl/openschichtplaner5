import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast';
import { useToast } from './hooks/useToast';
import SpotlightSearch from './components/SpotlightSearch';
import WarningsCenter from './components/WarningsCenter';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-loaded pages — each page group is a separate chunk
const Dashboard         = lazy(() => import('./pages/Dashboard'));
const Schedule          = lazy(() => import('./pages/Schedule'));
const Einsatzplan       = lazy(() => import('./pages/Einsatzplan'));
const Jahresuebersicht  = lazy(() => import('./pages/Jahresuebersicht'));
const Personaltabelle   = lazy(() => import('./pages/Personaltabelle'));
const Statistiken       = lazy(() => import('./pages/Statistiken'));
const Urlaub            = lazy(() => import('./pages/Urlaub'));
const Schichtmodell     = lazy(() => import('./pages/Schichtmodell'));
const Personalbedarf    = lazy(() => import('./pages/Personalbedarf'));
const Jahresabschluss   = lazy(() => import('./pages/Jahresabschluss'));
const Zeitkonto         = lazy(() => import('./pages/Zeitkonto'));
const Ueberstunden      = lazy(() => import('./pages/Ueberstunden'));
const Kontobuchungen    = lazy(() => import('./pages/Kontobuchungen'));
const Notizen           = lazy(() => import('./pages/Notizen'));
const Berichte          = lazy(() => import('./pages/Berichte'));
const Export            = lazy(() => import('./pages/Export'));
const Import            = lazy(() => import('./pages/Import'));
const Employees         = lazy(() => import('./pages/Employees'));
const Groups            = lazy(() => import('./pages/Groups'));
const Fairness          = lazy(() => import('./pages/Fairness'));
const MitarbeiterVergleich = lazy(() => import('./pages/MitarbeiterVergleich'));
const MitarbeiterProfil    = lazy(() => import('./pages/MitarbeiterProfil'));
const Teamkalender         = lazy(() => import('./pages/Teamkalender'));
const UrlaubsTimeline      = lazy(() => import('./pages/UrlaubsTimeline'));
const Shifts            = lazy(() => import('./pages/Shifts'));
const LeaveTypes        = lazy(() => import('./pages/LeaveTypes'));
const Holidays          = lazy(() => import('./pages/Holidays'));
const Workplaces        = lazy(() => import('./pages/Workplaces'));
const Extracharges      = lazy(() => import('./pages/Extracharges'));
const Einschraenkungen  = lazy(() => import('./pages/Einschraenkungen'));
const Benutzerverwaltung = lazy(() => import('./pages/Benutzerverwaltung'));
const Backup            = lazy(() => import('./pages/Backup'));
const Perioden          = lazy(() => import('./pages/Perioden'));
const Einstellungen     = lazy(() => import('./pages/Einstellungen'));
const Protokoll         = lazy(() => import('./pages/Protokoll'));
const TauschBoerse      = lazy(() => import('./pages/TauschBoerse'));
const Konflikte         = lazy(() => import('./pages/Konflikte'));
const Geburtstagkalender = lazy(() => import('./pages/Geburtstagkalender'));
const Schichtwuensche    = lazy(() => import('./pages/Schichtwuensche'));
const Jahresrueckblick   = lazy(() => import('./pages/Jahresrueckblick'));
const Druckvorschau      = lazy(() => import('./pages/Druckvorschau'));
const Wochenansicht      = lazy(() => import('./pages/Wochenansicht'));
const RotationsAnalyse   = lazy(() => import('./pages/RotationsAnalyse'));
const VerfügbarkeitsMatrix = lazy(() => import('./pages/VerfügbarkeitsMatrix'));
const KapazitaetsForecast = lazy(() => import('./pages/KapazitaetsForecast'));
const QualitaetsBericht   = lazy(() => import('./pages/QualitaetsBericht'));
const SchichtKalibrator   = lazy(() => import('./pages/SchichtKalibrator'));
const KompetenzMatrix     = lazy(() => import('./pages/KompetenzMatrix'));
const OnboardingWizard    = lazy(() => import('./pages/OnboardingWizard'));
const SchichtBriefing     = lazy(() => import('./pages/SchichtBriefing'));
const AuditLog            = lazy(() => import('./pages/AuditLog'));
const NotfallPlan         = lazy(() => import('./pages/NotfallPlan'));
const Leitwand            = lazy(() => import('./pages/Leitwand'));
const Simulation          = lazy(() => import('./pages/Simulation'));
const Uebergabe           = lazy(() => import('./pages/Uebergabe'));
const DienstBoard         = lazy(() => import('./pages/DienstBoard'));
const Login             = lazy(() => import('./pages/Login'));
const NotFound          = lazy(() => import('./pages/NotFound'));

/** Simple loading indicator shown while a lazy chunk is fetching */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px] text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        <span className="text-sm">Lädt…</span>
      </div>
    </div>
  );
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  group?: string;
  path: string;
  badge?: boolean;
  /** Which roles can see this item. Undefined = visible to all. */
  roles?: Array<'Admin' | 'Planer' | 'Leser'>;
}

const navItems: NavItem[] = [
  // ── Top-level ───────────────────────────────────────────────
  { id: 'dashboard',  label: 'Dashboard', icon: '📊', path: '/' },
  { id: 'konflikte',  label: 'Konflikte', icon: '⚠️', path: '/konflikte', badge: true },

  // ── Planung — Kernplanung ────────────────────────────────────
  { id: 'schedule',         label: 'Dienstplan',       icon: '📅', group: 'Planung', path: '/schedule' },
  { id: 'einsatzplan',      label: 'Einsatzplan',      icon: '📋', group: 'Planung', path: '/einsatzplan',      roles: ['Admin', 'Planer'] },
  { id: 'wochenansicht',    label: 'Wochenansicht',    icon: '🗃️', group: 'Planung', path: '/wochenansicht' },
  { id: 'jahresuebersicht', label: 'Jahresübersicht',  icon: '📆', group: 'Planung', path: '/jahresuebersicht' },
  { id: 'personaltabelle',  label: 'Personaltabelle',  icon: '👤', group: 'Planung', path: '/personaltabelle',  roles: ['Admin', 'Planer'] },
  { id: 'schichtmodell',    label: 'Schichtmodelle',   icon: '🔄', group: 'Planung', path: '/schichtmodell',    roles: ['Admin', 'Planer'] },
  { id: 'personalbedarf',   label: 'Personalbedarf',   icon: '👥', group: 'Planung', path: '/personalbedarf',   roles: ['Admin', 'Planer'] },

  // ── Abwesenheiten ────────────────────────────────────────────
  { id: 'urlaub',           label: 'Urlaubsverwaltung', icon: '🏖️', group: 'Abwesenheiten', path: '/urlaub',          roles: ['Admin', 'Planer'] },
  { id: 'urlaubs-timeline', label: 'Urlaubs-Timeline',  icon: '📊', group: 'Abwesenheiten', path: '/urlaubs-timeline' },
  { id: 'schichtwuensche',  label: 'Schichtwünsche',    icon: '💬', group: 'Abwesenheiten', path: '/schichtwuensche' },
  { id: 'tauschboerse',   label: 'Tauschbörse',       icon: '🔄', group: 'Abwesenheiten', path: '/tauschboerse' },

  // ── Zeitwirtschaft ───────────────────────────────────────────
  { id: 'zeitkonto',      label: 'Zeitkonto',      icon: '⏱️', group: 'Zeitwirtschaft', path: '/zeitkonto' },
  { id: 'ueberstunden',   label: 'Überstunden',    icon: '⏰', group: 'Zeitwirtschaft', path: '/ueberstunden',   roles: ['Admin', 'Planer'] },
  { id: 'kontobuchungen', label: 'Kontobuchungen', icon: '💰', group: 'Zeitwirtschaft', path: '/kontobuchungen', roles: ['Admin', 'Planer'] },
  { id: 'statistiken',    label: 'Statistiken',    icon: '📈', group: 'Zeitwirtschaft', path: '/statistiken' },

  // ── Ansichten ────────────────────────────────────────────────
  { id: 'leitwand',          label: 'Leitwand',              icon: '📺', group: 'Ansichten', path: '/leitwand' },
  { id: 'dienst-board',      label: 'Dienst-Board',          icon: '🖥️', group: 'Ansichten', path: '/dienst-board' },
  { id: 'teamkalender',      label: 'Team-Kalender',         icon: '🗓️', group: 'Ansichten', path: '/teamkalender' },
  { id: 'geburtstagkalender',label: 'Geburtstags-Kalender',  icon: '🎂', group: 'Ansichten', path: '/geburtstagkalender' },

  // ── Werkzeuge ────────────────────────────────────────────────
  { id: 'notfall-plan',           label: 'Notfall-Plan',        icon: '🚨', group: 'Werkzeuge', path: '/notfall-plan' },
  { id: 'uebergabe',              label: 'Übergabe',             icon: '🤝', group: 'Werkzeuge', path: '/uebergabe' },
  { id: 'simulation',             label: 'Simulation',           icon: '🧪', group: 'Werkzeuge', path: '/simulation' },
  { id: 'verfuegbarkeits-matrix', label: 'Verfügbarkeits-Matrix',icon: '🧩', group: 'Werkzeuge', path: '/verfuegbarkeits-matrix' },
  { id: 'notizen',                label: 'Notizen',              icon: '📝', group: 'Werkzeuge', path: '/notizen', roles: ['Admin', 'Planer'] },
  { id: 'jahresabschluss',        label: 'Jahresabschluss',      icon: '📅', group: 'Werkzeuge', path: '/jahresabschluss', roles: ['Admin', 'Planer'] },

  // ── Berichte & Analysen ──────────────────────────────────────
  { id: 'jahresrueckblick',   label: 'Jahresrückblick',    icon: '🗓️', group: 'Berichte', path: '/jahresrueckblick' },
  { id: 'mitarbeiter-vergleich', label: 'MA-Vergleich',   icon: '⚖️', group: 'Berichte', path: '/mitarbeiter-vergleich' },
  { id: 'mitarbeiter-profil', label: 'MA-Profil',          icon: '🪪', group: 'Berichte', path: '/mitarbeiter' },
  { id: 'fairness',           label: 'Fairness-Score',     icon: '📐', group: 'Berichte', path: '/fairness' },
  { id: 'rotations-analyse',  label: 'Rotations-Analyse',  icon: '🔄', group: 'Berichte', path: '/rotations-analyse' },
  { id: 'kapazitaets-forecast', label: 'Kapazitäts-Forecast', icon: '📊', group: 'Berichte', path: '/kapazitaets-forecast' },
  { id: 'qualitaets-bericht', label: 'Qualitätsbericht',   icon: '📋', group: 'Berichte', path: '/qualitaets-bericht' },
  { id: 'schicht-kalibrator', label: 'Schicht-Kalibrator', icon: '⚖️', group: 'Berichte', path: '/schicht-kalibrator' },
  { id: 'kompetenz-matrix',   label: 'Kompetenz-Matrix',   icon: '🎓', group: 'Berichte', path: '/kompetenz-matrix' },
  { id: 'berichte',           label: 'Monatsberichte',     icon: '📄', group: 'Berichte', path: '/berichte' },
  { id: 'export',             label: 'Export',             icon: '⬇️', group: 'Berichte', path: '/export', roles: ['Admin', 'Planer'] },
  { id: 'import',             label: 'Import',             icon: '⬆️', group: 'Berichte', path: '/import', roles: ['Admin'] },

  // ── Stammdaten ───────────────────────────────────────────────
  { id: 'employees',      label: 'Mitarbeiter',          icon: '👥', group: 'Stammdaten', path: '/employees',      roles: ['Admin', 'Planer'] },
  { id: 'groups',         label: 'Gruppen',              icon: '🏢', group: 'Stammdaten', path: '/groups',         roles: ['Admin', 'Planer'] },
  { id: 'shifts',         label: 'Schichtarten',         icon: '🕐', group: 'Stammdaten', path: '/shifts',         roles: ['Admin', 'Planer'] },
  { id: 'leave-types',    label: 'Abwesenheitsarten',    icon: '📋', group: 'Stammdaten', path: '/leave-types',    roles: ['Admin', 'Planer'] },
  { id: 'holidays',       label: 'Feiertage',            icon: '📅', group: 'Stammdaten', path: '/holidays',       roles: ['Admin', 'Planer'] },
  { id: 'workplaces',     label: 'Arbeitsplätze',        icon: '🏭', group: 'Stammdaten', path: '/workplaces',     roles: ['Admin', 'Planer'] },
  { id: 'extracharges',   label: 'Zeitzuschläge',        icon: '⏱️', group: 'Stammdaten', path: '/extracharges',   roles: ['Admin', 'Planer'] },
  { id: 'einschraenkungen', label: 'Schichteinschränkungen', icon: '🚫', group: 'Stammdaten', path: '/einschraenkungen', roles: ['Admin', 'Planer'] },

  // ── Administration ───────────────────────────────────────────
  { id: 'schichtbriefing',    label: 'Schicht-Briefing',     icon: '📋', group: 'Planung',         path: '/schichtbriefing' },
  { id: 'onboarding',         label: 'Onboarding-Wizard',    icon: '🧭', group: 'Administration', path: '/onboarding',         roles: ['Admin', 'Planer'] },
  { id: 'benutzerverwaltung', label: 'Benutzerverwaltung',   icon: '👤', group: 'Administration', path: '/benutzerverwaltung', roles: ['Admin'] },
  { id: 'backup',             label: 'Backup & Restore',     icon: '💾', group: 'Administration', path: '/backup',             roles: ['Admin'] },
  { id: 'perioden',           label: 'Abrechnungszeiträume', icon: '📅', group: 'Administration', path: '/perioden',           roles: ['Admin'] },
  { id: 'einstellungen',      label: 'Einstellungen',        icon: '⚙️', group: 'Administration', path: '/einstellungen',      roles: ['Admin'] },
  { id: 'auditlog',           label: 'Audit-Log',            icon: '🔍', group: 'Administration', path: '/auditlog',           roles: ['Admin', 'Planer'] },
  { id: 'protokoll',          label: 'Protokoll',            icon: '📋', group: 'Administration', path: '/protokoll',          roles: ['Admin'] },
  { id: 'druckvorschau',      label: 'Druckvorschau',        icon: '🖨️', group: 'Administration', path: '/druckvorschau' },
];

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isDevMode, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  // Global keyboard shortcut: Ctrl+K or standalone "/" opens Spotlight search
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+K (all platforms)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setSpotlightOpen(prev => !prev);
      return;
    }
    // "/" key — only when not typing in an input/textarea/select
    if (e.key === '/' && !spotlightOpen) {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
        setSpotlightOpen(true);
      }
    }
  }, [spotlightOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Fetch conflict count for current month on load
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const BASE = import.meta.env.VITE_API_URL ?? '';
    fetch(`${BASE}/api/schedule/conflicts?year=${year}&month=${month}`)
      .then(r => r.ok ? r.json() : { conflicts: [] })
      .then(data => setConflictCount((data.conflicts ?? []).length))
      .catch(() => setConflictCount(0));
  }, []);

  const goTo = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const isActive = (item: NavItem) => {
    if (item.id === 'dashboard') {
      return location.pathname === '/';
    }
    return location.pathname === item.path;
  };

  const currentItem = navItems.find(i => isActive(i));

  // Update document title based on active route
  useEffect(() => {
    const label = currentItem?.label;
    document.title = label ? `OpenSP5 — ${label}` : 'OpenSchichtplaner5';
  }, [currentItem]);

  // Filter nav items based on user role
  const visibleItems = navItems.filter(item => {
    if (isDevMode) return true;
    if (!item.roles) return true; // no restriction
    const role = user?.role ?? 'Leser';
    return item.roles.includes(role as 'Admin' | 'Planer' | 'Leser');
  });

  // Group nav items
  const GROUP_ORDER = ['', 'Planung', 'Abwesenheiten', 'Zeitwirtschaft', 'Ansichten', 'Werkzeuge', 'Berichte', 'Stammdaten', 'Administration'];
  const grouped: { group: string; items: NavItem[] }[] = GROUP_ORDER.map(g => ({
    group: g,
    items: visibleItems.filter(i => (i.group ?? '') === g),
  }));

  // Collapsible sidebar groups — persisted in localStorage
  const COLLAPSED_KEY = 'sp5_sidebar_collapsed';
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      // Default: all groups open
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Auto-expand the group that contains the active item
  const activeGroup = navItems.find(i => isActive(i))?.group ?? '';
  useEffect(() => {
    if (activeGroup) {
      setCollapsedGroups(prev => {
        if (!prev.has(activeGroup)) return prev;
        const next = new Set(prev);
        next.delete(activeGroup);
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
        return next;
      });
    }
  }, [activeGroup]);

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            🧸 OpenSP5
            {isDevMode && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold
                               bg-amber-500 text-black leading-none">
                🛠️ DEV
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Dienstplanung</div>
        </div>
        <div className="flex items-center gap-1">
          {/* Warnings Center bell */}
          <WarningsCenter />
          {/* Spotlight search button */}
          <button
            onClick={() => setSpotlightOpen(true)}
            title="Schnellsuche (Ctrl+K)"
            aria-label="Schnellsuche öffnen"
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
          >
            🔍
          </button>
          {/* Close button — only visible on mobile */}
          <button
            className="md:hidden text-slate-400 hover:text-white p-1"
            onClick={() => setSidebarOpen(false)}
            aria-label="Menü schließen"
          >
            ✕
          </button>
        </div>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {grouped.map(({ group, items }) => {
          if (items.length === 0) return null;
          const isCollapsed = group !== '' && collapsedGroups.has(group);
          return (
            <div key={group || '_root'}>
              {group && (
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 font-semibold hover:text-slate-300 transition-colors"
                >
                  <span>{group}</span>
                  <span className="text-[9px] opacity-60">{isCollapsed ? '▶' : '▼'}</span>
                </button>
              )}
              {!isCollapsed && items.map(item => (
                <button
                  key={item.id}
                  onClick={() => goTo(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    isActive(item)
                      ? 'bg-slate-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && conflictCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {conflictCount > 99 ? '99+' : conflictCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
      {/* User info + logout */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-slate-400 text-xs leading-tight flex-1 min-w-0">
            <span className="block text-slate-300 font-medium truncate">
              {isDevMode ? '🛠️ Developer' : user?.NAME ?? '?'}
            </span>
            <span className="block text-slate-500">
              {isDevMode ? 'Dev-Mode' : user?.role ?? ''}
            </span>
          </span>
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Hell-Modus aktivieren' : 'Dunkel-Modus aktivieren'}
            aria-label={isDark ? 'Hell-Modus aktivieren' : 'Dunkel-Modus aktivieren'}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                       text-slate-400 hover:text-white hover:bg-slate-600 transition-colors
                       text-base leading-none"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
        <button
          onClick={logout}
          className="w-full py-1.5 px-3 text-xs text-slate-400 hover:text-white
                     bg-slate-700 hover:bg-slate-600 rounded transition text-left"
        >
          ↩ Abmelden
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* Global Spotlight Search Modal */}
      <SpotlightSearch open={spotlightOpen} onClose={() => setSpotlightOpen(false)} />

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible | mobile: slide-in drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-56 bg-slate-800 text-white flex flex-col shadow-xl
        transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 md:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar with hamburger */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-800 text-white shadow">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Menü öffnen"
            className="text-xl leading-none"
          >
            ☰
          </button>
          <span className="font-semibold text-sm flex-1">
            {currentItem?.icon} {currentItem?.label}
          </span>
          <WarningsCenter />
          <button
            onClick={() => setSpotlightOpen(true)}
            title="Schnellsuche"
            aria-label="Schnellsuche öffnen"
            className="text-slate-400 hover:text-white transition-colors text-base leading-none p-1"
          >
            🔍
          </button>
          <button
            onClick={toggleTheme}
            title={isDark ? 'Hell-Modus' : 'Dunkel-Modus'}
            aria-label={isDark ? 'Hell-Modus aktivieren' : 'Dunkel-Modus aktivieren'}
            className="text-slate-400 hover:text-white transition-colors text-base leading-none p-1"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </header>

        <main className="flex-1 overflow-auto">
          {/* Suspense boundary: shows spinner while a lazy chunk loads */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/konflikte" element={<Konflikte />} />
              <Route path="/geburtstagkalender" element={<Geburtstagkalender />} />
              <Route path="/schichtwuensche" element={<Schichtwuensche />} />
              <Route path="/tauschboerse" element={<TauschBoerse />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/einsatzplan" element={<Einsatzplan />} />
              <Route path="/jahresuebersicht" element={<Jahresuebersicht />} />
              <Route path="/personaltabelle" element={<Personaltabelle />} />
              <Route path="/statistiken" element={<Statistiken />} />
              <Route path="/urlaub" element={<Urlaub />} />
              <Route path="/schichtmodell" element={<Schichtmodell />} />
              <Route path="/personalbedarf" element={<Personalbedarf />} />
              <Route path="/jahresrueckblick" element={<Jahresrueckblick />} />
              <Route path="/jahresabschluss" element={<Jahresabschluss />} />
              <Route path="/zeitkonto" element={<Zeitkonto />} />
              <Route path="/ueberstunden" element={<Ueberstunden />} />
              <Route path="/kontobuchungen" element={<Kontobuchungen />} />
              <Route path="/notizen" element={<Notizen />} />
              <Route path="/mitarbeiter-vergleich" element={<MitarbeiterVergleich />} />
              <Route path="/mitarbeiter" element={<MitarbeiterProfil />} />
              <Route path="/mitarbeiter/:id" element={<MitarbeiterProfil />} />
              <Route path="/teamkalender" element={<Teamkalender />} />
              <Route path="/urlaubs-timeline" element={<UrlaubsTimeline />} />
              <Route path="/fairness" element={<Fairness />} />
              <Route path="/berichte" element={<Berichte />} />
              <Route path="/export" element={<Export />} />
              <Route path="/import" element={<Import />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/shifts" element={<Shifts />} />
              <Route path="/leave-types" element={<LeaveTypes />} />
              <Route path="/holidays" element={<Holidays />} />
              <Route path="/workplaces" element={<Workplaces />} />
              <Route path="/extracharges" element={<Extracharges />} />
              <Route path="/einschraenkungen" element={<Einschraenkungen />} />
              <Route path="/benutzerverwaltung" element={<Benutzerverwaltung />} />
              <Route path="/backup" element={<Backup />} />
              <Route path="/perioden" element={<Perioden />} />
              <Route path="/einstellungen" element={<Einstellungen />} />
              <Route path="/protokoll" element={<Protokoll />} />
              <Route path="/druckvorschau" element={<Druckvorschau />} />
              <Route path="/dienst-board" element={<DienstBoard />} />
              <Route path="/wochenansicht" element={<Wochenansicht />} />
              <Route path="/verfuegbarkeits-matrix" element={<VerfügbarkeitsMatrix />} />
              <Route path="/rotations-analyse" element={<RotationsAnalyse />} />
              <Route path="/kapazitaets-forecast" element={<KapazitaetsForecast />} />
              <Route path="/qualitaets-bericht" element={<QualitaetsBericht />} />
              <Route path="/schicht-kalibrator" element={<SchichtKalibrator />} />
              <Route path="/kompetenz-matrix" element={<KompetenzMatrix />} />
              <Route path="/simulation" element={<Simulation />} />
              <Route path="/notfall-plan" element={<NotfallPlan />} />
              <Route path="/leitwand" element={<Leitwand />} />
              <Route path="/uebergabe" element={<Uebergabe />} />
              <Route path="/schichtbriefing" element={<SchichtBriefing />} />
              <Route path="/onboarding" element={<OnboardingWizard />} />
              <Route path="/auditlog" element={<AuditLog />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

/** Login gate: shows Login page when not authenticated */
function AuthGate() {
  const { user, isDevMode, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-500 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !isDevMode) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-slate-500 border-t-white rounded-full animate-spin" />
        </div>
      }>
        <Login />
      </Suspense>
    );
  }

  return <AppInner />;
}

function GlobalToastContainer() {
  const { toasts, removeToast } = useToast();
  return <ToastContainer toasts={toasts} onRemove={removeToast} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <AuthGate />
            </AuthProvider>
          </BrowserRouter>
          <GlobalToastContainer />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
