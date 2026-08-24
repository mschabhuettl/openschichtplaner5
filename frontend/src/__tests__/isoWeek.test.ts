/**
 * Unit-Tests für die ISO-8601-Kalenderwoche (Spec 4.11) — aus Schedule.tsx
 * extrahiert. Kritisch sind die Jahreswechsel (W52/W53/W01).
 */
import { describe, it, expect } from 'vitest';
import { getISOWeek } from '../utils/isoWeek';

describe('getISOWeek', () => {
  it('Jahreswechsel in W53: 2020/21 gehört bis So 3.1. zur KW 53', () => {
    expect(getISOWeek(2020, 12, 31)).toBe(53); // Do
    expect(getISOWeek(2021, 1, 1)).toBe(53);   // Fr → noch KW 53 des ISO-Jahres 2020
    expect(getISOWeek(2021, 1, 3)).toBe(53);   // So
    expect(getISOWeek(2021, 1, 4)).toBe(1);    // Mo → KW 1
  });

  it('Jahreswechsel in W52: 1.1.2022 (Sa) ist KW 52', () => {
    expect(getISOWeek(2022, 1, 1)).toBe(52);
    expect(getISOWeek(2022, 1, 3)).toBe(1); // Mo
  });

  it('KW 1 beginnt im Vorjahr: Mo 30.12.2024 ist bereits KW 1', () => {
    expect(getISOWeek(2024, 12, 29)).toBe(52); // So
    expect(getISOWeek(2024, 12, 30)).toBe(1);  // Mo
  });

  it('53-Wochen-Jahre: Mo 28.12.2026 und So 3.1.2027 sind KW 53', () => {
    expect(getISOWeek(2026, 12, 28)).toBe(53);
    expect(getISOWeek(2027, 1, 3)).toBe(53);
    expect(getISOWeek(2027, 1, 4)).toBe(1);
    expect(getISOWeek(2015, 12, 28)).toBe(53);
  });

  it('KW-Kopf-Vertrag: Montage liefern die im Tageskopf gezeigte KW', () => {
    // Dienstplan zeigt „KW{n}" nur an Montagen — Januar 2026: 5., 12., 19., 26.
    expect([5, 12, 19, 26].map(d => getISOWeek(2026, 1, d))).toEqual([2, 3, 4, 5]);
    expect(getISOWeek(2026, 1, 1)).toBe(1);  // Do 1.1.2026 → KW 1 (kein Kopf, aber KW stimmt)
    expect(getISOWeek(2026, 8, 24)).toBe(35); // Mo mitten im Jahr
  });
});
