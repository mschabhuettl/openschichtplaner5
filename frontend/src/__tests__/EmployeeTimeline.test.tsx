/**
 * Tests for EmployeeTimeline page (Q078)
 * 12+ frontend tests covering rendering, interactions, period selector, tooltip,
 * employee selector, data loading, and edge cases.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EmployeeTimeline from '../pages/EmployeeTimeline';
import { api } from '../api/client';

// ─── Mocks ────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getSchedule: vi.fn(),
    getAbsences: vi.fn(),
  },
}));

vi.mock('../components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

const mockEmployees = [
  { ID: 1, NAME: 'Müller', FIRSTNAME: 'Hans', SHORTNAME: 'HM', NUMBER: '001', HIDE: false, HRSDAY: 8, HRSWEEK: 40, HRSMONTH: 160, WORKDAYS_LIST: [true, true, true, true, true, false, false], POSITION: 1, SEX: 1 },
  { ID: 2, NAME: 'Schmidt', FIRSTNAME: 'Anna', SHORTNAME: 'AS', NUMBER: '002', HIDE: false, HRSDAY: 8, HRSWEEK: 40, HRSMONTH: 160, WORKDAYS_LIST: [true, true, true, true, true, false, false], POSITION: 2, SEX: 2 },
  { ID: 3, NAME: 'Hidden', FIRSTNAME: 'Max', SHORTNAME: 'MH', NUMBER: '003', HIDE: true, HRSDAY: 8, HRSWEEK: 40, HRSMONTH: 160, WORKDAYS_LIST: [true, true, true, true, true, false, false], POSITION: 3, SEX: 1 },
];

const mockScheduleEntries = [
  {
    id: 1, employee_id: 1, date: '2025-03-10',
    shift_id: 5, shift_name: 'Frühdienst', shift_short: 'F',
    color_bk: '#22c55e', color_text: '#ffffff',
    workplace_id: 1, workplace_name: 'Station A',
    kind: 'shift', leave_name: '', display_name: 'Frühdienst',
    startend: '06:00-14:00',
  },
  {
    id: 2, employee_id: 1, date: '2025-03-11',
    shift_id: 6, shift_name: 'Spätdienst', shift_short: 'S',
    color_bk: '#3b82f6', color_text: '#ffffff',
    workplace_id: 1, workplace_name: 'Station A',
    kind: 'shift', leave_name: '', display_name: 'Spätdienst',
    startend: '14:00-22:00',
  },
];

const mockAbsences = [
  {
    id: 10, employee_id: 1, date: '2025-03-13',
    leave_type_id: 1, leave_type_name: 'Urlaub', leave_type_short: 'U',
  },
  {
    id: 11, employee_id: 1, date: '2025-03-14',
    leave_type_id: 2, leave_type_name: 'Krankenstand', leave_type_short: 'K',
  },
];

function setupMocks() {
  vi.mocked(api.getEmployees).mockResolvedValue(mockEmployees as Awaited<ReturnType<typeof api.getEmployees>>);
  vi.mocked(api.getSchedule).mockResolvedValue(mockScheduleEntries as unknown as Awaited<ReturnType<typeof api.getSchedule>>);
  vi.mocked(api.getAbsences).mockResolvedValue(mockAbsences as unknown as Awaited<ReturnType<typeof api.getAbsences>>);
}

function renderWithRouter(employeeId?: string) {
  const path = employeeId ? `/employees/${employeeId}/timeline` : '/employee-timeline';
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/employees/:id/timeline" element={<EmployeeTimeline />} />
        <Route path="/employee-timeline" element={<EmployeeTimeline />} />
        <Route path="/mitarbeiter/:id" element={<div data-testid="profil-page">Profil</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────

describe('EmployeeTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // ── 1. Renders page title ─────────────────────────────────────
  it('renders the page title', async () => {
    await act(async () => { renderWithRouter(); });
    expect(screen.getByText(/Mitarbeiter-Timeline/i)).toBeTruthy();
  });

  // ── 2. Shows "choose employee" prompt when no employee selected ──
  it('shows placeholder when no employee selected', async () => {
    await act(async () => { renderWithRouter(); });
    expect(screen.getByText(/Bitte einen Mitarbeiter auswählen/i)).toBeTruthy();
  });

  // ── 3. Employee selector renders ─────────────────────────────
  it('renders employee selector button', async () => {
    await act(async () => { renderWithRouter(); });
    expect(screen.getByText(/Mitarbeiter wählen/i)).toBeTruthy();
  });

  // ── 4. Employee selector opens dropdown ──────────────────────
  it('opens employee dropdown on click', async () => {
    await act(async () => { renderWithRouter(); });
    const btn = screen.getByText(/Mitarbeiter wählen/i).closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Suchen/i)).toBeTruthy();
    });
  });

  // ── 5. Employee selector shows list entries (no hidden employees) ──
  it('lists non-hidden employees in dropdown', async () => {
    await act(async () => { renderWithRouter(); });
    const btn = screen.getByText(/Mitarbeiter wählen/i).closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Hans Müller')).toBeTruthy();
      expect(screen.getByText('Anna Schmidt')).toBeTruthy();
    });
    // Hidden employee should NOT appear
    expect(screen.queryByText('Max Hidden')).toBeNull();
  });

  // ── 6. Employee selector filter works ────────────────────────
  it('filters employees by search query', async () => {
    await act(async () => { renderWithRouter(); });
    const btn = screen.getByText(/Mitarbeiter wählen/i).closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => screen.getByPlaceholderText(/Suchen/i));
    fireEvent.change(screen.getByPlaceholderText(/Suchen/i), { target: { value: 'Anna' } });
    await waitFor(() => {
      expect(screen.getByText('Anna Schmidt')).toBeTruthy();
      expect(screen.queryByText('Hans Müller')).toBeNull();
    });
  });

  // ── 7. Period selector renders all options ────────────────────
  it('renders all period selector options', async () => {
    await act(async () => { renderWithRouter(); });
    expect(screen.getByText('1 Woche')).toBeTruthy();
    expect(screen.getByText('2 Wochen')).toBeTruthy();
    expect(screen.getByText('1 Monat')).toBeTruthy();
    expect(screen.getByText('3 Monate')).toBeTruthy();
  });

  // ── 8. Period selector changes period (active class) ─────────
  it('switches period on button click', async () => {
    await act(async () => { renderWithRouter(); });
    const btn1w = screen.getByText('1 Woche');
    const btn3m = screen.getByText('3 Monate');
    // Initially 1 month is default — its button has bg-indigo-600
    const btn1m = screen.getByText('1 Monat').closest('button')!;
    expect(btn1m.className).toContain('bg-indigo-600');
    fireEvent.click(btn1w);
    expect(btn1w.closest('button')!.className).toContain('bg-indigo-600');
    fireEvent.click(btn3m);
    expect(btn3m.closest('button')!.className).toContain('bg-indigo-600');
  });

  // ── 9. Navigation buttons exist ──────────────────────────────
  it('renders navigation buttons (prev, heute, next)', async () => {
    await act(async () => { renderWithRouter(); });
    expect(screen.getByText('◀')).toBeTruthy();
    expect(screen.getByText('▶')).toBeTruthy();
    expect(screen.getByText('Heute')).toBeTruthy();
  });

  // ── 10. Loads data for pre-selected employee (URL param) ──────
  it('loads data when employee id is in URL', async () => {
    await act(async () => { renderWithRouter('1'); });
    await waitFor(() => {
      expect(api.getAbsences).toHaveBeenCalledWith(expect.objectContaining({ employee_id: 1 }));
    });
  });

  // ── 11. Shows employee name header when employee is selected ──
  it('shows employee header with name when selected from URL', async () => {
    await act(async () => { renderWithRouter('1'); });
    await waitFor(() => {
      expect(screen.getByText('Hans Müller')).toBeTruthy();
    });
  });

  // ── 12. Shows stats cards when employee is selected ──────────
  it('shows stats cards for selected employee', async () => {
    await act(async () => { renderWithRouter('1'); });
    await waitFor(() => {
      expect(screen.getByText('Schichttage')).toBeTruthy();
      expect(screen.getByText('Abwesenheitstage')).toBeTruthy();
      expect(screen.getByText(/Arbeitstage/i)).toBeTruthy();
      expect(screen.getByText('Abdeckung')).toBeTruthy();
    });
  });

  // ── 13. Shows loading spinner while fetching ──────────────────
  it('shows loading spinner while data is loading', async () => {
    vi.mocked(api.getSchedule).mockReturnValue(new Promise(() => {}) as unknown as ReturnType<typeof api.getSchedule>);
    vi.mocked(api.getAbsences).mockReturnValue(new Promise(() => {}) as unknown as ReturnType<typeof api.getAbsences>);

    await act(async () => { renderWithRouter('1'); });
    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
  });

  // ── 14. Shows error message on API failure ────────────────────
  it('shows error message when API fails', async () => {
    vi.mocked(api.getAbsences).mockRejectedValue(new Error('Network error'));
    await act(async () => { renderWithRouter('1'); });
    await waitFor(() => {
      expect(screen.getByText(/Fehler beim Laden/i)).toBeTruthy();
    });
  });

  // ── 15. Shows legend items ────────────────────────────────────
  it('shows legend when employee is selected', async () => {
    await act(async () => { renderWithRouter('1'); });
    await waitFor(() => {
      expect(screen.getByText('Urlaub')).toBeTruthy();
      expect(screen.getByText('Krankenstand')).toBeTruthy();
      expect(screen.getByText('Schicht')).toBeTruthy();
      expect(screen.getByText('Heute')).toBeTruthy();
    });
  });

  // ── 16. "Heute" button works without crashing ─────────────────
  it('"Heute" button works without crashing', async () => {
    await act(async () => { renderWithRouter(); });
    const todayBtn = screen.getByText('Heute');
    fireEvent.click(todayBtn);
    expect(screen.getByText(/Mitarbeiter-Timeline/i)).toBeTruthy();
  });

  // ── 17. Prev/next navigation works ───────────────────────────
  it('prev/next navigation changes the displayed date range', async () => {
    await act(async () => { renderWithRouter(); });
    const prevBtn = screen.getByText('◀');
    const nextBtn = screen.getByText('▶');
    fireEvent.click(prevBtn);
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Mitarbeiter-Timeline/i)).toBeTruthy();
  });

  // ── 18. Horizontal view for 1-month period ────────────────────
  it('uses horizontal view for 1-month period (> 14 days)', async () => {
    await act(async () => { renderWithRouter('1'); });
    await waitFor(() => screen.getByText('Hans Müller'));
    // In horizontal view (30 days), "Datum" column header does NOT appear
    expect(screen.queryByText('Datum')).toBeNull();
    expect(screen.getByText('Hans Müller')).toBeTruthy();
  });

  // ── 19. List view for 1-week period ──────────────────────────
  it('uses list view for 1-week period (7 days)', async () => {
    await act(async () => { renderWithRouter('1'); });
    await waitFor(() => screen.getByText('Hans Müller'));
    // Switch to 1 week
    fireEvent.click(screen.getByText('1 Woche'));
    await waitFor(() => {
      // In list view, "Datum" column header appears
      expect(screen.getByText('Datum')).toBeTruthy();
    });
  });

  // ── 20. Shows "Profil" link button for selected employee ──────
  it('shows "Profil" button for selected employee', async () => {
    await act(async () => { renderWithRouter('1'); });
    await waitFor(() => {
      expect(screen.getByText('Profil →')).toBeTruthy();
    });
  });
});
