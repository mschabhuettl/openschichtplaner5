/** Tests für die 5XCHAR.VALIDDAYS-Wochentagsmaske (Mo..So) — Doppelformat-Parsing. */
import { describe, it, expect } from 'vitest';
import { parseValidDays, validDaysToString } from '../utils/validDays';

describe('parseValidDays', () => {
  it('leer → alle sieben false', () => {
    expect(parseValidDays('')).toEqual(new Array(7).fill(false));
  });

  it('leerzeichengetrennte Form (kanonisch)', () => {
    expect(parseValidDays('1 1 1 1 1 1 1')).toEqual(new Array(7).fill(true));
    expect(parseValidDays('1 0 1 0 1 0 0')).toEqual([true, false, true, false, true, false, false]);
  });

  it('kompakte 7-Zeichen-Form', () => {
    expect(parseValidDays('1111111')).toEqual(new Array(7).fill(true));
    expect(parseValidDays('1010100')).toEqual([true, false, true, false, true, false, false]);
  });

  it('Teilangabe füllt fehlende Tage mit false (beide Formen)', () => {
    expect(parseValidDays('1 0 1')).toEqual([true, false, true, false, false, false, false]);
    expect(parseValidDays('101')).toEqual([true, false, true, false, false, false, false]);
  });

  it('überlange kompakte Form wird auf 7 Tage abgeschnitten', () => {
    expect(parseValidDays('11111111')).toEqual(new Array(7).fill(true));
  });
});

describe('validDaysToString', () => {
  it('bool-Array → kompakte 0/1-Kette', () => {
    expect(validDaysToString(new Array(7).fill(true))).toBe('1111111');
    expect(validDaysToString([true, false, true, false, true, false, false])).toBe('1010100');
  });

  it('kappt auf 7 Tage', () => {
    expect(validDaysToString(new Array(10).fill(true))).toBe('1111111');
  });

  it('Round-Trip parse→string ist stabil (kanonische kompakte Form)', () => {
    for (const mask of ['1101001', '0000000', '1111111', '1000001']) {
      expect(validDaysToString(parseValidDays(mask))).toBe(mask);
    }
  });
});
