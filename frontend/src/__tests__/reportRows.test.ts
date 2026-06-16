import { describe, it, expect } from 'vitest';
import { entryArt } from '../utils/reportRows';

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
