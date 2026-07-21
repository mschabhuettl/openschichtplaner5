/**
 * ui/MultiSelect (Taktwerk-Baum-Select, docs/design-multiselect.md):
 * - leere Auswahl = „Alle"; „Alle"-Zeile leert die Auswahl
 * - Checkboxen unabhängig (keine Eltern-Kind-Kaskade)
 * - Button-Label: allLabel | Einzelname | „N ausgewählt"
 * - Tastatur: ↑↓ Fokus, Space toggelt, ⏎/Esc schließt; Außenklick schließt
 * - Baum-Einrückung über depth; Suchfeld erst ab 15 Optionen
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import { MultiSelect } from '../components/ui/MultiSelect';

const OPTS = [
  { value: 1, label: 'Rettungsdienst', depth: 0 },
  { value: 2, label: '   └ RTW', depth: 1 },
  { value: 3, label: '   └ KTW', depth: 1 },
  { value: 4, label: 'Verwaltung', depth: 0 },
];

describe('MultiSelect', () => {
  beforeEach(cleanup);

  it('zeigt allLabel bei leerer Auswahl, Einzelname bei einer, Zähler bei mehreren', () => {
    const { rerender } = render(
      <MultiSelect options={OPTS} selected={[]} onChange={() => {}} allLabel="Alle Gruppen" />,
    );
    expect(screen.getByRole('button').textContent).toContain('Alle Gruppen');
    rerender(<MultiSelect options={OPTS} selected={[2]} onChange={() => {}} allLabel="Alle Gruppen" />);
    expect(screen.getByRole('button').textContent).toContain('RTW');
    rerender(<MultiSelect options={OPTS} selected={[2, 3]} onChange={() => {}} allLabel="Alle Gruppen" />);
    expect(screen.getByRole('button').textContent).toContain('2 ausgewählt');
  });

  it('toggelt Werte unabhängig und leert über die Alle-Zeile', () => {
    const onChange = vi.fn();
    render(<MultiSelect options={OPTS} selected={[2]} onChange={onChange} allLabel="Alle Gruppen" />);
    fireEvent.click(screen.getByRole('button'));
    const list = within(screen.getByRole('listbox'));

    // Option ergänzen (unabhängig, keine Kaskade auf die Eltern)
    fireEvent.mouseDown(list.getByText('└ KTW'));
    expect(onChange).toHaveBeenLastCalledWith([2, 3]);

    // Abwählen
    fireEvent.mouseDown(list.getByText('└ RTW'));
    expect(onChange).toHaveBeenLastCalledWith([]);

    // „Alle"-Zeile leert
    fireEvent.mouseDown(list.getByText('Alle Gruppen'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('Tastatur: ↑↓ bewegt den Fokus, Space toggelt, Escape schließt', () => {
    const onChange = vi.fn();
    const { container } = render(
      <MultiSelect options={OPTS} selected={[]} onChange={onChange} allLabel="Alle Gruppen" />,
    );
    fireEvent.click(screen.getByRole('button'));
    const root = container.firstChild as HTMLElement;

    fireEvent.keyDown(root, { key: 'ArrowDown' }); // → erste Option
    fireEvent.keyDown(root, { key: ' ' });
    expect(onChange).toHaveBeenLastCalledWith([1]);

    fireEvent.keyDown(root, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('rendert Baum-Einrückung über depth und markiert Auswahl per aria-selected', () => {
    render(<MultiSelect options={OPTS} selected={[2]} onChange={() => {}} allLabel="Alle Gruppen" />);
    fireEvent.click(screen.getByRole('button'));
    const list = within(screen.getByRole('listbox'));
    const rtw = list.getByText('└ RTW').closest('[role="option"]') as HTMLElement;
    expect(rtw.getAttribute('aria-selected')).toBe('true');
    expect(rtw.style.paddingLeft).toBe('28px'); // 10 + 1*18
    const parent = list.getByText('Rettungsdienst').closest('[role="option"]') as HTMLElement;
    expect(parent.style.paddingLeft).toBe('10px');
  });

  it('zeigt das Suchfeld erst ab 15 Optionen und filtert', () => {
    render(<MultiSelect options={OPTS} selected={[]} onChange={() => {}} allLabel="Alle Gruppen" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByPlaceholderText('Suchen…')).toBeNull();
    cleanup();

    const many = Array.from({ length: 16 }, (_, i) => ({ value: i, label: `Gruppe ${i}`, depth: 0 }));
    render(<MultiSelect options={many} selected={[]} onChange={() => {}} allLabel="Alle Gruppen" />);
    fireEvent.click(screen.getByRole('button'));
    const search = screen.getByPlaceholderText('Suchen…');
    fireEvent.change(search, { target: { value: 'Gruppe 12' } });
    expect(screen.getByText('Gruppe 12')).toBeTruthy();
    expect(screen.queryByText('Gruppe 3')).toBeNull();
  });

  it('Außenklick schließt das Panel', () => {
    render(
      <div>
        <MultiSelect options={OPTS} selected={[]} onChange={() => {}} allLabel="Alle Gruppen" />
        <button>woanders</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Alle Gruppen/ }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.mouseDown(screen.getByText('woanders'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
