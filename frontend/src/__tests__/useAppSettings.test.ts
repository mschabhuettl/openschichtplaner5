/**
 * Tests for useAppSettings — localStorage-persisted app settings with deep-merge,
 * update/reset, and JSON export/import.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppSettings, DEFAULT_APP_SETTINGS } from '../hooks/useAppSettings';

const KEY = 'sp5_app_settings';

describe('useAppSettings', () => {
  beforeEach(() => localStorage.clear());

  it('returns defaults when nothing is stored', () => {
    const { result } = renderHook(() => useAppSettings());
    expect(result.current.settings).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('deep-merges a stored partial with defaults (new keys survive)', () => {
    localStorage.setItem(KEY, JSON.stringify({ worktime: { sollStundenProWoche: 38.5 } }));
    const { result } = renderHook(() => useAppSettings());
    expect(result.current.settings.worktime.sollStundenProWoche).toBe(38.5);
    // untouched keys fall back to defaults
    expect(result.current.settings.worktime.ueberstundenSchwellenwert).toBe(
      DEFAULT_APP_SETTINGS.worktime.ueberstundenSchwellenwert,
    );
    expect(result.current.settings.display).toEqual(DEFAULT_APP_SETTINGS.display);
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(KEY, '{broken');
    const { result } = renderHook(() => useAppSettings());
    expect(result.current.settings).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('update() patches a section and persists it', () => {
    const { result } = renderHook(() => useAppSettings());
    act(() => result.current.update('notifications', { zeigeGeburtstage: true }));
    expect(result.current.settings.notifications.zeigeGeburtstage).toBe(true);
    // other notification keys unchanged
    expect(result.current.settings.notifications.zeigeKonflikte).toBe(true);
    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(persisted.notifications.zeigeGeburtstage).toBe(true);
  });

  it('reset() restores defaults and persists', () => {
    const { result } = renderHook(() => useAppSettings());
    act(() => result.current.update('worktime', { sollStundenProWoche: 12 }));
    act(() => result.current.reset());
    expect(result.current.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('exportJSON round-trips through importJSON', () => {
    const { result } = renderHook(() => useAppSettings());
    act(() => result.current.update('display', { wochenbeginn: 'sonntag' }));
    let json = '';
    act(() => { json = result.current.exportJSON(); });
    expect(JSON.parse(json).display.wochenbeginn).toBe('sonntag');

    act(() => result.current.reset());
    let err: string | null = 'x';
    act(() => { err = result.current.importJSON(json); });
    expect(err).toBeNull();
    expect(result.current.settings.display.wochenbeginn).toBe('sonntag');
  });

  it('importJSON returns an error string on invalid JSON and keeps settings', () => {
    const { result } = renderHook(() => useAppSettings());
    let err: string | null = null;
    act(() => { err = result.current.importJSON('{not json'); });
    expect(err).toMatch(/JSON-Fehler/);
    expect(result.current.settings).toEqual(DEFAULT_APP_SETTINGS);
  });
});
