/**
 * HTML-/CSS-Escaping für die Druck- und Export-Popups.
 *
 * Die Druck-/Export-Builder bauen HTML-Strings aus benutzer-editierbaren
 * Freitextfeldern (Namen, Kürzel, Funktionen, …) und schreiben sie via
 * `window.open(...).document.write(html)` in ein Popup. Ohne Escaping wird
 * ein Freitext wie `<img onerror=…>` als Markup interpretiert (DOM-XSS).
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Wandelt & < > " ' in HTML-Entities. null/undefined → '';
 * Zahlen und andere Werte werden über String() konvertiert.
 */
export function escapeHtml(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, ch => HTML_ENTITIES[ch]);
}

/**
 * Validiert eine CSS-Farbe für die Verwendung in `style="...${color}..."`.
 *
 * Erlaubt sind `#rgb`/`#rrggbb`-Hexwerte sowie reine CSS-Farbnamen
 * (Buchstaben). Alles andere (z. B. `red;}…` als CSS-Injection) fällt auf
 * `fallback` zurück.
 */
export function safeColor(v: unknown, fallback = 'inherit'): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s;
  return fallback;
}
