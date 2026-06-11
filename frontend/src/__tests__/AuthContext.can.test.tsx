/**
 * Tests für den granularen can()-Helper im AuthContext (G-1, Spec 9.5.3):
 * permissions aus /api/auth/me, Admin-/Fehlend-Semantik (nur explizit
 * false sperrt) und Dev-Mode-Simulation je devViewRole.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

const SESSION_KEY = 'sp5_session';

function setup() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

function mockFetchOnce(ok: boolean, data: unknown) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    json: async () => data,
  });
}

describe('AuthContext can() (G-1)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false for every flag when logged out', () => {
    const { result } = setup();
    expect(result.current.can('wduties')).toBe(false);
    expect(result.current.can('showabs')).toBe(false);
  });

  it('login übernimmt permissions aus /api/auth/me — nur explizit false sperrt', async () => {
    const { result } = setup();
    mockFetchOnce(true, { user: { role: 'Planer', NAME: 'P', ID: 9 } });        // login
    mockFetchOnce(true, { permissions: { wduties: false, wabsences: true } });   // /auth/me
    await act(async () => {
      await result.current.login('p', 'pw');
    });
    expect(result.current.can('wduties')).toBe(false);   // explizit false sperrt
    expect(result.current.can('wabsences')).toBe(true);  // explizit true
    expect(result.current.can('wpast')).toBe(true);      // fehlender Schlüssel ⇒ erlaubt
    // permissions werden in der Session persistiert
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY)!);
    expect(stored.user.permissions.wduties).toBe(false);
  });

  it('Admin ⇒ immer true, auch bei explizit false gesetzten Flags', async () => {
    const { result } = setup();
    mockFetchOnce(true, { user: { role: 'Admin', NAME: 'Chef', ID: 1 } });
    mockFetchOnce(true, { permissions: { wduties: false, backup: false } });
    await act(async () => {
      await result.current.login('chef', 'pw');
    });
    expect(result.current.can('wduties')).toBe(true);
    expect(result.current.can('backup')).toBe(true);
  });

  it('user ohne permissions-Objekt ⇒ alles erlaubt (Legacy-Verhalten)', async () => {
    const { result } = setup();
    mockFetchOnce(true, { user: { role: 'Planer', NAME: 'P', ID: 9 } });
    mockFetchOnce(true, {}); // /auth/me ohne permissions
    await act(async () => {
      await result.current.login('p', 'pw');
    });
    expect(result.current.can('wduties')).toBe(true);
    expect(result.current.can('wnotes')).toBe(true);
  });

  it('Session-Restore: gespeicherte permissions wirken sofort', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: '', devMode: false,
        user: { role: 'Planer', NAME: 'P', ID: 9, permissions: { wnotes: false } },
      }),
    );
    const { result } = setup();
    expect(result.current.can('wnotes')).toBe(false);
    expect(result.current.can('wduties')).toBe(true);
  });

  it('Session-Restore: permissions werden von /api/auth/me aufgefrischt', async () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token: '', devMode: false, user: { role: 'Planer', NAME: 'P', ID: 9 } }),
    );
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ permissions: { wduties: false } }),
    });
    const { result } = setup();
    await waitFor(() => {
      expect(result.current.can('wduties')).toBe(false);
    });
    // und persistiert
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY)!);
    expect(stored.user.permissions.wduties).toBe(false);
  });

  it('Dev-Mode simuliert devViewRole: planer ohne Opt-ins, lese nur Anzeige-Flags', () => {
    const { result } = setup();
    act(() => result.current.loginDev());
    // dev: Vollzugriff
    expect(result.current.can('wduties')).toBe(true);
    expect(result.current.can('backup')).toBe(true);

    act(() => result.current.setDevViewRole('planer'));
    expect(result.current.can('wduties')).toBe(true);
    expect(result.current.can('wpast')).toBe(true);
    expect(result.current.can('wswaponly')).toBe(false);
    expect(result.current.can('addempl')).toBe(false);
    expect(result.current.can('backup')).toBe(false);

    act(() => result.current.setDevViewRole('lese'));
    expect(result.current.can('wduties')).toBe(false);
    expect(result.current.can('wabsences')).toBe(false);
    expect(result.current.can('showabs')).toBe(true);
    expect(result.current.can('shownotes')).toBe(true);
    expect(result.current.can('showstats')).toBe(true);

    act(() => result.current.setDevViewRole('admin'));
    expect(result.current.can('addempl')).toBe(true);
  });
});
