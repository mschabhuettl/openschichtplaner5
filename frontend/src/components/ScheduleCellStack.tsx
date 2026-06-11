/**
 * ScheduleCellStack — Inhalt einer Dienstplan-Zelle.
 *
 * Stellt MEHRERE Einträge pro MA/Tag gestapelt dar (V-1, Spec 6.7:
 * Dienst + Abwesenheit koexistent) und kennzeichnet generierte
 * Zyklusdienste (source==='cycle') dezent mit Schraffur + ↻ (APP-INT-4).
 */
import type { CSSProperties } from 'react';
import type { ScheduleEntry } from '../types';

export const CYCLE_TITLE = 'aus Schichtmodell (Zyklus)';

const CYCLE_HATCH: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 2px, transparent 2px, transparent 6px)',
};

export function ScheduleCellStack({ entries }: { entries: ScheduleEntry[] }) {
  if (entries.length === 0) return null;

  if (entries.length === 1) {
    const e = entries[0];
    const cycle = e.source === 'cycle';
    return (
      <span
        className="px-0.5 py-1.5 sm:py-0.5 font-bold text-[11px] min-h-[34px] sm:min-h-0 flex items-center justify-center gap-0.5"
        style={{ color: e.color_text, ...(cycle ? CYCLE_HATCH : undefined) }}
        title={cycle ? CYCLE_TITLE : undefined}
      >
        {cycle && <span className="text-[8px] opacity-80" aria-hidden="true">↻</span>}
        {e.display_name || '?'}
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-px p-0.5" data-testid="cell-stack">
      {entries.map((e, i) => {
        const cycle = e.source === 'cycle';
        return (
          <span
            key={i}
            className="block rounded px-0.5 font-bold text-[10px] leading-4 truncate"
            style={{
              backgroundColor: e.color_bk || '#64748b',
              color: e.color_text || '#fff',
              ...(cycle ? CYCLE_HATCH : undefined),
            }}
            title={
              (e.shift_name || e.leave_name || e.display_name || '') +
              (cycle ? ` · ${CYCLE_TITLE}` : '')
            }
          >
            {cycle && <span className="text-[8px] opacity-80" aria-hidden="true">↻ </span>}
            {e.display_name || '?'}
          </span>
        );
      })}
    </span>
  );
}
