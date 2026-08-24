/**
 * Jahresraster-Anzeigeoptionen (Spec 4.11.11):
 * - 1b Spaltenausrichtung „Wochentage": 37 Spalten (Mo…So ×5 + Mo Di),
 *   jede Monatszeile beginnt in der Spalte ihres ersten Wochentags,
 *   Zellen vor Monatsbeginn sind tote Zellen (ungültig-Stil);
 *   Default bleibt „Kalendertage" (31 Spalten, 1…31).
 * - 2 Sichtbare Einträge je Feld: 1 oder 2 (Taktwerk §11: Zellmaß fix
 *   21×20px), überzählige Einträge signalisiert ▾ (Spec 4.13-3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { JahresRaster } from '../components/JahresRaster';
import { monthStartOffset, WEEKDAY_ABBR } from '../components/jahresRasterUtils';
import type { ScheduleEntry } from '../types';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getGroups: vi.fn(),
    getGroupMembers: vi.fn(),
    getShifts: vi.fn(),
    getLeaveTypes: vi.fn(),
    getSchedule: vi.fn(),
    getScheduleYear: vi.fn(),
    getHolidays: vi.fn(),
  },
}));

import { api } from '../api/client';
import Jahresuebersicht from '../pages/Jahresuebersicht';

const entry = (p: Partial<ScheduleEntry>): ScheduleEntry => ({
  id: 1, employee_id: 1, date: '2026-07-10',
  shift_id: 1, shift_name: '', shift_short: '',
  color_bk: '#ff0000', color_text: '#fff',
  workplace_id: null, workplace_name: '',
  kind: 'shift', leave_name: '', display_name: 'F',
  ...p,
} as ScheduleEntry);

/** Spaltenindex einer Zelle innerhalb ihrer Zeile (0 = Monats-Kopfzelle). */
function colIndex(cell: HTMLElement): number {
  const tr = cell.closest('tr')!;
  return Array.from(tr.children).indexOf(cell);
}

describe('monthStartOffset (Spec 4.11.11-1b)', () => {
  it('liefert den Wochentag des Monatsersten, Mo=0…So=6', () => {
    expect(monthStartOffset(2026, 1)).toBe(3);  // 1.1.2026 = Donnerstag
    expect(monthStartOffset(2026, 2)).toBe(6);  // 1.2.2026 = Sonntag
    expect(monthStartOffset(2026, 3)).toBe(6);  // 1.3.2026 = Sonntag
    expect(monthStartOffset(2026, 7)).toBe(2);  // 1.7.2026 = Mittwoch
  });
});

