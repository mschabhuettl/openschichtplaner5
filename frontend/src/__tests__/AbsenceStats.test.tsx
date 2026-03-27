import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AbsenceStats from '../pages/AbsenceStats';
import { api } from '../api/client';
import type { AbsenceOverview, AbsenceGroupStats, AbsenceEmployeeStats } from '../pages/AbsenceStats';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  api: {
    getGroups: vi.fn(),
    getEmployees: vi.fn(),
    getAbsenceStatsOverview: vi.fn(),
    getAbsenceStatsGroup: vi.fn(),
    getAbsenceStatsEmployee: vi.fn(),
  },
}));

const mockGroups = [
  { ID: 1, NAME: 'Gruppe A', SHORTNAME: 'GA' },
  { ID: 2, NAME: 'Gruppe B', SHORTNAME: 'GB' },
];

const mockEmployees = [
  { ID: 10, NAME: 'Müller', FIRSTNAME: 'Hans', SHORTNAME: 'HM' },
  { ID: 11, NAME: 'Schmidt', FIRSTNAME: 'Anna', SHORTNAME: 'AS' },
];

const mockOverview: AbsenceOverview = {
  year: 2024,
  company_totals: { vacation_days: 50, sick_days: 20, other_days: 5, total_days: 75 },
  groups: [
    { group_id: 1, group_name: 'Gruppe A', vacation_days: 30, sick_days: 10, other_days: 3, total_days: 43 },
    { group_id: 2, group_name: 'Gruppe B', vacation_days: 20, sick_days: 10, other_days: 2, total_days: 32 },
  ],
  by_month: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    vacation: i === 6 ? 15 : 3,
    sick: i === 1 ? 8 : 1,
    other: 0,
  })),
};

const mockGroupStats: AbsenceGroupStats = {
  group_id: 1,
  group_name: 'Gruppe A',
  year: 2024,
  employees: [
    { employee_id: 10, employee_name: 'Müller, Hans', vacation_days: 15, sick_days: 5, other_days: 1, total_days: 21, pending_requests: 2 },
    { employee_id: 11, employee_name: 'Schmidt, Anna', vacation_days: 10, sick_days: 3, other_days: 0, total_days: 13, pending_requests: 0 },
  ],
  group_totals: { vacation_days: 25, sick_days: 8, other_days: 1, total_days: 34 },
  top3_by_sick_days: [
    { employee_id: 10, employee_name: 'Müller, Hans', sick_days: 5 },
    { employee_id: 11, employee_name: 'Schmidt, Anna', sick_days: 3 },
  ],
  top3_by_vacation_days: [
    { employee_id: 10, employee_name: 'Müller, Hans', vacation_days: 15 },
    { employee_id: 11, employee_name: 'Schmidt, Anna', vacation_days: 10 },
  ],
};

const mockEmployeeStats: AbsenceEmployeeStats = {
  employee_id: 10,
  employee_name: 'Müller, Hans',
  year: 2024,
  vacation_days: 15,
  sick_days: 5,
  other_days: 1,
  total_days: 21,
  pending_requests: 2,
  by_month: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    vacation: i === 6 ? 10 : 0,
    sick: i === 1 ? 5 : 0,
    other: 0,
  })),
};

function renderComponent() {
  return render(
    <BrowserRouter>
      <AbsenceStats />
    </BrowserRouter>
  );
}

