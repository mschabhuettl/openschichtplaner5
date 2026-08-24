/**
 * utils/auslastung — Auslastungsbereich-Optionen (Original-Spec 4.11.9-5/6):
 * - eigene Zusammenstellung: leere Auswahl = automatisch alle aktiven
 *   Schichtarten; Auswahl in Positions-Reihenfolge, auch inaktive Schichtarten
 * - Bedarfs-Unterzeile: Mindestbedarf, mit Maximalbedarf-Option „min–max"
 */
import { describe, it, expect } from 'vitest';
import { zusammenstellungZeilen, bedarfZellText } from '../utils/auslastung';

const F = { ID: 1 };
const S = { ID: 2 };
const N = { ID: 3 };
const alle = [F, S, N]; // Positions-Reihenfolge

describe('zusammenstellungZeilen', () => {
  it('leere Auswahl = automatisch alle aktiven Schichtarten (heutiges Bild)', () => {
    expect(zusammenstellungZeilen([F, S], alle, [])).toEqual([F, S]);
  });

  it('Auswahl zeigt genau die gewählten Schichtarten — auch inaktive', () => {
    expect(zusammenstellungZeilen([F, S], alle, [3])).toEqual([N]);
  });

  it('behält die Positions-Reihenfolge von „alle" unabhängig von der Auswahl-Reihenfolge', () => {
    expect(zusammenstellungZeilen([], alle, [3, 1])).toEqual([F, N]);
  });

  it('ignoriert unbekannte IDs in der Auswahl', () => {
    expect(zusammenstellungZeilen([F], alle, [2, 99])).toEqual([S]);
  });
});

describe('bedarfZellText', () => {
  it('zeigt den Mindestbedarf ohne Maximalbedarf-Option', () => {
    expect(bedarfZellText({ min: 2, max: 4 }, false)).toBe('2');
  });

  it('zeigt „min–max" mit Maximalbedarf-Option (Spec 4.11.9-6)', () => {
    expect(bedarfZellText({ min: 2, max: 4 }, true)).toBe('2–4');
  });

  it('leer bei fehlendem Soll oder 0/0-Soll (wie Tooltip „kein Soll")', () => {
    expect(bedarfZellText(undefined, false)).toBe('');
    expect(bedarfZellText({ min: 0, max: 0 }, false)).toBe('');
    expect(bedarfZellText({ min: 0, max: 0 }, true)).toBe('');
  });

  it('min=0 mit max>0 ist echtes Soll und wird angezeigt', () => {
    expect(bedarfZellText({ min: 0, max: 3 }, false)).toBe('0');
    expect(bedarfZellText({ min: 0, max: 3 }, true)).toBe('0–3');
  });
});
