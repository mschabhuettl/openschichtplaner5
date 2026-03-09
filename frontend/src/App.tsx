import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SSEProvider, useSSEContext } from './contexts/SSEContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './i18n/context';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast';
import { useToast } from './hooks/useToast';
import SpotlightSearch, { trackRecentPage } from './components/SpotlightSearch';
import WarningsCenter from './components/WarningsCenter';
import { NotificationBell } from './components/NotificationBell';
import { NotificationsPage } from './components/NotificationsPage';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { GuidedTour, useTour } from './components/GuidedTour';
import { ErrorBoundary, PageErrorBoundary } from './components/ErrorBoundary';
import { InstallBanner } from './components/InstallBanner';
import { ThemeToggle } from './components/ThemeToggle';
import { BottomNav } from './components/BottomNav';
import { api, checkApiCompatibility } from './api/client';
import { DevRoleSwitcher } from './components/DevRoleSwitcher';

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
const MeinProfil           = lazy(() => import('./pages/MeinProfil'));
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
const EmailSettings     = lazy(() => import('./pages/EmailSettings'));
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
const Analytics           = lazy(() => import('./pages/Analytics'));
const OnboardingWizard    = lazy(() => import('./pages/OnboardingWizard'));
const SchichtBriefing     = lazy(() => import('./pages/SchichtBriefing'));
const AuditLog            = lazy(() => import('./pages/AuditLog'));
const HealthDashboard     = lazy(() => import('./pages/HealthDashboard'));
const NotfallPlan         = lazy(() => import('./pages/NotfallPlan'));
const Leitwand            = lazy(() => import('./pages/Leitwand'));
const Simulation          = lazy(() => import('./pages/Simulation'));
const Uebergabe           = lazy(() => import('./pages/Uebergabe'));
const DienstBoard         = lazy(() => import('./pages/DienstBoard'));
const TeamUebersicht      = lazy(() => import('./pages/TeamUebersicht'));
const Login             = lazy(() => import('./pages/Login'));
const NotFound          = lazy(() => import('./pages/NotFound'));

/** SSE live connection indicator dot */
function LiveIndicator() {
  const { status } = useSSEContext();
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  return (
    <span
      title={isConnected ? 'Live-Updates aktiv' : isConnecting ? 'Verbinde...' : 'Live-Updates getrennt'}
      aria-label={isConnected ? 'Live' : 'Getrennt'}
      className="flex-shrink-0 flex items-center justify-center w-8 h-8"
    >
      <span
        className={`block w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
          isConnected
            ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]'
            : isConnecting
            ? 'bg-yellow-400 animate-pulse'
            : 'bg-red-500'
        }`}
      />
    </span>
  );
}

/** Access denied page for Leser trying to reach restricted routes */
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center px-6">
      <div className="text-5xl">🔒</div>
      <h1 className="text-xl font-bold text-slate-700 dark:text-slate-200">Kein Zugriff</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
        Diese Seite ist nur für Admins und Planer zugänglich.
      </p>
      <button
        onClick={() => navigate('/')}
        className="mt-2 px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-colors"
      >
        Zurück zum Dashboard
      </button>
    </div>
  );
}

/** Route guard: renders children only if the current role allows it */
function RoleRoute({ allowedRoles, children }: { allowedRoles: Array<'Admin' | 'Planer' | 'Leser'>; children: React.ReactNode }) {
  const { user, isDevMode, devViewRole } = useAuth();
  let role: 'Admin' | 'Planer' | 'Leser';
  if (isDevMode) {
    role = devViewRole === 'admin' ? 'Admin' : devViewRole === 'planer' ? 'Planer' : devViewRole === 'dev' ? 'Admin' : 'Leser';
  } else {
    role = (user?.role as 'Admin' | 'Planer' | 'Leser') ?? 'Leser';
  }
  if (!allowedRoles.includes(role)) return <AccessDenied />;
  return <>{children}</>;
}

