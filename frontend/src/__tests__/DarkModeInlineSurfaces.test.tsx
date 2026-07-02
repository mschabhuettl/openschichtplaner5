/**
 * Dark-Mode-Kontrast (Befunde 29/35): Analytics & Trends und Audit-Log sind
 * inline gestylt — Flächen/Text MÜSSEN die Theme-Variablen (var(--color-…))
 * nutzen, sonst bleiben sie im Dark-Mode weiß/hell (die globalen
 * html.dark-Klassen-Overrides greifen bei Inline-Styles nicht).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
  api: {
    getYearSummary: vi.fn(),
    getChangelog: vi.fn(),
  },
}));

import { api } from '../api/client';
import Analytics from '../pages/Analytics';
import AuditLog from '../pages/AuditLog';

const HARD_LIGHT = new Set([
  'white', '#fff', '#ffffff', 'rgb(255, 255, 255)',
  '#fffbeb', '#f8fafc', '#f1f5f9', '#fafafa', '#f3f4f6',
]);

function assertNoHardLightSurfaces(container: HTMLElement) {
  const offenders: string[] = [];
  let themed = 0;
  container.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    const bg = (el.style.background || el.style.backgroundColor || '').trim().toLowerCase();
    if (HARD_LIGHT.has(bg)) offenders.push(bg);
    if (bg.includes('var(--color-')) themed++;
  });
  expect(offenders).toEqual([]);
  expect(themed).toBeGreaterThan(0);
}

beforeEach(() => {
  vi.mocked(api.getYearSummary).mockResolvedValue({
    year: 2026,
    months: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, sick_days: 2, overtime_hours: 5, avg_staffing: 20, shifts_count: 400,
    })),
  } as never);
  vi.mocked(api.getChangelog).mockResolvedValue([
    { id: 1, timestamp: '2026-07-01T10:00:00', action: 'CREATE', entity_type: 'auth', entity_id: null, username: 'api', details: 'POST /api/auth/login' },
  ] as never);
});

afterEach(() => vi.clearAllMocks());

describe('Inline-Flächen nutzen Theme-Variablen (Dark-Mode-tauglich)', () => {
  it('Analytics & Trends', async () => {
    const { container } = render(<MemoryRouter><Analytics /></MemoryRouter>);
    await waitFor(() => expect(container.querySelectorAll('[style]').length).toBeGreaterThan(5));
    assertNoHardLightSurfaces(container);
  });

  it('Audit-Log', async () => {
    const { container } = render(<MemoryRouter><AuditLog /></MemoryRouter>);
    await waitFor(() => expect(container.querySelectorAll('[style]').length).toBeGreaterThan(3));
    assertNoHardLightSurfaces(container);
  });
});
