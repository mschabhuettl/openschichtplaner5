/**
 * Taktwerk — Farb-Algorithmus für Mitarbeiter-/Schichtfarben.
 * Nutzerfarben (roh aus der DBF) werden NIE direkt gerendert:
 * Hue bleibt erhalten, Sättigung/Helligkeit werden pro Modus auf eine
 * Schiene gesetzt, der Vordergrund wird per WCAG-Kontrast berechnet.
 *
 * Produktionsfertig, keine Dependencies. Ergebnisse memoisieren!
 */

export type Theme = 'light' | 'dark';

// ── Basis: Hex ↔ RGB ↔ HSL ──────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const x = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + x(r) + x(g) + x(b);
}

/** HSL mit h∈[0,360), s,l∈[0,100] */
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = (((h % 360) + 360) % 360) / 360; s /= 100; l /= 100;
  const f = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
  }
  return rgbToHex(r * 255, g * 255, b * 255);
}

// ── WCAG-Kontrast ───────────────────────────────────────────────────

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a), l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const INK_DARK = '#131315';
const INK_LIGHT = '#ffffff';

/** Kontrastsicherer Vordergrund für beliebige Fläche — nie Text-Farbe hart setzen. */
export function bestForeground(bg: string): string {
  return contrastRatio(bg, INK_DARK) >= contrastRatio(bg, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}

// ── Normalisierung (der Kern) ───────────────────────────────────────

/**
 * Achromat-Sonderfall: (nahezu) graue Rohfarben haben keinen Farbton — die
 * Hue-Schiene würde sie rot einfärben und mit echten Rot-Tönen kollidieren
 * (z. B. Zeitausgleich #808080 ununterscheidbar von Krank #FF0000). Die
 * Wiedererkennungs-Regel gilt sinngemäß: der Graue bleibt grau (S=0).
 */
const ACHROMATIC_MAX_S = 8;

function hueSat(raw: string, s: number): [number, number] {
  const [h, rawS] = hexToHsl(raw);
  return rawS < ACHROMATIC_MAX_S ? [0, 0] : [h, s];
}

/**
 * AA-Nachführung: für Grün-/Cyan-Hues erreicht die nominelle Schiene mit
 * keinem der beiden Ink-Töne 4.5:1 (light worst 4.34, dark 4.31) — die
 * zugesicherte Garantie „Text besteht überall AA" hat Vorrang vor dem
 * nominellen L-Wert: L wird nur für diese Hues in 1%-Schritten abgesenkt,
 * bis der beste Vordergrund AA erreicht (max. −2%).
 */
function railHex(h: number, s: number, l: number): string {
  let hex = hslToHex(h, s, l);
  while (contrastRatio(hex, bestForeground(hex)) < 4.5 && l > 20) {
    l -= 1;
    hex = hslToHex(h, s, l);
  }
  return hex;
}

/** Dienst-Chip-Fläche: Hue bleibt, S/L auf Schiene. Text besteht AA (≥4.5:1). */
export function normalize(raw: string, theme: Theme): string {
  const [h, s] = hueSat(raw, theme === 'dark' ? 46 : 52);
  return railHex(h, s, theme === 'dark' ? 37 : 38);
}

/** Abwesenheiten (hohl): Kontur-/Textfarbe für gestrichelte Chips auf Ebene-Hintergrund. */
export function hollow(raw: string, theme: Theme): string {
  const [h, s] = hueSat(raw, theme === 'dark' ? 55 : 60);
  return theme === 'dark' ? hslToHex(h, s, 66) : hslToHex(h, s, 34);
}

/** Tint-Fläche (Zeilenköpfe, Personen-Badges) — Text darauf = normale Schrift-Token. */
export function tint(raw: string, theme: Theme): string {
  const [h, s] = hueSat(raw, theme === 'dark' ? 30 : 45);
  return theme === 'dark' ? hslToHex(h, s, 16) : hslToHex(h, s, 94);
}

/** 3px-Spine (Kante an Zeilenköpfen, Listen, Legenden). */
export function spine(raw: string, theme: Theme): string {
  const [h, s] = hueSat(raw, theme === 'dark' ? 50 : 55);
  return theme === 'dark' ? hslToHex(h, s, 55) : hslToHex(h, s, 42);
}

// ── Kollisions-Spreizung ────────────────────────────────────────────

const MIN_HUE_GAP = 14;

/**
 * Wählen zwei Nutzer fast denselben Farbton, werden die Töne deterministisch
 * gespreizt (aufsteigend nach Hue sortiert, dann nach vorn geschoben, bis
 * jede Lücke ≥ 14° ist). Einmal pro Farbliste anwenden, Ergebnis cachen —
 * gibt Map rawHex → effektiver Hue zurück, den normalize* unten nutzt.
 */
export function spreadHues(raws: string[]): Map<string, number> {
  const entries = [...new Set(raws)]
    .filter((raw) => hexToHsl(raw)[1] >= ACHROMATIC_MAX_S) // Achromaten besetzen keinen Farbton
    .map((raw) => ({ raw, h: hexToHsl(raw)[0] }))
    .sort((a, b) => a.h - b.h);
  for (let i = 1; i < entries.length; i++) {
    const gap = entries[i].h - entries[i - 1].h;
    if (gap < MIN_HUE_GAP) entries[i].h = entries[i - 1].h + MIN_HUE_GAP;
  }
  return new Map(entries.map((e) => [e.raw, e.h % 360]));
}

/** normalize() mit gespreiztem Hue aus spreadHues(). */
export function normalizeSpread(raw: string, theme: Theme, hues: Map<string, number>): string {
  const [h0, s] = hueSat(raw, theme === 'dark' ? 46 : 52);
  const h = s === 0 ? h0 : hues.get(raw) ?? h0;
  return railHex(h, s, theme === 'dark' ? 37 : 38);
}

// ── Komfort: fertiges Style-Paket für eine Zelle ────────────────────

export interface ShiftCellColors {
  background: string;
  color: string;
  /** true → gestrichelter Hohl-Chip statt Füllung (Abwesenheit) */
  isHollow: boolean;
  /** Kontrast der Kombination (Debug/QA) */
  ratio: number;
}

export function shiftCellColors(raw: string, theme: Theme, opts?: { hollow?: boolean }): ShiftCellColors {
  if (opts?.hollow) {
    const c = hollow(raw, theme);
    const layer = theme === 'dark' ? '#111927' : '#ffffff';
    return { background: 'transparent', color: c, isHollow: true, ratio: contrastRatio(c, layer) };
  }
  const bg = normalize(raw, theme);
  const fg = bestForeground(bg);
  return { background: bg, color: fg, isHollow: false, ratio: contrastRatio(bg, fg) };
}

// ── Memoisierung ────────────────────────────────────────────────────
// Der Algorithmus läuft sonst tausendfach pro Render (30+ MA × 31 Tage).
// Cache pro (rawColor, theme, hollow) — Rohfarben-Menge ist klein (Schicht-
// arten + MA-Farben), der Cache bleibt daher begrenzt.

const cellCache = new Map<string, ShiftCellColors>();

export function shiftCellColorsMemo(raw: string, theme: Theme, opts?: { hollow?: boolean }): ShiftCellColors {
  const key = `${raw}|${theme}|${opts?.hollow ? 1 : 0}`;
  let v = cellCache.get(key);
  if (!v) {
    v = shiftCellColors(raw, theme, opts);
    cellCache.set(key, v);
  }
  return v;
}
