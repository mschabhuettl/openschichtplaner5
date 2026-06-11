/**
 * Einstellungen — Reset-Schalter für die gemerkte Konflikt-Strategie des
 * Dienstplan-Konfliktdialogs (localStorage-Key 'sp5-schedule-conflict-strategy').
 *
 * Ohne diesen Schalter gab es keine Möglichkeit, eine per „merken"-Häkchen
 * gespeicherte Strategie (add/replace) wieder auf „immer fragen" zu stellen.
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Einstellungen from '../pages/Einstellungen';
import { LanguageProvider } from '../i18n/context';
import { ThemeProvider } from '../contexts/ThemeContext';
import { getConflictStrategy, setConflictStrategy } from '../components/scheduleGridUtils';

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../api/client', () => ({
  api: {
    getSettings: vi.fn().mockResolvedValue({
      ANOANAME: 'Abwesend',
      ANOASHORT: 'X',
      ANOACRTXT: 0,
      ANOACRBAR: 16711680,
      ANOACRBK: 16777215,
      ANOABOLD: 0,
      BACKUPFR: 0,
    }),
    updateSettings: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <LanguageProvider>
      <ThemeProvider>
        <Einstellungen />
      </ThemeProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  // jsdom hat kein matchMedia; ThemeProvider braucht es für die System-Präferenz
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
});

describe('Einstellungen — Konflikt-Strategie zurücksetzen', () => {
  it('zeigt den Standard "Immer fragen" und deaktiviert den Reset-Schalter', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Immer fragen (Standard)'));
    const btn = screen.getByRole('button', { name: /Zurücksetzen \(wieder fragen\)/ });
    expect(btn).toBeDisabled();
  });

  it('zeigt eine gemerkte Strategie an und setzt sie per Klick zurück', async () => {
    setConflictStrategy('replace');
    renderPage();
    await waitFor(() => screen.getByText('Immer ersetzen'));

    const btn = screen.getByRole('button', { name: /Zurücksetzen \(wieder fragen\)/ });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    // UI und localStorage sind zurückgesetzt
    expect(screen.getByText('Immer fragen (Standard)')).toBeInTheDocument();
    expect(getConflictStrategy()).toBe('ask');
    expect(localStorage.getItem('sp5-schedule-conflict-strategy')).toBeNull();
  });

  it('zeigt "Immer hinzufügen" bei gemerkter add-Strategie', async () => {
    setConflictStrategy('add');
    renderPage();
    await waitFor(() => screen.getByText('Immer hinzufügen'));
  });
});
