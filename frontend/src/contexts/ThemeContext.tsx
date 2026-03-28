/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  preference: ThemePreference;
  toggleTheme: () => void;
  setPreference: (pref: ThemePreference) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_KEY = 'sp5_theme';

/** Resolve system preference to light/dark */
function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/** Read stored preference from localStorage */
function getStoredPreference(): ThemePreference | null {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  } catch { /* ignore */ }
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    return getStoredPreference() ?? 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<Theme>(() => {
    const pref = getStoredPreference() ?? 'system';
    if (pref === 'system') return getSystemTheme();
    return pref;
  });

  // Listen for OS dark mode changes when preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [preference]);

  // Apply class to <html> element
  useEffect(() => {
    const html = document.documentElement;
    if (resolvedTheme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // Persist preference
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, preference);
    } catch { /* ignore */ }
  }, [preference]);

  // Update meta theme-color for mobile browsers
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolvedTheme === 'dark' ? '#0f172a' : '#1e293b');
    }
  }, [resolvedTheme]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    if (pref === 'system') {
      setResolvedTheme(getSystemTheme());
    } else {
      setResolvedTheme(pref);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // When toggling, always switch to explicit light/dark (exit system mode)
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setPreferenceState(next);
    setResolvedTheme(next);
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{
      theme: resolvedTheme,
      preference,
      toggleTheme,
      setPreference,
      isDark: resolvedTheme === 'dark',
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
