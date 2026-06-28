/**
 * WorkTimeRules.test.tsx — Frontend tests for Q081: Arbeitszeit-Regelwerk UI
 *
 * 14 tests covering:
 *  - Rules config section (Admin only)
 *  - Employee violation check
 *  - Group violation check
 *  - Violation rendering (color coding, labels)
 *  - Role-based visibility
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
  employee_id: 1,
  employee_name: 'Muster Max',
  date_from: '2025-01-01',
  date_to: '2025-01-31',
  violation_count: 2,
  violations: [
    {
      rule_type: 'max_hours_per_day',
      severity: 'error' as const,
      date: '2025-01-05',
      message: 'Maximale Tagesarbeitszeit überschritten.',
      value: 12,
      limit: 10,
    },
    {
      rule_type: 'min_rest_hours_between_shifts',
      severity: 'warning' as const,
      date: '2025-01-07',
      message: 'Mindestruhezeit unterschritten.',
      value: 9,
      limit: 11,
    },
  ],
};

const mockCheckAllResult = {
  date_from: '2025-01-01',
  date_to: '2025-01-31',
  employee_count: 2,
  total_violations: 2,
  results: [
    { ...mockCheckResult },
    {
      employee_id: 2,
      employee_name: 'Test Eva',
      date_from: '2025-01-01',
      date_to: '2025-01-31',
      violation_count: 0,
      violations: [],
    },
  ],
};

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
    await waitFor(() => screen.getByText(/Geprüfte Mitarbeiter/));
    // Total violations is rendered as a number in a span
    const allCells = screen.getAllByText('2');
    expect(allCells.length).toBeGreaterThan(0);
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
      ...mockCheckResult,
      violation_count: 0,
      violations: [],
    });
    setup();
    await selectEmployeeAndCheck();

    await waitFor(() => screen.getByText(/Keine Verstöße gefunden/));
    expect(screen.getByText(/Keine Verstöße gefunden/)).toBeTruthy();
  });
});
