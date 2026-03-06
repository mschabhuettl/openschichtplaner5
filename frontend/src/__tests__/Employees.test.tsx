/**
 * Unit tests for Employees page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock API client
vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getGroups: vi.fn(),
    getGroupAssignments: vi.fn(),
    getShifts: vi.fn(),
    getRestrictions: vi.fn(),
    bulkEmployeeAction: vi.fn(),
    getEmployeePhotoUrl: vi.fn(() => ''),
    uploadEmployeePhoto: vi.fn(),
    updateEmployee: vi.fn(),
    createEmployee: vi.fn(),
    deleteEmployee: vi.fn(),
  },
  invalidateStammdatenCache: vi.fn(),
}));

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { ID: 1, NAME: 'Admin', ADMIN: true, role: 'Admin' },
    isDevMode: false,
    canAdmin: true,
    canWrite: true,
    canWriteOvertimes: true,
  }),
}));

// Mock i18n
vi.mock('../i18n', () => ({
  useT: () => ({
    employees: {
      title: 'Mitarbeiter',
      subtitle: 'Mitarbeiterverwaltung',
      addButton: '+ Neu',
      searchPlaceholder: 'Suchen…',
      noResults: 'Keine Mitarbeiter gefunden',
      allGroups: 'Alle Gruppen',
      filterActive: 'Aktive',
      filterAll: 'Alle',
      filterHidden: 'Inaktive',
      printButton: '🖨️ Drucken',
      resetFilter: '× Reset',
      selected: 'ausgewählt',
      assignGroup: '👥 Gruppe zuweisen',
      showAll: '✅ Einblenden',
      hideSelected: '🚫 Ausblenden',
      clearSelection: '× Auswahl aufheben',
      columns: {
        number: 'Nr.',
        name: 'Name',
        firstname: 'Vorname',
        shortname: 'Kürzel',
        hrsDay: 'Std/Tag',
        workdays: 'Arbeitstage',
        entry: 'Eintritt',
        group: 'Gruppe',
        role: 'Rolle',
        workHours: 'Stunden/Woche',
        vacDays: 'Urlaubstage',
        active: 'Aktiv',
        actions: 'Aktionen',
      },
      actions: {
        profile: '🪪 Profil',
        edit: 'Bearbeiten',
        hide: 'Ausblenden',
      },
      salutation: { mr: 'Herr', ms: 'Frau', diverse: 'Divers' },
      worktimeUnit: { perDay: 'Pro Tag', perWeek: 'Pro Woche', perMonth: 'Pro Monat' },
    },
    common: {
      loading: 'Laden…',
      error: 'Fehler',
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      add: 'Hinzufügen',
      close: 'Schließen',
      yes: 'Ja',
      no: 'Nein',
      search: 'Suchen',
    },
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock hooks
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn(async () => true),
    dialogProps: { open: false, message: '', onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}));

import { api } from '../api/client';
import Employees from '../pages/Employees';

const mockEmployees = [
  { ID: 1, NAME: 'Müller', FIRSTNAME: 'Anna', SHORTNAME: 'AM', NUMBER: '001', HRSDAY: 8, HRSWEEK: 40, WORKDAYS_LIST: [1,1,1,1,1,0,0], EMPSTART: '2020-01-01', HIDE: false },
  { ID: 2, NAME: 'Schmidt', FIRSTNAME: 'Bob', SHORTNAME: 'BS', NUMBER: '002', HRSDAY: 6, HRSWEEK: 30, WORKDAYS_LIST: [1,1,1,1,0,0,0], EMPSTART: '2021-05-15', HIDE: false },
];

function renderEmployees() {
  return render(
    <MemoryRouter>
      <Employees />
    </MemoryRouter>
  );
}

describe('Employees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEmployees).mockResolvedValue(mockEmployees as any);
    vi.mocked(api.getGroups).mockResolvedValue([]);
    vi.mocked(api.getGroupAssignments).mockResolvedValue([]);
    vi.mocked(api.getShifts).mockResolvedValue([]);
    vi.mocked(api.getRestrictions).mockResolvedValue([]);
  });

  it('renders without crashing', () => {
    renderEmployees();
    expect(document.body).toBeTruthy();
  });

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getEmployees).mockReturnValue(new Promise(() => {}));
    renderEmployees();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows employee list after loading', async () => {
    renderEmployees();
    await waitFor(() => {
      expect(screen.getByText('Müller')).toBeTruthy();
      expect(screen.getByText('Schmidt')).toBeTruthy();
    });
  });

  it('shows empty state when no employees', async () => {
    vi.mocked(api.getEmployees).mockResolvedValue([]);
    renderEmployees();
    await waitFor(() => {
      expect(screen.queryByText('Müller')).toBeNull();
      expect(screen.queryByText('Schmidt')).toBeNull();
      expect(screen.getByText('Keine Mitarbeiter gefunden')).toBeTruthy();
    });
  });

  it('filters employees by search input', async () => {
    renderEmployees();
    await waitFor(() => {
      expect(screen.getByText('Müller')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Suchen…');
    fireEvent.change(searchInput, { target: { value: 'Müller' } });

    await waitFor(() => {
      expect(screen.getByText('Müller')).toBeTruthy();
      expect(screen.queryByText('Schmidt')).toBeNull();
    });
  });

  it('shows all employees when search is cleared', async () => {
    renderEmployees();
    await waitFor(() => {
      expect(screen.getByText('Müller')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Suchen…');
    fireEvent.change(searchInput, { target: { value: 'xyz-not-existing' } });
    await waitFor(() => {
      expect(screen.queryByText('Müller')).toBeNull();
    });

    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getByText('Müller')).toBeTruthy();
      expect(screen.getByText('Schmidt')).toBeTruthy();
    });
  });
});
