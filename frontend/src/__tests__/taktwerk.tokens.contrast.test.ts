/**
 * Taktwerk-Token (index.css): die verbindlichen Light/Dark-Paare des
 * Design-Systems. Der Test parst die CSS direkt und fixiert die
 * Kontrast-Garantien der Token-Kombinationen, wie das Design sie nutzt:
 * - Primärtext (schrift) auf allen Flächen >= 4.5:1
 * - Sekundärtext (schrift-2) auf Grund/Ebene >= 4.5:1
 * - Labels/Platzhalter (schrift-3) auf Ebene >= 3:1 (UI-Grenze)
 * - Signal als Textfarbe auf Ebene >= 4.5:1
 * - Chip-/Flächen-Kombinationen (glut-ink auf glut, glut auf glut-flaeche,
 *   signal auf signal-flaeche) >= 3:1 (fette Kompakt-Typo/UI)
 * Eine Token-Änderung, die eine Garantie bricht, macht die Suite rot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Sammelt --vars über ALLE Blöcke des Selektors (mehrere :root-Blöcke). */
function collectVars(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp('(?:^|\\n)' + selector.replace('.', '\\.') + '\\s*\\{([^}]*)\\}', 'g');
  for (const block of css.matchAll(re)) {
    for (const [, k, v] of block[1].matchAll(/(--[a-z][a-z0-9-]*)\s*:\s*([^;]+);/g)) {
      out[k] = v.trim();
    }
  }
  return out;
}

function srgb(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function ratio(fg: string, bg: string): number {
  const l1 = luminance(fg), l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const MODES = {
  light: collectVars(css, ':root'),
  dark: collectVars(css, 'html.dark'),
} as const;

const TAKTWERK = [
  '--grund', '--ebene', '--ebene-2', '--rail', '--kontur', '--kontur-soft',
  '--wash', '--schrift', '--schrift-2', '--schrift-3', '--glut',
  '--glut-flaeche', '--glut-ink', '--signal', '--signal-flaeche',
];

describe('Taktwerk-Token: Vollständigkeit', () => {
  for (const [mode, vars] of Object.entries(MODES)) {
    it(`${mode}: alle 15 Token als Hex definiert`, () => {
      const missing = TAKTWERK.filter((t) => !/^#[0-9a-f]{6}$/i.test(vars[t] ?? ''));
      expect(missing).toEqual([]);
    });
  }
});

describe('Taktwerk-Token: Kontrast-Garantien', () => {
  for (const [mode, vars] of Object.entries(MODES)) {
    it(`${mode}: schrift auf allen Flächen >= 4.5:1`, () => {
      const failures: string[] = [];
      for (const s of ['--grund', '--ebene', '--ebene-2', '--rail', '--wash', '--glut-flaeche']) {
        const r = ratio(vars['--schrift'], vars[s]);
        if (r < 4.5) failures.push(`--schrift auf ${s}: ${r.toFixed(2)}`);
      }
      expect(failures).toEqual([]);
    });

    it(`${mode}: schrift-2 >= 4.5:1 auf Grund/Ebene; schrift-3 >= 3:1 auf Ebene`, () => {
      expect(ratio(vars['--schrift-2'], vars['--grund'])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(vars['--schrift-2'], vars['--ebene'])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(vars['--schrift-3'], vars['--ebene'])).toBeGreaterThanOrEqual(3);
    });

    it(`${mode}: signal als Text auf Ebene >= 4.5:1`, () => {
      expect(ratio(vars['--signal'], vars['--ebene'])).toBeGreaterThanOrEqual(4.5);
    });

    it(`${mode}: Chip-/Flächen-Kombinationen >= 3:1`, () => {
      expect(ratio(vars['--glut-ink'], vars['--glut'])).toBeGreaterThanOrEqual(3);
      expect(ratio(vars['--glut'], vars['--glut-flaeche'])).toBeGreaterThanOrEqual(3);
      expect(ratio(vars['--glut'], vars['--ebene'])).toBeGreaterThanOrEqual(3);
      expect(ratio(vars['--signal'], vars['--signal-flaeche'])).toBeGreaterThanOrEqual(3);
    });
  }
});
