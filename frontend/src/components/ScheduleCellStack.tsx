/**
 * ScheduleCellStack — Inhalt einer Dienstplan-Zelle (Taktwerk-Chips).
 *
 * Stellt MEHRERE Einträge pro MA/Tag gestapelt dar (V-1, Spec 6.7:
 * Dienst + Abwesenheit koexistent) und kennzeichnet generierte
 * Zyklusdienste (source==='cycle') dezent mit Schraffur + ↻ (APP-INT-4).
 * Sollplan-Einträge (schedule_type===1, Spec 4.12) erhalten in der
 * Soll-/Ist-Sicht ein dezentes „S" + gestrichelten Rahmen.
 *
 * Chip-Anatomie (Design-System, docs/design-system.md §6):
 * - Dienste = massive Chips: DBF-Rohfarbe über shiftColor normalisiert
 *   (Hue bleibt, S/L-Schiene, Vordergrund per Kontrast), Phasenkerbe links
 *   (oben/Mitte/unten = Früh-/Tag-/Nachtdienst-Silhouette).
 * - Abwesenheiten = hohle Chips: gestrichelte Kontur, keine Füllung.
 * - Farblose Dienste = stille Typografie (nur Text in Schrift-2).
 * - Mehrfacheinträge = gestapelte Halbbalken in fixer Zellhöhe.
 */
import type { CSSProperties } from 'react';
import type { ScheduleEntry } from '../types';
import { shiftCellColorsMemo } from '../utils/shiftColor';
import { notchTopPx, type Phase } from '../utils/scheduleVisuals';

export const CYCLE_TITLE = 'aus Schichtmodell (Zyklus)';
export const SOLL_TITLE = 'Sollplan-Eintrag (Zielvorgabe)';

/** Felddarstellung wie der Original-Anpassen-Dialog (Kategorie „Felder"):
 *  Kürzel | Farbbalken | Farbbalken und Kürzel | nur Hintergrund färben.
 *  Balkenfarbe = color_bk (der Eintrags-Vertrag führt keine separate
 *  Balkenfarbe). Default 'kuerzel' = bisheriges Verhalten. */
export type FeldDarstellung = 'kuerzel' | 'farbbalken' | 'farbbalken_kuerzel' | 'hintergrund';
export interface DarstellungsModi {
  dienste: FeldDarstellung;
  abwesenheiten: FeldDarstellung;
}
export const DEFAULT_DARSTELLUNG: DarstellungsModi = { dienste: 'kuerzel', abwesenheiten: 'kuerzel' };

const modeFor = (e: ScheduleEntry, modi: DarstellungsModi): FeldDarstellung =>
  e.kind === 'absence' ? modi.abwesenheiten : modi.dienste;

const Farbbalken = ({ color, isDark }: { color?: string; isDark?: boolean }) => (
  <span
    data-testid="farbbalken"
    className="block h-1.5 w-full rounded-sm"
    style={{
      backgroundColor: color
        ? shiftCellColorsMemo(color, isDark ? 'dark' : 'light').background
        : undefined,
    }}
  />
);

const CYCLE_HATCH: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 2px, transparent 2px, transparent 6px)',
};

const SOLL_OUTLINE: CSSProperties = {
  outline: '1px dashed currentColor',
  outlineOffset: '-1px',
};

/** Phasenkerbe: 2×7px-Strich links im Dienst-Chip; Vertikalposition = Phase. */
const PhasenKerbe = ({ phase, isDark }: { phase: Phase; isDark?: boolean }) => (
  <span
    aria-hidden="true"
    className="absolute rounded-[1px] pointer-events-none"
    style={{
      left: 3,
      top: notchTopPx(phase, 25) - 2,
      width: 2,
      height: 7,
      background: isDark ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.85)',
    }}
  />
);

