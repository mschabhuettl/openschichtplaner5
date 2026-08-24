/**
 * Komponententest der Berichts-Karte „Dienstplan (Zeitraum)" (Spec 7.4.1,
 * Bericht #6): Von/Bis-Validierung als Feldfehler und Raster-Erzeugung über
 * Monatsgrenzen (Monats-Calls zusammengefügt, KW-Kopf, Seitenaufbau).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }));

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getGroups: vi.fn(),
    getShifts: vi.fn(),
    getSchedule: vi.fn(),
    getHolidays: vi.fn(),
    getGroupAssignments: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

import { api } from '../api/client';
import Berichte from '../pages/Berichte';

const employees = [
  { ID: 1, NAME: 'Muster', FIRSTNAME: 'Max', NUMBER: '1' },
  { ID: 2, NAME: 'Beispiel', FIRSTNAME: 'Berta', NUMBER: '2' },
];
const shifts = [
  { ID: 10, NAME: 'Frühdienst', SHORTNAME: 'F', POSITION: 1 },
  { ID: 11, NAME: 'Spätdienst', SHORTNAME: 'S', POSITION: 2 },
];

function makePopup() {
  return {
    document: { write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
    print: vi.fn(),
  };
}

describe('Berichte — Dienstplan (Zeitraum)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEmployees).mockResolvedValue(employees as never);
    vi.mocked(api.getGroups).mockResolvedValue([] as never);
    vi.mocked(api.getShifts).mockResolvedValue(shifts as never);
    vi.mocked(api.getHolidays).mockResolvedValue([
      { ID: 1, DATE: '2026-08-15', NAME: 'Mariä Himmelfahrt', INTERVAL: 0 },
    ] as never);
    vi.mocked(api.getSchedule).mockResolvedValue([] as never);
    vi.mocked(api.getGroupAssignments).mockResolvedValue([] as never);
  });

  async function setup() {
    render(<Berichte />);
    await waitFor(() => expect(screen.getByLabelText('Zeitraum von')).toBeInTheDocument());
  }

  function setRange(from: string, to: string) {
    fireEvent.change(screen.getByLabelText('Zeitraum von'), { target: { value: from } });
    fireEvent.change(screen.getByLabelText('Zeitraum bis'), { target: { value: to } });
  }

  it('zeigt bei ungültiger Reihenfolge einen Feldfehler und startet keinen Druck', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await setup();
    setRange('2026-08-10', '2026-08-01');

    expect(screen.getByRole('alert')).toHaveTextContent('Von-Datum muss vor dem Bis-Datum liegen');

    fireEvent.click(screen.getByRole('button', { name: /Dienstplan \(Zeitraum\)/ }));
    expect(showToastMock).toHaveBeenCalledWith(
      expect.stringContaining('Von-Datum'), 'error',
    );
    expect(api.getSchedule).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('meldet zu lange Zeiträume (über 185 Tage) als Feldfehler', async () => {
    await setup();
    setRange('2026-01-01', '2026-07-05');
    expect(screen.getByRole('alert')).toHaveTextContent('maximal 185 Tage');
  });

  it('lädt monatsübergreifend beide Monate und druckt das Raster mit KW-Kopf', async () => {
    vi.mocked(api.getSchedule).mockImplementation(async (_y: number, m: number) =>
      (m === 7
        ? [{ employee_id: 1, date: '2026-07-28', kind: 'shift', shift_id: 10, display_name: 'F', color_bk: '#ff0000', color_text: '#ffffff' }]
        : [{ employee_id: 2, date: '2026-08-03', kind: 'shift', shift_id: 11, display_name: 'S', color_bk: '#00ff00', color_text: '#000000' }]) as never);
    const popup = makePopup();
    const open = vi.fn(() => popup);
    vi.stubGlobal('open', open);

    await setup();
    setRange('2026-07-27', '2026-08-09');
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Dienstplan \(Zeitraum\)/ }));

    await waitFor(() => expect(popup.document.write).toHaveBeenCalled());
    // Monats-Calls zusammengefügt: Juli und August 2026
    expect(api.getSchedule).toHaveBeenCalledWith(2026, 7, undefined);
    expect(api.getSchedule).toHaveBeenCalledWith(2026, 8, undefined);

    const html = vi.mocked(popup.document.write).mock.calls[0][0] as string;
    // Raster: Tagesspalten beider Monate, KW-Kopf, beide Mitarbeiter, Einträge
    expect(html).toContain('27.07.');
    expect(html).toContain('09.08.');
    expect(html).toContain('KW 31');
    expect(html).toContain('KW 32');
    expect(html).toContain('Muster');
    expect(html).toContain('Beispiel');
    expect(html).toContain('>F</span>');
    expect(html).toContain('>S</span>');
    // Legende in POSITION-Reihenfolge: F vor S
    const legendPart = html.slice(html.indexOf('Legende'));
    expect(legendPart.indexOf('>F</span>')).toBeGreaterThan(-1);
    expect(legendPart.indexOf('>F</span>')).toBeLessThan(legendPart.indexOf('>S</span>'));
    vi.unstubAllGlobals();
  });
});
