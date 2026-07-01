/**
 * Urlaubs-Timeline: Der Gruppenfilter lädt Mitgliedschaften über den
 * existierenden Endpunkt GET /api/v1/groups/{id}/members. Der früher
 * verwendete GET /api/v1/groups/{id} existiert nicht (404) — der Fehler wurde
 * verschluckt und der Gruppenfilter zeigte bei jeder Gruppenwahl niemanden.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getLeaveTypes: vi.fn(),
    getGroups: vi.fn(),
    getGroupMembers: vi.fn(),
  },
}));

vi.mock('../components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

import { api } from '../api/client';
import UrlaubsTimeline from '../pages/UrlaubsTimeline';

const YEAR = new Date().getFullYear();

describe('UrlaubsTimeline — Gruppenfilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEmployees).mockResolvedValue([
      { ID: 1, NAME: 'Müller', FIRSTNAME: 'Hans', HIDE: false },
      { ID: 2, NAME: 'Schmidt', FIRSTNAME: 'Anna', HIDE: false },
    ] as never);
    vi.mocked(api.getLeaveTypes).mockResolvedValue([
      { ID: 10, NAME: 'Urlaub', SHORTNAME: 'U', COLORBAR_HEX: '#2563eb' },
    ] as never);
    vi.mocked(api.getGroups).mockResolvedValue([
      { ID: 5, NAME: 'Team A' },
    ] as never);
    // Nur MA 1 ist Mitglied von Team A
    vi.mocked(api.getGroupMembers).mockResolvedValue([
      { ID: 1, NAME: 'Müller', FIRSTNAME: 'Hans' },
    ] as never);
    // fetchRaw (Abwesenheiten) läuft über globales fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('zeigt bei Gruppenwahl nur die Mitglieder aus /groups/{id}/members', async () => {
    render(<UrlaubsTimeline />);
    await screen.findByText(`H. Müller`);
    expect(screen.getByText('A. Schmidt')).toBeTruthy();
    expect(vi.mocked(api.getGroupMembers)).toHaveBeenCalledWith(5);

    fireEvent.change(screen.getByDisplayValue('Alle Gruppen'), { target: { value: '5' } });

    await waitFor(() => {
      expect(screen.getByText('H. Müller')).toBeTruthy();
      expect(screen.queryByText('A. Schmidt')).toBeNull();
    });
  });

  it(`ruft keine nicht-existente Detail-Route /groups/{id} auf`, async () => {
    render(<UrlaubsTimeline />);
    await screen.findByText('H. Müller');
    const fetchMock = vi.mocked(global.fetch);
    const groupDetailCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).match(/\/api\/v1\/groups\/\d+$/)
    );
    expect(groupDetailCalls).toHaveLength(0);
    // Abwesenheiten des Jahres kommen weiterhin über fetchRaw
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes(`/api/v1/absences?year=${YEAR}`))).toBe(true);
  });
});
