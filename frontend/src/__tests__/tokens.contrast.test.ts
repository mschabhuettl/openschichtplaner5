/**
 * Design-System-Tokens (UX-Audit B1): jede Text-auf-Fläche-Kombination der
 * --color-*-Paare muss WCAG AA erfüllen — in BEIDEN Modi. Der Test parst
 * index.css direkt: eine Token-Änderung, die Kontrast bricht, wird rot.
 * AA: 4.5:1 für normalen Text; text-subtle ist für dekorative Kleinst-
 * hinweise vorgesehen und muss 3:1 (AA large/UI) halten.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function blockVars(css: string, selector: string): Record<string, string> {
  const re = new RegExp(selector.replace('.', '\\.') + '\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const [, k, v] of m[1].matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[k] = v.trim();
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
const MODES = { light: blockVars(css, ':root'), dark: blockVars(css, 'html.dark') } as const;

const TEXT = ['--color-text', '--color-text2', '--color-text3', '--color-text-muted'];
const SURFACES = ['--color-surface', '--color-surface2', '--color-surface3', '--color-bg'];

describe('Token-Kontraste (WCAG AA)', () => {
  for (const [mode, vars] of Object.entries(MODES)) {
    it(`${mode}: Textfarben auf allen Flächen >= 4.5:1 (muted >= 4.5 auf surface)`, () => {
      const failures: string[] = [];
      for (const t of TEXT) {
        for (const s of SURFACES) {
          const r = ratio(vars[t], vars[s]);
          // muted ist Sekundärtext: AA normal auf den Hauptflächen
          if (r < 4.5) failures.push(`${t} auf ${s}: ${r.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });

    it(`${mode}: warn-text auf warn-bg/-badge >= 4.5:1; subtle >= 3:1 auf surface`, () => {
      expect(ratio(vars['--color-warn-text'], vars['--color-warn-bg'])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(vars['--color-warn-text'], vars['--color-warn-badge'])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(vars['--color-text-subtle'], vars['--color-surface'])).toBeGreaterThanOrEqual(3);
    });
  }
});
