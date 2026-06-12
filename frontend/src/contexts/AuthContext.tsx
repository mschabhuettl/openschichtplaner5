/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────────
export interface CurrentUser {
  ID: number;
  NAME: string;
  DESCRIP: string;
  ADMIN: boolean;
  RIGHTS: number;
  role: 'Admin' | 'Planer' | 'Leser';
  // Granular permissions
  WDUTIES: boolean;
  WABSENCES: boolean;
  WOVERTIMES: boolean;
  WNOTES: boolean;
  WCYCLEASS: boolean;
  WPAST: boolean;
  WACCEMWND: boolean;
  WACCGRWND: boolean;
  BACKUP: boolean;
  SHOWSTATS: boolean;
  ACCADMWND: boolean;
  /**
   * Granulare 5USER-Rechte aus /api/auth/me (G-1, Spec 9.5.3/9.6) —
   * Schlüssel: wduties/wabsences/wovertimes/wnotes/wdeviation/wcycleass/
   * wswaponly/wpast/addempl/showabs/shownotes/showstats/backup.
   */
  permissions?: Record<string, boolean>;
}

/** The roles available in the dev view-role simulator. */
export type DevViewRole = 'admin' | 'planer' | 'lese';

export interface AuthContextType {
  user: CurrentUser | null;
  isDevMode: boolean;
  /**
   * Dev-mode simulation: which role perspective to render the UI as.
   * Always 'admin' (highest) for non-dev sessions. Does NOT affect backend auth —
   * all API calls still use the full dev token.
   */
  devViewRole: DevViewRole;
  setDevViewRole: (role: DevViewRole) => void;
  isLoading: boolean;
  token: string | null;
  login: (username: string, password: string, totpCode?: string) => Promise<void>;
  loginDev: () => void;
  logout: () => void;
  // Permission helpers — respect devViewRole in dev mode
  canWrite: boolean;
  canWriteDuties: boolean;
  canWriteAbsences: boolean;
  canWriteOvertimes: boolean;
  canAdmin: boolean;
  canBackup: boolean;
  /**
   * Granulares Rechte-Gating (G-1): prüft ein 5USER-Flag aus
   * user.permissions (z. B. 'wduties'). Verhalten wie die api:
   * Admin ⇒ immer true, fehlende permissions/fehlender Schlüssel ⇒ true —
   * nur ein explizit gesetztes false sperrt. Im Dev-Mode wird der
   * gewählte devViewRole simuliert.
   */
  can: (perm: string) => boolean;
}

// ── Default role permissions ─────────────────────────────────
function applyRoleDefaults(user: Partial<CurrentUser>): CurrentUser {
  const role = user.role ?? 'Leser';
  const isAdmin = role === 'Admin';
  const isPlaner = role === 'Planer';

  return {
    ID: user.ID ?? 0,
    NAME: user.NAME ?? '',
    DESCRIP: user.DESCRIP ?? '',
    ADMIN: user.ADMIN ?? isAdmin,
    RIGHTS: user.RIGHTS ?? (isPlaner ? 1 : 0),
    role,
    WDUTIES: user.WDUTIES ?? (isAdmin || isPlaner),
    WABSENCES: user.WABSENCES ?? (isAdmin || isPlaner),
    WOVERTIMES: user.WOVERTIMES ?? (isAdmin || isPlaner),
    WNOTES: user.WNOTES ?? (isAdmin || isPlaner),
    WCYCLEASS: user.WCYCLEASS ?? (isAdmin || isPlaner),
    WPAST: user.WPAST ?? (isAdmin || isPlaner),
    WACCEMWND: user.WACCEMWND ?? isAdmin,
    WACCGRWND: user.WACCGRWND ?? isAdmin,
    BACKUP: user.BACKUP ?? isAdmin,
    SHOWSTATS: user.SHOWSTATS ?? (isAdmin || isPlaner),
    ACCADMWND: user.ACCADMWND ?? isAdmin,
    permissions: user.permissions,
  };
}

// ── Dev-Mode pseudo user (always full access) ─────────────────────────────────────
const DEV_USER: CurrentUser = {
  ID: 0,
  NAME: 'Developer',
  DESCRIP: 'Dev-Mode — Vollzugriff',
  ADMIN: true,
  RIGHTS: 99,
  role: 'Admin',
  WDUTIES: true,
  WABSENCES: true,
  WOVERTIMES: true,
  WNOTES: true,
  WCYCLEASS: true,
  WPAST: true,
  WACCEMWND: true,
  WACCGRWND: true,
  BACKUP: true,
  SHOWSTATS: true,
  ACCADMWND: true,
};

/**
 * Returns simulated permissions for the given devViewRole.
 * Used only for UI rendering — backend still gets the full dev token.
 */
