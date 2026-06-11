/**
 * Tests für den Konflikt-Dialog (V-2, Spec 6.7):
 * - drei Entscheidungen: Zusätzlich / Ersetzen / Abbrechen
 * - „Zusätzlich" deaktivierbar (zweiter Dienst am selben Tag)
 * - merkbare Standard-Strategie in localStorage
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConflictDialog } from '../components/ConflictDialog';
import { getConflictStrategy, setConflictStrategy } from '../components/scheduleGridUtils';

describe('ConflictDialog', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  const renderDialog = (overrides: Partial<Parameters<typeof ConflictDialog>[0]> = {}) => {
    const onChoose = vi.fn();
    render(
      <ConflictDialog
        open
        existingLabels={['F']}
        incomingLabel="U – Urlaub"
        allowAdd
        onChoose={onChoose}
        {...overrides}
      />,
    );
    return onChoose;
  };

  it('zeigt vorhandene Einträge und den neuen Eintrag an', () => {
    renderDialog({ existingLabels: ['F', 'U'] });
    expect(screen.getByText('F, U')).toBeTruthy();
    expect(screen.getByText('U – Urlaub')).toBeTruthy();
  });

  it('„Zusätzlich eintragen" liefert add', () => {
    const onChoose = renderDialog();
    fireEvent.click(screen.getByText(/Zusätzlich eintragen/));
    expect(onChoose).toHaveBeenCalledWith('add', false);
  });

  it('„Vorhandene ersetzen" liefert replace', () => {
    const onChoose = renderDialog();
    fireEvent.click(screen.getByText(/Vorhandene ersetzen/));
    expect(onChoose).toHaveBeenCalledWith('replace', false);
  });

  it('„Abbrechen" liefert cancel', () => {
    const onChoose = renderDialog();
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onChoose).toHaveBeenCalledWith('cancel', false);
  });

  it('Escape bricht ab', () => {
    const onChoose = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onChoose).toHaveBeenCalledWith('cancel', false);
  });

  it('allowAdd=false deaktiviert „Zusätzlich eintragen"', () => {
    const onChoose = renderDialog({ allowAdd: false });
    const addBtn = screen.getByText(/Zusätzlich eintragen/).closest('button')!;
    expect(addBtn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(addBtn);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('„immer so"-Checkbox gibt remember=true weiter', () => {
    const onChoose = renderDialog();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText(/Vorhandene ersetzen/));
    expect(onChoose).toHaveBeenCalledWith('replace', true);
  });
});

describe('Konflikt-Strategie (localStorage)', () => {
  beforeEach(() => localStorage.clear());

  it('Default ist ask (immer fragen)', () => {
    expect(getConflictStrategy()).toBe('ask');
  });

  it('persistiert add/replace und liest sie zurück', () => {
    setConflictStrategy('replace');
    expect(getConflictStrategy()).toBe('replace');
    setConflictStrategy('add');
    expect(getConflictStrategy()).toBe('add');
  });

  it('ask entfernt die gespeicherte Strategie', () => {
    setConflictStrategy('replace');
    setConflictStrategy('ask');
    expect(getConflictStrategy()).toBe('ask');
    expect(localStorage.getItem('sp5-schedule-conflict-strategy')).toBeNull();
  });

  it('ignoriert ungültige gespeicherte Werte', () => {
    localStorage.setItem('sp5-schedule-conflict-strategy', 'kaputt');
    expect(getConflictStrategy()).toBe('ask');
  });
});
