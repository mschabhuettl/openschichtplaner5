import { describe, it, expect } from 'vitest';
import { entryArt, reportGroupLabel, groupReportRows, withEmptyEmployees } from '../utils/reportRows';

describe('entryArt (A8: Datenbasis Soll/Ist im Listenbericht)', () => {
  it('benennt Dienst/Sonderdienst/Abwesenheit wie bisher', () => {
    expect(entryArt('shift', null, 0)).toBe('Dienst');
    expect(entryArt('shift', 'cycle', 0)).toBe('Dienst (Zyklus)');
    expect(entryArt('special_shift', null, 0)).toBe('Sonderdienst');
    expect(entryArt('absence', null, undefined)).toBe('Abwesenheit');
  });

  it('kennzeichnet Sollplan-Schichten (schedule_type=1)', () => {
    expect(entryArt('shift', null, 1)).toBe('Dienst · Soll');
    expect(entryArt('shift', 'cycle', 1)).toBe('Dienst (Zyklus) · Soll');
  });
});

describe('reportGroupLabel / groupReportRows (A8: Untergliederung KW/Monat)', () => {
  it('bildet Monats- und KW-Labels (ISO-8601)', () => {
    expect(reportGroupLabel('2026-06-15', 'month')).toBe('Juni 2026');
    expect(reportGroupLabel('2026-06-15', 'kw')).toBe('KW 25 · 2026');
    expect(reportGroupLabel('2026-12-31', 'kw')).toBe('KW 53 · 2026');
    expect(reportGroupLabel('2026-01-01', 'kw')).toBe('KW 01 · 2026');
    expect(reportGroupLabel('2026-06-15', 'none')).toBe('');
  });

  it('mode=none liefert genau eine Gruppe mit allen Zeilen', () => {
    const rows = [{ date: '2026-06-15' }, { date: '2026-07-02' }];
    expect(groupReportRows(rows, 'none')).toEqual([{ label: '', rows }]);
  });

  it('gruppiert datumssortierte Zeilen fortlaufend nach KW', () => {
    const rows = [{ date: '2026-06-15' }, { date: '2026-06-17' }, { date: '2026-06-22' }];
    const g = groupReportRows(rows, 'kw');
    expect(g.map(x => x.label)).toEqual(['KW 25 · 2026', 'KW 26 · 2026']);
    expect(g[0].rows).toHaveLength(2);
    expect(g[1].rows).toHaveLength(1);
  });

  it('gruppiert nach Monat über Monatsgrenzen', () => {
    const rows = [{ date: '2026-06-29' }, { date: '2026-07-01' }];
    expect(groupReportRows(rows, 'month').map(x => x.label)).toEqual(['Juni 2026', 'Juli 2026']);
  });
});

describe('withEmptyEmployees (A8: Nullzeilen)', () => {
  it('ohne showEmpty nur Mitarbeiter mit Einträgen', () => {
    expect(withEmptyEmployees([1, 3], [1, 2, 3, 4], false)).toEqual([1, 3]);
  });
  it('mit showEmpty auch Kandidaten ohne Einträge, ohne Duplikate', () => {
    expect(withEmptyEmployees([1, 3], [1, 2, 3, 4], true).sort()).toEqual([1, 2, 3, 4]);
  });
  it('mit showEmpty und ohne Kandidaten bleibt es bei den Einträgen', () => {
    expect(withEmptyEmployees([5], [], true)).toEqual([5]);
  });
});
