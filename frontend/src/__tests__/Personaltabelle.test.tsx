/**
 * Tests für Personaltabelle (Gap-IDs APP-INT-2, V-9, R-3)
 * — GET /api/personnel-table: dynamische Spalten, Urlaubs-Doppelwert,
 *   Zeitraum-Modus Monat ⟷ freier Von/Bis-Zeitraum (Spec 3.9.1–3.9.3)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { LanguageProvider } from '../i18n';

// ── API mock ──────────────────────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  api: {
    getPersonnelTable: vi.fn(),
    getGroups: vi.fn(),
  },
}));

import { api } from '../api/client';
import Personaltabelle from '../pages/Personaltabelle';

const mockedApi = api as unknown as {
  getPersonnelTable: ReturnType<typeof vi.fn>;
  getGroups: ReturnType<typeof vi.fn>;
};

const renderComp = () =>
  render(<LanguageProvider><Personaltabelle /></LanguageProvider>);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const columns = {
  shifts: [
    { id: 1, name: 'Frühdienst', short: 'F' },
    { id: 2, name: 'Nachtdienst', short: 'N' },
  ],
  leave_types: [
    { id: 10, name: 'Urlaub', short: 'U', entitled: true },
    { id: 11, name: 'Krank', short: 'K', entitled: false },
  ],
};

const rowMueller = {
  employee_id: 1,
  employee_name: 'Müller, Anna',
  employee_short: 'AM',
  iststunden: 160,
  sollstunden: 150,
  saldo: 10,
  arbeitszeit: 155,
  abwesenheit_bezahlt: 8,
  sonntag: 2,
  feiertag: 1,
  sonderdienste: 3,
  shift_counts: { '1': 12, '2': 4 },
  absence_days_by_type: { '10': 18, '11': 2.5 },
  leave_accounts: { '10': { taken: 18, remaining: 7 } },
};

const rowSchmidt = {
  employee_id: 2,
  employee_name: 'Schmidt, Bernd',
  employee_short: 'BS',
  iststunden: 140,
  sollstunden: 150,
  saldo: -10,
  arbeitszeit: 140,
  abwesenheit_bezahlt: 0,
  sonntag: 1,
  feiertag: 0,
  sonderdienste: 1,
  shift_counts: { '1': 5, '2': 9 },
  absence_days_by_type: { '10': 30, '11': 1.5 },
  leave_accounts: { '10': { taken: 30, remaining: -5 } },
};

/** Zeitraum = genau ein Kalenderjahr → Doppelwert „verbraucht / Rest" (Spec 3.9.3 Nr. 6) */
const oneYearResponse = {
  date_from: '2026-01-01',
  date_to: '2026-12-31',
  group_id: null,
  one_year: true,
  columns,
  rows: [rowMueller, rowSchmidt],
};

/** Zeitraum ≠ Kalenderjahr → nur Tageswerte, keine leave_accounts */
const monthResponse = {
  date_from: '2026-06-01',
  date_to: '2026-06-30',
  group_id: null,
  one_year: false,
  columns,
  rows: [
    { ...rowMueller, leave_accounts: undefined },
    { ...rowSchmidt, leave_accounts: undefined },
  ],
};

