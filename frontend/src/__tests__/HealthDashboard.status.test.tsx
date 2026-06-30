/**
 * Regression (P2-7 / Punkte 36+37): Das System-Health-Dashboard zeigte
 * „Backend-Status ✗" und „Datenbank ✗", obwohl Backend/DB gesund waren — die
 * Anzeige prüfte `status === 'ok'` bzw. `db.status === 'connected'`, das Backend
 * liefert aber `status: 'healthy'` und `db.status: 'ok'`. Jetzt korrekt gemappt.
 */

import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../contexts/AuthContext';
import HealthDashboard from '../pages/HealthDashboard';

const authMock = vi.mocked(useAuth);

function mockHealth(body: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (typeof url === 'string' && url.includes('/api/v1/health')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }
    // frontend-errors and anything else → empty
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
  }));
}

beforeEach(() => {
  authMock.mockReturnValue({ token: 'tok', user: { ID: 1, NAME: 'A' } } as unknown as ReturnType<typeof useAuth>);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('zeigt „✓ Online" und „✓ Verbunden" bei gesundem Backend (status healthy / db ok)', async () => {
  mockHealth({
    status: 'healthy',
    version: '1.2.3',
    uptime_seconds: 42,
    db: { status: 'ok', employees: 30 },
  });
  render(<HealthDashboard />);
  expect(await screen.findByText('✓ Online')).toBeTruthy();
  expect(screen.getByText('✓ Verbunden')).toBeTruthy();
  // Mitarbeiterzahl aus db.employees
  expect(screen.getByText('30')).toBeTruthy();
});

it('zeigt „⚠ Eingeschränkt" bei degraded und „✗ Fehler" bei db-Fehler', async () => {
  mockHealth({
    status: 'degraded',
    version: '1.2.3',
    uptime_seconds: 42,
    db: { status: 'error' },
  });
  render(<HealthDashboard />);
  expect(await screen.findByText('⚠ Eingeschränkt')).toBeTruthy();
  expect(screen.getByText('✗ Fehler')).toBeTruthy();
});
