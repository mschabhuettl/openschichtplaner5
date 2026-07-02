/**
 * SP5_READONLY im Frontend: /api/health.readonly=true → Banner sichtbar,
 * can()/canWrite* liefern false (Schreib-UI verschwindet). Die harte
 * Durchsetzung ist serverseitig (test_readonly_instance.py der api).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ReadOnlyBanner } from '../components/ReadOnlyBanner';

function Probe() {
  const { can, canWrite, canAdmin, readOnlyInstance } = useAuth();
  return (
    <div>
      <span data-testid="ro">{String(readOnlyInstance)}</span>
      <span data-testid="canwrite">{String(canWrite)}</span>
      <span data-testid="can-wduties">{String(can('wduties'))}</span>
      <span data-testid="canadmin">{String(canAdmin)}</span>
    </div>
  );
}

describe('SP5_READONLY im Frontend', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('/api/health')) {
        return Promise.resolve({ ok: true, json: async () => ({ readonly: true }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    }));
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('setzt readOnlyInstance und sperrt Schreib-Flags; Banner erscheint', async () => {
    render(
      <AuthProvider>
        <ReadOnlyBanner />
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('ro').textContent).toBe('true'));
    expect(screen.getByTestId('canwrite').textContent).toBe('false');
    expect(screen.getByTestId('can-wduties').textContent).toBe('false');
    expect(screen.getByText(/Schreibgeschützte Instanz/)).toBeTruthy();
  });
});