beforeEach(() => {
  localStorage.setItem('sp5_language', 'de');
  mockedApi.getPersonnelTable.mockResolvedValue(oneYearResponse);
  mockedApi.getGroups.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Personaltabelle', () => {
  it('lädt im Monatsmodus (Default) den aktuellen Monat als Zeitraum', async () => {
    renderComp();
    await waitFor(() => expect(mockedApi.getPersonnelTable).toHaveBeenCalled());
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`;
    expect(mockedApi.getPersonnelTable).toHaveBeenCalledWith(from, to, undefined);
  });

  it('rendert Standardspalten und dynamische Spalten je Schicht-/Abwesenheitsart', async () => {
    renderComp();
    await screen.findByText('Müller, Anna');
    // Standardspalten
    for (const label of ['Ist (h)', 'Soll (h)', 'Saldo (h)', 'Arbeitszeit (h)', 'Abw. bezahlt (h)', 'Sonntagsdienste', 'Feiertagsdienste', 'Sonderdienste']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // Dynamische Spalten (Kürzel als Label, voller Name als title)
    expect(screen.getByTitle('Frühdienst')).toBeTruthy();
    expect(screen.getByTitle('Nachtdienst')).toBeTruthy();
    expect(screen.getByTitle('Urlaub')).toBeTruthy();
    expect(screen.getByTitle('Krank')).toBeTruthy();
    // Schichtart-Zählerwerte
    expect(screen.getByText('12')).toBeTruthy(); // Müller F
    expect(screen.getByText('9')).toBeTruthy();  // Schmidt N
  });

  it('zeigt Abwesenheitstage in 0,5-Schritten', async () => {
    renderComp();
    await screen.findByText('Müller, Anna');
    expect(screen.getByText('2.5')).toBeTruthy(); // Müller Krank
    expect(screen.getByText('1.5')).toBeTruthy(); // Schmidt Krank
  });

  it('zeigt bei Ein-Jahres-Zeitraum den Urlaubs-Doppelwert „verbraucht / Rest"', async () => {
    renderComp();
    await screen.findByText('Müller, Anna');
    const remaining = screen.getByText('7');
    expect(remaining.parentElement?.textContent).toBe('18 / 7');
  });

  it('markiert negativen Resturlaub rot (Anspruch überschritten)', async () => {
    renderComp();
    await screen.findByText('Schmidt, Bernd');
    const negative = screen.getByText('-5');
    expect(negative.className).toContain('text-red-600');
    expect(negative.parentElement?.textContent).toBe('30 / -5');
  });

  it('zeigt ohne Ein-Jahres-Zeitraum nur Tageswerte (kein Doppelwert)', async () => {
    mockedApi.getPersonnelTable.mockResolvedValue(monthResponse);
    renderComp();
    await screen.findByText('Müller, Anna');
    const table = screen.getByRole('table');
    expect(within(table).getByText('18')).toBeTruthy(); // Urlaubstage Müller
    expect(within(table).getByText('30')).toBeTruthy(); // Urlaubstage Schmidt
    expect(within(table).queryByText('/')).toBeNull();  // kein „x / y"
  });

  it('wechselt in den freien Von/Bis-Zeitraum und lädt mit den gewählten Daten', async () => {
    renderComp();
    await waitFor(() => expect(mockedApi.getPersonnelTable).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum' }));
    const fromInput = screen.getByLabelText('Von');
    const toInput = screen.getByLabelText('Bis');
    fireEvent.change(fromInput, { target: { value: '2025-01-01' } });
    fireEvent.change(toInput, { target: { value: '2025-12-31' } });

    await waitFor(() =>
      expect(mockedApi.getPersonnelTable).toHaveBeenCalledWith('2025-01-01', '2025-12-31', undefined)
    );

    // Zurück in den Monatsmodus: Monats-/Jahresauswahl wieder sichtbar
    fireEvent.click(screen.getByRole('button', { name: 'Monat' }));
    expect(screen.queryByLabelText('Von')).toBeNull();
  });

  it('lädt bei ungültigem Zeitraum (Von > Bis) nicht und zeigt einen Hinweis', async () => {
    renderComp();
    await waitFor(() => expect(mockedApi.getPersonnelTable).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum' }));
    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '2025-12-31' } });
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2025-01-01' } });

    await screen.findByText(/Ungültiger Zeitraum/);
    expect(mockedApi.getPersonnelTable).not.toHaveBeenCalledWith('2025-12-31', '2025-01-01', undefined);
  });

  it('sortiert auch dynamische Spalten per Klick auf den Spaltenkopf', async () => {
    renderComp();
    await screen.findByText('Müller, Anna');

    const names = () =>
      screen.getAllByText(/Müller, Anna|Schmidt, Bernd/).map(el => el.textContent);
    // Default: Sortierung nach Name aufsteigend
    expect(names()).toEqual(['Müller, Anna', 'Schmidt, Bernd']);

    // Klick auf Schichtart-Spalte „F" → aufsteigend nach Einteilungen (Schmidt 5 < Müller 12)
    fireEvent.click(screen.getByTitle('Frühdienst'));
    expect(names()).toEqual(['Schmidt, Bernd', 'Müller, Anna']);

    // Zweiter Klick → absteigend
    fireEvent.click(screen.getByTitle('Frühdienst'));
    expect(names()).toEqual(['Müller, Anna', 'Schmidt, Bernd']);
  });

  it('zeigt eine Summenzeile mit Doppelwert-Summen', async () => {
    renderComp();
    await screen.findByText('Müller, Anna');
    const totalRow = screen.getByText(/Gesamt \(2 MA\)/).closest('tr')!;
    expect(within(totalRow).getByText('17')).toBeTruthy(); // Σ Frühdienst 12+5
    const totalRemaining = within(totalRow).getByText('2'); // Σ Rest 7+(-5)
    expect(totalRemaining.parentElement?.textContent).toBe('48 / 2');
  });
});
