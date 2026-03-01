/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

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
}

/** The roles available in the dev view-role simulator. */
export type DevViewRole = 'dev' | 'admin' | 'planer' | 'lese';

export interface AuthContextType {
  user: CurrentUser | null;
  isDevMode: boolean;
  /**
   * Dev-mode simulation: which role perspective to render the UI as.
   * Always 'dev' for non-dev sessions. Does NOT affect backend auth —
   * all API calls still use the full dev token.
   */
  devViewRole: DevViewRole;
  setDevViewRole: (role: DevViewRole) => void;
  isLoading: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  loginDev: () => void;
  logout: () => void;
  // Permission helpers — respect devViewRole in dev mode
  canWrite: boolean;
  canWriteDuties: boolean;
  canWriteAbsences: boolean;
  canWriteOvertimes: boolean;
  canAdmin: boolean;
  canBackup: boolean;
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
      return {
        canWrite: true, canWriteDuties: true, canWriteAbsences: true,
        canWriteOvertimes: true, canAdmin: true, canBackup: true,
        simulatedRole: 'Admin' as const,
      };
    default: // 'dev' — full access
      return {
        canWrite: true, canWriteDuties: true, canWriteAbsences: true,
        canWriteOvertimes: true, canAdmin: true, canBackup: true,
        simulatedRole: 'Admin' as const,
      };
  }
}

// ── Session persistence key ───────────────────────────────────
const SESSION_KEY = 'sp5_session';

interface StoredSession {
  token: string;
  user: CurrentUser;
  devMode: boolean;
  devViewRole?: DevViewRole;
}

// ── Context ───────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [devViewRole, setDevViewRoleState] = useState<DevViewRole>('dev');
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session: StoredSession = JSON.parse(raw);
        if (session.devMode) {
          setUser(DEV_USER);
          setIsDevMode(true);
          setDevViewRoleState(session.devViewRole ?? 'dev');
          setToken(null);
        } else if (session.user) {
          // Token is managed by HttpOnly cookie; only restore user metadata from localStorage
          setToken(null);
          setUser(applyRoleDefaults(session.user));
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-logout when API returns 401
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(SESSION_KEY);
      setToken(null);
      setUser(null);
      setIsDevMode(false);
      setDevViewRoleState('dev');
    };
    window.addEventListener('sp5:unauthorized', handler);
    return () => window.removeEventListener('sp5:unauthorized', handler);
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    const BASE = import.meta.env.VITE_API_URL ?? '';
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',  // allow HttpOnly cookie to be set
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login fehlgeschlagen' }));
      throw new Error(err.detail ?? 'Login fehlgeschlagen');
    }
    const data = await res.json();
    const resolvedUser = applyRoleDefaults(data.user);
    // Store user info only — token is kept in HttpOnly cookie, not localStorage
    const session: StoredSession = { token: '', user: resolvedUser, devMode: false };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setToken(null);  // token managed by HttpOnly cookie
    setUser(resolvedUser);
    setIsDevMode(false);
    setDevViewRoleState('dev');
  };

  const loginDev = () => {
    const session: StoredSession = { token: '', user: DEV_USER, devMode: true, devViewRole: 'dev' };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setToken(null);
    setUser(DEV_USER);
    setIsDevMode(true);
    setDevViewRoleState('dev');
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
    const BASE = import.meta.env.VITE_API_URL ?? '';
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-Auth-Token'] = token;
    }
    fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers,
      credentials: 'include',  // send cookie so backend can clear it
    }).catch(() => {});
    localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setUser(null);
    setIsDevMode(false);
    setDevViewRoleState('dev');
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
