/**
 * G-1 (Spec 9.5.3/9.6): Notizen — Schreiben nur mit WNOTES.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: {
    getNotes: vi.fn(),
    getEmployees: vi.fn(),
    getGroups: vi.fn(),
    getGroupMembers: vi.fn(),
    addNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  },
}));

vi.mock('../contexts/SSEContext', () => ({
  useSSEContext: () => ({ status: 'disconnected', subscribe: vi.fn(() => vi.fn()) }),
  useSSERefresh: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
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
import Notizen from '../pages/Notizen';

const authMock = vi.mocked(useAuth);

function setAuth(opts: { canWrite: boolean; can: (perm: string) => boolean }) {
  authMock.mockReturnValue({
    user: { ID: 9, NAME: 'P', role: 'Planer' },
    isDevMode: false,
    devViewRole: 'admin',
    canWrite: opts.canWrite,
    can: opts.can,
  } as unknown as ReturnType<typeof useAuth>);
}

describe('Notizen — WNOTES-Gating (G-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getNotes).mockResolvedValue([] as never);
    vi.mocked(api.getEmployees).mockResolvedValue([] as never);
    vi.mocked(api.getGroups).mockResolvedValue([] as never);
    vi.mocked(api.getGroupMembers).mockResolvedValue([] as never);
  });

  it('mit wnotes: „Neue Notiz"-Button wird angeboten', async () => {
    setAuth({ canWrite: true, can: () => true });
    render(<Notizen />);
    await waitFor(() => {
      expect(screen.getByText(/Neue Notiz/)).toBeTruthy();
    });
  });

  it('ohne wnotes (explizit false): kein Schreib-Button', async () => {
    setAuth({ canWrite: true, can: (p) => p !== 'wnotes' });
    render(<Notizen />);
    await waitFor(() => {
      expect(vi.mocked(api.getNotes)).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Neue Notiz/)).toBeNull();
  });

  it('Leser ohne Schreibrechte: kein Schreib-Button trotz wnotes', async () => {
    setAuth({ canWrite: false, can: () => true });
    render(<Notizen />);
    await waitFor(() => {
      expect(vi.mocked(api.getNotes)).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Neue Notiz/)).toBeNull();
  });
});
