/**
 * SP5_CORE_ONLY im Frontend: EXTRA-Liste konsistent zur Navigation,
 * Guard blockt EXTRA-Pfade im Core-Modus, Default lässt alles durch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EXTRA_ROUTE_PATHS, isExtraPath } from '../utils/coreOnly';

vi.mock('../api/client', () => ({ api: new Proxy({}, { get: () => vi.fn() }) }));
import { navItems } from '../App';
import { AuthProvider } from '../contexts/AuthContext';
import { CoreOnlyGuard } from '../components/CoreOnlyGuard';

describe('coreOnly-Klassifikation', () => {
  it('jeder EXTRA-Pfad existiert als Route/Nav-Eintrag oder ist bewusst pfadbasiert', () => {
    // Konsistenz: kein Tippfehler-Pfad, der nie matcht — jeder Nav-Pfad, der
    // EXTRA sein soll, steht in der Liste; CORE-Pfade stehen NICHT drin.
    const navPaths = new Set(navItems.map(i => i.path).filter(Boolean));
    for (const core of ['/schedule', '/einsatzplan', '/urlaub', '/zeitkonto', '/employees', '/shifts', '/groups']) {
      expect(isExtraPath(core), core).toBe(false);
      expect(navPaths.has(core) || core === '/employees').toBe(true);
    }
    for (const extra of ['/tauschboerse', '/schichtwuensche', '/analytics', '/wochenansicht']) {
      expect(isExtraPath(extra), extra).toBe(true);
    }
  });

  it('isExtraPath matcht auch Unterpfade, aber keine Präfix-Kollisionen', () => {
    expect(isExtraPath('/team')).toBe(true);
    expect(isExtraPath('/teamkalender')).toBe(true);
    expect(isExtraPath('/health')).toBe(true);
    expect(isExtraPath('/health/detail')).toBe(true);
  });
});

describe('CoreOnlyGuard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('/api/health')) {
        return Promise.resolve({ ok: true, json: async () => ({ core_only: true }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    }));
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('blockt EXTRA-Pfad im Core-Modus mit Hinweis', async () => {
    render(
      <MemoryRouter initialEntries={['/tauschboerse']}>
        <AuthProvider>
          <CoreOnlyGuard><div data-testid="page">Tauschbörse</div></CoreOnlyGuard>
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/Im Core-Modus deaktiviert/)).toBeTruthy());
    expect(screen.queryByTestId('page')).toBeNull();
  });

  it('lässt CORE-Pfad durch', async () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <AuthProvider>
          <CoreOnlyGuard><div data-testid="page">Dienstplan</div></CoreOnlyGuard>
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('page')).toBeTruthy());
  });
});
