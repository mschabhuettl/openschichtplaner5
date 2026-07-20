/**
 * Taktwerk-Farb-Algorithmus (utils/shiftColor.ts): Nutzerfarben aus der DBF
 * werden nie roh gerendert — Hue bleibt, S/L auf Schiene, Vordergrund per
 * WCAG-Kontrast. Diese Suite fixiert die Design-Garantien:
 * - Voll-Chip (normalize + bestForeground) besteht AA (>= 4.5:1) für JEDEN Hue
 * - Hohl-Chip-Farbe hält >= 3:1 (UI-Grenze) auf der Ebene-Fläche beider Modi
 * - spreadHues spreizt Kollisionen deterministisch auf >= 14° Abstand
 * - Memo-Cache liefert identische Objekte für identische Eingaben
 */
import { describe, it, expect } from 'vitest';
import {
  hexToHsl,
  hslToHex,
  contrastRatio,
  bestForeground,
  normalize,
  hollow,
  tint,
  spine,
  spreadHues,
  normalizeSpread,
  shiftCellColors,
  shiftCellColorsMemo,
  type Theme,
} from '../utils/shiftColor';

const THEMES: Theme[] = ['light', 'dark'];
const LAYER = { light: '#ffffff', dark: '#111927' } as const;

describe('shiftColor: Voll-Chip AA-Garantie', () => {
  it('normalize+bestForeground >= 4.5:1 für alle Hues (Volltonfarben, beide Modi)', () => {
    const failures: string[] = [];
    for (const theme of THEMES) {
      for (let h = 0; h < 360; h += 1) {
        const raw = hslToHex(h, 100, 50); // typische DBF-Volltonfarbe
        const { background, color, ratio, isHollow } = shiftCellColors(raw, theme);
        if (isHollow) failures.push(`${theme} h=${h}: unerwartet hohl`);
        if (ratio < 4.5) failures.push(`${theme} h=${h}: ${background}/${color} = ${ratio.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('achromatische Rohfarben (weiß/schwarz/grau) bleiben grau auf der Schiene', () => {
    for (const theme of THEMES) {
      for (const raw of ['#ffffff', '#000000', '#808080', '#fefefe', '#010101']) {
        const { ratio } = shiftCellColors(raw, theme);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
        // Achromat-Regel: keine Färbung (S=0), Helligkeit fix auf der Schiene
        const [, s, l] = hexToHsl(normalize(raw, theme));
        expect(Math.round(s)).toBe(0);
        expect(Math.round(l)).toBe(theme === 'dark' ? 37 : 38);
      }
    }
  });

  it('Achromat kollidiert nicht mit echtem Rot (ZA #808080 vs. Kr #FF0000)', () => {
    for (const theme of THEMES) {
      expect(normalize('#808080', theme)).not.toBe(normalize('#ff0000', theme));
      const [, sHollow] = hexToHsl(hollow('#808080', theme));
      expect(Math.round(sHollow)).toBe(0);
    }
  });
});

describe('shiftColor: Hohl-Chip (Abwesenheiten)', () => {
  it('hollow-Farbe >= 3:1 auf der Ebene-Fläche für alle Hues, beide Modi', () => {
    const failures: string[] = [];
    for (const theme of THEMES) {
      for (let h = 0; h < 360; h += 1) {
        const c = hollow(hslToHex(h, 100, 50), theme);
        const r = contrastRatio(c, LAYER[theme]);
        if (r < 3) failures.push(`${theme} h=${h}: ${c} = ${r.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('shiftCellColors mit hollow: transparenter Hintergrund + Konturfarbe', () => {
    const v = shiftCellColors('#ff0000', 'light', { hollow: true });
    expect(v.isHollow).toBe(true);
    expect(v.background).toBe('transparent');
    expect(v.color).toBe(hollow('#ff0000', 'light'));
  });
});

describe('shiftColor: Tint/Spine liefern hue-treue Modus-Werte', () => {
  it('tint/spine behalten den Hue und nutzen die spezifizierten S/L-Werte', () => {
    const raw = hslToHex(200, 100, 50);
    expect(tint(raw, 'light')).toBe(hslToHex(200, 45, 94));
    expect(tint(raw, 'dark')).toBe(hslToHex(200, 30, 16));
    expect(spine(raw, 'light')).toBe(hslToHex(200, 55, 42));
    expect(spine(raw, 'dark')).toBe(hslToHex(200, 50, 55));
  });
});

describe('shiftColor: Kollisions-Spreizung', () => {
  it('Hues < 14° Abstand werden auf >= 14° gespreizt (deterministisch)', () => {
    const raws = [hslToHex(10, 100, 50), hslToHex(12, 100, 50), hslToHex(20, 100, 50)];
    const a = spreadHues(raws);
    const b = spreadHues([...raws].reverse());
    const hues = [...a.values()].sort((x, y) => x - y);
    for (let i = 1; i < hues.length; i++) {
      expect(hues[i] - hues[i - 1]).toBeGreaterThanOrEqual(14 - 1e-9);
    }
    // deterministisch: Eingabereihenfolge egal
    for (const [k, v] of a) expect(b.get(k)).toBe(v);
  });

  it('ausreichend getrennte Hues bleiben unverändert', () => {
    const r1 = hslToHex(0, 100, 50);
    const r2 = hslToHex(120, 100, 50);
    const m = spreadHues([r1, r2]);
    expect(m.get(r1)).toBeCloseTo(0, 5);
    expect(m.get(r2)).toBeCloseTo(120, 5);
  });

  it('normalizeSpread nutzt den gespreizten Hue', () => {
    const r1 = hslToHex(10, 100, 50);
    const r2 = hslToHex(11, 100, 50);
    const m = spreadHues([r1, r2]);
    expect(normalizeSpread(r2, 'light', m)).toBe(hslToHex(m.get(r2)!, 52, 38));
  });
});

describe('shiftColor: Grundbausteine', () => {
  it('bestForeground wählt die kontrastreichere Ink-Farbe', () => {
    expect(bestForeground('#ffffff')).toBe('#131315');
    expect(bestForeground('#000000')).toBe('#ffffff');
  });

  it('hexToHsl/hslToHex sind rundlauf-stabil für Volltöne', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#ffff00']) {
      const [h, s, l] = hexToHsl(hex);
      expect(hslToHex(h, s, l).toLowerCase()).toBe(hex);
    }
  });
});

describe('shiftColor: Memoisierung', () => {
  it('liefert für identische Eingaben dasselbe Objekt (Referenz-Gleichheit)', () => {
    const a = shiftCellColorsMemo('#ff8800', 'dark');
    const b = shiftCellColorsMemo('#ff8800', 'dark');
    expect(b).toBe(a);
    // hollow ist ein eigener Cache-Schlüssel
    const c = shiftCellColorsMemo('#ff8800', 'dark', { hollow: true });
    expect(c).not.toBe(a);
    expect(c.isHollow).toBe(true);
  });
});
