import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ConflictReport from '../pages/ConflictReport';
import { api } from '../api/client';
import type { ConflictReportResult } from '../api/client';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  api: {
    getGroups: vi.fn(),
    getConflictReport: vi.fn(),
    getConflictReportExportUrl: vi.fn((params: { from: string; to: string; format: string; group_id?: number }) =>
      `/api/v1/reports/conflicts/export?from=${params.from}&to=${params.to}&format=${params.format}`
    ),
  },
}));

const mockGroups = [
  { ID: 1, NAME: 'Gruppe Alpha', SHORTNAME: 'GA' },
  { ID: 2, NAME: 'Gruppe Beta', SHORTNAME: 'GB' },
];

const mockConflictResult: ConflictReportResult = {
  from: '2024-01-01',
  to: '2024-01-31',
  group_id: null,
  summary: { overlaps: 2, double_booked: 1, understaffed: 3, total: 6 },
  conflicts: [
    {
      type: 'overlap',
      date: '2024-01-05',
      employee_id: 10,
      employee_name: 'Hans Müller',
      group_id: 1,
      description: 'Hans Müller: shifts A and B overlap',
      severity: 'warning',
    },
    {
      type: 'double_booked',
      date: '2024-01-10',
      employee_id: 11,
      employee_name: 'Anna Schmidt',
      group_id: 1,
      description: 'Anna Schmidt is double-booked',
      severity: 'error',
    },
    {
      type: 'understaffed',
      date: '2024-01-15',
      employee_id: null,
      employee_name: null,
      group_id: 2,
      description: "Group 'Gruppe Beta' has 0 employees scheduled",
      severity: 'warning',
    },
  ],
};

const emptyResult: ConflictReportResult = {
  from: '2024-01-01',
  to: '2024-01-31',
  group_id: null,
  summary: { overlaps: 0, double_booked: 0, understaffed: 0, total: 0 },
  conflicts: [],
};