/** Simple loading indicator shown while a lazy chunk is fetching */
function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Seite wird geladen"
      className="flex items-center justify-center h-full min-h-[200px] text-slate-500"
    >
      <div className="flex flex-col items-center gap-3">
        <div aria-hidden="true" className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
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
  { id: 'mein-profil', label: 'Mein Profil', icon: '👤', path: '/mein-profil', roles: ['Leser'] },

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
  { id: 'statistiken',    label: 'Statistiken',    icon: '📈', group: 'Zeitwirtschaft', path: '/statistiken', roles: ['Admin', 'Planer'] },

  // ── Ansichten ────────────────────────────────────────────────
  { id: 'leitwand',          label: 'Leitwand',              icon: '📺', group: 'Ansichten', path: '/leitwand',   roles: ['Admin', 'Planer'] },
  { id: 'dienst-board',      label: 'Dienst-Board',          icon: '🖥️', group: 'Ansichten', path: '/dienst-board', roles: ['Admin', 'Planer'] },
  { id: 'teamkalender',      label: 'Team-Kalender',         icon: '🗓️', group: 'Ansichten', path: '/teamkalender' },
  { id: 'team-uebersicht',   label: 'Team-Übersicht',        icon: '👥', group: 'Ansichten', path: '/team',       roles: ['Admin', 'Planer'] },
  { id: 'geburtstagkalender',label: 'Geburtstags-Kalender',  icon: '🎂', group: 'Ansichten', path: '/geburtstagkalender' },

  // ── Werkzeuge ────────────────────────────────────────────────
  { id: 'notfall-plan',           label: 'Notfall-Plan',        icon: '🚨', group: 'Werkzeuge', path: '/notfall-plan',           roles: ['Admin', 'Planer'] },
  { id: 'uebergabe',              label: 'Übergabe',             icon: '🤝', group: 'Werkzeuge', path: '/uebergabe',              roles: ['Admin', 'Planer'] },
  { id: 'simulation',             label: 'Simulation',           icon: '🧪', group: 'Werkzeuge', path: '/simulation',             roles: ['Admin', 'Planer'] },
  { id: 'verfuegbarkeits-matrix', label: 'Verfügbarkeits-Matrix',icon: '🧩', group: 'Werkzeuge', path: '/verfuegbarkeits-matrix', roles: ['Admin', 'Planer'] },
  { id: 'notizen',                label: 'Notizen',              icon: '📝', group: 'Werkzeuge', path: '/notizen', roles: ['Admin', 'Planer'] },
  { id: 'jahresabschluss',        label: 'Jahresabschluss',      icon: '📅', group: 'Werkzeuge', path: '/jahresabschluss', roles: ['Admin', 'Planer'] },

  // ── Berichte & Analysen ──────────────────────────────────────
  { id: 'jahresrueckblick',   label: 'Jahresrückblick',    icon: '🗓️', group: 'Berichte', path: '/jahresrueckblick',    roles: ['Admin', 'Planer'] },
  { id: 'mitarbeiter-vergleich', label: 'MA-Vergleich',   icon: '⚖️', group: 'Berichte', path: '/mitarbeiter-vergleich', roles: ['Admin', 'Planer'] },
  { id: 'mitarbeiter-profil', label: 'MA-Profil',          icon: '🪪', group: 'Berichte', path: '/mitarbeiter',           roles: ['Admin', 'Planer'] },
  { id: 'fairness',           label: 'Fairness-Score',     icon: '📐', group: 'Berichte', path: '/fairness',              roles: ['Admin', 'Planer'] },
  { id: 'rotations-analyse',  label: 'Rotations-Analyse',  icon: '🔄', group: 'Berichte', path: '/rotations-analyse',    roles: ['Admin', 'Planer'] },
  { id: 'kapazitaets-forecast', label: 'Kapazitäts-Forecast', icon: '📊', group: 'Berichte', path: '/kapazitaets-forecast', roles: ['Admin', 'Planer'] },
  { id: 'qualitaets-bericht', label: 'Qualitätsbericht',   icon: '📋', group: 'Berichte', path: '/qualitaets-bericht',   roles: ['Admin', 'Planer'] },
  { id: 'schicht-kalibrator', label: 'Schicht-Kalibrator', icon: '⚖️', group: 'Berichte', path: '/schicht-kalibrator',   roles: ['Admin', 'Planer'] },
  { id: 'kompetenz-matrix',   label: 'Kompetenz-Matrix',   icon: '🎓', group: 'Berichte', path: '/kompetenz-matrix',     roles: ['Admin', 'Planer'] },
  { id: 'analytics',          label: 'Analytics & Trends', icon: '📉', group: 'Berichte', path: '/analytics',            roles: ['Admin', 'Planer'] },
  { id: 'berichte',           label: 'Monatsberichte',     icon: '📄', group: 'Berichte', path: '/berichte',             roles: ['Admin', 'Planer'] },
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
  { id: 'email-settings',    label: 'E-Mail',               icon: '📧', group: 'Administration', path: '/email-settings',     roles: ['Admin'] },
  { id: 'auditlog',           label: 'Audit-Log',            icon: '🔍', group: 'Administration', path: '/auditlog',           roles: ['Admin', 'Planer'] },
  { id: 'health',             label: 'System Health',        icon: '🩺', group: 'Administration', path: '/health',             roles: ['Admin'] },
  { id: 'protokoll',          label: 'Protokoll',            icon: '📋', group: 'Administration', path: '/protokoll',          roles: ['Admin'] },
  { id: 'druckvorschau',      label: 'Druckvorschau',        icon: '🖨️', group: 'Administration', path: '/druckvorschau' },
];

