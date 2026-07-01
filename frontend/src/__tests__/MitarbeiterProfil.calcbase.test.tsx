/**
 * MA-Profil Vertragsstunden (5EMPL.CALCBASE, Spec 3.3.1): Das Original pflegt
 * nur den Stundenwert der gewählten Berechnungsbasis (0=Tag, 1=Woche, 2=Monat,
 * 3=Gesamt) — die übrigen HRS*-Felder können in echten Datenbanken veraltet
 * sein. Das Profil darf sie nicht als gültige Vertragsstunden präsentieren.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getGroups: vi.fn(),
    getShifts: vi.fn(),
    getGroupAssignments: vi.fn(),
    getEmployeeStatsYear: vi.fn(),
    getAbsences: vi.fn(),
    getChangelog: vi.fn(),
    getSkills: vi.fn(),
    getSkillAssignments: vi.fn(),
    getAvailability: vi.fn(),
    getRestrictions: vi.fn(),
    getSchedule: vi.fn(),
    updateEmployee: vi.fn(),
    setAvailability: vi.fn(),
    createSkillAssignment: vi.fn(),
    deleteSkillAssignment: vi.fn(),
  },
}));

vi.mock('../components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

import { api } from '../api/client';
import MitarbeiterProfil from '../pages/MitarbeiterProfil';

// MA mit Wochenbasis: HRSWEEK gilt, HRSDAY/HRSMONTH sind veraltete Reste (0).
const wochenMA = {
  ID: 7, NAME: 'Weber', FIRSTNAME: 'Lena', NUMBER: '77', HIDE: false,
  HRSDAY: 0, HRSWEEK: 38.5, HRSMONTH: 0, HRSTOTAL: 0, CALCBASE: 1,
  WORKDAYS_LIST: [true, true, true, true, true, false, false],
  POSITION: 1, SEX: 2,
};

function renderProfil() {
  return render(
    <MemoryRouter initialEntries={['/mitarbeiter/7']}>
      <Routes>
        <Route path="/mitarbeiter/:id" element={<MitarbeiterProfil />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MitarbeiterProfil — Vertragsstunden nach CALCBASE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEmployees).mockResolvedValue([wochenMA] as never);
    vi.mocked(api.getGroups).mockResolvedValue([] as never);
    vi.mocked(api.getShifts).mockResolvedValue([] as never);
    vi.mocked(api.getGroupAssignments).mockResolvedValue([] as never);
    vi.mocked(api.getEmployeeStatsYear).mockResolvedValue({
      months: [],
      totals: { shifts_count: 0, actual_hours: 0, target_hours: 0, difference: 0, weekend_shifts: 0, night_shifts: 0, vacation_days: 0 },
    } as never);
    vi.mocked(api.getAbsences).mockResolvedValue([] as never);
    vi.mocked(api.getChangelog).mockResolvedValue([] as never);
    vi.mocked(api.getSkills).mockResolvedValue([] as never);
    vi.mocked(api.getSkillAssignments).mockResolvedValue([] as never);
    vi.mocked(api.getAvailability).mockResolvedValue({ employee_id: 7, days: null, updated_at: null } as never);
    vi.mocked(api.getRestrictions).mockResolvedValue([] as never);
    vi.mocked(api.getSchedule).mockResolvedValue([] as never);
    vi.mocked(api.updateEmployee).mockResolvedValue(wochenMA as never);
    vi.mocked(api.setAvailability).mockResolvedValue({} as never);
  });

  it('zeigt in der Übersicht nur den Wert der Vertragsbasis (Woche), nicht die veralteten Felder', async () => {
    renderProfil();
    expect(await screen.findByText('38.5h / Woche')).toBeTruthy();
    expect(screen.getByText('Wochenstunden')).toBeTruthy();
    // Die veralteten Roh-Felder erscheinen nicht mehr als eigene Zeilen
    expect(screen.queryByText('Std/Tag')).toBeNull();
    expect(screen.queryByText('Std/Monat')).toBeNull();
  });

  it('Bearbeiten kennt die Berechnungsbasis, markiert das gültige Feld und speichert CALCBASE', async () => {
    renderProfil();
    await screen.findByText('38.5h / Woche');
    fireEvent.click(screen.getByRole('button', { name: /Profil & Qualifikationen/ }));

    const select = await screen.findByDisplayValue('Wochenstunden');
    expect(screen.getByText(/Stunden \/ Woche \(Vertragsbasis\)/)).toBeTruthy();

    fireEvent.change(select, { target: { value: '2' } });
    expect(screen.getByText(/Stunden \/ Monat \(Vertragsbasis\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Profil speichern/ }));
    await waitFor(() => expect(vi.mocked(api.updateEmployee)).toHaveBeenCalled());
    const payload = vi.mocked(api.updateEmployee).mock.calls[0][1];
    expect(payload).toMatchObject({ CALCBASE: 2, HRSWEEK: 38.5 });
  });
});
