/**
 * P-VOLLERFASSUNG Lücke #23: getMonthlyReportUrl hängt den optionalen
 * Berichtstitel und Fußtext als Query-Parameter an — und nur, wenn gesetzt.
 */
import { describe, it, expect } from 'vitest';
import { api } from '../api/client';

describe('getMonthlyReportUrl title/footer', () => {
  it('nimmt title und footer auf, wenn gesetzt', () => {
    const url = api.getMonthlyReportUrl(2026, 1, 'pdf', undefined, 'Quartalsbericht Q2', 'Vertraulich');
    const qs = new URL(url, 'http://localhost').searchParams;
    expect(qs.get('title')).toBe('Quartalsbericht Q2');
    expect(qs.get('footer')).toBe('Vertraulich');
    expect(qs.get('format')).toBe('pdf');
  });

  it('lässt title/footer weg, wenn leer oder nur Leerzeichen', () => {
    const url = api.getMonthlyReportUrl(2026, 1, 'pdf', undefined, '   ', '');
    const qs = new URL(url, 'http://localhost').searchParams;
    expect(qs.has('title')).toBe(false);
    expect(qs.has('footer')).toBe(false);
  });
});
