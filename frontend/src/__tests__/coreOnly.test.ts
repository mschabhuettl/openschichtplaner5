/** Tests für den SP5_CORE_ONLY Routen-Klassifikator (Nav-Filter + Routen-Guard). */
import { describe, it, expect } from 'vitest';
import { isExtraPath, EXTRA_ROUTE_PATHS } from '../utils/coreOnly';

describe('isExtraPath', () => {
  it('exakter EXTRA-Pfad → true', () => {
    expect(isExtraPath('/health')).toBe(true);
    expect(isExtraPath('/teamkalender')).toBe(true);
    expect(isExtraPath('/analytics')).toBe(true);
  });

  it('Unterpfad eines EXTRA-Pfads → true', () => {
    expect(isExtraPath('/health/details')).toBe(true);
    expect(isExtraPath('/companies/42/edit')).toBe(true);
  });

  it('Grenzfall: Pfad der nur ein PRÄFIX teilt ist KEIN EXTRA-Pfad', () => {
    // '/healthy' darf nicht als EXTRA '/health' gelten (sonst im Core-Modus
    // fälschlich versteckt). Der "+ '/'"-Grenzabgleich schützt davor.
    expect(isExtraPath('/healthy')).toBe(false);
    expect(isExtraPath('/teams')).toBe(false); // teilt Präfix mit '/team'
  });

  it('Core-Pfade → false', () => {
    expect(isExtraPath('/dienstplan')).toBe(false);
    expect(isExtraPath('/')).toBe(false);
    expect(isExtraPath('/employees')).toBe(false);
  });
});

describe('EXTRA_ROUTE_PATHS', () => {
  it('alle Einträge beginnen mit "/" und sind eindeutig', () => {
    expect(EXTRA_ROUTE_PATHS.every(p => p.startsWith('/'))).toBe(true);
    expect(new Set(EXTRA_ROUTE_PATHS).size).toBe(EXTRA_ROUTE_PATHS.length);
  });
});
