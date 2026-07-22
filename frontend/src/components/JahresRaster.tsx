/**
 * JahresRaster — Jahres-Tagesraster eines Mitarbeiters (V-8, Spec 4.4).
 *
 * 12 Zeilen (Monate) × 31 Spalten (Kalendertage 1…31, Spec 4.11.11-1a);
 * Geometrie fix nach Taktwerk §11 (03-primitives): Monatsspalte 34px,
 * Tageszellen 21×20px — der Zellinhalt darf die Zellgröße nie variieren
 * (Befund 9). Einzeleinträge füllen die Zelle als Chip (Rohfarbe über
 * shiftColor normalisiert, Vordergrund berechnet); die Chip-Fuge entsteht
 * als innenliegende 1,5px-Linie in Panelfarbe (box-shadow inset) statt
 * über Margin. Abwesenheiten sind hohle Ringe, Wochenenden/Feiertage/Heute
 * dezent getönt; Zyklusdienste (source==='cycle') tragen ↻ + Schraffur
 * (APP-INT-4), Mehrfacheinträge stapeln über ScheduleCellStack.
 *
 * Bewusste Web-Abweichung zum Original (Spec R6.1-1): Eintragen/Löschen
 * direkt im Jahresraster gibt es NICHT — ein Klick auf eine Zelle
 * navigiert stattdessen in den Dienstplan des jeweiligen Monats, wo die
 * volle Bearbeitung zur Verfügung steht.
 */
import type { CSSProperties } from 'react';
import type { ScheduleEntry } from '../types';
import { ScheduleCellStack, CYCLE_TITLE, SOLL_TITLE } from './ScheduleCellStack';
import { shiftCellColorsMemo } from '../utils/shiftColor';
import { MONTH_ABBR, daysInMonth, toDateStr, shortLabel } from './jahresRasterUtils';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Schraffur für Zyklusdienste — gleiche Optik wie der Dienstplan-Chip. */
const CYCLE_HATCH: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 2px, transparent 2px, transparent 6px)',
};

