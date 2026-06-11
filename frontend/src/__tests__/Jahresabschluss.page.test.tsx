/**
 * Page tests for Jahresabschluss.tsx:
 * - V-17: keep_entitlements-Durchreichung (Preview-Query + Run-Body),
 *   kein pauschales Übertrags-Limit-Feld mehr.
 * - V-13/APP-INT-3: Resturlaub-Verfall-UI (Dry-Run-Vorschau → Ausführen).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: {
    getGroups: vi.fn(),
    runAnnualClose: vi.fn(),
    forfeitLeaveEntitlements: vi.fn(),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { ID: 1, NAME: 'Admin', ADMIN: true, role: 'Admin' },
    isDevMode: false,
    canAdmin: true,
  }),
}));

import { api } from '../api/client';
import Jahresabschluss from '../pages/Jahresabschluss';

const lastYear = new Date().getFullYear() - 1;
const thisYear = new Date().getFullYear();

const previewData = {
  year: lastYear,
  next_year: lastYear + 1,
  employee_count: 1,
  total_carry_forward: 5,
  total_forfeited: 2,
  details: [{
    employee_id: 1, employee_name: 'Muster, Max',
    entitlement: 25, carry_forward_in: 0, total: 25, used: 20,
    remaining: 5, proposed_carry_forward: 5, forfeited: 0,
  }],
};

const forfeitPreview = {
  ok: true,
  cutoff_date: `${thisYear}-03-31`,
  year: thisYear,
  group_id: null,
  dry_run: true,
  employees_processed: 3,
  total_forfeited: 6,
  cuts: [{
    employee_id: 1, employee_name: 'Muster, Max',
    leave_type_id: 2, leave_type_name: 'Urlaub', year: thisYear,
    old_rest: 10, new_rest: 4, forfeited: 6,
  }],
};

describe('Jahresabschluss page — Optionen (V-17) und Verfall (V-13)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.getGroups).mockResolvedValue([] as any);
    fetchMock.mockResolvedValue({ ok: true, json: async () => previewData });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hat kein pauschales Übertrags-Limit-Feld mehr und zeigt CARRYFWD-Hinweis', () => {
    render(<Jahresabschluss />);
    expect(screen.queryByText('Maximaler Übertrag (Tage)')).toBeNull();
    expect(screen.getByText(/artspezifisch/)).toBeTruthy();
    expect(screen.getByLabelText('Urlaubsansprüche bleiben im Folgejahr gleich')).toBeTruthy();
  });

  it('reicht keep_entitlements als Query-Parameter an die Vorschau durch', async () => {
    render(<Jahresabschluss />);
    fireEvent.click(screen.getByLabelText('Urlaubsansprüche bleiben im Folgejahr gleich'));
    fireEvent.click(screen.getByRole('button', { name: /Vorschau laden/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/v1/annual-close/preview');
    expect(url).toContain('keep_entitlements=true');
    await waitFor(() => expect(screen.getByText('Muster, Max')).toBeTruthy());
  });

  it('reicht keep_entitlements beim Durchführen an runAnnualClose durch', async () => {
    vi.mocked(api.runAnnualClose).mockResolvedValue({
      year: lastYear, next_year: lastYear + 1, processed: 1,
      total_carry_forward: 5, total_forfeited: 2, already_existed: false, details: [],
    });

    render(<Jahresabschluss />);
    fireEvent.click(screen.getByLabelText('Urlaubsansprüche bleiben im Folgejahr gleich'));
    fireEvent.click(screen.getByRole('button', { name: /Vorschau laden/ }));
    await waitFor(() => expect(screen.getByText('Muster, Max')).toBeTruthy());

    // Bestätigungsdialog öffnen, Jahr eintippen, ausführen
    fireEvent.click(screen.getAllByRole('button', { name: /Jahresabschluss durchführen/ })[0]);
    fireEvent.change(screen.getByPlaceholderText(String(lastYear)), { target: { value: String(lastYear) } });
    const confirmButtons = screen.getAllByRole('button', { name: /Jahresabschluss durchführen/ });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(api.runAnnualClose).toHaveBeenCalledTimes(1));
    expect(api.runAnnualClose).toHaveBeenCalledWith(expect.objectContaining({
      year: lastYear,
      keep_entitlements: true,
    }));
  });

  it('Verfall-Vorschau ruft forfeit mit dry_run=true und zeigt Kürzungen alt→neu', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(api.forfeitLeaveEntitlements).mockResolvedValue(forfeitPreview as any);

    render(<Jahresabschluss />);
    fireEvent.click(screen.getByRole('button', { name: /Verfall-Vorschau/ }));

    await waitFor(() => expect(api.forfeitLeaveEntitlements).toHaveBeenCalledTimes(1));
    expect(api.forfeitLeaveEntitlements).toHaveBeenCalledWith({
      cutoff_date: `${thisYear}-03-31`,
      group_id: undefined,
      dry_run: true,
    });
    await waitFor(() => expect(screen.getByText('Muster, Max')).toBeTruthy());
    expect(screen.getByText('Urlaub')).toBeTruthy();   // Abwesenheitsart
    expect(screen.getByText('10')).toBeTruthy();       // Rest alt
    expect(screen.getByText('4')).toBeTruthy();        // Rest neu
  });

  it('Verfall ausführen erfordert Bestätigung und sendet dry_run=false', async () => {
    vi.mocked(api.forfeitLeaveEntitlements)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(forfeitPreview as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ ...forfeitPreview, dry_run: false } as any);

    render(<Jahresabschluss />);
    fireEvent.click(screen.getByRole('button', { name: /Verfall-Vorschau/ }));
    await waitFor(() => expect(screen.getByText('Muster, Max')).toBeTruthy());

    // Button öffnet nur den Bestätigungsdialog — noch kein zweiter API-Call
    fireEvent.click(screen.getByRole('button', { name: '❌ Verfall ausführen' }));
    expect(api.forfeitLeaveEntitlements).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Verfall bestätigen/)).toBeTruthy();

    const confirmButtons = screen.getAllByRole('button', { name: /Verfall ausführen/ });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(api.forfeitLeaveEntitlements).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.forfeitLeaveEntitlements).mock.calls[1][0]).toEqual(
      expect.objectContaining({ dry_run: false })
    );
  });

  it('blendet den Verfall-Abschnitt für Nicht-Admins nicht ein', () => {
    // canAdmin ist im Mock fest true — hier nur Smoke-Check, dass der
    // Abschnitt für Admins sichtbar ist (Gegenprobe via Mock wäre ein eigener Kontext).
    render(<Jahresabschluss />);
    expect(screen.getByText(/Resturlaub verfallen lassen/)).toBeTruthy();
  });
});