export function ScheduleCellStack({
  entries,
  modi = DEFAULT_DARSTELLUNG,
  isDark = false,
  phaseMap,
}: {
  entries: ScheduleEntry[];
  modi?: DarstellungsModi;
  isDark?: boolean;
  phaseMap?: Map<number, Phase>;
}) {
  if (entries.length === 0) return null;
  const theme = isDark ? 'dark' : 'light';

  if (entries.length === 1) {
    const e = entries[0];
    const cycle = e.source === 'cycle';
    const soll = e.schedule_type === 1;
    const mode = modeFor(e, modi);
    const title = [e.shift_name || e.leave_name || e.display_name || '', cycle ? CYCLE_TITLE : '', soll ? SOLL_TITLE : '']
      .filter(Boolean).join(' · ') || undefined;
    if (mode === 'hintergrund') {
      // Zellhintergrund färbt die Zelle (Schedule.tsx); hier bewusst leer.
      return <span className="block min-h-[34px] sm:min-h-6" title={title} />;
    }
    if (mode === 'farbbalken' || mode === 'farbbalken_kuerzel') {
      return (
        <span
          className="px-0.5 py-1 flex flex-col items-stretch justify-center gap-0.5 min-h-[34px] sm:min-h-0"
          title={title}
        >
          {mode === 'farbbalken_kuerzel' && (
            <span className="font-bold text-[11px] sm:text-[10px] leading-none text-center text-schrift">
              {cycle && <span className="text-[8px] opacity-80" aria-hidden="true">↻</span>}
              {soll && <span className="text-[8px] opacity-80" aria-hidden="true">S</span>}
              {e.display_name || '?'}
            </span>
          )}
          <Farbbalken color={e.color_bk} isDark={isDark} />
        </span>
      );
    }

    const label = e.display_name || '?';
    const marks = (
      <>
        {cycle && <span className="text-[8px] opacity-80" aria-hidden="true">↻</span>}
        {soll && <span className="text-[8px] opacity-80" aria-hidden="true">S</span>}
      </>
    );

    // Farbloser Eintrag: stille Typografie — kein Chip, keine Fläche.
    if (!e.color_bk) {
      return (
        <span
          className="px-0.5 font-semibold text-[11px] sm:text-[10px] min-h-[34px] sm:min-h-6 flex items-center justify-center gap-0.5 text-schrift-2"
          style={{ ...(cycle ? CYCLE_HATCH : undefined), ...(soll ? SOLL_OUTLINE : undefined) }}
          title={title}
        >
          {marks}
          {label}
        </span>
      );
    }

    // Abwesenheit: hohler Chip (gestrichelte Kontur, keine Füllung).
    if (e.kind === 'absence') {
      const tw = shiftCellColorsMemo(e.color_bk, theme, { hollow: true });
      return (
        <span className="flex items-center p-[2px] min-h-[34px] sm:min-h-0 sm:h-[23px]" title={title}>
          <span
            className="relative block w-full text-center font-bold overflow-hidden rounded-cell box-border text-[11px] sm:text-[9.5px] leading-[30px] sm:leading-[17px]"
            style={{
              border: `1.5px dashed ${tw.color}`,
              color: tw.color,
              ...(soll ? SOLL_OUTLINE : undefined),
            }}
          >
            {marks}
            {label}
          </span>
        </span>
      );
    }

    // Dienst: massiver Chip mit Phasenkerbe.
    const tw = shiftCellColorsMemo(e.color_bk, theme);
    const phase = phaseMap?.get(e.shift_id ?? -1);
    return (
      <span className="flex items-center p-[2px] min-h-[34px] sm:min-h-0 sm:h-[23px]" title={title}>
        <span
          className={`relative block w-full text-center font-bold overflow-hidden rounded-cell leading-[30px] sm:leading-[19px] ${label.length > 2 ? 'text-[9px] sm:text-[8px]' : 'text-[11px] sm:text-[10px]'}`}
          style={{
            backgroundColor: tw.background,
            color: tw.color,
            ...(cycle ? CYCLE_HATCH : undefined),
            ...(soll ? SOLL_OUTLINE : undefined),
          }}
        >
          {phase && <PhasenKerbe phase={phase} isDark={isDark} />}
          {marks}
          {label}
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-px p-0.5" data-testid="cell-stack">
      {entries.map((e, i) => {
        const cycle = e.source === 'cycle';
        const soll = e.schedule_type === 1;
        const mode = modeFor(e, modi);
        if (mode === 'farbbalken' || mode === 'hintergrund') {
          // Gestapelt: Balken je Eintrag (ohne Text); „nur Hintergrund" wird
          // im Stapel ebenfalls als Farbfläche gezeigt, sonst wäre der
          // Eintrag unsichtbar.
          return (
            <span key={i} title={e.shift_name || e.leave_name || e.display_name || ''} className="block px-0.5 py-0.5">
              <Farbbalken color={e.color_bk} isDark={isDark} />
            </span>
          );
        }
        const tw = e.color_bk ? shiftCellColorsMemo(e.color_bk, theme) : null;
        return (
          <span
            key={i}
            className="block rounded-sm px-0.5 font-bold text-[10px] sm:text-[7.5px] leading-4 sm:leading-[9px] truncate"
            style={{
              backgroundColor: tw?.background,
              color: tw ? tw.color : undefined,
              ...(cycle ? CYCLE_HATCH : undefined),
              ...(soll ? SOLL_OUTLINE : undefined),
            }}
            data-mode={mode}
            title={
              (e.shift_name || e.leave_name || e.display_name || '') +
              (cycle ? ` · ${CYCLE_TITLE}` : '') +
              (soll ? ` · ${SOLL_TITLE}` : '')
            }
          >
            {cycle && <span className="text-[8px] opacity-80" aria-hidden="true">↻ </span>}
            {soll && <span className="text-[8px] opacity-80" aria-hidden="true">S </span>}
            {e.display_name || '?'}
          </span>
        );
      })}
    </span>
  );
}
