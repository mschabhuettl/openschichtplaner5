/**
 * Tests für Statistiken — Zeitraum-Modus Monat ⟷ freier Von/Bis-Zeitraum
 * (Gap-IDs APP-INT-5, R-2; Spec 3.9.1)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n';
import { ToastProvider } from '../contexts/ToastContext';

// ── API mock ──────────────────────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  api: {
    getGroups: vi.fn(),
    getEmployees: vi.fn(),
    getStatistics: vi.fn(),
    getExtraChargesSummary: vi.fn(),
  },
}));

import { api } from '../api/client';
import Statistiken from '../pages/Statistiken';

const mockedApi = api as unknown as {
  getGroups: ReturnType<typeof vi.fn>;
  getEmployees: ReturnType<typeof vi.fn>;
  getStatistics: ReturnType<typeof vi.fn>;
  getExtraChargesSummary: ReturnType<typeof vi.fn>;
};

const renderComp = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <LanguageProvider>
          <Statistiken />
        </LanguageProvider>
      </ToastProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.setItem('sp5_language', 'de');
  mockedApi.getGroups.mockResolvedValue([]);
  mockedApi.getEmployees.mockResolvedValue([]);
  mockedApi.getStatistics.mockResolvedValue([]);
  mockedApi.getExtraChargesSummary.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Statistiken — Zeitraum-Modus', () => {
  it('lädt im Monatsmodus (Default) mit year/month', async () => {
    renderComp();
    const now = new Date();
    await waitFor(() =>
      expect(mockedApi.getStatistics).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1, undefined)
    );
    expect(mockedApi.getExtraChargesSummary).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1);
  });

  it('wechselt in den freien Zeitraum und lädt Statistik + Zuschläge mit from/to', async () => {
    renderComp();
    await waitFor(() => expect(mockedApi.getStatistics).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum' }));
    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '2025-03-01' } });
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2025-04-15' } });

    await waitFor(() => {
      expect(mockedApi.getStatistics).toHaveBeenCalledWith({
        from: '2025-03-01',
        to: '2025-04-15',
        group_id: undefined,
      });
      expect(mockedApi.getExtraChargesSummary).toHaveBeenCalledWith({
        from: '2025-03-01',
        to: '2025-04-15',
      });
    });
  });

  it('zeigt im Zeitraum-Modus keine Monatsnavigation, im Monatsmodus wieder', async () => {
    renderComp();
    await waitFor(() => expect(mockedApi.getStatistics).toHaveBeenCalled());

    expect(screen.getByLabelText('Vorheriger Monat')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum' }));
    expect(screen.queryByLabelText('Vorheriger Monat')).toBeNull();
    expect(screen.getByLabelText('Von')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Monat' }));
    expect(screen.getByLabelText('Vorheriger Monat')).toBeTruthy();
    expect(screen.queryByLabelText('Von')).toBeNull();
  });

  it('lädt bei ungültigem Zeitraum (Von > Bis) nicht und zeigt einen Hinweis', async () => {
    renderComp();
    await waitFor(() => expect(mockedApi.getStatistics).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum' }));
    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '2025-12-31' } });
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2025-01-01' } });

    await screen.findByText(/Ungültiger Zeitraum/);
    expect(mockedApi.getStatistics).not.toHaveBeenCalledWith({
      from: '2025-12-31',
      to: '2025-01-01',
      group_id: undefined,
    });
  });
});
