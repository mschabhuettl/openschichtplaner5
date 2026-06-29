/**
 * Regression (P2-9 / Punkt 13): das Schicht-Briefing darf nicht ewig bei
 * „Wetter wird geladen…" hängen, wenn der externe Wetterdienst (wttr.in) langsam
 * ist oder ausfällt. Der Fetch hat jetzt einen harten Timeout (AbortSignal.timeout)
 * und einen Fallback-Status; bei Fehlschlag erscheint „Wetter nicht verfügbar".
 */

import { it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SchichtBriefing from '../pages/SchichtBriefing';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('zeigt einen Fallback statt ewigem „wird geladen", wenn der Wetterdienst fehlschlägt', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (typeof url === 'string' && url.includes('wttr.in')) {
      return Promise.reject(new Error('timeout')); // simuliert Timeout/Ausfall
    }
    // Briefing-Daten (employees/schedule/absences) leer, damit die Seite rendert.
    return Promise.resolve({ json: () => Promise.resolve([]) } as Response);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<MemoryRouter><SchichtBriefing /></MemoryRouter>);

  // Bei Fehlschlag erscheint der Fallback statt des Dauer-Ladezustands
  // (findByText wirft, falls er nicht binnen Timeout auftaucht).
  expect(await screen.findByText('Wetter nicht verfügbar', {}, { timeout: 4000 })).toBeTruthy();
  expect(screen.queryByText('Wetter wird geladen…')).toBeNull();
});
