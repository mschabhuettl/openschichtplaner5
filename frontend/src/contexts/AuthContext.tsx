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

export interface AuthContextType {
  user: CurrentUser | null;
  isDevMode: boolean;
  isLoading: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  loginDev: () => void;
  logout: () => void;
  // Permission helpers
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

// ── Dev-Mode pseudo user ─────────────────────────────────────
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

// ── Session persistence key ───────────────────────────────────
const SESSION_KEY = 'sp5_session';

interface StoredSession {
  token: string;
  user: CurrentUser;
  devMode: boolean;
}

// ── Context ───────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
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
          setToken(null);
        } else if (session.token && session.user) {
          setToken(session.token);
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
    };
    window.addEventListener('sp5:unauthorized', handler);
    return () => window.removeEventListener('sp5:unauthorized', handler);
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    const BASE = import.meta.env.VITE_API_URL ?? '';
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login fehlgeschlagen' }));
      throw new Error(err.detail ?? 'Login fehlgeschlagen');
    }
    const data = await res.json();
    const resolvedUser = applyRoleDefaults(data.user);
    const session: StoredSession = { token: data.token, user: resolvedUser, devMode: false };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setToken(data.token);
    setUser(resolvedUser);
    setIsDevMode(false);
  };

  const loginDev = () => {
    const session: StoredSession = { token: '', user: DEV_USER, devMode: true };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setToken(null);
    setUser(DEV_USER);
    setIsDevMode(true);
  };

  const logout = async () => {
    if (token) {
      const BASE = import.meta.env.VITE_API_URL ?? '';
      fetch(`${BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'X-Auth-Token': token },
      }).catch(() => {});
    }
    localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setUser(null);
    setIsDevMode(false);
  };

  // Permission helpers
  const canWrite = isDevMode || !!(user && (
    user.WDUTIES || user.WABSENCES || user.WOVERTIMES || user.WNOTES
  ));
  const canWriteDuties = isDevMode || !!(user?.WDUTIES);
  const canWriteAbsences = isDevMode || !!(user?.WABSENCES);
  const canWriteOvertimes = isDevMode || !!(user?.WOVERTIMES);
  const canAdmin = isDevMode || !!(user?.ACCADMWND);
  const canBackup = isDevMode || !!(user?.BACKUP);

  return (
    <AuthContext.Provider value={{
      user,
      isDevMode,
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
