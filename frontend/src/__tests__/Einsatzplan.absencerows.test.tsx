/**
 * Einsatzplan-Wochenmatrix (Befund 7): wie das Original eine Zeile JE
 * Abwesenheitsart (unter den Schichtzeilen), Zellen = abwesende Mitarbeiter.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n';
import { ToastProvider } from '../contexts/ToastContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { ID: 9, NAME: 'P', role: 'Planer' },
    isDevMode: false, canWrite: true, canWriteDuties: true, canWriteAbsences: true,
    canAdmin: false, can: () => true,
  }),
}));
vi.mock('../contexts/SSEContext', () => ({
  useSSEContext: () => ({ status: 'disconnected', subscribe: vi.fn(() => vi.fn()) }),
  useSSERefresh: vi.fn(),
}));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

vi.mock('../api/client', () => {
  const fns = new Map();
  const today = new Date().toISOString().slice(0, 10);
  const week = {
    week_start: today,
    week_end: today,
    days: [{
      date: today,
      entries: [
        { employee_id: 1, employee_name: 'Anders, Kerstin', employee_short: 'KAN', shift_id: 1, shift_name: 'Früh', shift_short: 'F', color_bk: '#00f', color_text: '#fff', workplace_id: null, workplace_name: '', kind: 'shift', leave_name: '', display_name: 'F' },
        { employee_id: 2, employee_name: 'Bartel, Karsten', employee_short: 'KBA', shift_id: null, shift_name: '', shift_short: '', color_bk: '#fc0', color_text: '#333', workplace_id: null, workplace_name: '', kind: 'absence', leave_name: 'Urlaub', display_name: 'Ur' },
      ],
    }],
  };
  const shapes = {
    getShifts: [{ ID: 1, NAME: 'Frühschicht', SHORTNAME: 'F', COLORBK_HEX: '#00f', COLORTEXT_HEX: '#fff', TIMES_BY_WEEKDAY: {}, HIDE: false, POSITION: 1 }],
    getLeaveTypes: [
      { ID: 10, NAME: 'Urlaub', SHORTNAME: 'Ur', COLORBK_HEX: '#fc0', COLORBK_LIGHT: true },
      { ID: 11, NAME: 'Krankheit', SHORTNAME: 'Kr', COLORBK_HEX: '#f99', COLORBK_LIGHT: true },
    ],
    getScheduleWeek: week,
    getScheduleDay: week.days[0].entries,
    getGroups: [], getWorkplaces: [], getScheduleTemplates: [], getNotes: [],
  };
  const api = new Proxy({}, {
    get(_t, prop) {
      if (!fns.has(prop)) fns.set(prop, vi.fn().mockResolvedValue(prop in shapes ? shapes[prop] : []));
      return fns.get(prop);
    },
  });
  return { api, invalidateStammdatenCache: vi.fn(), invalidateCachePath: vi.fn() };
});

import Einsatzplan from '../pages/Einsatzplan';

beforeEach(() => { localStorage.setItem('sp5_language', 'de'); });
afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('Einsatzplan Wochenmatrix — Zeilen je Abwesenheitsart', () => {
  it('zeigt die Urlaubs-Zeile mit dem abwesenden MA (Original-Layout)', async () => {
    render(
      <MemoryRouter>
        <ToastProvider><LanguageProvider><Einsatzplan /></LanguageProvider></ToastProvider>
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: /Wochenansicht|Woche/ }));
    const row = await screen.findByTestId('einsatz-absence-row-10');
    expect(row.textContent).toContain('Urlaub');
    expect(row.textContent).toContain('Bartel, Karsten');
    // Zweite Art ohne Einträge existiert als eigene Zeile (hideEmpty aus)
    expect(screen.getByTestId('einsatz-absence-row-11').textContent).toContain('Krankheit');
  });
});
