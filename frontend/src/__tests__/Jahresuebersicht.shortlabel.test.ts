/**
 * Jahresplan-Matrix (Befund 9): Zellen bleiben gleich groß — Zell-Labels werden
 * aufs Kürzel begrenzt (freie Sonderdienst-Kurznamen wie „N-CT 5:45-15:45"
 * dürfen die Zellbreite nicht sprengen; Original zeigt fixe Matrix-Zellen).
 */
import { describe, it, expect } from 'vitest';
import { shortLabel } from '../components/jahresRasterUtils';

describe('shortLabel', () => {
  it('kürzt Sonderdienst-Langnamen aufs erste Token', () => {
    expect(shortLabel('N-CT 5:45-15:45')).toBe('N-CT');
    expect(shortLabel('SD 08:00-16:00')).toBe('SD');
  });
  it('lässt echte Kürzel unverändert', () => {
    expect(shortLabel('BO')).toBe('BO');
    expect(shortLabel('NACHTBEREIT-WE')).toBe('NACHTBEREIT-WE');
  });
  it('ist robust bei Leerwerten', () => {
    expect(shortLabel('')).toBe('?');
    expect(shortLabel('   ')).toBe('?');
  });
});
