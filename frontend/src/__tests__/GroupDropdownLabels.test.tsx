/**
 * Gruppen-Filter-Dropdowns heißen „Alle Gruppen", nicht „Alle Mitarbeiter" —
 * die Optionsliste enthält GRUPPEN (Maintainer-Befund 23: irreführende
 * Beschriftung in Zeitkonto/Überstunden/Überstunden-Dashboard/Statistiken/
 * Verfügbarkeits-Matrix).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n';
import { ToastProvider } from '../contexts/ToastContext';

// Auto-Mock: jede api-Methode liefert []; getGroups liefert zwei Gruppen.
vi.mock('../api/client', () => {
  const fns = new Map<string, ReturnType<typeof vi.fn>>();
  const api = new Proxy({}, {
    get(_t, prop: string) {
      if (!fns.has(prop)) {
        const byShape: Record<string, unknown> = {
          getGroups: [{ ID: 5, NAME: 'Team A', SUPERID: 6 }, { ID: 6, NAME: 'Team B', SUPERID: 0 }],
          // Zeitkonto-Summary/-Overtime erwarten Objekt-Shapes
          getZeitkontoSummary: { total_target_hours: 0, total_actual_hours: 0, total_saldo: 0, employees_count: 0 },
          getOvertimeSummary: { employees: [], summary: { total_soll: 0, total_ist: 0, total_delta: 0, total_carry: 0, total_saldo: 0 } },
        };
        const fn = vi.fn().mockResolvedValue(prop in byShape ? byShape[prop] : []);
        fns.set(prop, fn);
      }
      return fns.get(prop);
    },
  });
  return { api, invalidateStammdatenCache: vi.fn(), invalidateCachePath: vi.fn() };
});

const wrap = (el: React.ReactElement) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <LanguageProvider>{el}</LanguageProvider>
      </ToastProvider>
    </MemoryRouter>
  );

async function expectGroupDropdown() {
  // Default-Option heißt „Alle Gruppen" und die Gruppen sind Optionen
  const option = await screen.findByRole('option', { name: 'Alle Gruppen' });
  expect(option).toBeTruthy();
  const select = option.closest('select')!;
  const labels = Array.from(select.options).map(o => o.textContent);
  // Baumgerechte Darstellung (Befund 18): Kind eingerückt unter dem Elternteil
  expect(labels.some(l => l.includes('└ Team A'))).toBe(true);
  expect(labels).toContain('Team B');
  // Kein Gruppen-Dropdown gibt sich mehr als Mitarbeiterliste aus
  expect(labels).not.toContain('Alle Mitarbeiter');
}

beforeEach(() => {
  localStorage.setItem('sp5_language', 'de');
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Gruppen-Dropdowns heißen „Alle Gruppen" (Befund 23)', () => {
  it('Zeitkonto', async () => {
    const { default: Zeitkonto } = await import('../pages/Zeitkonto');
    wrap(<Zeitkonto />);
    await expectGroupDropdown();
  });

  it('Überstunden', async () => {
    const { default: Ueberstunden } = await import('../pages/Ueberstunden');
    wrap(<Ueberstunden />);
    await expectGroupDropdown();
  });

  it('Überstunden-Dashboard', async () => {
    const { default: OvertimeDashboard } = await import('../pages/OvertimeDashboard');
    wrap(<OvertimeDashboard />);
    await expectGroupDropdown();
  });

  it('Statistiken', async () => {
    const { default: Statistiken } = await import('../pages/Statistiken');
    wrap(<Statistiken />);
    await expectGroupDropdown();
  });

});