/** Global offline banner — shown when the browser loses connectivity */
function ApiIncompatibleBanner() {
  const [info, setInfo] = useState<{ backendVersion: string; requiredVersion: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkApiCompatibility();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { backendVersion: string; requiredVersion: string };
      setInfo(detail);
    };
    window.addEventListener('sp5:api-incompatible', handler);
    return () => window.removeEventListener('sp5:api-incompatible', handler);
  }, []);

  if (!info || dismissed) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#b45309', color: '#fff', padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <span>
        ⚠️ API-Versionskonflikt: Backend {info.backendVersion} ist zu alt (mind. {info.requiredVersion} erforderlich).
        Bitte Backend aktualisieren.
      </span>
      <button onClick={() => setDismissed(true)} style={{
        background: 'transparent', border: '1px solid #fff', color: '#fff',
        borderRadius: 4, padding: '2px 10px', cursor: 'pointer',
      }}>×</button>
    </div>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showOnlineFlash, setShowOnlineFlash] = useState(false);

  useEffect(() => {
    const onOffline = () => { setOffline(true); setShowOnlineFlash(false); };
    const onOnline = () => {
      setOffline(false);
      setShowOnlineFlash(true);
      setTimeout(() => setShowOnlineFlash(false), 3000);
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (offline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[99999] bg-yellow-400 text-yellow-900 text-sm font-medium text-center py-2 px-4 shadow-md">
        ⚠️ Keine Verbindung — Daten könnten veraltet sein
      </div>
    );
  }
  if (showOnlineFlash) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[99999] bg-green-500 text-white text-sm font-medium text-center py-2 px-4 shadow-md">
        ✓ Verbindung wiederhergestellt
      </div>
    );
  }
  return null;
}

/** Banner shown when the backend API is completely unreachable at startup */
function BackendUnreachableBanner() {
  const [unreachable, setUnreachable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/version', { signal: AbortSignal.timeout(5000) });
        if (!cancelled && !res.ok && res.status === 0) setUnreachable(true);
      } catch (err) {
        if (!cancelled) {
          // TypeError: Failed to fetch → backend nicht erreichbar
          if (err instanceof TypeError) setUnreachable(true);
        }
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  if (!unreachable || dismissed) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99998,
      background: '#dc2626', color: '#fff', padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <span>
        🔴 Backend nicht erreichbar — bitte prüfe ob der Server läuft.
      </span>
      <button onClick={() => setDismissed(true)} style={{
        background: 'transparent', border: '1px solid #fff', color: '#fff',
        borderRadius: 4, padding: '2px 10px', cursor: 'pointer',
      }}>×</button>
    </div>
  );
}