function renderPage() {
  return render(
    <BrowserRouter>
      <ConflictReport />
    </BrowserRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConflictReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getGroups as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroups);
    (api.getConflictReport as ReturnType<typeof vi.fn>).mockResolvedValue(mockConflictResult);
  });

  // 1
  it('renders the page heading', async () => {
    renderPage();
    expect(screen.getByText(/Konflikt-Report/i)).toBeTruthy();
  });

  // 2
  it('renders the filter form with group dropdown and date inputs', async () => {
    renderPage();
    expect(screen.getByTestId('group-select')).toBeTruthy();
    expect(screen.getByTestId('from-date')).toBeTruthy();
    expect(screen.getByTestId('to-date')).toBeTruthy();
    expect(screen.getByTestId('pruefen-btn')).toBeTruthy();
  });

  // 3
  it('loads and displays groups in the dropdown', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Gruppe Alpha')).toBeTruthy();
      expect(screen.getByText('Gruppe Beta')).toBeTruthy();
    });
  });

  // 4
  it('shows empty state before check is run', async () => {
    renderPage();
    expect(screen.getByTestId('empty-state')).toBeTruthy();
  });

  // 5
  it('calls getConflictReport with correct params on Prüfen click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Gruppe Alpha'));

    fireEvent.change(screen.getByTestId('group-select'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('from-date'), { target: { value: '2024-01-01' } });
    fireEvent.change(screen.getByTestId('to-date'), { target: { value: '2024-01-31' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    expect(api.getConflictReport).toHaveBeenCalledWith({
      group_id: 1,
      from: '2024-01-01',
      to: '2024-01-31',
    });
  });

  // 6
  it('displays summary bar after successful check', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('summary-bar')).toBeTruthy();
      expect(screen.getByTestId('summary-total')).toBeTruthy();
      expect(screen.getByTestId('summary-overlaps')).toBeTruthy();
      expect(screen.getByTestId('summary-double-booked')).toBeTruthy();
      expect(screen.getByTestId('summary-understaffed')).toBeTruthy();
    });
  });

  // 7
  it('shows correct summary counts', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('summary-total').textContent).toContain('6');
      expect(screen.getByTestId('summary-overlaps').textContent).toContain('2');
      expect(screen.getByTestId('summary-double-booked').textContent).toContain('1');
      expect(screen.getByTestId('summary-understaffed').textContent).toContain('3');
    });
  });

  // 8
  it('renders conflict rows after loading', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      const rows = screen.getAllByTestId('conflict-row');
      expect(rows).toHaveLength(3);
    });
  });

  // 9
  it('renders type filter buttons', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('filter-btn-all')).toBeTruthy();
      expect(screen.getByTestId('filter-btn-overlap')).toBeTruthy();
      expect(screen.getByTestId('filter-btn-double_booked')).toBeTruthy();
      expect(screen.getByTestId('filter-btn-understaffed')).toBeTruthy();
    });
  });

  // 10
  it('filters conflicts by type (overlap) when filter button is clicked', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => screen.getAllByTestId('conflict-row'));

    // Click overlap filter — should show only 1 overlap row
    fireEvent.click(screen.getByTestId('filter-btn-overlap'));
    const rows = screen.getAllByTestId('conflict-row');
    expect(rows).toHaveLength(1);
  });

  // 11
  it('shows all conflicts when "Alle" filter is selected', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => screen.getAllByTestId('conflict-row'));

    // First filter by type, then switch back to all
    fireEvent.click(screen.getByTestId('filter-btn-double_booked'));
    fireEvent.click(screen.getByTestId('filter-btn-all'));

    const rows = screen.getAllByTestId('conflict-row');
    expect(rows).toHaveLength(3);
  });

  // 12
  it('renders type badges for each conflict type', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('badge-overlap')).toBeTruthy();
      expect(screen.getByTestId('badge-double_booked')).toBeTruthy();
      expect(screen.getByTestId('badge-understaffed')).toBeTruthy();
    });
  });

  // 13
  it('shows "no conflicts" message when result is empty', async () => {
    (api.getConflictReport as ReturnType<typeof vi.fn>).mockResolvedValue(emptyResult);
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('no-conflicts')).toBeTruthy();
    });
  });

  // 14
  it('renders CSV and Excel export links after check', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('export-csv')).toBeTruthy();
      expect(screen.getByTestId('export-xlsx')).toBeTruthy();
    });
  });

  // 15
  it('export CSV link href contains format=csv', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      const csvLink = screen.getByTestId('export-csv');
      expect((csvLink as HTMLAnchorElement).href).toContain('format=csv');
    });
  });

  // 16
  it('export Excel link href contains format=xlsx', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      const xlsxLink = screen.getByTestId('export-xlsx');
      expect((xlsxLink as HTMLAnchorElement).href).toContain('format=xlsx');
    });
  });

  // 17
  it('shows error message when API call fails', async () => {
    (api.getConflictReport as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Netzwerkfehler')
    );
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      const errEl = screen.getByTestId('error-msg');
      expect(errEl).toBeTruthy();
      expect(errEl.textContent).toContain('Netzwerkfehler');
    });
  });

  // 18
  it('filters understaffed conflicts correctly', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => screen.getAllByTestId('conflict-row'));

    fireEvent.click(screen.getByTestId('filter-btn-understaffed'));
    const rows = screen.getAllByTestId('conflict-row');
    expect(rows).toHaveLength(1);
  });

  // 19 (bonus)
  it('calls getConflictReport without group_id when "Alle Gruppen" selected', async () => {
    renderPage();

    // Do not change group selector — keep it at "Alle Gruppen"
    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      const call = (api.getConflictReport as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.group_id).toBeUndefined();
      expect(call.from).toBeTruthy();
      expect(call.to).toBeTruthy();
    });
  });

  // 20 (bonus)
  it('shows conflict table after loading results', async () => {
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pruefen-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('conflict-table')).toBeTruthy();
    });
  });
});
