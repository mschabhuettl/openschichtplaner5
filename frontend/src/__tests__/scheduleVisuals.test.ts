/**
 * Taktwerk-Visual-Logik (utils/scheduleVisuals.ts): Phasenkerbe, Tagbogen,
 * Zeitfaden und Saldo-Format sind Design-Verträge der Referenzansicht —
 * die Fixpunkte stammen aus der Design-Referenz (Juli: Tageslicht 05:20–20:50
 * → Stops 22/27/82/87; 14:32 am 2. Juli → Zeitfaden x=245).
 */
import { describe, it, expect } from 'vitest';
import {
  phaseForStart,
  notchTopPx,
  tagbogenStops,
  tagbogenGradient,
  sunTimesForMonth,
  zeitfadenLeft,
  formatSaldo,
} from '../utils/scheduleVisuals';

describe('phaseForStart', () => {
  it('ordnet Dienstbeginn den Phasen zu (Grenzfälle)', () => {
    expect(phaseForStart(2 * 60 + 59)).toBe('nacht');  // 02:59
    expect(phaseForStart(3 * 60)).toBe('frueh');       // 03:00
    expect(phaseForStart(9 * 60 + 59)).toBe('frueh');  // 09:59
    expect(phaseForStart(10 * 60)).toBe('mitte');      // 10:00
    expect(phaseForStart(14 * 60 + 59)).toBe('mitte'); // 14:59
    expect(phaseForStart(15 * 60)).toBe('spaet');      // 15:00
    expect(phaseForStart(20 * 60 + 59)).toBe('spaet'); // 20:59
    expect(phaseForStart(21 * 60)).toBe('nacht');      // 21:00
    expect(phaseForStart(0)).toBe('nacht');            // 00:00
  });

  it('unbekannter Beginn → Mitte', () => {
    expect(phaseForStart(null)).toBe('mitte');
    expect(phaseForStart(Number.NaN)).toBe('mitte');
  });
});

describe('notchTopPx', () => {
  it('Referenz-Zeilenhöhe 25px: früh 4 / Mitte+spät 10 / nacht 15', () => {
    expect(notchTopPx('frueh', 25)).toBe(4);
    expect(notchTopPx('mitte', 25)).toBe(10);
    expect(notchTopPx('spaet', 25)).toBe(10);
    expect(notchTopPx('nacht', 25)).toBe(15);
  });

  it('kompakt 22px: proportional gerundet, ganzzahlig', () => {
    for (const p of ['frueh', 'mitte', 'spaet', 'nacht'] as const) {
      const v = notchTopPx(p, 22);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeLessThan(notchTopPx(p, 25) + 1);
    }
    expect(notchTopPx('frueh', 22)).toBe(4);
    expect(notchTopPx('nacht', 22)).toBe(13);
  });
});

describe('Tagbogen', () => {
  it('Juli-Fixpunkt: 05:20/20:50 → Stops 22/27/82/87', () => {
    expect(tagbogenStops(320, 1250)).toEqual({ nightEnd: 22, dayStart: 27, dayEnd: 82, nightStart: 87 });
  });

  it('Gradient-String exakt im Referenzformat', () => {
    expect(tagbogenGradient(320, 1250, '#dfe3ea', '#f2d49a')).toBe(
      'linear-gradient(90deg, #dfe3ea 0 22%, #f2d49a 27% 82%, #dfe3ea 87% 100%)',
    );
  });

  it('sunTimesForMonth: Juli = Referenzwerte; alle Monate plausibel geordnet', () => {
    expect(sunTimesForMonth(7)).toEqual({ sunriseMin: 320, sunsetMin: 1250 });
    for (let m = 1; m <= 12; m++) {
      const { sunriseMin, sunsetMin } = sunTimesForMonth(m);
      expect(sunriseMin).toBeGreaterThan(0);
      expect(sunsetMin).toBeGreaterThan(sunriseMin);
      expect(sunsetMin).toBeLessThan(1440);
    }
  });
});

describe('zeitfadenLeft', () => {
  it('Referenz-Fixpunkt: 2. Juli (Index 1), 14:32 → 245px', () => {
    expect(zeitfadenLeft(1, 14 * 60 + 32)).toBe(245);
  });

  it('Tagesanfang liegt exakt auf der Spaltenkante', () => {
    expect(zeitfadenLeft(0, 0)).toBe(178);
    expect(zeitfadenLeft(2, 0)).toBe(178 + 2 * 42);
  });
});

describe('formatSaldo', () => {
  it('Vorzeichen, Dezimal-Komma, U+2212 als Minus', () => {
    expect(formatSaldo(3.5)).toBe('+3,5');
    expect(formatSaldo(-2)).toBe('−2,0');
    expect(formatSaldo(0)).toBe('+0,0');
    expect(formatSaldo(10.25)).toBe('+10,3');
  });
});