/** Wraps a route element in a per-page ErrorBoundary + Suspense */
function PB({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <PageErrorBoundary pageName={name}>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </PageErrorBoundary>
  );
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isDevMode, logout } = useAuth();

  const { language, setLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [quickHelpOpen, setQuickHelpOpen] = useState(false);
  const { tourOpen, startTour, closeTour } = useTour();

  // "g" prefix navigation: track pending timer via ref (no re-render needed)
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gPendingRef = useRef(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip when typing in inputs
    const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select'
      || (document.activeElement as HTMLElement)?.isContentEditable;

    // Ctrl+K (all platforms) — Spotlight search (always fires, even in inputs)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setSpotlightOpen(prev => !prev);
      return;
    }

    if (isTyping) return;

    // "/" key — Spotlight search
    if (e.key === '/') {
      e.preventDefault();
      setSpotlightOpen(true);
      return;
    }

    // "?" key — Keyboard shortcuts help
    if (e.key === '?') {
      e.preventDefault();
      setShortcutsOpen(prev => !prev);
      return;
    }

    // "g" prefix navigation
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      gPendingRef.current = true;
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
      gTimerRef.current = setTimeout(() => { gPendingRef.current = false; }, 1000);
      return;
    }

    // Alt+T → Team-Übersicht, Alt+A → Analytics, Alt+H → Health
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const altMap: Record<string, string> = {
        t: '/team',
        a: '/analytics',
        h: '/health',
      };
      const dest = altMap[e.key.toLowerCase()];
      if (dest) {
        e.preventDefault();
        navigate(dest);
        return;
      }
    }

    // Second key after "g"
    if (gPendingRef.current) {
      gPendingRef.current = false;
      if (gTimerRef.current) { clearTimeout(gTimerRef.current); gTimerRef.current = null; }
      const goMap: Record<string, string> = {
        d: '/',                 // Dashboard
        p: '/schedule',         // dienstPlan
        m: '/employees',        // Mitarbeiter
        k: '/konflikte',        // Konflikte
        s: '/statistiken',      // Statistiken
        u: '/urlaub',           // Urlaub
        e: '/einsatzplan',      // Einsatzplan
        w: '/schichtwuensche',  // Wünsche
        n: '/notizen',          // Notizen
        a: '/analytics',        // Analytics
        q: '/kompetenz-matrix', // Kompetenz-Matrix (Q for Qualifikation)
        t: '/tauschboerse',     // Tauschbörse
        v: '/team',             // Team-Übersicht (V for Verwaltung)
        h: '/health',           // Health Dashboard
      };
      const dest = goMap[e.key];
      if (dest) {
        e.preventDefault();
        navigate(dest);
      }
    }
  }, [navigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Fetch conflict count for current month on load
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    api.getConflicts({ year, month })
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

  // Update document title based on active route + track recent pages
  useEffect(() => {
    const label = currentItem?.label;
    document.title = label ? `${label} — SP5` : 'OpenSchichtplaner5';
    // Track this page visit for "Zuletzt besucht" quick-access
    if (location.pathname !== '/login') {
      trackRecentPage(location.pathname);
    }
  }, [currentItem, location.pathname]);

  // Filter nav items based on user role (or simulated devViewRole in dev mode)
  const { devViewRole } = useAuth();
  const visibleItems = navItems.filter(item => {
    if (!item.roles) return true; // no restriction
    if (isDevMode) {
      // In dev mode, simulate visibility based on devViewRole
      if (devViewRole === 'dev') return true;
      const simRole = devViewRole === 'admin' ? 'Admin'
        : devViewRole === 'planer' ? 'Planer'
        : 'Leser';
      return item.roles.includes(simRole as 'Admin' | 'Planer' | 'Leser');
    }
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

  const { t } = useLanguage();

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
          <div className="text-xs text-slate-400 mt-0.5">{t.nav.dienstplanung}</div>
        </div>
        <div className="flex items-center gap-1">
          {/* Warnings Center bell */}
          <WarningsCenter />
          {/* In-App Notifications */}
          <NotificationBell />
          {/* Spotlight search button */}
          <button
            onClick={() => setSpotlightOpen(true)}
            title="Schnellsuche (Ctrl+K)"
            aria-label="Schnellsuche öffnen"
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center"
          >
            🔍
          </button>
          {/* Keyboard shortcuts help */}
          <button
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard-Shortcuts anzeigen (?)"
            aria-label="Keyboard-Shortcuts anzeigen"
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors text-sm font-bold leading-none min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center"
          >
            ?
          </button>
          {/* Erste Schritte */}
          <button
            onClick={() => setQuickHelpOpen(true)}
            title="Erste Schritte anzeigen"
            aria-label="Erste Schritte anzeigen"
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors text-sm leading-none min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center"
          >
            📖
          </button>
          {/* Onboarding tour */}
          <button
            onClick={startTour}
            title="Geführte Tour starten"
            aria-label="Geführte Tour starten"
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors text-sm leading-none min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center"
          >
            🧭
          </button>
          {/* Close button — only visible on mobile */}
          <button
            className="md:hidden text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-slate-700 transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="Menü schließen"
          >
            ✕
          </button>
        </div>
      </div>
      <nav aria-label="Hauptnavigation" className="flex-1 py-2 overflow-y-auto">
        {grouped.map(({ group, items }) => {
          if (items.length === 0) return null;
          const isCollapsed = group !== '' && collapsedGroups.has(group);
          return (
            <div key={group || '_root'}>
              {group && (
                <button
                  onClick={() => toggleGroup(group)}
                  aria-expanded={!isCollapsed}
                  className="w-full flex items-center justify-between px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 font-semibold hover:text-slate-300 transition-colors"
                >
                  <span>{t.navGroups[group as keyof typeof t.navGroups] ?? group}</span>
                  <span aria-hidden="true" className="text-[9px] opacity-60">{isCollapsed ? '▶' : '▼'}</span>
                </button>
              )}
              {!isCollapsed && items.map(item => (
                <button
                  key={item.id}
                  onClick={() => goTo(item.path)}
                  aria-current={isActive(item) ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-base min-h-[48px] transition-colors ${
                    isActive(item)
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="flex-1 text-left">{t.navItems[item.id as keyof typeof t.navItems] ?? item.label}</span>
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
          {/* SSE Live Indicator */}
          <LiveIndicator />
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'de' ? 'en' : 'de')}
            title={language === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
            aria-label={language === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                       text-slate-400 hover:text-white hover:bg-slate-600 transition-colors
                       text-sm font-bold leading-none"
          >
            {language === 'de' ? '🇩🇪' : '🇬🇧'}
          </button>
          {/* Dark Mode Toggle */}
          <ThemeToggle size="md" />
        </div>
        <button
          onClick={logout}
          className="w-full py-2.5 px-3 text-sm text-slate-400 hover:text-white
                     bg-slate-700 hover:bg-slate-600 rounded transition text-left min-h-[44px]"
        >
          ↩ {t.nav.logout}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* API version compatibility banner */}
      <ApiIncompatibleBanner />
      {/* Global offline connectivity banner */}
      <OfflineBanner />
      {/* Backend unreachable banner (startup check) */}
      <BackendUnreachableBanner />

      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[99999]
                   focus:px-4 focus:py-2 focus:bg-white focus:text-slate-900 focus:rounded-lg
                   focus:shadow-lg focus:text-sm focus:font-medium focus:ring-2 focus:ring-blue-500"
      >
        Zum Hauptinhalt springen
      </a>

      {/* Global Spotlight Search Modal */}
      <SpotlightSearch open={spotlightOpen} onClose={() => setSpotlightOpen(false)} />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Erste Schritte Modal */}
      {quickHelpOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setQuickHelpOpen(false)} role="dialog" aria-modal="true" aria-labelledby="quick-help-title">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 id="quick-help-title" className="text-lg font-bold text-gray-800 dark:text-gray-100">📖 Erste Schritte</h2>
              <button onClick={() => setQuickHelpOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none" aria-label="Schließen">✕</button>
            </div>
            <ol className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-base">1</span>
                <div>
                  <p className="font-semibold">Mitarbeiter anlegen</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Navigieren Sie zu <strong>Mitarbeiter</strong> und legen Sie alle Mitarbeitenden mit Namen, Kürzel und Arbeitszeitmodell an.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-base">2</span>
                <div>
                  <p className="font-semibold">Gruppen erstellen</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Unter <strong>Gruppen</strong> können Sie Teams oder Abteilungen anlegen und Mitarbeiter zuweisen.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-base">3</span>
                <div>
                  <p className="font-semibold">Schichttypen definieren</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Erstellen Sie unter <strong>Schichten</strong> die Schichttypen (z. B. Frühschicht, Spätschicht) mit Kürzel und Dauer.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-base">4</span>
                <div>
                  <p className="font-semibold">Dienstplan befüllen</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Im <strong>Dienstplan</strong> können Sie Schichten per Klick oder Drag &amp; Drop zuweisen.</p>
                </div>
              </li>
            </ol>
            <div className="mt-5 flex justify-between items-center">
              <button
                onClick={() => { setQuickHelpOpen(false); startTour(); }}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 underline"
              >
                🧭 Geführte Tour starten
              </button>
              <button
                onClick={() => setQuickHelpOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                Los geht's!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Tour (auto on first visit + manual via 🧭 button) */}
      <GuidedTour open={tourOpen} onClose={closeTour} />

      {/* Mobile overlay backdrop — fade in/out with opacity transition */}
      <div
        className={`fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity duration-200 ease-in-out ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      {/* Sidebar — desktop: always visible | mobile: slide-in drawer */}
      <aside aria-label="Seitenmenü" className={`
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
        <header className="md:hidden flex items-center gap-1 px-2 bg-slate-800 text-white shadow h-14 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Menü öffnen"
            className="flex items-center justify-center w-11 h-11 rounded-lg text-xl text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
          >
            ☰
          </button>
          <span className="font-semibold text-sm flex-1 min-w-0 truncate px-1">
            <span className="hidden xs:inline">{currentItem?.icon} </span>SP5
          </span>
          <WarningsCenter />
          {/* In-App Notifications */}
          <NotificationBell />
          <button
            onClick={() => setSpotlightOpen(true)}
            title="Schnellsuche"
            aria-label="Schnellsuche öffnen"
            className="flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-base flex-shrink-0"
          >
            🔍
          </button>
          <ThemeToggle size="sm" />
        </header>

        <main id="main-content" className="flex-1 overflow-auto pb-14 md:pb-0">
          {/* Per-page Suspense + ErrorBoundary via <PB> wrapper */}
          <Routes>
            <Route path="/" element={<PB name="Dashboard"><Dashboard /></PB>} />
            <Route path="/konflikte" element={<PB name="Konflikte"><Konflikte /></PB>} />
            <Route path="/geburtstagkalender" element={<PB name="Geburtstagkalender"><Geburtstagkalender /></PB>} />
            <Route path="/schichtwuensche" element={<PB name="Schichtwünsche"><Schichtwuensche /></PB>} />
            <Route path="/tauschboerse" element={<PB name="Tauschbörse"><TauschBoerse /></PB>} />
            <Route path="/schedule" element={<PB name="Dienstplan"><Schedule /></PB>} />
            <Route path="/einsatzplan" element={<PB name="Einsatzplan"><Einsatzplan /></PB>} />
            <Route path="/jahresuebersicht" element={<PB name="Jahresübersicht"><Jahresuebersicht /></PB>} />
            <Route path="/personaltabelle" element={<PB name="Personaltabelle"><Personaltabelle /></PB>} />
            <Route path="/statistiken" element={<PB name="Statistiken"><RoleRoute allowedRoles={['Admin', 'Planer']}><Statistiken /></RoleRoute></PB>} />
            <Route path="/urlaub" element={<PB name="Urlaubsverwaltung"><RoleRoute allowedRoles={['Admin', 'Planer']}><Urlaub /></RoleRoute></PB>} />
            <Route path="/schichtmodell" element={<PB name="Schichtmodelle"><RoleRoute allowedRoles={['Admin', 'Planer']}><Schichtmodell /></RoleRoute></PB>} />
            <Route path="/personalbedarf" element={<PB name="Personalbedarf"><RoleRoute allowedRoles={['Admin', 'Planer']}><Personalbedarf /></RoleRoute></PB>} />
            <Route path="/jahresrueckblick" element={<PB name="Jahresrückblick"><RoleRoute allowedRoles={['Admin', 'Planer']}><Jahresrueckblick /></RoleRoute></PB>} />
            <Route path="/jahresabschluss" element={<PB name="Jahresabschluss"><RoleRoute allowedRoles={['Admin', 'Planer']}><Jahresabschluss /></RoleRoute></PB>} />
            <Route path="/zeitkonto" element={<PB name="Zeitkonto"><RoleRoute allowedRoles={['Admin', 'Planer']}><Zeitkonto /></RoleRoute></PB>} />
            <Route path="/ueberstunden" element={<PB name="Überstunden"><RoleRoute allowedRoles={['Admin', 'Planer']}><Ueberstunden /></RoleRoute></PB>} />
            <Route path="/kontobuchungen" element={<PB name="Kontobuchungen"><RoleRoute allowedRoles={['Admin', 'Planer']}><Kontobuchungen /></RoleRoute></PB>} />
            <Route path="/notizen" element={<PB name="Notizen"><Notizen /></PB>} />
            <Route path="/benachrichtigungen" element={<PB name="Benachrichtigungen"><NotificationsPage /></PB>} />
            <Route path="/mitarbeiter-vergleich" element={<PB name="MA-Vergleich"><RoleRoute allowedRoles={['Admin', 'Planer']}><MitarbeiterVergleich /></RoleRoute></PB>} />
            <Route path="/team" element={<PB name="Team-Übersicht"><RoleRoute allowedRoles={['Admin', 'Planer']}><TeamUebersicht /></RoleRoute></PB>} />
            <Route path="/mitarbeiter" element={<PB name="MA-Profil"><RoleRoute allowedRoles={['Admin', 'Planer']}><MitarbeiterProfil /></RoleRoute></PB>} />
            <Route path="/mitarbeiter/:id" element={<PB name="MA-Profil"><RoleRoute allowedRoles={['Admin', 'Planer']}><MitarbeiterProfil /></RoleRoute></PB>} />
            <Route path="/mein-profil" element={<PB name="Mein Profil"><MeinProfil /></PB>} />
            <Route path="/teamkalender" element={<PB name="Team-Kalender"><Teamkalender /></PB>} />
            <Route path="/urlaubs-timeline" element={<PB name="Urlaubs-Timeline"><UrlaubsTimeline /></PB>} />
            <Route path="/fairness" element={<PB name="Fairness-Score"><RoleRoute allowedRoles={['Admin', 'Planer']}><Fairness /></RoleRoute></PB>} />
            <Route path="/berichte" element={<PB name="Monatsberichte"><RoleRoute allowedRoles={['Admin', 'Planer']}><Berichte /></RoleRoute></PB>} />
            <Route path="/export" element={<PB name="Export"><RoleRoute allowedRoles={['Admin', 'Planer']}><Export /></RoleRoute></PB>} />
            <Route path="/import" element={<PB name="Import"><RoleRoute allowedRoles={['Admin']}><Import /></RoleRoute></PB>} />
            <Route path="/employees" element={<PB name="Mitarbeiter"><RoleRoute allowedRoles={['Admin', 'Planer']}><Employees /></RoleRoute></PB>} />
            <Route path="/groups" element={<PB name="Gruppen"><RoleRoute allowedRoles={['Admin', 'Planer']}><Groups /></RoleRoute></PB>} />
            <Route path="/shifts" element={<PB name="Schichtarten"><RoleRoute allowedRoles={['Admin', 'Planer']}><Shifts /></RoleRoute></PB>} />
            <Route path="/leave-types" element={<PB name="Abwesenheitsarten"><RoleRoute allowedRoles={['Admin', 'Planer']}><LeaveTypes /></RoleRoute></PB>} />
            <Route path="/holidays" element={<PB name="Feiertage"><RoleRoute allowedRoles={['Admin', 'Planer']}><Holidays /></RoleRoute></PB>} />
            <Route path="/workplaces" element={<PB name="Arbeitsplätze"><RoleRoute allowedRoles={['Admin', 'Planer']}><Workplaces /></RoleRoute></PB>} />
            <Route path="/extracharges" element={<PB name="Zeitzuschläge"><RoleRoute allowedRoles={['Admin', 'Planer']}><Extracharges /></RoleRoute></PB>} />
            <Route path="/einschraenkungen" element={<PB name="Schichteinschränkungen"><RoleRoute allowedRoles={['Admin', 'Planer']}><Einschraenkungen /></RoleRoute></PB>} />
            <Route path="/benutzerverwaltung" element={<PB name="Benutzerverwaltung"><RoleRoute allowedRoles={['Admin']}><Benutzerverwaltung /></RoleRoute></PB>} />
            <Route path="/backup" element={<PB name="Backup & Restore"><RoleRoute allowedRoles={['Admin']}><Backup /></RoleRoute></PB>} />
            <Route path="/perioden" element={<PB name="Abrechnungszeiträume"><RoleRoute allowedRoles={['Admin']}><Perioden /></RoleRoute></PB>} />
            <Route path="/einstellungen" element={<PB name="Einstellungen"><RoleRoute allowedRoles={['Admin']}><Einstellungen /></RoleRoute></PB>} />
            <Route path="/email-settings" element={<PB name="E-Mail"><RoleRoute allowedRoles={['Admin']}><EmailSettings /></RoleRoute></PB>} />
            <Route path="/protokoll" element={<PB name="Protokoll"><RoleRoute allowedRoles={['Admin']}><Protokoll /></RoleRoute></PB>} />
            <Route path="/druckvorschau" element={<PB name="Druckvorschau"><Druckvorschau /></PB>} />
            <Route path="/dienst-board" element={<PB name="Dienst-Board"><RoleRoute allowedRoles={['Admin', 'Planer']}><DienstBoard /></RoleRoute></PB>} />
            <Route path="/wochenansicht" element={<PB name="Wochenansicht"><Wochenansicht /></PB>} />
            <Route path="/verfuegbarkeits-matrix" element={<PB name="Verfügbarkeits-Matrix"><RoleRoute allowedRoles={['Admin', 'Planer']}><VerfügbarkeitsMatrix /></RoleRoute></PB>} />
            <Route path="/rotations-analyse" element={<PB name="Rotations-Analyse"><RoleRoute allowedRoles={['Admin', 'Planer']}><RotationsAnalyse /></RoleRoute></PB>} />
            <Route path="/kapazitaets-forecast" element={<PB name="Kapazitäts-Forecast"><RoleRoute allowedRoles={['Admin', 'Planer']}><KapazitaetsForecast /></RoleRoute></PB>} />
            <Route path="/qualitaets-bericht" element={<PB name="Qualitätsbericht"><RoleRoute allowedRoles={['Admin', 'Planer']}><QualitaetsBericht /></RoleRoute></PB>} />
            <Route path="/schicht-kalibrator" element={<PB name="Schicht-Kalibrator"><RoleRoute allowedRoles={['Admin', 'Planer']}><SchichtKalibrator /></RoleRoute></PB>} />
            <Route path="/kompetenz-matrix" element={<PB name="Kompetenz-Matrix"><RoleRoute allowedRoles={['Admin', 'Planer']}><KompetenzMatrix /></RoleRoute></PB>} />
            <Route path="/analytics" element={<PB name="Analytics & Trends"><RoleRoute allowedRoles={['Admin', 'Planer']}><Analytics /></RoleRoute></PB>} />
            <Route path="/simulation" element={<PB name="Simulation"><RoleRoute allowedRoles={['Admin', 'Planer']}><Simulation /></RoleRoute></PB>} />
            <Route path="/notfall-plan" element={<PB name="Notfall-Plan"><RoleRoute allowedRoles={['Admin', 'Planer']}><NotfallPlan /></RoleRoute></PB>} />
            <Route path="/leitwand" element={<PB name="Leitwand"><RoleRoute allowedRoles={['Admin', 'Planer']}><Leitwand /></RoleRoute></PB>} />
            <Route path="/uebergabe" element={<PB name="Übergabe"><RoleRoute allowedRoles={['Admin', 'Planer']}><Uebergabe /></RoleRoute></PB>} />
            <Route path="/schichtbriefing" element={<PB name="Schicht-Briefing"><SchichtBriefing /></PB>} />
            <Route path="/onboarding" element={<PB name="Onboarding-Wizard"><OnboardingWizard /></PB>} />
            <Route path="/auditlog" element={<PB name="Audit-Log"><RoleRoute allowedRoles={['Admin', 'Planer']}><AuditLog /></RoleRoute></PB>} />
            <Route path="/health" element={<PB name="System Health"><RoleRoute allowedRoles={['Admin']}><HealthDashboard /></RoleRoute></PB>} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<PB name="404"><NotFound /></PB>} />
          </Routes>
        </main>
        {/* Bottom navigation bar — mobile only */}
        <BottomNav />
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
        <LanguageProvider>
          <ToastProvider>
            <BrowserRouter>
              <AuthProvider>
                <SSEProvider>
                  <AuthGate />
                </SSEProvider>
                <DevRoleSwitcher />
              </AuthProvider>
            </BrowserRouter>
            <GlobalToastContainer />
            <InstallBanner />
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
