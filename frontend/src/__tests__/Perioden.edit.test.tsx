/**
 * Page test for Perioden.tsx — gekennzeichneten Zeitraum bearbeiten
 * (P-VOLLERFASSUNG GruppenErfassen.20): die Zeitraum-Liste bietet eine
 * Bearbeiten-Aktion, die den geteilten Dialog vorausgefüllt öffnet und
 * api.updatePeriod aufruft.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: {
    getPeriods: vi.fn(),
    getGroups: vi.fn(),
    createPeriod: vi.fn(),
    updatePeriod: vi.fn(),
    deletePeriod: vi.fn(),
  },
}));

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ canEditSchedule: true }),
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

vi.mock('../components/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

import { api } from '../api/client';
import Perioden from '../pages/Perioden';

const mockGroups = [{ ID: 2, NAME: 'Team A' }];
const mockPeriod = {
  id: 5,
  group_id: 2,
  start: '2026-07-01',
  end: '2026-07-31',
  color: '#fcd34d',
  description: 'Sommer',
};

describe('Perioden — Zeitraum bearbeiten (GruppenErfassen.20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getPeriods).mockResolvedValue([mockPeriod] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getGroups).mockResolvedValue(mockGroups as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.updatePeriod).mockResolvedValue({ ok: true, record: mockPeriod } as any);
  });

  it('edit opens the prefilled modal and PUTs the changed description', async () => {
    render(<Perioden />);

    // Wait for the row to render.
    await screen.findByText('✏️ Bearbeiten');
    fireEvent.click(screen.getByText('✏️ Bearbeiten'));

    // Modal opens in edit mode with the existing description prefilled.
    expect(await screen.findByText(/Zeitraum bearbeiten/)).toBeTruthy();
    const descInput = screen.getByPlaceholderText('z.B. Q1 2026') as HTMLInputElement;
    expect(descInput.value).toBe('Sommer');

    fireEvent.change(descInput, { target: { value: 'Sommer+' } });
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(api.updatePeriod).toHaveBeenCalledWith(5, expect.objectContaining({
        group_id: 2,
        start: '2026-07-01',
        end: '2026-07-31',
        description: 'Sommer+',
      }));
    });
    expect(api.createPeriod).not.toHaveBeenCalled();
  });
});
