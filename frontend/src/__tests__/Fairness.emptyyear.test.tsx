/**
 * Regression (im Browser-Smoke gefunden): für ein Jahr ohne Schichtdaten liefert
 * die API `fairness: {}` — ein truthy leeres Objekt. Der Guard `{metrics && …}` ließ
 * die Summary-Cards rendern, und `metrics.total_score.toFixed(0)` warf
 * „Cannot read properties of undefined (reading 'toFixed')" → die ganze Seite crashte.
 * Fix: erst rendern, wenn die Kennzahlen wirklich da sind (`hasMetrics`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n';

vi.mock('../api/client', () => ({
  api: { getGroups: vi.fn(async () => []) },
}));

import Fairness from '../pages/Fairness';

describe('Fairness — Jahr ohne Schichtdaten (fairness:{}) crasht nicht', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ year: 2099, employees: [], fairness: {} }) })),
    );
  });

  it('zeigt die Leer-Ansicht statt an .toFixed() zu crashen', async () => {
    render(<LanguageProvider><MemoryRouter><Fairness /></MemoryRouter></LanguageProvider>);
    expect(await screen.findByText(/Keine Schichtdaten/i)).toBeTruthy();
  });
});
