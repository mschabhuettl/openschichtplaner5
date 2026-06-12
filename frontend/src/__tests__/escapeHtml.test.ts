/**
 * Tests für das HTML-/CSS-Escaping der Druck-/Export-Popups (DOM-XSS-Schutz).
 */
import { describe, it, expect } from 'vitest';
import { escapeHtml, safeColor } from '../utils/escapeHtml';

describe('escapeHtml', () => {
  it('entschärft ein Script-Tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('entschärft img-onerror-Markup', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
  });

  it('escaped Anführungszeichen (doppelt und einfach)', () => {
    expect(escapeHtml(`"a" 'b'`)).toBe('&quot;a&quot; &#39;b&#39;');
  });

  it('escaped das kaufmännische Und', () => {
    expect(escapeHtml('Müller & Co')).toBe('Müller &amp; Co');
  });

  it('liefert leeren String bei null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('konvertiert Zahlen über String()', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(0)).toBe('0');
  });

  it('lässt harmlosen Text unverändert', () => {
    expect(escapeHtml('Max Mustermann')).toBe('Max Mustermann');
  });
});

describe('safeColor', () => {
  it('akzeptiert #rgb und #rrggbb', () => {
    expect(safeColor('#abc')).toBe('#abc');
    expect(safeColor('#A1B2C3')).toBe('#A1B2C3');
  });

  it('akzeptiert reine CSS-Farbnamen', () => {
    expect(safeColor('red')).toBe('red');
    expect(safeColor('DarkBlue')).toBe('DarkBlue');
  });

  it('fällt bei CSS-Injection auf den Fallback zurück', () => {
    expect(safeColor('red;}body{display:none')).toBe('inherit');
    expect(safeColor('#fff;background:url(x)')).toBe('inherit');
    expect(safeColor('expression(alert(1))')).toBe('inherit');
  });

  it('nutzt den angegebenen Fallback', () => {
    expect(safeColor(null, '#000')).toBe('#000');
    expect(safeColor(42, '#000')).toBe('#000');
  });
});
