/**
 * Tests for usePermissions — derives UI capability flags from the auth context.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

const authMock = vi.mocked(useAuth);

function setAuth(overrides: Record<string, unknown> = {}) {
  authMock.mockReturnValue({
    user: null,
    isDevMode: false,
    devViewRole: null,
    canWriteDuties: false,
    canWriteAbsences: false,
    canAdmin: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>);
}

describe('usePermissions', () => {
  beforeEach(() => authMock.mockReset());

  it('grants everything in dev full-view (devMode + devViewRole=dev)', () => {
    setAuth({ isDevMode: true, devViewRole: 'dev' });
    const { result } = renderHook(() => usePermissions());
    expect(result.current).toEqual({
      canEditSchedule: true,
      canEditAbsences: true,
      canEditMasterData: true,
      canSeeAdmin: true,
      canDoBackup: true,
    });
  });

  it('denies everything for a read-only user', () => {
    setAuth({ user: {} });
    const { result } = renderHook(() => usePermissions());
    expect(Object.values(result.current).every((v) => v === false)).toBe(true);
  });

  it('reflects the individual capability flags', () => {
    setAuth({
      canWriteDuties: true,
      canAdmin: true,
      user: { WACCEMWND: true, BACKUP: false },
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEditSchedule).toBe(true);
    expect(result.current.canEditAbsences).toBe(false);
    expect(result.current.canEditMasterData).toBe(true);
    expect(result.current.canSeeAdmin).toBe(true);
    expect(result.current.canDoBackup).toBe(false);
  });

  it('dev mode without the dev view-role does not auto-grant', () => {
    setAuth({ isDevMode: true, devViewRole: 'Leser', user: {} });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canSeeAdmin).toBe(false);
    expect(result.current.canEditSchedule).toBe(false);
  });
});