export function JahresRaster({
  year,
  dayMap,
  holidays,
  onMonthClick,
}: {
  year: number;
  /** Einträge des ausgewählten Mitarbeiters, Schlüssel "YYYY-MM-DD" (buildDayMap). */
  dayMap: Map<string, ScheduleEntry[]>;
  holidays: Set<string>;
  onMonthClick: (month: number) => void;
}) {
  const now = new Date();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
  // Theme provider-frei, Muster der Menü-Chips in Schedule.tsx
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const theme = isDark ? 'dark' : 'light';

  return (
    <div className="overflow-x-auto">
      {/* Feste Geometrie (Taktwerk §11): 34px + 31×21px — gleich große
          Tagesspalten wie im Original (Befund 9) */}
      <table className="border-collapse table-fixed w-[685px]" data-testid="jahresraster">
        <colgroup>
          <col style={{ width: 34 }} />
          {DAYS.map(d => <col key={d} style={{ width: 21 }} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-ebene px-1 pb-[3px] text-left text-[7.5px] font-bold uppercase tracking-[.08em] text-schrift-3">
              Monat
            </th>
            {DAYS.map(d => (
              <th scope="col" key={d} className="pb-[3px] text-center font-mono text-[7.5px] font-medium tabular-nums text-schrift-3">
                {String(d).padStart(2, '0')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MONTH_ABBR.map((abbr, mi) => {
            const month = mi + 1;
            const dim = daysInMonth(year, month);
            return (
              <tr key={month}>
                <th scope="row" className="sticky left-0 z-10 bg-ebene px-1 text-left text-[9px] font-bold text-schrift-2 border-r border-b border-kontur-soft whitespace-nowrap">
                  {abbr}
                </th>
                {DAYS.map(day => {
                  // Tag-31-Handling/Schaltjahr: Tage außerhalb des Monats sind
                  // tote Zellen — Geometrie bleibt konstant (§11)
                  if (day > dim) {
                    return <td key={day} className="border-r border-b border-kontur-soft bg-[#f7f8fa] dark:bg-[#0a0e17]" aria-hidden="true" />;
                  }
                  const dateStr = toDateStr(year, month, day);
                  const entries = dayMap.get(dateStr) ?? [];
                  const wd = new Date(year, month - 1, day).getDay();
                  const isWe = wd === 0 || wd === 6;
                  const isHol = holidays.has(dateStr);
                  const isToday = dateStr === todayStr;
                  const title = [
                    dateStr,
                    isHol ? 'Feiertag' : '',
                    isToday ? 'Heute' : '',
                    `Klick öffnet den Dienstplan ${abbr} ${year}`,
                  ].filter(Boolean).join(' · ');

                  // Einzeleintrag = Zelle als Chip (normalisierte Farbe);
                  // Abwesenheit = hohler Ring statt Füllung
                  const single = entries.length === 1 ? entries[0] : null;
                  const cycle = single?.source === 'cycle';
                  const soll = single?.schedule_type === 1;
                  const label = single ? shortLabel(single.display_name || '?') : '';
                  const tw = single?.color_bk
                    ? shiftCellColorsMemo(single.color_bk, theme, { hollow: single.kind === 'absence' })
                    : null;
                  // Zustands-Kaskade wie im Dienstplan: Chip > Feiertag
                  // (Signal-Wash) > Heute (Glut-Wash) > Wochenende (bg-wash)
                  const stateBg = isHol
                    ? (isDark ? 'rgba(228,105,111,.12)' : 'rgba(190,59,59,.08)')
                    : isToday
                    ? (isDark ? 'rgba(240,163,92,.05)' : 'rgba(201,106,20,.045)')
                    : undefined;
                  const chipClass = single
                    ? !single.color_bk
                      ? 'text-[8px] font-semibold text-schrift-2'
                      : single.kind === 'absence'
                      ? 'text-[7px] font-bold'
                      : 'text-[8px] font-extrabold'
                    : '';
                  return (
                    <td
                      key={day}
                      data-testid={`jr-cell-${month}-${day}`}
                      className={`border-r border-b border-kontur-soft p-0 h-[20px] text-center align-middle cursor-pointer hover:brightness-95 transition-[filter] overflow-hidden${isWe && !isToday && !isHol ? ' bg-wash' : ''}`}
                      style={{
                        backgroundColor: (tw && !tw.isHollow ? tw.background : undefined) ?? stateBg,
                        // Chip-Fuge (§11): 1,5px innenliegende Linie in Panel-
                        // farbe statt Margin; Abwesenheit: 1px-Ring in Hohl-Farbe
                        boxShadow: tw
                          ? (tw.isHollow ? `inset 0 0 0 1px ${tw.color}` : 'inset 0 0 0 1.5px var(--ebene)')
                          : undefined,
                        color: tw ? tw.color : undefined,
                      }}
                      title={title}
                      onClick={() => onMonthClick(month)}
                    >
                      {single ? (
                        <span
                          className={`block w-full leading-[20px] truncate ${chipClass}`}
                          style={{
                            ...(cycle ? CYCLE_HATCH : undefined),
                            ...(soll ? { outline: '1px dashed currentColor', outlineOffset: -1 } : undefined),
                          }}
                          title={[single.shift_name || single.leave_name || label, cycle ? CYCLE_TITLE : '', soll ? SOLL_TITLE : ''].filter(Boolean).join(' · ')}
                        >
                          {cycle && <span className="text-[7px] opacity-80" aria-hidden="true">↻</span>}
                          {soll && <span className="text-[7px] opacity-80" aria-hidden="true">S</span>}
                          {label}
                        </span>
                      ) : entries.length > 1 ? (
                        <ScheduleCellStack entries={entries.map(e => ({ ...e, display_name: shortLabel(e.display_name || '?') }))} isDark={isDark} />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
