/**
 * 5XCHAR.VALIDDAYS weekday-mask helpers (Mon..Sun).
 *
 * Das Original speichert die Maske leerzeichengetrennt ("1 1 1 1 1 1 1"); die lib
 * normalizes writes to that canonical form. `parseValidDays` therefore splits on
 * toleriert Leerraum (und fällt aufs zeichenweise Lesen eines kompakten
 * "1111111"-Tokens zurück), während `validDaysToString` die kompakte 7-Zeichen-Form der API
 * model accepts (^[01]{7}$).
 */

export function parseValidDays(validdays: string): boolean[] {
  const result: boolean[] = new Array(7).fill(false);
  if (!validdays) return result;
  const tokens = validdays.trim().split(/\s+/);
  const flags = tokens.length > 1 ? tokens : Array.from(tokens[0] ?? '');
  for (let i = 0; i < 7 && i < flags.length; i++) {
    result[i] = flags[i] === '1';
  }
  return result;
}

export function validDaysToString(days: boolean[]): string {
  return days.slice(0, 7).map(v => (v ? '1' : '0')).join('');
}
