/**
 * utils/scheduleFilter — Mengen-Semantik der Dienstplan-Filter (Spec 4.7):
 * - leeres Array = „Alle" (kein Filter)
 * - Einzel- und Mehrfachauswahl innerhalb einer Dimension = ODER
 * - Kombination der drei Dimensionen (Schicht/Abwesenheit/Arbeitsplatz) = UND
 */
import { describe, it, expect } from 'vitest';
import { idInSelection, rowMatchesScheduleFilters } from '../utils/scheduleFilter';

describe('idInSelection', () => {
  it('leere Auswahl trifft nie aktiv (leer = „Alle" wird eine Ebene höher behandelt)', () => {
    expect(idInSelection([], 1)).toBe(false);
    expect(idInSelection([], undefined)).toBe(false);
  });

  it('trifft nur enthaltene Werte; null/undefined nie', () => {
    expect(idInSelection([1, 3], 3)).toBe(true);
    expect(idInSelection([1, 3], 2)).toBe(false);
    expect(idInSelection([1, 3], null)).toBe(false);
    expect(idInSelection([1, 3], undefined)).toBe(false);
  });
});

describe('rowMatchesScheduleFilters', () => {
  const entries = [
    { shift_id: 1, workplace_id: 10 },
    { shift_id: 2 },
    { leave_type_id: 5 },
  ];

  it('leer = Alle: ohne aktive Auswahl passt jede Zeile', () => {
    expect(rowMatchesScheduleFilters(entries, [], [], [])).toBe(true);
    expect(rowMatchesScheduleFilters([], [], [], [])).toBe(true);
  });

  it('Einzelauswahl je Dimension', () => {
    expect(rowMatchesScheduleFilters(entries, [1], [], [])).toBe(true);
    expect(rowMatchesScheduleFilters(entries, [3], [], [])).toBe(false);
    expect(rowMatchesScheduleFilters(entries, [], [5], [])).toBe(true);
    expect(rowMatchesScheduleFilters(entries, [], [6], [])).toBe(false);
    expect(rowMatchesScheduleFilters(entries, [], [], [10])).toBe(true);
    expect(rowMatchesScheduleFilters(entries, [], [], [11])).toBe(false);
  });

  it('Mehrfachauswahl innerhalb einer Dimension = ODER', () => {
    expect(rowMatchesScheduleFilters(entries, [2, 3], [], [])).toBe(true);
    expect(rowMatchesScheduleFilters(entries, [3, 4], [], [])).toBe(false);
  });

  it('Kombination der Dimensionen = UND', () => {
    // Schicht 1 UND Abwesenheit 5 vorhanden → sichtbar
    expect(rowMatchesScheduleFilters(entries, [1], [5], [])).toBe(true);
    // Schicht 1 vorhanden, Abwesenheit 6 fehlt → ausgeblendet
    expect(rowMatchesScheduleFilters(entries, [1], [6], [])).toBe(false);
    // Abwesenheit 5 vorhanden, Schicht 3 fehlt → ausgeblendet
    expect(rowMatchesScheduleFilters(entries, [3], [5], [])).toBe(false);
    // Alle drei Dimensionen aktiv und getroffen
    expect(rowMatchesScheduleFilters(entries, [1], [5], [10])).toBe(true);
    expect(rowMatchesScheduleFilters(entries, [1], [5], [11])).toBe(false);
  });
});
