/**
 * Tests for NewAbsenceModal (Urlaub.tsx) — Teiltags-Abwesenheiten (Gap V-3):
 * Tageszeit ganz/vormittags/nachmittags/stundenweise mit interval/start_time/end_time
 * (Minuten ab Mitternacht) im POST /api/v1/absences-Body.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: {
    getAbsences: vi.fn(),
    getEmployees: vi.fn(),
    getLeaveTypes: vi.fn(),
    getGroups: vi.fn(),
  },
}));
vi.mock('../contexts/SSEContext', () => ({ useSSERefresh: vi.fn() }));
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ canEditAbsences: true, canEditSchedule: true }),
}));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { NewAbsenceModal } from '../pages/Urlaub';
import type { Employee, LeaveType } from '../types';

const employees = [
  { ID: 1, NAME: 'Muster', FIRSTNAME: 'Max', NUMBER: '001', SHORTNAME: 'MM' },
] as unknown as Employee[];
const leaveTypes = [
  { ID: 5, NAME: 'Urlaub', SHORTNAME: 'U' },
] as unknown as LeaveType[];

const MONDAY = '2026-06-08';

function setDates(container: HTMLElement, from: string, to: string) {
  const dateInputs = container.querySelectorAll('input[type="date"]');
  fireEvent.change(dateInputs[0], { target: { value: from } });
  fireEvent.change(dateInputs[1], { target: { value: to } });
}

function lastFetchBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1] as RequestInit;
  return JSON.parse(String(init.body));
}

describe('NewAbsenceModal — Tageszeit/Interval (V-3)', () => {
  const fetchMock = vi.fn();
  const onSave = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderModal() {
    return render(
      <NewAbsenceModal employees={employees} leaveTypes={leaveTypes} onSave={onSave} onClose={onClose} />
    );
  }

  it('sendet standardmäßig interval=0 ohne Zeitfelder', async () => {
    const { container } = renderModal();
    setDates(container, MONDAY, MONDAY);
    fireEvent.click(screen.getByText('Beantragen'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body.interval).toBe(0);
    expect(body.date).toBe(MONDAY);
    expect('start_time' in body).toBe(false);
    expect('end_time' in body).toBe(false);
  });

  it('sendet interval=1 für vormittags', async () => {
    const { container } = renderModal();
    setDates(container, MONDAY, MONDAY);
    // Selects: [0]=Mitarbeiter, [1]=Art, [2]=Tageszeit
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[2], { target: { value: '1' } });
    fireEvent.click(screen.getByText('Beantragen'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastFetchBody(fetchMock).interval).toBe(1);
  });

  it('stundenweise zeigt Zeitfelder und sendet Minuten ab Mitternacht', async () => {
    const { container } = renderModal();
    setDates(container, MONDAY, MONDAY);
    const selects = screen.getAllByRole('combobox');

    expect(container.querySelectorAll('input[type="time"]').length).toBe(0);
    fireEvent.change(selects[2], { target: { value: '3' } });
    const timeInputs = container.querySelectorAll('input[type="time"]');
    expect(timeInputs.length).toBe(2);

    fireEvent.change(timeInputs[0], { target: { value: '08:00' } });
    fireEvent.change(timeInputs[1], { target: { value: '12:30' } });
    fireEvent.click(screen.getByText('Beantragen'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastFetchBody(fetchMock);
    expect(body.interval).toBe(3);
    expect(body.start_time).toBe(480);
    expect(body.end_time).toBe(750);
  });

  it('validiert stundenweise: Beginn = Ende wird abgelehnt', async () => {
    const { container } = renderModal();
    setDates(container, MONDAY, MONDAY);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[2], { target: { value: '3' } });
    const timeInputs = container.querySelectorAll('input[type="time"]');
    fireEvent.change(timeInputs[0], { target: { value: '08:00' } });
    fireEvent.change(timeInputs[1], { target: { value: '08:00' } });
    fireEvent.click(screen.getByText('Beantragen'));

    expect(await screen.findByText(/Beginn und Ende unterschiedlich/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