describe('JahresRaster — Spaltenausrichtung Wochentage (Spec 4.11.11-1b)', () => {
  it('rendert 37 Wochentagsspalten (Mo…So ×5 + Mo Di)', () => {
    const { getByTestId } = render(
      <JahresRaster year={2026} dayMap={new Map()} holidays={new Set()} onMonthClick={vi.fn()} ausrichtung="wochentage" />
    );
    const headers = within(getByTestId('jahresraster')).getAllByRole('columnheader');
    expect(headers).toHaveLength(38); // „Monat" + 37
    expect(headers[1].textContent).toBe('Mo');
    expect(headers[7].textContent).toBe('So');
    expect(headers[36].textContent).toBe('Mo'); // ×5 komplett …
    expect(headers[37].textContent).toBe('Di'); // … + Mo Di
    expect(WEEKDAY_ABBR).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  });

  it('Monatszeile beginnt in der Spalte ihres ersten Wochentags, davor tote Zellen', () => {
    const { getByTestId } = render(
      <JahresRaster year={2026} dayMap={new Map()} holidays={new Set()} onMonthClick={vi.fn()} ausrichtung="wochentage" />
    );
    // Januar 2026 beginnt Donnerstag → Offset 3: Spalten Mo/Di/Mi tot
    const jan1 = getByTestId('jr-cell-1-1');
    expect(colIndex(jan1)).toBe(4); // 1 (Monatszelle) + Offset 3
    const janRow = jan1.closest('tr')!;
    expect(janRow.children).toHaveLength(38);
    for (const i of [1, 2, 3]) {
      expect(janRow.children[i].getAttribute('aria-hidden')).toBe('true');
      expect(janRow.children[i].textContent).toBe('');
    }
    // nach Monatsende (31.1. in Spalte 34) wieder tote Zellen
    expect(colIndex(getByTestId('jr-cell-1-31'))).toBe(34);
    for (const i of [35, 36, 37]) {
      expect(janRow.children[i].getAttribute('aria-hidden')).toBe('true');
    }
    // Februar 2026 beginnt Sonntag → Offset 6
    expect(colIndex(getByTestId('jr-cell-2-1'))).toBe(7);
    // gleiche Wochentage stehen untereinander: 5.1. (Mo) über 2.2. (Mo)
    expect(colIndex(getByTestId('jr-cell-1-5'))).toBe(colIndex(getByTestId('jr-cell-2-2')));
  });

  it('Default bleibt Kalendertage: 31 Spalten 1…31 ohne Offset', () => {
    const { getByTestId } = render(
      <JahresRaster year={2026} dayMap={new Map()} holidays={new Set()} onMonthClick={vi.fn()} />
    );
    const headers = within(getByTestId('jahresraster')).getAllByRole('columnheader');
    expect(headers).toHaveLength(32);
    expect(headers[1].textContent).toBe('01');
    expect(colIndex(getByTestId('jr-cell-1-1'))).toBe(1);
  });
});

describe('JahresRaster — sichtbare Einträge je Feld (Spec 4.11.11-2)', () => {
  const three = [
    entry({}),
    entry({ id: 2, display_name: 'N', color_bk: '#0000ff' }),
    entry({ id: 3, display_name: 'U', kind: 'absence', shift_id: null, color_bk: '#ffaa00' }),
  ];
  const dayMap = new Map<string, ScheduleEntry[]>([['2026-07-10', three]]);

  it('Default 2: zeigt zwei Einträge, Überzählige signalisiert ▾ (Spec 4.13-3)', () => {
    const { getByTestId } = render(
      <JahresRaster year={2026} dayMap={dayMap} holidays={new Set()} onMonthClick={vi.fn()} />
    );
    const cell = getByTestId('jr-cell-7-10');
    const stack = within(cell).getByTestId('cell-stack');
    expect(stack.textContent).toContain('F');
    expect(stack.textContent).toContain('N');
    expect(stack.textContent).not.toContain('U');
    expect(getByTestId('jr-mehr-7-10').textContent).toBe('▾');
    expect(cell.title).toContain('1 weiterer Eintrag');
  });

  it('1: zeigt nur den ersten Eintrag als Chip + ▾', () => {
    const { getByTestId, queryByTestId } = render(
      <JahresRaster year={2026} dayMap={dayMap} holidays={new Set()} onMonthClick={vi.fn()} maxEintraege={1} />
    );
    const cell = getByTestId('jr-cell-7-10');
    expect(queryByTestId('cell-stack')).toBeNull(); // Einzel-Chip, kein Stapel
    expect(cell.textContent).toContain('F');
    expect(cell.textContent).not.toContain('N');
    expect(getByTestId('jr-mehr-7-10').textContent).toBe('▾');
    expect(cell.title).toContain('2 weitere Einträge');
  });

  it('kein ▾, wenn alle Einträge sichtbar sind', () => {
    const two = new Map<string, ScheduleEntry[]>([['2026-07-10', three.slice(0, 2)]]);
    const { getByTestId, queryByTestId } = render(
      <JahresRaster year={2026} dayMap={two} holidays={new Set()} onMonthClick={vi.fn()} />
    );
    expect(within(getByTestId('jr-cell-7-10')).getByTestId('cell-stack')).toBeTruthy();
    expect(queryByTestId('jr-mehr-7-10')).toBeNull();
    // Einzeleintrag ebenfalls ohne ▾
    const one = new Map<string, ScheduleEntry[]>([['2026-07-11', [entry({ date: '2026-07-11' })]]]);
    const r2 = render(
      <JahresRaster year={2026} dayMap={one} holidays={new Set()} onMonthClick={vi.fn()} maxEintraege={1} />
    );
    expect(r2.queryByTestId('jr-mehr-7-11')).toBeNull();
  });
});

