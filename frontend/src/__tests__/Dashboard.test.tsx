/**
 * Unit tests for Dashboard page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock API client
vi.mock('../api/client', () => ({
  api: {
    getDashboardSummary: vi.fn(),
    getDashboardToday: vi.fn(),
    getDashboardUpcoming: vi.fn(),
    getDashboardStats: vi.fn(),
    getConflicts: vi.fn(),
    getBurnoutRadar: vi.fn(),
    getAbsenceStatuses: vi.fn(),
  },
}));

// Mock i18n
vi.mock('../i18n/context', () => ({
  useT: () => ({
    common: { loading: 'Lädt…', refresh: 'Aktualisieren', error: 'Fehler' },
    dashboard: {
      title: 'Dashboard',
      kpiEmployees: 'Mitarbeiter',
      kpiShiftsToday: 'Dienste heute',
      kpiAbsences: 'Abwesenheiten',
      kpiConflicts: 'Konflikte',
      todaySection: 'Heute',
      upcomingSection: 'Demnächst',
      noData: 'Keine Daten',
      lastRefresh: 'Zuletzt aktualisiert',
      autoRefresh: 'Auto-Refresh',
      month: 'Monat',
      year: 'Jahr',
      statsSection: 'Statistiken',
      weekdayDistribution: 'Wochentagsverteilung',
    },
  }),
}));

// Mock HelpTooltip
vi.mock('../components/HelpTooltip', () => ({
  HelpTooltip: () => null,
}));

import { api } from '../api/client';
import Dashboard from '../pages/Dashboard';

const mockSummary = {
  employees: { total: 42, active: 40 },
  shifts_today: { count: 5, by_shift: [] },
  shifts_this_month: { scheduled: 120, absent: 10, coverage_pct: 92 },
  absences_this_month: { total: 3, by_type: [] },
  zeitkonto_alerts: [],
  upcoming_birthdays: [],
  staffing_warnings: [],
  groups: 3,
};

const mockToday = {
  date: '2026-03-06',
  on_duty: [],
  on_duty_count: 5,
  absences: [],
  birthdays: [],
  holidays: [],
  week_days: [],
  week_peak: { count: 0, day: 'Mo', date: '2026-03-03' },
};

const mockUpcoming = {
  duties: [],
  absences: [],
  holidays: [],
};

const mockStats = {
  total_employees: 42,
  shifts_this_month: 5,
  active_shift_types: 3,
  vacation_days_used: 12,
  coverage_by_day: [],
  month: 3,
  year: 2026,
  employee_ranking: [],
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getDashboardSummary).mockResolvedValue(mockSummary);
    vi.mocked(api.getDashboardToday).mockResolvedValue(mockToday);
    vi.mocked(api.getDashboardUpcoming).mockResolvedValue(mockUpcoming);
    vi.mocked(api.getDashboardStats).mockResolvedValue(mockStats);
    vi.mocked(api.getConflicts).mockResolvedValue({ conflicts: [] });
    vi.mocked(api.getBurnoutRadar).mockResolvedValue([]);
    vi.mocked(api.getAbsenceStatuses).mockResolvedValue({});
  });

  it('renders without crashing', () => {
    render(<Dashboard />);
    // Should at least mount without throwing
    expect(document.body).toBeTruthy();
  });

  it('shows loading state initially', () => {
    // Keep API pending
    vi.mocked(api.getDashboardSummary).mockReturnValue(new Promise(() => {}));
    render(<Dashboard />);
    // Loading skeletons should be present (animate-pulse elements)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows KPI data after loading', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      // Employee count should appear
      expect(screen.getByText('42')).toBeTruthy();
    });
  });

  it('shows error when API fails', async () => {
    vi.mocked(api.getDashboardSummary).mockRejectedValue(new Error('API Error'));
    vi.mocked(api.getDashboardToday).mockRejectedValue(new Error('API Error'));
    vi.mocked(api.getDashboardUpcoming).mockRejectedValue(new Error('API Error'));
    vi.mocked(api.getDashboardStats).mockRejectedValue(new Error('API Error'));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/API Error/)).toBeTruthy();
    });
  });

  it('calls all dashboard API endpoints on mount', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(api.getDashboardSummary).toHaveBeenCalled();
      expect(api.getDashboardToday).toHaveBeenCalled();
      expect(api.getDashboardUpcoming).toHaveBeenCalled();
      expect(api.getDashboardStats).toHaveBeenCalled();
    });
  });
});
