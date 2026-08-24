/**
 * Pure Hilfsfunktionen für die Personaltabelle — Ansichts-Optionen wie das
 * Original (Spec 4.11.12): Spaltenauswahl (Nr. 1) und Option „individuelle
 * Farben" (Nr. 2).
 */

/** localStorage-Schlüssel der Personaltabellen-Ansicht (Stil der sp5_-App-Schlüssel). */
export const PERSONALTABELLE_ANSICHT_KEY = 'sp5_personaltabelle_ansicht';

/** Key der immer vorhandenen, nicht abwählbaren Namensspalte (Spec 4.11.12-1). */
export const NAME_SPALTE = 'employee_name';

export interface PersonaltabelleAnsicht {
  /**
   * Keys der abgewählten Spalten. Gespeichert wird die Negativliste, damit
   * neue/unbekannte Spalten (z. B. neu angelegte Schicht-/Abwesenheitsarten)
   * automatisch sichtbar sind; Keys entfallener Spalten bleiben unschädlich.
   */
  versteckt: string[];
  /** Option „individuelle Farben" (Spec 4.11.12-2) — Default aus. */
  maFarben: boolean;
}

/**
 * Gespeicherte Ansicht robust laden: ungültiges JSON, fremde Typen und die
 * (nie abwählbare) Namensspalte fallen auf den Default zurück bzw. heraus.
 */
export function ladeAnsicht(raw: string | null): PersonaltabelleAnsicht {
  const def: PersonaltabelleAnsicht = { versteckt: [], maFarben: false };
  if (!raw) return def;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return def;
    const p = parsed as Partial<PersonaltabelleAnsicht>;
    return {
      versteckt: Array.isArray(p.versteckt)
        ? p.versteckt.filter((k): k is string => typeof k === 'string' && k !== NAME_SPALTE)
        : [],
      maFarben: p.maFarben === true,
    };
  } catch {
    return def;
  }
}

/**
 * Spaltensatz um die abgewählten Spalten reduzieren; die Namensspalte bleibt
 * immer erhalten (Spec 4.11.12-1). Unbekannte Keys in `versteckt` sind wirkungslos.
 */
export function sichtbareSpalten<T extends { key: string }>(
  cols: T[],
  versteckt: readonly string[]
): T[] {
  const set = new Set(versteckt);
  return cols.filter(c => c.key === NAME_SPALTE || !set.has(c.key));
}
