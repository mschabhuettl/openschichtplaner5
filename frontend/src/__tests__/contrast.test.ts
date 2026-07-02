/**
 * Design-System-Kontrastfunktion (UX-Audit B3): identische Entscheidung wie
 * sp5lib.color_utils.is_light_color (Rec.-601-Luminanz, Schwelle 0.5).
 */
import { describe, it, expect } from 'vitest';
import { hexToRgb, isLightColor, readableTextColor } from '../utils/contrast';

describe('contrast', () => {
  it('hexToRgb parst #RRGGBB und #RGB; Müll wird Weiß', () => {
    expect(hexToRgb('#FF0000')).toEqual([255, 0, 0]);
    expect(hexToRgb('#0f0')).toEqual([0, 255, 0]);
    expect(hexToRgb('kaputt')).toEqual([255, 255, 255]);
    expect(hexToRgb('')).toEqual([255, 255, 255]);
  });

  it('isLightColor entspricht der Server-Formel (Beispiele beidseitig geprüft)', () => {
    expect(isLightColor('#FFFFFF')).toBe(true);   // Weiß → hell
    expect(isLightColor('#000000')).toBe(false);  // Schwarz → dunkel
    expect(isLightColor('#FFFF00')).toBe(true);   // Gelb (lum 0.886)
    expect(isLightColor('#0000FF')).toBe(false);  // Blau (lum 0.114)
    expect(isLightColor('#FF0000')).toBe(false);  // Rot (lum 0.299)
    expect(isLightColor('#00FF00')).toBe(true);   // Grün (lum 0.587)
  });

  it('readableTextColor: dunkler Text auf hell, weißer auf dunkel', () => {
    expect(readableTextColor('#FFFF99')).toBe('#111827');
    expect(readableTextColor('#1e3a8a')).toBe('#ffffff');
  });
});
