/**
 * Zentrale Lesbarkeits-Funktion für farbige Flächen (Design-System, B3 im
 * UX-Audit): wählt zu einer beliebigen Hintergrundfarbe die lesbare
 * Vordergrundfarbe (schwarz/weiß). Gleiche Formel und Schwelle wie die
 * Server-Seite (sp5lib.color_utils.is_light_color: Rec.-601-Luminanz > 0.5),
 * damit FE und Berichte identisch entscheiden.
 */

/** Parst '#RGB'/'#RRGGBB' zu (r, g, b); ungültige Werte gelten als Weiß. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '').trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16), g = parseInt(h[1] + h[1], 16), b = parseInt(h[2] + h[2], 16);
    if ([r, g, b].every(Number.isFinite)) return [r, g, b];
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].every(Number.isFinite)) return [r, g, b];
  }
  return [255, 255, 255];
}

/** True bei heller Farbe (dunklen Text verwenden) — Rec.-601, Schwelle 0.5. */
export function isLightColor(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

/** Lesbare Textfarbe zu beliebigem Hintergrund: '#111827' (dunkel) oder '#ffffff'. */
export function readableTextColor(bgHex: string): string {
  return isLightColor(bgHex) ? '#111827' : '#ffffff';
}
