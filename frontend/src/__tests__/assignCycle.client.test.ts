/**
 * P-VOLLERFASSUNG Lücke #4: api.assignCycle reicht das optionale end_date
 * (befristete Schichtmodell-Zuordnung, 5CYASS.END) mit — und nur dann, wenn
 * es gesetzt ist.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api/client';

function captureFetch() {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : {} });
    return new Response(JSON.stringify({ ok: true, record: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

describe('api.assignCycle end_date', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('sendet end_date, wenn gesetzt', async () => {
    const calls = captureFetch();
    await api.assignCycle(10, 1, '2026-06-01', '2026-09-30');
    const body = calls[0].body;
    expect(body.start_date).toBe('2026-06-01');
    expect(body.end_date).toBe('2026-09-30');
  });

  it('lässt end_date weg, wenn nicht gesetzt (offene Zuordnung)', async () => {
    const calls = captureFetch();
    await api.assignCycle(10, 1, '2026-06-01');
    const body = calls[0].body;
    expect(body.start_date).toBe('2026-06-01');
    expect('end_date' in body).toBe(false);
  });
});
