/**
 * V-14/R6.4: Arbeitsplatz im Dienstplan-Kontextmenü zuordnen/entfernen.
 * Sichert den API-Vertrag des Client-Aufrufs ab: POST /api/v1/schedule/workplace
 * mit { employee_id, date, workplace_id }; workplace_id=0 entfernt die Zuordnung.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api/client';

describe('api.assignScheduleWorkplace', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, updated: 1, workplace_id: 3 }),
      clone() { return this; },
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('POSTet employee_id/date/workplace_id an /api/v1/schedule/workplace', async () => {
    const res = await api.assignScheduleWorkplace(7, '2026-06-15', 3);
    expect(res.updated).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/schedule/workplace');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ employee_id: 7, date: '2026-06-15', workplace_id: 3 });
  });

  it('sendet workplace_id=0 zum Entfernen der Zuordnung', async () => {
    await api.assignScheduleWorkplace(7, '2026-06-15', 0);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      employee_id: 7, date: '2026-06-15', workplace_id: 0,
    });
  });
});
