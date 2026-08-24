/**
 * WorkTimeRules.test.tsx — Frontend tests for Q081: Arbeitszeit-Regelwerk UI
 *
 * 18 tests covering:
 *  - Rules config section (Admin only)
 *  - Employee violation check
 *  - Group violation check
 *  - Violation rendering (color coding, labels)
 *  - Role-based visibility
 *  - Prüfoptionen: Grenzen pro Prüfung + Wochenmodell-Umschalter
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import WorkTimeRules from '../pages/WorkTimeRules';
import { api } from '../api/client';

// ── Mock API ──────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  api: {
    getWorkTimeRules:      vi.fn(),
    updateWorkTimeRules:   vi.fn(),
    checkWorkTimeRules:    vi.fn(),
    checkAllWorkTimeRules: vi.fn(),
    getEmployees:          vi.fn(),
    getGroups:             vi.fn(),
  },
}));

const defaultConfig = {
  max_hours_per_day: 10,
  max_hours_per_week: 48,
  min_rest_hours_between_shifts: 11,
  max_consecutive_days: 6,
  enabled: true,
  updated_at: '2025-01-01T12:00:00',
};

const mockEmployees = [
  { ID: 1, NAME: 'Muster', FIRSTNAME: 'Max', SHORTNAME: 'MM' },
  { ID: 2, NAME: 'Test',   FIRSTNAME: 'Eva', SHORTNAME: 'TE' },
];

const mockGroups = [
  { ID: 10, NAME: 'Gruppe A' },
  { ID: 11, NAME: 'Gruppe B' },
];

const mockCheckResult = {
  violations: [
    {
      type: 'max_hours_per_day',
      date: '2025-01-05',
      employee_id: 1,
      description: 'Worked 12.0h on 2025-01-05 (max 10h)',
      severity: 'error' as const,
      value: 12,
      limit: 10,
    },
    {
      type: 'min_rest_hours_between_shifts',
      date: '2025-01-07',
      employee_id: 1,
      description: 'Only 9.0h rest before shift on 2025-01-07 (min 11h required)',
      severity: 'warning' as const,
      value: 9,
      limit: 11,
    },
  ],
  summary: { total: 2, warnings: 1, errors: 1 },
};

const mockCheckAllResult = mockCheckResult;

function setup(role: 'Admin' | 'Planer' | 'Leser' = 'Admin') {
  vi.mocked(api.getWorkTimeRules).mockResolvedValue(defaultConfig);
  vi.mocked(api.getEmployees).mockResolvedValue(mockEmployees as never);
  vi.mocked(api.getGroups).mockResolvedValue(mockGroups as never);
  return render(
    <MemoryRouter>
      <WorkTimeRules role={role} />
    </MemoryRouter>
  );
}

// Robust against CI timing: wait for the employee <select> to actually be
// populated before selecting. Selecting before the async employee load
// finished left the check with no valid employee, so the result never
// rendered and the test flaked under load.
async function selectEmployeeAndCheck() {
  const select = (await screen.findByLabelText('Mitarbeiter auswählen')) as HTMLSelectElement;
  await waitFor(() => expect(select.options.length).toBeGreaterThan(1));
  fireEvent.change(select, { target: { value: '1' } });
  fireEvent.click(screen.getByLabelText('Mitarbeiter prüfen'));
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('WorkTimeRules page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1 ── renders page title
  it('renders page title', async () => {
    setup();
    await waitFor(() => screen.getByText(/Arbeitszeit-Regelwerk/));
    expect(screen.getByText(/Arbeitszeit-Regelwerk/)).toBeTruthy();
  });

  // 2 ── Admin sees config section
  it('Admin sees Regelkonfiguration section', async () => {
    setup('Admin');
    await waitFor(() => screen.getByText('🔧 Regelkonfiguration'));
    expect(screen.getByText('🔧 Regelkonfiguration')).toBeTruthy();
  });

  // 3 ── Planer does NOT see config section
  it('Planer does not see Regelkonfiguration section', async () => {
    setup('Planer');
    await waitFor(() => screen.getByText(/Mitarbeiter prüfen/));
    expect(screen.queryByText('🔧 Regelkonfiguration')).toBeNull();
  });

  // 4 ── config form fields are pre-filled from API
  it('config form fields loaded from API', async () => {
    setup('Admin');
    await waitFor(() => screen.getByLabelText('Max. Stunden pro Tag'));
    const input = screen.getByLabelText('Max. Stunden pro Tag') as HTMLInputElement;
    expect(input.value).toBe('10');
    const weekInput = screen.getByLabelText('Max. Stunden pro Woche') as HTMLInputElement;
    expect(weekInput.value).toBe('48');
  });

  // 5 ── save button calls updateWorkTimeRules
  it('Save button calls updateWorkTimeRules', async () => {
    vi.mocked(api.updateWorkTimeRules).mockResolvedValue({ ...defaultConfig, max_hours_per_day: 9 });
    setup('Admin');
    await waitFor(() => screen.getByLabelText('Speichern'));
    fireEvent.click(screen.getByLabelText('Speichern'));
    await waitFor(() => expect(api.updateWorkTimeRules).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.updateWorkTimeRules).mock.calls[0][0];
    expect(call.max_hours_per_day).toBe(10);
    expect(call.enabled).toBe(true);
  });

  // 6 ── employee selector lists employees
  it('employee selector shows loaded employees', async () => {
    setup();
    await waitFor(() => screen.getByLabelText('Mitarbeiter auswählen'));
    const select = screen.getByLabelText('Mitarbeiter auswählen') as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(1); // placeholder + employees
  });

  // 7 ── Prüfen button is disabled without employee selection
  it('Prüfen button disabled without employee', async () => {
    setup();
    await waitFor(() => screen.getByLabelText('Mitarbeiter prüfen'));
    const btn = screen.getByLabelText('Mitarbeiter prüfen') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  // 8 ── Prüfen calls API and shows violations
  it('Prüfen button calls checkWorkTimeRules and renders violations', async () => {
    vi.mocked(api.checkWorkTimeRules).mockResolvedValue(mockCheckResult);
    setup();
    await selectEmployeeAndCheck();

    await waitFor(() => expect(api.checkWorkTimeRules).toHaveBeenCalledTimes(1));
    await waitFor(() => screen.getByText(/2 Verstoß/));
    expect(screen.getByText(/2 Verstoß/)).toBeTruthy();
  });

  // 9 ── violation list shows error badge
  it('renders error severity badge for error violations', async () => {
    vi.mocked(api.checkWorkTimeRules).mockResolvedValue(mockCheckResult);
    setup();
    await selectEmployeeAndCheck();

    await waitFor(() => screen.getByText('⛔ Fehler'));
    expect(screen.getByText('⛔ Fehler')).toBeTruthy();
  });

  // 10 ── violation list shows warning badge
  it('renders warning severity badge', async () => {
    vi.mocked(api.checkWorkTimeRules).mockResolvedValue(mockCheckResult);
    setup();
    await selectEmployeeAndCheck();

    await waitFor(() => screen.getByText('⚠️ Warnung'));
    expect(screen.getByText('⚠️ Warnung')).toBeTruthy();
  });

  // 11 ── violation type label shown in German
  it('shows violation type in German', async () => {
    vi.mocked(api.checkWorkTimeRules).mockResolvedValue(mockCheckResult);
    setup();
    await selectEmployeeAndCheck();

    await waitFor(() => screen.getByText('Tägliche Höchstarbeitszeit überschritten'));
    expect(screen.getByText('Tägliche Höchstarbeitszeit überschritten')).toBeTruthy();
  });

  // 12 ── Alle prüfen calls checkAllWorkTimeRules
  it('"Alle prüfen" calls checkAllWorkTimeRules and renders summary table', async () => {
    vi.mocked(api.checkAllWorkTimeRules).mockResolvedValue(mockCheckAllResult);
    setup();
    await waitFor(() => screen.getByLabelText('Alle prüfen'));

    fireEvent.click(screen.getByLabelText('Alle prüfen'));

    await waitFor(() => expect(api.checkAllWorkTimeRules).toHaveBeenCalledTimes(1));
    await waitFor(() => screen.getByText(/Verstöße gesamt/));
    // Verstöße gruppiert je Mitarbeiter: Name des MA 1 erscheint in der Tabelle
    await waitFor(() => screen.getByText('Muster Max'));
    expect(screen.getByText('Muster Max')).toBeTruthy();
  });

  // 13 ── group selector shows groups
  it('group selector shows loaded groups', async () => {
    setup();
    // Auf die befüllten Optionen warten, nicht nur auf das <select> — die
    // Gruppen werden asynchron nachgeladen (sonst Race unter CI-Parallellast).
    await waitFor(() => {
      const select = screen.getByLabelText('Gruppe auswählen') as HTMLSelectElement;
      expect(select.options.length).toBeGreaterThan(1);
    });
  });

  // 14 ── no violations shows green OK message
  it('shows green OK message when no violations', async () => {
    vi.mocked(api.checkWorkTimeRules).mockResolvedValue({
      violations: [],
      summary: { total: 0, warnings: 0, errors: 0 },
    });
    setup();
    await selectEmployeeAndCheck();

    await waitFor(() => screen.getByText(/Keine Verstöße gefunden/));
    expect(screen.getByText(/Keine Verstöße gefunden/)).toBeTruthy();
  });

  // ── Prüfoptionen: Grenzen + Wochenmodell-Umschalter ─────────────────────

  // 15 ── Default: keine Zusatzparameter (Verhalten wie bisher)
  it('sends no limit overrides by default (regression)', async () => {
    vi.mocked(api.checkWorkTimeRules).mockResolvedValue(mockCheckResult);
    setup();
    await selectEmployeeAndCheck();

    await waitFor(() => expect(api.checkWorkTimeRules).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.checkWorkTimeRules).mock.calls[0][0];
    expect(call.employee_id).toBe(1);
    expect(call.max_hours_per_day).toBeUndefined();
    expect(call.max_hours_per_week).toBeUndefined();
    expect(call.min_rest_hours_between_shifts).toBeUndefined();
    expect(call.max_consecutive_days).toBeUndefined();
    expect(call.week_limit_mode).toBeUndefined();
    expect(call.week_limit_factor).toBeUndefined();
  });

  // 16 ── Umschalter „relativ zum Wochenmodell" sendet Modus + Faktor
  it('model mode sends week_limit_mode and week_limit_factor', async () => {
    vi.mocked(api.checkWorkTimeRules).mockResolvedValue(mockCheckResult);
    setup();
    await waitFor(() => screen.getByLabelText('Wochengrenzen-Modus'));

    fireEvent.change(screen.getByLabelText('Wochengrenzen-Modus'), { target: { value: 'model' } });
    await waitFor(() => screen.getByLabelText('Faktor Wochenstundenmodell'));
    fireEvent.change(screen.getByLabelText('Faktor Wochenstundenmodell'), { target: { value: '1.5' } });
    await selectEmployeeAndCheck();

    await waitFor(() => expect(api.checkWorkTimeRules).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.checkWorkTimeRules).mock.calls[0][0];
    expect(call.week_limit_mode).toBe('model');
    expect(call.week_limit_factor).toBe(1.5);
  });

  // 17 ── Überschriebene Grenzen werden als Parameter gesendet
  it('override checkbox sends the limit fields as parameters', async () => {
    vi.mocked(api.checkWorkTimeRules).mockResolvedValue(mockCheckResult);
    setup();
    // Erst warten, bis die Konfiguration geladen ist (sie belegt die Felder vor)
    await waitFor(() => screen.getByLabelText('Max. Stunden pro Tag'));

    fireEvent.click(screen.getByLabelText('Grenzen für diese Prüfung überschreiben'));
    await waitFor(() => screen.getByLabelText('Max. Stunden pro Tag (Prüfung)'));
    fireEvent.change(screen.getByLabelText('Max. Stunden pro Tag (Prüfung)'), { target: { value: '8' } });
    await selectEmployeeAndCheck();

    await waitFor(() => expect(api.checkWorkTimeRules).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.checkWorkTimeRules).mock.calls[0][0];
    expect(call.max_hours_per_day).toBe(8);
    // Die übrigen Felder gehen mit der geladenen Konfiguration mit
    expect(call.max_hours_per_week).toBe(48);
    expect(call.min_rest_hours_between_shifts).toBe(11);
    expect(call.max_consecutive_days).toBe(6);
    expect(call.week_limit_mode).toBeUndefined();
  });

  // 18 ── Gruppenprüfung nutzt dieselben Prüfoptionen
  it('"Alle prüfen" forwards the same limit parameters', async () => {
    vi.mocked(api.checkAllWorkTimeRules).mockResolvedValue(mockCheckAllResult);
    setup();
    await waitFor(() => screen.getByLabelText('Wochengrenzen-Modus'));

    fireEvent.change(screen.getByLabelText('Wochengrenzen-Modus'), { target: { value: 'model' } });
    fireEvent.click(screen.getByLabelText('Alle prüfen'));

    await waitFor(() => expect(api.checkAllWorkTimeRules).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.checkAllWorkTimeRules).mock.calls[0][0];
    expect(call.week_limit_mode).toBe('model');
    expect(call.week_limit_factor).toBe(1);
  });
});
