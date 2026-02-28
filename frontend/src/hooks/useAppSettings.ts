/**
 * useAppSettings – localStorage-persisted application settings & per-user preferences
 *
 * All settings live in localStorage so they survive page reloads without a
 * backend round-trip. The hook exposes typed getters + a single `update()`
 * helper so consumers never have to touch localStorage directly.
 */

import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorktimeSettings {
  sollStundenProWoche: number;        // e.g. 38.5
  ueberstundenSchwellenwert: number;  // hours above which = overtime alert
}

export interface NotificationSettings {
  zeigeKonflikte: boolean;
  zeigeUeberstunden: boolean;
  zeigeFehlendePlanung: boolean;
  zeigeGeburtstage: boolean;
}

export interface DisplaySettings {
  wochenbeginn: 'montag' | 'sonntag';
  datumsformat: 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  konflikteSchwellenwert: number;     // >= this many = critical
}

export interface UserPreferences {
  bevorzugteAnsicht: 'liste' | 'karte';
  gespeichertesMonat: number | null;  // 1-12
  gespeichertesJahr: number | null;
  sichtbareSpalten: string[];         // column keys
}

export interface AppSettings {
  worktime: WorktimeSettings;
  notifications: NotificationSettings;
  display: DisplaySettings;
  preferences: UserPreferences;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_APP_SETTINGS: AppSettings = {
  worktime: {
    sollStundenProWoche: 40,
    ueberstundenSchwellenwert: 2,
  },
  notifications: {
    zeigeKonflikte: true,
    zeigeUeberstunden: true,
    zeigeFehlendePlanung: true,
    zeigeGeburtstage: false,
  },
  display: {
    wochenbeginn: 'montag',
    datumsformat: 'DD.MM.YYYY',
    konflikteSchwellenwert: 3,
  },
  preferences: {
    bevorzugteAnsicht: 'liste',
    gespeichertesMonat: null,
    gespeichertesJahr: null,
    sichtbareSpalten: ['name', 'schicht', 'stunden', 'abwesenheit'],
  },
};

const STORAGE_KEY = 'sp5_app_settings';

// ─── Load / Save helpers ──────────────────────────────────────────────────────

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    // Deep-merge with defaults so new keys survive upgrades
    return {
      worktime: { ...DEFAULT_APP_SETTINGS.worktime, ...parsed.worktime },
      notifications: { ...DEFAULT_APP_SETTINGS.notifications, ...parsed.notifications },
      display: { ...DEFAULT_APP_SETTINGS.display, ...parsed.display },
      preferences: { ...DEFAULT_APP_SETTINGS.preferences, ...parsed.preferences },
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

function saveSettings(s: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const update = useCallback(<K extends keyof AppSettings>(
    section: K,
    patch: Partial<AppSettings[K]>,
  ) => {
    setSettings(prev => {
      const next: AppSettings = {
        ...prev,
        [section]: { ...prev[section], ...patch },
      };
      saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveSettings(DEFAULT_APP_SETTINGS);
    setSettings(DEFAULT_APP_SETTINGS);
  }, []);

  /** Export current settings as pretty JSON string */
  const exportJSON = useCallback((): string => {
    return JSON.stringify(settings, null, 2);
  }, [settings]);

  /** Import settings from JSON string; returns error message or null on success */
  const importJSON = useCallback((json: string): string | null => {
    try {
      const parsed = JSON.parse(json) as Partial<AppSettings>;
      const merged: AppSettings = {
        worktime: { ...DEFAULT_APP_SETTINGS.worktime, ...parsed.worktime },
        notifications: { ...DEFAULT_APP_SETTINGS.notifications, ...parsed.notifications },
        display: { ...DEFAULT_APP_SETTINGS.display, ...parsed.display },
        preferences: { ...DEFAULT_APP_SETTINGS.preferences, ...parsed.preferences },
      };
      saveSettings(merged);
      setSettings(merged);
      return null;
    } catch (e) {
      return `JSON-Fehler: ${String(e)}`;
    }
  }, []);

  return { settings, update, reset, exportJSON, importJSON };
}
