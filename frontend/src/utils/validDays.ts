/**
 * 5XCHAR.VALIDDAYS weekday-mask helpers (Mon..Sun).
 *
 * The original stores the mask space-separated ("1 1 1 1 1 1 1"); the lib
 * normalizes writes to that canonical form. `parseValidDays` therefore splits on
 * whitespace (and falls back to reading a compact "1111111" token character by
 * character), while `validDaysToString` emits the 7-char compact form the API
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
