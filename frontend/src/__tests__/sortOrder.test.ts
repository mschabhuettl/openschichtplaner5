/**
 * Zentrale Sortierregeln (Design-System, UX-Audit B2) — original-treu:
 * MA nach Name→Vorname, Stammdaten nach POSITION, Tageskontext nach
 * Beginnzeit→Name.
 */
import { describe, it, expect } from 'vitest';
import { byNameFirstname, byPosition, byStartTimeThenName, deCompare } from '../utils/sortOrder';

describe('sortOrder', () => {
  it('byNameFirstname: Name vor Vorname, deutsch kollationiert', () => {
    const list = [
      { NAME: 'Müller', FIRSTNAME: 'Zoe' },
      { NAME: 'Maier', FIRSTNAME: 'Anna' },
      { NAME: 'Müller', FIRSTNAME: 'Anna' },
    ].sort(byNameFirstname);
    expect(list.map(e => `${e.NAME},${e.FIRSTNAME}`)).toEqual([
      'Maier,Anna', 'Müller,Anna', 'Müller,Zoe',
    ]);
  });

  it('byPosition: POSITION zuerst, Name als Tiebreaker', () => {
    const rows = [
      { POSITION: 2, NAME: 'Spät' },
      { POSITION: 1, NAME: 'Früh' },
      { POSITION: 2, NAME: 'Nacht' },
    ].sort(byPosition);
    expect(rows.map(r => r.NAME)).toEqual(['Früh', 'Nacht', 'Spät']);
  });

  it('byStartTimeThenName: Beginnzeit, ohne Zeit ans Ende, dann Name', () => {
    const rows = [
      { start_min: 720, name: 'B' },
      { start_min: null, name: 'Z' },
      { start_min: 360, name: 'A' },
      { start_min: 720, name: 'A' },
    ].sort(byStartTimeThenName);
    expect(rows.map(r => r.name)).toEqual(['A', 'A', 'B', 'Z']);
  });

  it('deCompare: deutsche Kollation (ä bei a)', () => {
    expect(['Zorn', 'Ärger', 'Apfel'].sort((a, b) => deCompare(a, b))).toEqual(['Apfel', 'Ärger', 'Zorn']);
  });
});