/** Click a tab by its data-tab attribute */
function clickTab(tabId: string) {
  const tab = document.querySelector(`[data-tab="${tabId}"]`);
  if (!tab) throw new Error(`Tab ${tabId} not found`);
  fireEvent.click(tab);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AbsenceStats', () => {
  beforeEach(() => {
    vi.mocked(api.getGroups).mockResolvedValue(
      mockGroups as Awaited<ReturnType<typeof api.getGroups>>
    );
    vi.mocked(api.getEmployees).mockResolvedValue(
      mockEmployees as Awaited<ReturnType<typeof api.getEmployees>>
    );
    vi.mocked(api.getAbsenceStatsOverview).mockResolvedValue(mockOverview);
    vi.mocked(api.getAbsenceStatsGroup).mockResolvedValue(mockGroupStats);
    vi.mocked(api.getAbsenceStatsEmployee).mockResolvedValue(mockEmployeeStats);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Renders page title ─────────────────────────────────
  it('renders the page heading', async () => {
    await act(async () => { renderComponent(); });
    expect(screen.getByText(/Abwesenheits-Statistiken/)).toBeTruthy();
  });

  // ─── 2. Shows year selector with current year ──────────────
  it('shows year selector defaulting to current year', async () => {
    await act(async () => { renderComponent(); });
    const currentYear = new Date().getFullYear().toString();
    const select = screen.getByLabelText('Jahr auswählen');
    expect((select as HTMLSelectElement).value).toBe(currentYear);
  });

  // ─── 3. Renders three tabs ─────────────────────────────────
  it('renders overview, group and employee tabs', async () => {
    await act(async () => { renderComponent(); });
    expect(document.querySelector('[data-tab="overview"]')).toBeTruthy();
    expect(document.querySelector('[data-tab="group"]')).toBeTruthy();
    expect(document.querySelector('[data-tab="employee"]')).toBeTruthy();
  });

  // ─── 4. Overview tab loads and shows company totals ────────
  it('overview tab shows company totals', async () => {
    await act(async () => { renderComponent(); });
    await waitFor(() => {
      expect(screen.getAllByText('75').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
  });

  // ─── 5. Overview tab shows group summary table ─────────────
  it('overview tab shows groups table', async () => {
    await act(async () => { renderComponent(); });
    await waitFor(() => {
      expect(screen.getAllByText('Gruppe A').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Gruppe B').length).toBeGreaterThan(0);
    });
  });

  // ─── 6. Overview calls correct API with year ───────────────
  it('overview calls getAbsenceStatsOverview with year', async () => {
    await act(async () => { renderComponent(); });
    const currentYear = new Date().getFullYear();
    expect(vi.mocked(api.getAbsenceStatsOverview)).toHaveBeenCalledWith(currentYear);
  });

  // ─── 7. Switching to group tab shows group selector ────────
  it('group tab shows group selector dropdown', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('group'); });
    expect(screen.getByText('— Gruppe wählen —')).toBeTruthy();
  });

  // ─── 8. Group tab loads data when group is selected ────────
  it('group tab loads stats on group selection', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('group'); });

    await waitFor(() => {
      const options = Array.from(document.querySelectorAll('option'));
      return options.some(o => o.textContent === 'Gruppe A');
    });

    const groupSelect = Array.from(document.querySelectorAll('select')).find(
      s => Array.from(s.options).some(o => o.text === 'Gruppe A')
    )!;
    await act(async () => {
      fireEvent.change(groupSelect, { target: { value: '1' } });
    });
    await waitFor(() => {
      expect(vi.mocked(api.getAbsenceStatsGroup)).toHaveBeenCalledWith(1, expect.any(Number));
    });
  });

  // ─── 9. Group tab shows employee table ─────────────────────
  it('group tab shows employee table after loading', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('group'); });

    await waitFor(() => {
      const options = Array.from(document.querySelectorAll('option'));
      return options.some(o => o.textContent === 'Gruppe A');
    });

    const groupSelect = Array.from(document.querySelectorAll('select')).find(
      s => Array.from(s.options).some(o => o.text === 'Gruppe A')
    )!;
    await act(async () => {
      fireEvent.change(groupSelect, { target: { value: '1' } });
    });
    await waitFor(() => {
      expect(screen.getAllByText('Müller, Hans').length).toBeGreaterThan(0);
    });
  });

  // ─── 10. Group tab shows top-3 highlights ──────────────────
  it('group tab shows top-3 sick and vacation highlights', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('group'); });

    await waitFor(() => {
      const options = Array.from(document.querySelectorAll('option'));
      return options.some(o => o.textContent === 'Gruppe A');
    });

    const groupSelect = Array.from(document.querySelectorAll('select')).find(
      s => Array.from(s.options).some(o => o.text === 'Gruppe A')
    )!;
    await act(async () => {
      fireEvent.change(groupSelect, { target: { value: '1' } });
    });
    await waitFor(() => {
      expect(screen.getByText(/Top 3 Krankentage/)).toBeTruthy();
      expect(screen.getByText(/Top 3 Urlaubstage/)).toBeTruthy();
    });
  });

  // ─── 11. Employee tab loads data when employee is selected ──
  it('employee tab loads stats on employee selection', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('employee'); });

    await waitFor(() => {
      const options = Array.from(document.querySelectorAll('option'));
      return options.some(o => o.textContent?.includes('Müller'));
    });

    const empSelect = Array.from(document.querySelectorAll('select')).find(
      s => Array.from(s.options).some(o => o.text.includes('Müller'))
    )!;
    await act(async () => {
      fireEvent.change(empSelect, { target: { value: '10' } });
    });
    await waitFor(() => {
      expect(vi.mocked(api.getAbsenceStatsEmployee)).toHaveBeenCalledWith(10, expect.any(Number));
    });
  });

  // ─── 12. Employee tab shows pending requests banner ────────
  it('employee tab shows pending requests badge', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('employee'); });

    await waitFor(() => {
      const options = Array.from(document.querySelectorAll('option'));
      return options.some(o => o.textContent?.includes('Müller'));
    });

    const empSelect = Array.from(document.querySelectorAll('select')).find(
      s => Array.from(s.options).some(o => o.text.includes('Müller'))
    )!;
    await act(async () => {
      fireEvent.change(empSelect, { target: { value: '10' } });
    });
    await waitFor(() => {
      expect(screen.getByText(/ausstehende Abwesenheitsanträge/)).toBeTruthy();
    });
  });

  // ─── 13. Employee tab shows monthly breakdown table ─────────
  it('employee tab shows monthly breakdown', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('employee'); });

    await waitFor(() => {
      const options = Array.from(document.querySelectorAll('option'));
      return options.some(o => o.textContent?.includes('Müller'));
    });

    const empSelect = Array.from(document.querySelectorAll('select')).find(
      s => Array.from(s.options).some(o => o.text.includes('Müller'))
    )!;
    await act(async () => {
      fireEvent.change(empSelect, { target: { value: '10' } });
    });
    await waitFor(() => {
      expect(screen.getByText('Monatsaufschlüsselung')).toBeTruthy();
    });
  });

  // ─── 14. Employee tab shows pie chart section ──────────────
  it('employee tab shows distribution section', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('employee'); });

    await waitFor(() => {
      const options = Array.from(document.querySelectorAll('option'));
      return options.some(o => o.textContent?.includes('Müller'));
    });

    const empSelect = Array.from(document.querySelectorAll('select')).find(
      s => Array.from(s.options).some(o => o.text.includes('Müller'))
    )!;
    await act(async () => {
      fireEvent.change(empSelect, { target: { value: '10' } });
    });
    await waitFor(() => {
      expect(screen.getByText('Verteilung')).toBeTruthy();
    });
  });

  // ─── 15. Year change triggers reload of overview ───────────
  it('changing year reloads overview data', async () => {
    await act(async () => { renderComponent(); });
    await waitFor(() => {
      expect(vi.mocked(api.getAbsenceStatsOverview)).toHaveBeenCalledTimes(1);
    });
    const yearSelect = screen.getByLabelText('Jahr auswählen');
    // Use currentYear+1 which is always in the options (currentYear .. currentYear+3)
    const nextYear = new Date().getFullYear() + 1;
    await act(async () => {
      fireEvent.change(yearSelect, { target: { value: String(nextYear) } });
    });
    await waitFor(() => {
      expect(vi.mocked(api.getAbsenceStatsOverview)).toHaveBeenCalledWith(nextYear);
    });
  });

  // ─── 16. Shows placeholder when no group selected ──────────
  it('group tab shows placeholder when no group selected', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('group'); });
    expect(screen.getByText('Bitte eine Gruppe auswählen')).toBeTruthy();
  });

  // ─── 17. Group tab pending badge shown for employees ───────
  it('group tab shows pending badge for employees with requests', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { clickTab('group'); });

    await waitFor(() => {
      const options = Array.from(document.querySelectorAll('option'));
      return options.some(o => o.textContent === 'Gruppe A');
    });

    const groupSelect = Array.from(document.querySelectorAll('select')).find(
      s => Array.from(s.options).some(o => o.text === 'Gruppe A')
    )!;
    await act(async () => {
      fireEvent.change(groupSelect, { target: { value: '1' } });
    });
    await waitFor(() => {
      // Müller has 2 pending requests — badge should appear
      const badges = screen.getAllByText('2');
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
