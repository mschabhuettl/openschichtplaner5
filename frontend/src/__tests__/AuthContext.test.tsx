/**
 * Tests for AuthContext — session restore, dev-mode view-role simulation,
 * role-derived capability flags, login/2FA, logout and proactive expiry.
 * fetch is stubbed; localStorage/sessionStorage are real (jsdom) and cleared
 * between tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('starts logged-out and finishes loading with no stored session', () => {
    const { result } = setup();
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isDevMode).toBe(false);
  });

  // ── Session restore ──────────────────────────────────────────
  it('restores a dev-mode session with its view-role', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token: '', devMode: true, devViewRole: 'planer', user: { NAME: 'Developer' } }),
    );
    const { result } = setup();
    expect(result.current.isDevMode).toBe(true);
    expect(result.current.devViewRole).toBe('planer');
    expect(result.current.user?.NAME).toBe('Developer');
  });

  it('restores a regular user and applies role defaults', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token: '', devMode: false, user: { role: 'Admin', NAME: 'Chef', ID: 1 } }),
    );
    const { result } = setup();
    expect(result.current.user?.role).toBe('Admin');
    expect(result.current.canAdmin).toBe(true); // ACCADMWND defaulted true for Admin
    expect(result.current.token).toBeNull(); // token lives in the HttpOnly cookie
  });

  it('logs out immediately when the restored session is already expired', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: '',
        devMode: false,
        user: { role: 'Admin', NAME: 'Chef' },
        expiresAt: Math.floor(Date.now() / 1000) - 100,
      }),
    );
    const { result } = setup();
    expect(result.current.user).toBeNull();
    expect(sessionStorage.getItem('sp5_session_expired')).toBe('1');
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('drops a corrupt stored session without throwing', () => {
    localStorage.setItem(SESSION_KEY, 'not-json{');
    const { result } = setup();
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  // ── Dev mode + view-role simulation ──────────────────────────
  it('loginDev grants full access and persists a dev session', () => {
    const { result } = setup();
    act(() => result.current.loginDev());
    expect(result.current.isDevMode).toBe(true);
    expect(result.current.canAdmin).toBe(true);
    expect(result.current.canBackup).toBe(true);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).devMode).toBe(true);
  });

  it('setDevViewRole switches the simulated permissions and persists', () => {
    const { result } = setup();
    act(() => result.current.loginDev());
    act(() => result.current.setDevViewRole('lese'));
    expect(result.current.devViewRole).toBe('lese');
    expect(result.current.canWrite).toBe(false);
    expect(result.current.canAdmin).toBe(false);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).devViewRole).toBe('lese');

    act(() => result.current.setDevViewRole('planer'));
    expect(result.current.canWrite).toBe(true);
    expect(result.current.canWriteDuties).toBe(true);
    expect(result.current.canAdmin).toBe(false); // planer is not admin
  });

  it('setDevViewRole is a no-op outside dev mode', () => {
    const { result } = setup();
    act(() => result.current.setDevViewRole('admin'));
    expect(result.current.devViewRole).toBe('admin');
  });

  // ── Non-dev capability derivation ────────────────────────────
  it('derives canWrite from any granular write flag for a real user', async () => {
    const { result } = setup();
    mockFetchOnce(true, { user: { role: 'Leser', NAME: 'L', WNOTES: true } });
    await act(async () => {
      await result.current.login('l', 'pw');
    });
    expect(result.current.canWrite).toBe(true); // WNOTES alone is enough
    expect(result.current.canWriteDuties).toBe(false); // Leser default
    expect(result.current.canAdmin).toBe(false);
  });

  // ── login / 2FA / logout ─────────────────────────────────────
  it('login stores the session and sets the user on success', async () => {
    const { result } = setup();
    mockFetchOnce(true, { user: { role: 'Planer', NAME: 'P', ID: 9 } });
    await act(async () => {
      await result.current.login('p', 'pw');
    });
    expect(result.current.user?.role).toBe('Planer');
    expect(result.current.canWriteDuties).toBe(true);
    expect(result.current.canAdmin).toBe(false);
    expect(localStorage.getItem(SESSION_KEY)).toBeTruthy();
  });

  it('login rejects with the server detail message on failure', async () => {
    const { result } = setup();
    mockFetchOnce(false, { detail: 'Falsche Zugangsdaten' });
    await expect(
      act(async () => {
        await result.current.login('x', 'bad');
      }),
    ).rejects.toThrow('Falsche Zugangsdaten');
    expect(result.current.user).toBeNull();
  });

  it('login signals a 2FA requirement', async () => {
    const { result } = setup();
    mockFetchOnce(true, { requires_2fa: true });
    await expect(
      act(async () => {
        await result.current.login('x', 'pw');
      }),
    ).rejects.toThrow('2FA_REQUIRED');
  });

  it('logout clears the user and the stored session', async () => {
    const { result } = setup();
    act(() => result.current.loginDev());
    expect(result.current.user).not.toBeNull();
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  // ── 401 / unauthorized handling ──────────────────────────────
  it('clears the session when an sp5:unauthorized event fires', () => {
    const { result } = setup();
    act(() => result.current.loginDev());
    const toast = vi.fn();
    window.addEventListener('sp5:session-expired-toast', toast);
    act(() => {
      window.dispatchEvent(new CustomEvent('sp5:unauthorized'));
    });
    expect(result.current.user).toBeNull();
    expect(result.current.isDevMode).toBe(false);
    expect(sessionStorage.getItem('sp5_session_expired')).toBe('1');
    expect(toast).toHaveBeenCalled();
    window.removeEventListener('sp5:session-expired-toast', toast);
  });

  // ── Proactive expiry timer ───────────────────────────────────
  it('fires unauthorized 60s before a restored session expires', () => {
    vi.useFakeTimers();
    const expiresAt = Math.floor(Date.now() / 1000) + 120; // 2 min out
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token: '', devMode: false, user: { role: 'Admin', NAME: 'C' }, expiresAt }),
    );
    const { result } = setup();
    expect(result.current.user).not.toBeNull();
    // timer fires at expiresAt - 60s, i.e. 60s from now
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.user).toBeNull();
  });

  it('useAuth throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/within AuthProvider/);
    spy.mockRestore();
  });
});
