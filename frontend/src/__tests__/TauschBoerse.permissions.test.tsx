/**
 * G-1 (Spec 9.5.3/9.6): Tauschbörse — Planer-Tauschaktionen nur mit
 * WDUTIES ODER WSWAPONLY; Selbstservice bleibt ungegated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: {
    getSwapRequests: vi.fn(),
    getEmployees: vi.fn(),
    getShifts: vi.fn(),
    resolveSwapRequest: vi.fn(),
    deleteSwapRequest: vi.fn(),
    respondSwapRequest: vi.fn(),
    cancelSelfSwapRequest: vi.fn(),
    createSwapRequest: vi.fn(),
    createSelfSwapRequest: vi.fn(),
    getScheduleEntries: vi.fn(),
  },
}));

vi.mock('../contexts/SSEContext', () => ({
  useSSEContext: () => ({ status: 'disconnected', subscribe: vi.fn(() => vi.fn()) }),
  useSSERefresh: vi.fn(),
}));

vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn(async () => true),
    dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../contexts/AuthContext';

import { api } from '../api/client';
import TauschBoerse from '../pages/TauschBoerse';

const authMock = vi.mocked(useAuth);

function setAuth(role: string, can: (perm: string) => boolean) {
  authMock.mockReturnValue({
    user: { ID: 9, NAME: 'P', role },
    isDevMode: false,
    devViewRole: 'admin',
    can,
  } as unknown as ReturnType<typeof useAuth>);
}

const pendingRequest = {
  id: 1, status: 'pending',
  requester_id: 1, partner_id: 2,
  requester_date: '2026-06-15', partner_date: '2026-06-16',
  requester_name: 'A', partner_name: 'B',
};

describe('TauschBoerse — WDUTIES/WSWAPONLY-Gating (G-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getSwapRequests).mockResolvedValue([pendingRequest] as never);
    vi.mocked(api.getEmployees).mockResolvedValue([] as never);
    vi.mocked(api.getShifts).mockResolvedValue([] as never);
  });

  it('Planer mit wduties: „+ Neue Anfrage" und Genehmigen sichtbar', async () => {
    setAuth('Planer', () => true);
    render(<TauschBoerse />);
    await waitFor(() => {
      expect(screen.getByText('+ Neue Anfrage')).toBeTruthy();
    });
    expect(screen.getAllByTitle('Genehmigen & ausführen').length).toBeGreaterThan(0);
  });

  it('Planer ohne wduties, aber mit wswaponly: Aktionen bleiben sichtbar', async () => {
    setAuth('Planer', (perm) => perm === 'wswaponly');
    render(<TauschBoerse />);
    await waitFor(() => {
      expect(screen.getByText('+ Neue Anfrage')).toBeTruthy();
    });
  });

  it('Planer ohne wduties und ohne wswaponly: keine Tausch-Aktionen', async () => {
    setAuth('Planer', (perm) => perm !== 'wduties' && perm !== 'wswaponly');
    render(<TauschBoerse />);
    await waitFor(() => {
      // Seite ist geladen (KPI-Karte sichtbar)
      expect(screen.getByText('Gesamt')).toBeTruthy();
    });
    expect(screen.queryByText('+ Neue Anfrage')).toBeNull();
    expect(screen.queryByTitle('Genehmigen & ausführen')).toBeNull();
    expect(screen.queryByTitle('Löschen')).toBeNull();
  });
});
