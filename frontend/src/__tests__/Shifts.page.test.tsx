/**
 * Page tests for Shifts.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/context';

vi.mock('../api/client', () => ({
  api: {
    getShifts: vi.fn(),
    createShift: vi.fn(),
    updateShift: vi.fn(),
    deleteShift: vi.fn(),
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
import Shifts from '../pages/Shifts';

const mockShifts = [
  { ID: 1, NAME: 'Frühschicht', SHORTNAME: 'F', DURATION0: 8, COLOR: 0xFFFFFF, HIDE: false },
  { ID: 2, NAME: 'Spätschicht', SHORTNAME: 'S', DURATION0: 8, COLOR: 0x0000FF, HIDE: false },
];

function renderShifts() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Shifts />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('Shifts page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sp5_language', 'de');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getShifts).mockResolvedValue(mockShifts as any);
  });

  it('renders without crash', async () => {
    renderShifts();
    await waitFor(() => {
      expect(screen.getAllByText('Frühschicht').length).toBeGreaterThan(0);
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(api.getShifts).mockReturnValue(new Promise(() => {}));
    renderShifts();
    // During loading the shift rows are not yet visible
    expect(screen.queryByText('Frühschicht')).toBeNull();
  });

  it('shows shifts after data loads', async () => {
    renderShifts();
    await waitFor(() => {
      expect(screen.getAllByText('Frühschicht').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Spätschicht').length).toBeGreaterThan(0);
    });
  });

  it('shows error state on API failure', async () => {
    vi.mocked(api.getShifts).mockRejectedValue(new Error('API Error'));
    renderShifts();
    await waitFor(() => {
      // Error causes empty list — no shifts shown
      expect(screen.queryByText('Frühschicht')).toBeNull();
    });
  });

  // P-VOLLERFASSUNG Lücke #3: ausgeblendete Stammdaten wieder einblendbar (Sackgasse beheben).
  describe('Ausgeblendete Schichtarten', () => {
    const mockWithHidden = [
      ...mockShifts,
      { ID: 3, NAME: 'Nachtschicht', SHORTNAME: 'N', DURATION0: 8, COLOR: 0x000000, HIDE: true },
    ];

    it('lädt inklusive ausgeblendeter (include_hidden=true)', async () => {
      vi.mocked(api.getShifts).mockResolvedValue(mockWithHidden as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      renderShifts();
      await waitFor(() => expect(screen.getAllByText('Frühschicht').length).toBeGreaterThan(0));
      expect(api.getShifts).toHaveBeenCalledWith(true);
    });

    it('blendet ausgeblendete Schichten standardmäßig aus, zeigt sie nach Toggle', async () => {
      vi.mocked(api.getShifts).mockResolvedValue(mockWithHidden as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      renderShifts();
      await waitFor(() => expect(screen.getAllByText('Frühschicht').length).toBeGreaterThan(0));
      // Standard: ausgeblendete Schicht NICHT sichtbar
      expect(screen.queryByText('Nachtschicht')).toBeNull();
      // Toggle ist da (Zähler 1) und aktiviert die ausgeblendete Schicht
      const toggle = screen.getByRole('checkbox', { name: /Ausgeblendete anzeigen/ });
      fireEvent.click(toggle);
      await waitFor(() => expect(screen.getAllByText('Nachtschicht').length).toBeGreaterThan(0));
    });

    it('zeigt keinen Toggle, wenn nichts ausgeblendet ist', async () => {
      renderShifts(); // mockShifts ohne HIDE
      await waitFor(() => expect(screen.getAllByText('Frühschicht').length).toBeGreaterThan(0));
      expect(screen.queryByRole('checkbox', { name: /Ausgeblendete anzeigen/ })).toBeNull();
    });
  });
});
