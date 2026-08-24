/**
 * Unit-Tests für die Gruppen-Schnittmenge (Spec 4.6.3) — aus Schedule.tsx
 * extrahierte pure Helferfunktion.
 */
import { describe, it, expect } from 'vitest';
import { intersectGroupMembers } from '../utils/groupFilter';

const emps = [{ ID: 1 }, { ID: 2 }, { ID: 3 }];
const members = new Map<number, Set<number>>([
  [10, new Set([1, 2])],
  [20, new Set([2, 3])],
]);

describe('intersectGroupMembers', () => {
  it('Schnittmenge: nur Mitglieder ALLER Gruppen (keine Vereinigung)', () => {
    // Vereinigung von 10 und 20 wäre {1, 2, 3} — Schnittmenge ist nur {2}
    expect(intersectGroupMembers(emps, [10, 20], members)).toEqual([{ ID: 2 }]);
  });

  it('einzelne Gruppe: alle Mitglieder in Eingabe-Reihenfolge', () => {
    expect(intersectGroupMembers(emps, [20], members)).toEqual([{ ID: 2 }, { ID: 3 }]);
  });

  it('unbekannte Gruppe (ohne Mitgliedermenge) leert die Schnittmenge', () => {
    expect(intersectGroupMembers(emps, [10, 99], members)).toEqual([]);
  });

  it('erhält die Reihenfolge der Eingabeliste', () => {
    const reversed = [...emps].reverse();
    expect(intersectGroupMembers(reversed, [10], members)).toEqual([{ ID: 2 }, { ID: 1 }]);
  });
});
