/**
 * Page tests for Workplaces.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/context';

vi.mock('../api/client', () => ({
  api: {
    getWorkplaces: vi.fn(),
    getEmployees: vi.fn(),
    getWorkplaceEmployees: vi.fn(),
    createWorkplace: vi.fn(),
    updateWorkplace: vi.fn(),
    deleteWorkplace: vi.fn(),
    assignEmployeeToWorkplace: vi.fn(),
    removeEmployeeFromWorkplace: vi.fn(),
  },
  invalidateStammdatenCache: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { ID: 1, NAME: 'Admin', ADMIN: true, role: 'Admin' },
    isDevMode: false,
    canAdmin: true,
    canWrite: true,
  }),
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

import { api } from '../api/client';
import Workplaces from '../pages/Workplaces';

const mockWorkplaces = [
  { ID: 1, NAME: 'Station A', SHORTNAME: 'A', COLOR: 0xFFFFFF, HIDE: false },
  { ID: 2, NAME: 'Station B', SHORTNAME: 'B', COLOR: 0x00FF00, HIDE: false },
];

function renderWorkplaces() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Workplaces />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('Workplaces page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sp5_language', 'de');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getWorkplaces).mockResolvedValue(mockWorkplaces as any);
    vi.mocked(api.getEmployees).mockResolvedValue([]);
  });

  it('renders without crash', async () => {
    renderWorkplaces();
    await waitFor(() => {
      expect(screen.getByText('Station A')).toBeTruthy();
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(api.getWorkplaces).mockReturnValue(new Promise(() => {}));
    renderWorkplaces();
    expect(screen.queryByText('Station A')).toBeNull();
  });

  it('shows workplaces after data loads', async () => {
    renderWorkplaces();
    await waitFor(() => {
      expect(screen.getByText('Station A')).toBeTruthy();
      expect(screen.getByText('Station B')).toBeTruthy();
    });
  });

  it('shows empty list on API failure', async () => {
    vi.mocked(api.getWorkplaces).mockRejectedValue(new Error('API Error'));
    renderWorkplaces();
    await waitFor(() => {
      expect(screen.queryByText('Station A')).toBeNull();
    });
  });
});