function devViewPermissions(role: DevViewRole) {
  switch (role) {
    case 'lese':
      return {
        canWrite: false, canWriteDuties: false, canWriteAbsences: false,
        canWriteOvertimes: false, canAdmin: false, canBackup: false,
        simulatedRole: 'Leser' as const,
      };
    case 'planer':
      return {
        canWrite: true, canWriteDuties: true, canWriteAbsences: true,
        canWriteOvertimes: true, canAdmin: false, canBackup: false,
        simulatedRole: 'Planer' as const,
      };
    case 'admin':
    default: // 'admin' — full access (highest simulated level)
      return {
        canWrite: true, canWriteDuties: true, canWriteAbsences: true,
        canWriteOvertimes: true, canAdmin: true, canBackup: true,
        simulatedRole: 'Admin' as const,
      };
  }
}

/**
 * Simulierte granulare Rechte je devViewRole (G-1, nur UI-Rendering).
 * Spiegelt die api-Rollen-Defaults: Planer hat die W*-Schreibflags,
 * aber nicht die Opt-ins (wswaponly/addempl/backup); Leser nur die
 * Anzeige-Flags (showabs/shownotes/showstats).
 */
function devViewCan(role: DevViewRole, perm: string): boolean {
  switch (role) {
    case 'lese':
      return perm === 'showabs' || perm === 'shownotes' || perm === 'showstats';
    case 'planer':
      return perm !== 'wswaponly' && perm !== 'addempl' && perm !== 'backup';
    default: // 'admin': Vollzugriff
      return true;
  }
}

// ── Session persistence key ───────────────────────────────────
const SESSION_KEY = 'sp5_session';

interface StoredSession {
  token: string;
  user: CurrentUser;
  devMode: boolean;
  devViewRole?: DevViewRole;
  expiresAt?: number;  // Unix timestamp (seconds) when session expires
}