// ── Seitenebene: Umschalter + Auswahl in der Toolbar ───────────
const Y = new Date().getFullYear();

const mockEmployees = [{ ID: 1, NAME: 'Muster', FIRSTNAME: 'Max', SHORTNAME: 'MMU' }];

// März: zwei Einträge am selben Tag für MA 1 (Dienst + Abwesenheit)
const marchEntries: ScheduleEntry[] = [
  entry({ date: `${Y}-03-15` }),
  entry({ id: 2, date: `${Y}-03-15`, display_name: 'U', kind: 'absence', shift_id: null, color_bk: '#ffaa00' }),
];

async function renderPage() {
  render(<Jahresuebersicht />);
  await waitFor(() => expect(screen.getByTestId('jahresraster')).toBeTruthy());
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(api.getEmployees).mockResolvedValue(mockEmployees);
  vi.mocked(api.getGroups).mockResolvedValue([]);
  vi.mocked(api.getGroupMembers).mockResolvedValue([]);
  vi.mocked(api.getShifts).mockResolvedValue([]);
  vi.mocked(api.getLeaveTypes).mockResolvedValue([]);
  vi.mocked(api.getSchedule).mockImplementation((_y: number, m: number) =>
    Promise.resolve(m === 3 ? marchEntries : []));
  vi.mocked(api.getScheduleYear).mockResolvedValue([]);
  vi.mocked(api.getHolidays).mockResolvedValue([]);
});

describe('Jahresübersicht — Anzeigeoptionen-Toolbar (Spec 4.11.11)', () => {
  it('Umschalter: Default Kalendertage, Radio-Wechsel auf Wochentage und zurück', async () => {
    await renderPage();

    const kal = screen.getByRole('button', { name: 'Kalendertage' });
    const wt = screen.getByRole('button', { name: 'Wochentage' });
    expect(kal.getAttribute('aria-pressed')).toBe('true');   // Default (1a)
    expect(wt.getAttribute('aria-pressed')).toBe('false');
    const headerCount = () =>
      within(screen.getByTestId('jahresraster')).getAllByRole('columnheader').length;
    expect(headerCount()).toBe(32);

    fireEvent.click(wt);
    await waitFor(() => expect(headerCount()).toBe(38));
    expect(wt.getAttribute('aria-pressed')).toBe('true');
    expect(kal.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(kal);                                    // Revert
    await waitFor(() => expect(headerCount()).toBe(32));
    expect(kal.getAttribute('aria-pressed')).toBe('true');
  });

  it('Einträge je Feld: Default 2, Auswahl 1 blendet Überzählige aus (▾)', async () => {
    await renderPage();

    const select = screen.getByLabelText(/Einträge je Feld/) as HTMLSelectElement;
    expect(select.value).toBe('2');
    const cell = screen.getByTestId('jr-cell-3-15');
    expect(cell.textContent).toContain('F');
    expect(cell.textContent).toContain('U');
    expect(screen.queryByTestId('jr-mehr-3-15')).toBeNull();

    fireEvent.change(select, { target: { value: '1' } });
    await waitFor(() => expect(screen.getByTestId('jr-mehr-3-15')).toBeTruthy());
    const cell1 = screen.getByTestId('jr-cell-3-15');
    expect(cell1.textContent).toContain('F');
    expect(cell1.textContent?.replace('▾', '')).not.toContain('U');
  });
});
