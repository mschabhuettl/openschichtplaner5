/**
 * Import-Datei-Parsing (I-1): Encoding-Sniffing per BOM (UTF-16 LE/BE, UTF-8)
 * und Trennzeichen-Autodetect (Tab/Komma/Semikolon). Original-SP5-Exporte sind
 * Tab-getrennt und UTF-16-LE mit BOM (Spec 7.5/8.1).
 */

export type Separator = '\t' | ',' | ';';

/** Dekodiert Datei-Bytes: BOM-Sniffing → utf-16le/utf-16be/utf-8 (Fallback utf-8). */
export function decodeImportBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let encoding = 'utf-8';
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  const text = new TextDecoder(encoding).decode(buf);
  // BOM (als U+FEFF) entfernen — TextDecoder('utf-8') lässt das utf-8-BOM stehen
  return text.replace(/^\uFEFF/, '');
}

/** Zählt Vorkommen eines Zeichens außerhalb von doppelten Anführungszeichen. */
function countUnquoted(line: string, ch: string): number {
  let count = 0;
  let inQuote = false;
  for (const c of line) {
    if (c === '"') inQuote = !inQuote;
    else if (c === ch && !inQuote) count++;
  }
  return count;
}

/** Trennzeichen-Autodetect anhand der Kopfzeile: Tab > Semikolon > Komma bei Gleichstand. */
export function detectSeparator(text: string): Separator {
  const firstLine = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').find(l => l.trim()) ?? '';
  const candidates: Separator[] = ['\t', ';', ','];
  let best: Separator = ',';
  let bestCount = -1;
  for (const sep of candidates) {
    const n = countUnquoted(firstLine, sep);
    if (n > bestCount) { best = sep; bestCount = n; }
  }
  return bestCount > 0 ? best : ',';
}

/** Zerlegt Text in Kopfzeile + Datenzeilen (Quote-Handling wie bisheriges parseCSV). */
export function parseDelimited(text: string, sep: Separator): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === sep && !inQuote) {
        result.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result.map(v => v.trim());
  };

  const headers = splitLine(nonEmpty[0]);
  const rows = nonEmpty.slice(1).map(splitLine);
  return { headers, rows };
}

/** Baut kanonisches Komma-CSV (UTF-8) für den Upload an die Import-API. */
export function toCanonicalCSV(headers: string[], rows: string[][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers.map(esc).join(',')];
  for (const row of rows) {
    lines.push(headers.map((_, i) => esc(row[i] ?? '')).join(','));
  }
  return lines.join('\n');
}

/**
 * Farbwert-Validierung (Spec 8.2): #RRGGBB oder Dezimal-COLORREF (0..16777215).
 * Die Import-API akzeptiert beide Formen unverändert.
 */
export function isValidImportColor(value: string): boolean {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return true;
  if (/^\d{1,8}$/.test(value)) {
    const n = parseInt(value, 10);
    return n >= 0 && n <= 16777215;
  }
  return false;
}
