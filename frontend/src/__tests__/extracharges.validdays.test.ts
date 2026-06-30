/**
 * Regression (P2-5 / Punkt 32): „Zeitzuschläge hinzufügen ohne Wirkung."
 *
 * Die 5XCHAR.VALIDDAYS-Maske wird im Original LEER-GETRENNT gespeichert
 * ("1 1 1 1 1 1 1"). `parseValidDays` las sie früher Zeichen für Zeichen, sodass
 * die Leerzeichen (Index 1/3/5/…) als „aus" interpretiert wurden → beim Bearbeiten
 * eines bestehenden Zuschlags zeigte der Dialog falsche Wochentage. Jetzt wird auf
 * Whitespace getrennt; die Kompaktform bleibt als Rückfall lesbar.
 */

import { describe, it, expect } from 'vitest';
import { parseValidDays, validDaysToString } from '../utils/validDays';

describe('parseValidDays', () => {
  it('reads the canonical space-separated original mask correctly', () => {
    expect(parseValidDays('1 1 1 1 1 1 1')).toEqual([true, true, true, true, true, true, true]);
    // Samstag (Index 5) only — must NOT be misread because of the spaces.
    expect(parseValidDays('0 0 0 0 0 1 0')).toEqual([false, false, false, false, false, true, false]);
    expect(parseValidDays('1 1 1 1 1 0 0')).toEqual([true, true, true, true, true, false, false]);
  });

  it('still reads the compact form (older data)', () => {
    expect(parseValidDays('1111111')).toEqual([true, true, true, true, true, true, true]);
    expect(parseValidDays('0000010')).toEqual([false, false, false, false, false, true, false]);
  });

  it('empty mask → all days off', () => {
    expect(parseValidDays('')).toEqual([false, false, false, false, false, false, false]);
  });
});

describe('validDaysToString', () => {
  it('emits the 7-char compact form the API accepts (^[01]{7}$)', () => {
    expect(validDaysToString([true, true, true, true, true, true, true])).toBe('1111111');
    expect(validDaysToString([false, false, false, false, false, true, false])).toBe('0000010');
    expect(/^[01]{7}$/.test(validDaysToString([true, false, true, false, true, false, true]))).toBe(true);
  });

  it('round-trips through the canonical space-separated form', () => {
    const days = [true, false, true, true, false, false, true];
    // Frontend writes compact; the backend normalizes to spaced; read back must match.
    const spaced = validDaysToString(days).split('').join(' ');
    expect(parseValidDays(spaced)).toEqual(days);
  });
});
