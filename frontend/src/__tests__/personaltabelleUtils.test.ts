/**
 * Unit-Tests für die Personaltabellen-Ansichts-Helfer (Spec 4.11.12-1/2):
 * robustes Laden der gespeicherten Ansicht und Spalten-Filterlogik
 * (Namensspalte immer sichtbar, unbekannte Keys unschädlich).
 */
import { describe, it, expect } from 'vitest';
import {
  ladeAnsicht,
  sichtbareSpalten,
  NAME_SPALTE,
} from '../pages/personaltabelleUtils';

const cols = [
  { key: NAME_SPALTE },
  { key: 'employee_short' },
  { key: 'saldo' },
  { key: 'shift_1' },
];

describe('ladeAnsicht', () => {
  it('liefert ohne gespeicherten Wert den Default (nichts versteckt, MA-Farben aus)', () => {
    expect(ladeAnsicht(null)).toEqual({ versteckt: [], maFarben: false });
  });

  it('fällt bei ungültigem JSON auf den Default zurück', () => {
    expect(ladeAnsicht('kein json {')).toEqual({ versteckt: [], maFarben: false });
    expect(ladeAnsicht('"nur-ein-string"')).toEqual({ versteckt: [], maFarben: false });
    expect(ladeAnsicht('null')).toEqual({ versteckt: [], maFarben: false });
  });

  it('filtert fremde Typen und die Namensspalte aus der Negativliste', () => {
    const geladen = ladeAnsicht(
      JSON.stringify({ versteckt: ['saldo', 5, NAME_SPALTE, null], maFarben: 1 })
    );
    expect(geladen.versteckt).toEqual(['saldo']);
    expect(geladen.maFarben).toBe(false); // nur echtes true zählt
  });

  it('lädt eine gespeicherte Ansicht unverändert zurück (Roundtrip)', () => {
    const ansicht = { versteckt: ['saldo', 'shift_1'], maFarben: true };
    expect(ladeAnsicht(JSON.stringify(ansicht))).toEqual(ansicht);
  });
});

describe('sichtbareSpalten', () => {
  it('lässt ohne Abwahl alle Spalten sichtbar', () => {
    expect(sichtbareSpalten(cols, [])).toEqual(cols);
  });

  it('blendet abgewählte Spalten aus', () => {
    expect(sichtbareSpalten(cols, ['saldo', 'shift_1']).map(c => c.key)).toEqual([
      NAME_SPALTE,
      'employee_short',
    ]);
  });

  it('behält die Namensspalte auch bei (fehlerhafter) Abwahl immer', () => {
    expect(sichtbareSpalten(cols, [NAME_SPALTE]).map(c => c.key)).toEqual(
      cols.map(c => c.key)
    );
  });

  it('ignoriert unbekannte/entfallene Spalten-Keys', () => {
    expect(sichtbareSpalten(cols, ['gibt_es_nicht', 'leave_99'])).toEqual(cols);
  });
});