// ── Context ───────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [devViewRole, setDevViewRoleState] = useState<DevViewRole>('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Clear any running session-expiry timer. */
  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  /**
   * Schedule a proactive logout shortly before the session expires.
   * Fires 60 s before `expiresAt` (or immediately if already past).
   */
  const scheduleExpiryTimer = useCallback((expiresAt: number) => {
    clearExpiryTimer();
    // Trigger 60 seconds before actual expiry so the user isn't mid-action
    const BUFFER_MS = 60_000;
    const msUntilExpiry = expiresAt * 1000 - Date.now() - BUFFER_MS;
    const delay = Math.max(msUntilExpiry, 0);
    expiryTimerRef.current = setTimeout(() => {
      // Dispatch the unauthorized event — same path as a 401 response
      window.dispatchEvent(new CustomEvent('sp5:unauthorized'));
    }, delay);
  }, [clearExpiryTimer]);

  /**
   * G-1: Granulare Rechte von /api/auth/me holen (Server ist Quelle der
   * Wahrheit). Liefert null bei Fehlern — dann bleibt das bisherige
   * permissions-Objekt (bzw. die Rollen-Defaults) in Kraft.
   */
  const fetchPermissions = useCallback(async (): Promise<Record<string, boolean> | null> => {
    try {
      const BASE = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${BASE}/api/v1/auth/me`, { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data && typeof data.permissions === 'object' && data.permissions !== null
        ? data.permissions as Record<string, boolean>
        : null;
    } catch {
      return null;
    }
  }, []);

  /** permissions in State + persistierter Session aktualisieren. */
  const applyPermissions = useCallback((perms: Record<string, boolean>) => {
    setUser(u => (u ? { ...u, permissions: perms } : u));
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session: StoredSession = JSON.parse(raw);
        if (!session.devMode && session.user) {
          session.user = { ...session.user, permissions: perms };
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session: StoredSession = JSON.parse(raw);
        if (session.devMode) {
          setUser(DEV_USER);
          setIsDevMode(true);
          setDevViewRoleState((session.devViewRole as string) === 'dev' ? 'admin' : (session.devViewRole ?? 'admin'));
          setToken(null);
        } else if (session.user) {
          // Token is managed by HttpOnly cookie; only restore user metadata from localStorage
          setToken(null);
          setUser(applyRoleDefaults(session.user));
          // Restore proactive expiry timer
          if (session.expiresAt && session.expiresAt * 1000 <= Date.now()) {
            // Already expired — log out immediately
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.setItem('sp5_session_expired', '1');
            setUser(null);
          } else {
            if (session.expiresAt) {
              scheduleExpiryTimer(session.expiresAt);
            }
            // G-1: permissions im Hintergrund auffrischen
            fetchPermissions().then(perms => {
              if (perms) applyPermissions(perms);
            });
          }
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [scheduleExpiryTimer, fetchPermissions, applyPermissions]);

  // Auto-logout when API returns 401 or proactive expiry timer fires
  useEffect(() => {
    const handler = () => {
      clearExpiryTimer();
      localStorage.removeItem(SESSION_KEY);
      // Signal to Login page that session expired (not a manual logout)
      sessionStorage.setItem('sp5_session_expired', '1');
      // Dispatch a toast event so the UI can show a notification
      window.dispatchEvent(new CustomEvent('sp5:session-expired-toast', {
        detail: { message: 'Sitzung abgelaufen — bitte neu anmelden.' },
      }));
      setToken(null);
      setUser(null);
      setIsDevMode(false);
      setDevViewRoleState('admin');
    };
    window.addEventListener('sp5:unauthorized', handler);
    return () => window.removeEventListener('sp5:unauthorized', handler);
  }, [clearExpiryTimer]);

  const login = async (username: string, password: string, totpCode?: string): Promise<void> => {
    const BASE = import.meta.env.VITE_API_URL ?? '';
    const body: Record<string, string> = { username, password };
    if (totpCode) body.totp_code = totpCode;
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',  // allow HttpOnly cookie to be set
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ detail: 'Login fehlgeschlagen' }));
    if (!res.ok) {
      throw new Error(data.detail ?? 'Login fehlgeschlagen');
    }
    // Check if 2FA is required
    if (data.requires_2fa) {
      const err = new Error('2FA_REQUIRED');
      (err as Error & { requires2FA: boolean }).requires2FA = true;
      throw err;
    }
    // G-1: granulare permissions aus /api/auth/me übernehmen (Login-Antwort
    // enthält sie nicht; das Session-Cookie ist hier bereits gesetzt)
    const perms = await fetchPermissions();
    const resolvedUser = applyRoleDefaults(
      perms ? { ...data.user, permissions: perms } : data.user,
    );
    const expiresAt: number | undefined = data.expires_at;
    // Store user info only — token is kept in HttpOnly cookie, not localStorage
    const session: StoredSession = { token: '', user: resolvedUser, devMode: false, expiresAt };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setToken(null);  // token managed by HttpOnly cookie
    setUser(resolvedUser);
    setIsDevMode(false);
    setDevViewRoleState('admin');
    // Schedule proactive logout before session expires
    if (expiresAt) {
      scheduleExpiryTimer(expiresAt);
    }
  };

  const loginDev = () => {
    const session: StoredSession = { token: '', user: DEV_USER, devMode: true, devViewRole: 'admin' };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setToken(null);
    setUser(DEV_USER);
    setIsDevMode(true);
    setDevViewRoleState('admin');
  };

  /** Switch the simulated view-role. Only changes UI — backend token stays __dev_mode__. */
  const setDevViewRole = (role: DevViewRole) => {
    if (!isDevMode) return;
    setDevViewRoleState(role);
    // Persist so it survives page refresh
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session: StoredSession = JSON.parse(raw);
        session.devViewRole = role;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
    } catch { /* ignore */ }
  };

  const logout = async () => {
    clearExpiryTimer();
    const BASE = import.meta.env.VITE_API_URL ?? '';
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-Auth-Token'] = token;
    }
    fetch(`${BASE}/api/v1/auth/logout`, {
      method: 'POST',
      headers,
      credentials: 'include',  // send cookie so backend can clear it
    }).catch(() => {});
    localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setUser(null);
    setIsDevMode(false);
    setDevViewRoleState('admin');
  };

  // Permission helpers — in dev mode, simulate the selected view-role for UI purposes
  const simPerms = isDevMode ? devViewPermissions(devViewRole) : null;

  const canWrite = simPerms ? simPerms.canWrite : !!(user && (
    user.WDUTIES || user.WABSENCES || user.WOVERTIMES || user.WNOTES
  ));
  const canWriteDuties = simPerms ? simPerms.canWriteDuties : !!(user?.WDUTIES);
  const canWriteAbsences = simPerms ? simPerms.canWriteAbsences : !!(user?.WABSENCES);
  const canWriteOvertimes = simPerms ? simPerms.canWriteOvertimes : !!(user?.WOVERTIMES);
  const canAdmin = simPerms ? simPerms.canAdmin : !!(user?.ACCADMWND);
  const canBackup = simPerms ? simPerms.canBackup : !!(user?.BACKUP);

  // G-1: granulares Flag-Gating — nur explizit false sperrt (wie die api)
  const can = useCallback((perm: string): boolean => {
    if (isDevMode) return devViewCan(devViewRole, perm);
    if (!user) return false;
    if (user.role === 'Admin' || user.ADMIN) return true;
    return user.permissions?.[perm] !== false;
  }, [isDevMode, devViewRole, user]);

  return (
    <AuthContext.Provider value={{
      user,
      isDevMode,
      devViewRole,
      setDevViewRole,
      isLoading,
      token,
      login,
      loginDev,
      logout,
      canWrite,
      canWriteDuties,
      canWriteAbsences,
      canWriteOvertimes,
      canAdmin,
      canBackup,
      can,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
