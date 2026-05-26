/**
 * Tests for ThemeContext — light/dark theme resolution, persistence and the
 * "system" preference. window.matchMedia is not implemented in jsdom, so a
 * controllable mock stands in and can fire OS colour-scheme changes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

const THEME_KEY = 'sp5_theme';

function installMatchMedia(initialDark: boolean) {
  let matches = initialDark;
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_t: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: (_t: string, cb: (e: MediaQueryListEvent) => void) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
  return {
    fire(dark: boolean) {
      matches = dark;
      listeners.forEach((cb) => cb({ matches: dark } as MediaQueryListEvent));
    },
  };
}

function setup() {
  return renderHook(() => useTheme(), { wrapper: ThemeProvider });
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    installMatchMedia(false); // default: OS prefers light
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to the system preference, resolving to light', () => {
    const { result } = setup();
    expect(result.current.preference).toBe('system');
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('resolves system → dark and applies the .dark class when the OS is dark', () => {
    installMatchMedia(true);
    const { result } = setup();
    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('reads a stored explicit preference on init', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    const { result } = setup();
    expect(result.current.preference).toBe('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('setPreference updates the theme and persists it', () => {
    const { result } = setup();
    act(() => result.current.setPreference('dark'));
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    act(() => result.current.setPreference('light'));
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('toggleTheme flips the theme and exits system mode', () => {
    const { result } = setup(); // starts system/light
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(result.current.preference).toBe('dark'); // no longer 'system'
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(result.current.preference).toBe('light');
  });

  it('follows OS colour-scheme changes while preference is system', () => {
    const mm = installMatchMedia(false);
    const { result } = setup();
    expect(result.current.theme).toBe('light');
    act(() => mm.fire(true));
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignores OS changes once an explicit preference is set', () => {
    const mm = installMatchMedia(false);
    const { result } = setup();
    act(() => result.current.setPreference('light'));
    act(() => mm.fire(true)); // OS goes dark, but we pinned light
    expect(result.current.theme).toBe('light');
  });

  it('updates the mobile theme-color meta tag', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
    const { result } = setup();
    act(() => result.current.setPreference('dark'));
    expect(meta.getAttribute('content')).toBe('#0f172a');
    act(() => result.current.setPreference('light'));
    expect(meta.getAttribute('content')).toBe('#1e293b');
    meta.remove();
  });

  it('useTheme throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(/within ThemeProvider/);
    spy.mockRestore();
  });
});
