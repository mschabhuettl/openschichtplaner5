/**
 * Page tests for Holidays.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/context';

vi.mock('../api/client', () => ({
  api: {
    getHolidays: vi.fn(),
    getLeaveTypes: vi.fn(),
    createHoliday: vi.fn(),
    updateHoliday: vi.fn(),
    deleteHoliday: vi.fn(),
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
import Holidays from '../pages/Holidays';

const mockHolidays = [
  { ID: 1, DATE: '2026-01-01', NAME: 'Neujahr', INTERVAL: 1 },
  { ID: 2, DATE: '2026-12-25', NAME: 'Weihnachten', INTERVAL: 1 },
];

const mockLeaveTypes = [
  { ID: 1, NAME: 'Urlaub', SHORTNAME: 'U', HIDE: false },
];

function renderHolidays() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Holidays />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('Holidays page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sp5_language', 'de');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getHolidays).mockResolvedValue(mockHolidays as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getLeaveTypes).mockResolvedValue(mockLeaveTypes as any);
  });

  it('renders without crash', async () => {
    renderHolidays();
    await waitFor(() => {
      expect(screen.getByText('Neujahr')).toBeTruthy();
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(api.getHolidays).mockReturnValue(new Promise(() => {}));
    renderHolidays();
    expect(screen.queryByText('Neujahr')).toBeNull();
  });

  it('shows holidays after data loads', async () => {
    renderHolidays();
    await waitFor(() => {
      expect(screen.getByText('Neujahr')).toBeTruthy();
      expect(screen.getByText('Weihnachten')).toBeTruthy();
    });
  });

  it('shows empty list on API failure', async () => {
    vi.mocked(api.getHolidays).mockRejectedValue(new Error('API Error'));
    renderHolidays();
    await waitFor(() => {
      expect(screen.queryByText('Neujahr')).toBeNull();
    });
  });
});
