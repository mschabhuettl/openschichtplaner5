/**
 * Page tests for Groups.tsx
 * Uses real i18n/LanguageProvider to avoid translation mock complexity.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/context';

// ── API mock ──────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  api: {
    getGroups: vi.fn(),
    getEmployees: vi.fn(),
    getGroupMembers: vi.fn(),
    addGroupMember: vi.fn(),
    removeGroupMember: vi.fn(),
    updateGroup: vi.fn(),
    createGroup: vi.fn(),
    deleteGroup: vi.fn(),
  },
  invalidateStammdatenCache: vi.fn(),
}));

// ── Auth mock ─────────────────────────────────────────────────
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { ID: 1, NAME: 'Admin', ADMIN: true, role: 'Admin' },
    isDevMode: false,
    canAdmin: true,
    canWrite: true,
  }),
}));

// ── Toast / Confirm mocks ─────────────────────────────────────
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn(async () => true),
    dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}));

import { api } from '../api/client';
import Groups from '../pages/Groups';

const mockGroups = [
  { ID: 1, NAME: 'Team Alpha', SHORTNAME: 'TA', SUPERID: 0, HIDE: false, BOLD: 0, DAILYDEM: 0, ARBITR: '', CFGLABEL: 0, CBKLABEL: 0, CBKSCHED: 0 },
  { ID: 2, NAME: 'Team Beta', SHORTNAME: 'TB', SUPERID: 0, HIDE: false, BOLD: 0, DAILYDEM: 0, ARBITR: '', CFGLABEL: 0, CBKLABEL: 0, CBKSCHED: 0 },
];

function renderGroups() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Groups />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('Groups page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force German locale so translations are predictable
    localStorage.setItem('sp5_language', 'de');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getGroups).mockResolvedValue(mockGroups as any);
    vi.mocked(api.getEmployees).mockResolvedValue([]);
  });

  it('renders groups after loading', async () => {
    renderGroups();
    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeTruthy();
      expect(screen.getByText('Team Beta')).toBeTruthy();
    });
  });

  it('renders page title with group count', async () => {
    renderGroups();
    await waitFor(() => {
      expect(screen.getByText(/Gruppen \(2\)/)).toBeTruthy();
    });
  });

  it('renders search input', async () => {
    renderGroups();
    await waitFor(() => screen.getByText('Team Alpha'));
    expect(screen.getByPlaceholderText('🔍 Suchen...')).toBeTruthy();
  });

  it('filters groups by search input', async () => {
    renderGroups();
    await waitFor(() => screen.getByText('Team Alpha'));

    const searchInput = screen.getByPlaceholderText('🔍 Suchen...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeTruthy();
      expect(screen.queryByText('Team Beta')).toBeNull();
    });
  });

  it('shows empty state message when no groups', async () => {
    vi.mocked(api.getGroups).mockResolvedValue([]);
    renderGroups();
    await waitFor(() => {
      expect(screen.getByText('Noch keine Gruppen angelegt')).toBeTruthy();
    });
  });
});
