/**
 * Einsatzplan-Anzeigeoptionen „Mitarbeitername" wie das Original (Spec 4.11.10-3):
 * a) Namen in den individuellen Farben des Mitarbeiters (Tint + Spine, nie Rohfarbe);
 * b) bei Diensten die Bezeichnung des zugeordneten Arbeitsplatzes voranstellen.
 * Beide Default AUS — das heutige Bild bleibt unverändert.
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
  const entries = [
    { employee_id: 1, employee_name: 'Anders, Kerstin', employee_short: 'KAN', shift_id: 1, shift_name: 'Früh', shift_short: 'F', color_bk: '#00f', color_text: '#fff', workplace_id: 3, workplace_name: 'OP-Saal', kind: 'shift', leave_name: '', display_name: 'F' },
    { employee_id: 2, employee_name: 'Bartel, Karsten', employee_short: 'KBA', shift_id: null, shift_name: '', shift_short: '', color_bk: '#fc0', color_text: '#333', workplace_id: null, workplace_name: '', kind: 'absence', leave_name: 'Urlaub', display_name: 'Ur' },
  ];
  const shapes = {
    getShifts: [{ ID: 1, NAME: 'Frühschicht', SHORTNAME: 'F', COLORBK_HEX: '#00f', COLORTEXT_HEX: '#fff', TIMES_BY_WEEKDAY: {}, HIDE: false, POSITION: 1 }],
    getLeaveTypes: [{ ID: 10, NAME: 'Urlaub', SHORTNAME: 'Ur', COLORBK_HEX: '#fc0', COLORBK_LIGHT: true }],
    getScheduleDay: entries,
    // beide MA mit individueller Farbe — die Abwesenheit muss trotzdem hohl bleiben
    getEmployees: [
      { ID: 1, NAME: 'Anders', FIRSTNAME: 'Kerstin', CBKLABEL: 255, CBKLABEL_HEX: '#ff0000' },
      { ID: 2, NAME: 'Bartel', FIRSTNAME: 'Karsten', CBKLABEL: 16711680, CBKLABEL_HEX: '#0000ff' },
    ],
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

function renderPage() {
  render(
    <MemoryRouter>
      <ToastProvider><LanguageProvider><Einsatzplan /></LanguageProvider></ToastProvider>
    </MemoryRouter>
  );
}

async function openWeekView() {
  fireEvent.click(await screen.findByRole('button', { name: /Wochenansicht/ }));
  return await screen.findAllByText('Anders, Kerstin');
}

describe('Einsatzplan — Anzeigeoptionen (Spec 4.11.10-3a/b)', () => {
  it('Default: beide Optionen aus — keine MA-Farbe, kein Arbeitsplatz-Präfix', async () => {
    renderPage();
    const chips = await openWeekView();
    expect(chips[0].style.boxShadow).toBe('');
    expect(screen.queryByText(/OP-Saal:/)).toBeNull();
    expect(screen.getByRole('button', { name: /MA-Farben/ }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: /Arbeitsplatz/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('MA-Farben: Dienst-Badge bekommt Tint + Spine, Abwesenheits-Badge bleibt hohl', async () => {
    renderPage();
    await openWeekView();
    fireEvent.click(screen.getByRole('button', { name: /MA-Farben/ }));
    await waitFor(() => {
      expect(screen.getAllByText('Anders, Kerstin')[0].style.boxShadow).toContain('inset 3px 0 0');
    });
    // Abwesenheit von Option (a) unberührt: hohl, keine Spine — obwohl MA 2 eine Farbe hat
    const abw = screen.getAllByText('Bartel, Karsten')[0];
    expect(abw.style.boxShadow).toBe('');
  });

  it('Arbeitsplatz voranstellen: „<Arbeitsplatz>: <Name>" nur bei Diensten mit Arbeitsplatz', async () => {
    renderPage();
    await openWeekView();
    fireEvent.click(screen.getByRole('button', { name: /Arbeitsplatz/ }));
    expect((await screen.findAllByText('OP-Saal: Anders, Kerstin')).length).toBeGreaterThan(0);
    // Abwesenheit (ohne Arbeitsplatz-Zuordnung) bleibt ohne Präfix
    expect(screen.getAllByText('Bartel, Karsten').length).toBeGreaterThan(0);
  });

  it('Tagesansicht: beide Optionen wirken auf die Namens-Badges', async () => {
    renderPage();
    expect((await screen.findAllByText('Anders, Kerstin')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Arbeitsplatz/ }));
    const span = (await screen.findAllByText('OP-Saal: Anders, Kerstin'))[0];
    expect((span.closest('div') as HTMLElement).style.boxShadow).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /MA-Farben/ }));
    await waitFor(() => {
      const badge = screen.getAllByText('OP-Saal: Anders, Kerstin')[0].closest('div') as HTMLElement;
      expect(badge.style.boxShadow).toContain('inset 3px 0 0');
    });
  });
});
