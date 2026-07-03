/**
 * ScheduleCellStack — Inhalt einer Dienstplan-Zelle.
 *
 * Stellt MEHRERE Einträge pro MA/Tag gestapelt dar (V-1, Spec 6.7:
 * Dienst + Abwesenheit koexistent) und kennzeichnet generierte
 * Zyklusdienste (source==='cycle') dezent mit Schraffur + ↻ (APP-INT-4).
 * Sollplan-Einträge (schedule_type===1, Spec 4.12) erhalten in der
 * Soll-/Ist-Sicht ein dezentes „S" + gestrichelten Rahmen.
 */
import type { CSSProperties } from 'react';
import type { ScheduleEntry } from '../types';

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

const Farbbalken = ({ color }: { color?: string }) => (
  <span
    data-testid="farbbalken"
    className="block h-1.5 w-full rounded-sm"
    style={{ backgroundColor: color || '#64748b' }}
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

export function ScheduleCellStack({
  entries,
  modi = DEFAULT_DARSTELLUNG,
}: {
  entries: ScheduleEntry[];
  modi?: DarstellungsModi;
}) {
  if (entries.length === 0) return null;

  if (entries.length === 1) {
    const e = entries[0];
    const cycle = e.source === 'cycle';
    const soll = e.schedule_type === 1;
    const mode = modeFor(e, modi);
    if (mode === 'hintergrund') {
      // Zellhintergrund färbt die Zelle (Schedule.tsx); hier bewusst leer.
      return <span className="block min-h-[34px] sm:min-h-6" title={e.shift_name || e.leave_name || e.display_name || undefined} />;
    }
    if (mode === 'farbbalken' || mode === 'farbbalken_kuerzel') {
      return (
        <span
          className="px-0.5 py-1 flex flex-col items-stretch justify-center gap-0.5 min-h-[34px] sm:min-h-0"
          title={e.shift_name || e.leave_name || e.display_name || undefined}
        >
          {mode === 'farbbalken_kuerzel' && (
            <span className="font-bold text-[11px] leading-none text-center">
              {cycle && <span className="text-[8px] opacity-80" aria-hidden="true">↻</span>}
              {soll && <span className="text-[8px] opacity-80" aria-hidden="true">S</span>}
              {e.display_name || '?'}
            </span>
          )}
          <Farbbalken color={e.color_bk} />
        </span>
      );
    }
    return (
      <span
        className="px-0.5 py-1.5 sm:py-0.5 font-bold text-[11px] min-h-[34px] sm:min-h-0 flex items-center justify-center gap-0.5"
        style={{ color: e.color_text, ...(cycle ? CYCLE_HATCH : undefined), ...(soll ? SOLL_OUTLINE : undefined) }}
        title={[cycle ? CYCLE_TITLE : '', soll ? SOLL_TITLE : ''].filter(Boolean).join(' · ') || undefined}
      >
        {cycle && <span className="text-[8px] opacity-80" aria-hidden="true">↻</span>}
        {soll && <span className="text-[8px] opacity-80" aria-hidden="true">S</span>}
        {e.display_name || '?'}
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
              <Farbbalken color={e.color_bk} />
            </span>
          );
        }
        return (
          <span
            key={i}
            className="block rounded px-0.5 font-bold text-[10px] leading-4 truncate"
            style={{
              backgroundColor: e.color_bk || '#64748b',
              color: e.color_text || '#fff',
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
