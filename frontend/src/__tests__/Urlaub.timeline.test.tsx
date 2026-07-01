/**
 * Jahres-Timeline (Urlaub): Das Gantt-Grid (bis zu ~11k Zellen bei 30 MA × 365
 * Tagen) ist vom Tooltip-State entkoppelt — Hover darf NICHT das komplette Grid
 * re-rendern (Punkt 17 „Jahres-Timeline extrem laggy" bei echter Datenmenge).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../i18n';

vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn(),
    getLeaveTypes: vi.fn(),
    getGroups: vi.fn(),
    getAbsences: vi.fn(),
    downloadVacationRequest: vi.fn(),
  },
}));

vi.mock('../contexts/SSEContext', () => ({
  useSSEContext: () => ({ status: 'disconnected', subscribe: vi.fn(() => vi.fn()) }),
  useSSERefresh: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../contexts/AuthContext';

import { api } from '../api/client';
import Urlaub, { TimelineGrid } from '../pages/Urlaub';

const YEAR = new Date().getFullYear();

const employees = [
  { ID: 1, NAME: 'Müller', FIRSTNAME: 'Hans', NUMBER: '001' },
] as never[];
const leaveTypes = [
  { ID: 10, NAME: 'Urlaub', SHORTNAME: 'U', COLORBAR_HEX: '#2563eb', COLORBK_HEX: '#dbeafe' },
] as never[];

function gridProps(onHover = vi.fn()) {
  return {
    year: YEAR,
    employees: employees as never,
    leaveTypes: leaveTypes as never,
    absMap: new Map([[`1_${YEAR}-03-10`, { ID: 100, EMPLOYEE_ID: 1, DATE: `${YEAR}-03-10`, LEAVE_TYPE_ID: 10 }]]) as never,
    countByEmployee: new Map([[1, 1]]),
    filterLeaveType: null,
    onHover,
  };
}

describe('TimelineGrid — Hover-Entkopplung', () => {
  it('meldet Hover auf einer Abwesenheits-Zelle mit MA, Datum und Art; Verlassen meldet null', () => {
    const onHover = vi.fn();
    const { container } = render(<TimelineGrid {...gridProps(onHover)} />);

    const cell = container.querySelector('td.cursor-pointer');
    expect(cell).not.toBeNull();
    fireEvent.mouseEnter(cell!, { clientX: 40, clientY: 50 });
    expect(onHover).toHaveBeenCalledTimes(1);
    const tip = onHover.mock.calls[0][0];
    expect(tip.text).toContain('Hans Müller');
    expect(tip.text).toContain('Urlaub');

    fireEvent.mouseLeave(cell!);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('ist memoized: erneutes Rendern mit identischen Props rendert das Grid nicht neu', () => {
    // Direkter Beleg der Memoisierung — ohne memo() re-rendert jede
    // Tooltip-Änderung alle Zellen (Regression zu Punkt 17).
    expect((TimelineGrid as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for('react.memo'));

    // Render-Sonde: das Grid ruft pro Render leaveTypes.find() auf (getLT der
    // Abwesenheits-Zelle). Bailout durch memo ⇒ kein weiterer find-Aufruf.
    let findCalls = 0;
    const probedLeaveTypes = [...leaveTypes];
    const origFind = probedLeaveTypes.find.bind(probedLeaveTypes);
    Object.defineProperty(probedLeaveTypes, 'find', {
      value: (...args: Parameters<typeof origFind>) => { findCalls++; return origFind(...args); },
    });
    const props = { ...gridProps(), leaveTypes: probedLeaveTypes as never };
    const tree = (tip: string) => (
      <>
        <TimelineGrid {...props} />
        <span>{tip}</span>
      </>
    );
    const { rerender } = render(tree('a'));
    expect(findCalls).toBeGreaterThan(0);
    const after = findCalls;
    rerender(tree('b'));
    expect(findCalls).toBe(after);
  });
});

describe('Urlaub Jahres-Timeline-Tab — Tooltip-Fluss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sp5_language', 'de');
    sessionStorage.clear();
    vi.mocked(useAuth).mockReturnValue({
      user: { ID: 9, NAME: 'P', role: 'Planer', WABSENCES: true },
      isDevMode: false,
      canWrite: true,
      canWriteAbsences: true,
      canAdmin: false,
      can: () => true,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(api.getEmployees).mockResolvedValue(employees as never);
    vi.mocked(api.getLeaveTypes).mockResolvedValue(leaveTypes as never);
    vi.mocked(api.getGroups).mockResolvedValue([] as never);
    vi.mocked(api.getAbsences).mockResolvedValue([
      { id: 100, employee_id: 1, date: `${YEAR}-03-10`, leave_type_id: 10 },
    ] as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('zeigt beim Überfahren einer Zelle den Tooltip und blendet ihn beim Verlassen aus', async () => {
    const { container } = render(<LanguageProvider><Urlaub /></LanguageProvider>);
    fireEvent.click(await screen.findByRole('button', { name: /Jahres-Timeline/ }));
    await waitFor(() => expect(container.querySelector('td.cursor-pointer')).not.toBeNull());

    // Tooltip-Knoten ist permanent gemountet (nur display togglet) — Ein-/
    // Aushängen würde per space-y-4-Sibling-Selektor das ganze Grid re-stylen.
    const tooltip = container.querySelector<HTMLElement>('div.fixed.pointer-events-none.whitespace-pre')!;
    expect(tooltip).not.toBeNull();
    expect(tooltip.style.display).toBe('none');

    const cell = container.querySelector('td.cursor-pointer')!;
    fireEvent.mouseEnter(cell, { clientX: 40, clientY: 50 });
    await waitFor(() => expect(tooltip.style.display).not.toBe('none'));
    expect(tooltip.textContent).toContain('Hans Müller');
    expect(tooltip.textContent).toContain('Urlaub');

    fireEvent.mouseLeave(cell);
    await waitFor(() => expect(tooltip.style.display).toBe('none'));
  });
});
