/**
 * A9: ReorderDialog — ▲/▼ ändert die Reihenfolge, Speichern ruft
 * api.reorderMasterData mit den IDs in neuer Reihenfolge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ReorderDialog from '../components/ReorderDialog';

const reorderMock = vi.fn().mockResolvedValue({ ok: true, updated: 3 });
vi.mock('../api/client', () => ({
  api: { reorderMasterData: (...args: unknown[]) => reorderMock(...args) },
}));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const items = [
  { id: 10, label: 'Alpha' },
  { id: 11, label: 'Beta' },
  { id: 12, label: 'Gamma' },
];

describe('ReorderDialog', () => {
  beforeEach(() => { reorderMock.mockClear(); cleanup(); });

  it('rendert die Einträge in Reihenfolge', () => {
    render(<ReorderDialog entity="shifts" title="Test" items={items} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
  });

  it('verschiebt einen Eintrag nach unten und speichert die neue Reihenfolge', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<ReorderDialog entity="shifts" title="Test" items={items} onClose={onClose} onSaved={onSaved} />);
    // erstes „nach unten" bewegt Alpha (id 10) hinter Beta (id 11)
    fireEvent.click(screen.getAllByLabelText('nach unten')[0]);
    fireEvent.click(screen.getByText('Speichern'));
    await waitFor(() => expect(reorderMock).toHaveBeenCalledWith('shifts', [11, 10, 12]));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('oberster Eintrag kann nicht nach oben', () => {
    render(<ReorderDialog entity="groups" title="Test" items={items} onClose={() => {}} onSaved={() => {}} />);
    const upButtons = screen.getAllByLabelText('nach oben') as HTMLButtonElement[];
    expect(upButtons[0].disabled).toBe(true);
  });
});
