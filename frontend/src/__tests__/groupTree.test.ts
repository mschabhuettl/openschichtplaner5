/**
 * Gruppen-Dropdowns baumgerecht (Befund 18): Optionen folgen der
 * SUPERID-Hierarchie (Tiefensuche, Kinder alphabetisch, Einrückung je Ebene) —
 * wie die Baumstruktur der Original-Gruppenauswahl.
 */
import { describe, it, expect } from 'vitest';
import { groupTreeOptions } from '../utils/groupTree';
const g = (ID: number, NAME: string, SUPERID = 0) => ({ ID, NAME, SUPERID });

describe('groupTreeOptions', () => {
  it('ordnet Kinder unter ihre Eltern (DFS, alphabetisch) mit Einrückung', () => {
    const groups = [
      g(1, 'Alle Mitarbeiter'),
      g(61, 'Produktion', 1), g(2, 'Team A', 61), g(54, 'Team B', 61),
      g(53, 'Verwaltung', 1), g(63, 'Vertrieb', 53),
    ];
    const opts = groupTreeOptions(groups);
    expect(opts.map(o => o.name)).toEqual([
      'Alle Mitarbeiter', 'Produktion', 'Team A', 'Team B', 'Verwaltung', 'Vertrieb',
    ]);
    expect(opts.map(o => o.depth)).toEqual([0, 1, 2, 2, 1, 2]);
    expect(opts[2].label).toContain('└ Team A');
  });

  it('behandelt Waisen und Zyklen als Wurzeln (nichts geht verloren)', () => {
    const groups = [g(5, 'Waise', 999), g(7, 'Zyklus A', 8), g(8, 'Zyklus B', 7)];
    const opts = groupTreeOptions(groups);
    expect(opts.map(o => o.id).sort()).toEqual([5, 7, 8]);
  });
});
