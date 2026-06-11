/**
 * Tests für Import-Encoding-/Trennzeichen-Sniffing (I-1) und
 * Dezimal-COLORREF-Farbwerte (Spec 8.2).
 */
import { describe, it, expect } from 'vitest';
import {
  decodeImportBuffer,
  detectSeparator,
  parseDelimited,
  toCanonicalCSV,
  isValidImportColor,
} from '../utils/importParsing';

function utf16leWithBOM(s: string): ArrayBuffer {
  const buf = new Uint8Array(2 + s.length * 2);
  buf[0] = 0xff;
  buf[1] = 0xfe;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    buf[2 + i * 2] = code & 0xff;
    buf[3 + i * 2] = code >> 8;
  }
  return buf.buffer;
}

function utf8(s: string, withBOM = false): ArrayBuffer {
  const body = new TextEncoder().encode(s);
  if (!withBOM) return body.buffer as ArrayBuffer;
  const buf = new Uint8Array(3 + body.length);
  buf.set([0xef, 0xbb, 0xbf], 0);
  buf.set(body, 3);
  return buf.buffer;
}

describe('decodeImportBuffer', () => {
  it('dekodiert UTF-16-LE mit BOM (Original-Export)', () => {
    const text = 'NAME\tKURZZEICHEN\nFrühschicht\tF';
    expect(decodeImportBuffer(utf16leWithBOM(text))).toBe(text);
  });

  it('dekodiert UTF-8 mit BOM und entfernt das BOM', () => {
    expect(decodeImportBuffer(utf8('NAME,FARBE\nSpät,33023', true))).toBe('NAME,FARBE\nSpät,33023');
  });

  it('dekodiert UTF-8 ohne BOM (Fallback)', () => {
    expect(decodeImportBuffer(utf8('a,b\n1,2'))).toBe('a,b\n1,2');
  });
});

describe('detectSeparator', () => {
  it('erkennt Tab (TSV, Spec-Format 8.1)', () => {
    expect(detectSeparator('NAME\tKURZZEICHEN\tFARBE\nF\tF\t1')).toBe('\t');
  });

  it('erkennt Semikolon', () => {
    expect(detectSeparator('NAME;KURZZEICHEN;FARBE\nF;F;1')).toBe(';');
  });

  it('erkennt Komma', () => {
    expect(detectSeparator('NAME,KURZZEICHEN,FARBE\nF,F,1')).toBe(',');
  });

  it('ignoriert Trennzeichen innerhalb von Anführungszeichen', () => {
    expect(detectSeparator('"NAME;MIT;SEMIKOLONS"\tFARBE\nx\ty')).toBe('\t');
  });

  it('fällt auf Komma zurück, wenn kein Trennzeichen vorkommt', () => {
    expect(detectSeparator('NAME\nFrüh')).toBe(',');
  });
});

describe('parseDelimited', () => {
  it('parst TSV-Zeilen', () => {
    const { headers, rows } = parseDelimited('NAME\tFARBE\nFrüh\t16744448\nSpät\t33023', '\t');
    expect(headers).toEqual(['NAME', 'FARBE']);
    expect(rows).toEqual([['Früh', '16744448'], ['Spät', '33023']]);
  });

  it('behandelt Anführungszeichen mit eingebettetem Trennzeichen', () => {
    const { rows } = parseDelimited('A;B\n"x;y";z', ';');
    expect(rows).toEqual([['x;y', 'z']]);
  });
});

describe('toCanonicalCSV', () => {
  it('erzeugt Komma-CSV mit Quoting für Sonderzeichen', () => {
    const csv = toCanonicalCSV(['NAME', 'NOTIZ'], [['Früh', 'mit, Komma'], ['Spät', 'mit "Quote"']]);
    expect(csv).toBe('NAME,NOTIZ\nFrüh,"mit, Komma"\nSpät,"mit ""Quote"""');
  });

  it('füllt fehlende Zellen mit Leerstring', () => {
    expect(toCanonicalCSV(['A', 'B'], [['1']])).toBe('A,B\n1,');
  });

  it('Roundtrip TSV/UTF-16 → kanonisches CSV', () => {
    const original = 'NAME\tFARBE\nFrühschicht\t16744448';
    const text = decodeImportBuffer(utf16leWithBOM(original));
    const sep = detectSeparator(text);
    const { headers, rows } = parseDelimited(text, sep);
    expect(toCanonicalCSV(headers, rows)).toBe('NAME,FARBE\nFrühschicht,16744448');
  });
});

describe('isValidImportColor (Spec 8.2)', () => {
  it('akzeptiert #RRGGBB', () => {
    expect(isValidImportColor('#4A90D9')).toBe(true);
  });

  it('akzeptiert Dezimal-COLORREF 0..16777215', () => {
    expect(isValidImportColor('0')).toBe(true);
    expect(isValidImportColor('33023')).toBe(true);
    expect(isValidImportColor('16777215')).toBe(true);
  });

  it('lehnt zu große Zahlen und Unsinn ab', () => {
    expect(isValidImportColor('16777216')).toBe(false);
    expect(isValidImportColor('#FFF')).toBe(false);
    expect(isValidImportColor('blau')).toBe(false);
    expect(isValidImportColor('-1')).toBe(false);
  });
});
