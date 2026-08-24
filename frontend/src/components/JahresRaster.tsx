/**
 * JahresRaster — Jahres-Tagesraster eines Mitarbeiters (V-8, Spec 4.4).
 *
 * 12 Zeilen (Monate) × Tagesspalten, Spaltenausrichtung nach Spec 4.11.11-1
 * (Radio-Logik): a) Kalendertage 1…31 (31 Spalten, Default) oder
 * b) Wochentage Mo…So (37 Spalten = max. Offset 6 + 31 Tage; jede
 * Monatszeile beginnt in der Spalte ihres ersten Wochentags).
 * Geometrie fix nach Taktwerk §11 (03-primitives): Monatsspalte 34px,
 * Tageszellen 21×20px — der Zellinhalt darf die Zellgröße nie variieren
 * (Befund 9). Einzeleinträge füllen die Zelle als Chip (Rohfarbe über
 * shiftColor normalisiert, Vordergrund berechnet); die Chip-Fuge entsteht
 * als innenliegende 1,5px-Linie in Panelfarbe (box-shadow inset) statt
 * über Margin. Abwesenheiten sind hohle Ringe, Wochenenden/Feiertage/Heute
 * dezent getönt; Zyklusdienste (source==='cycle') tragen ↻ + Schraffur
 * (APP-INT-4), Mehrfacheinträge stapeln über ScheduleCellStack.
 * Sichtbare Einträge je Feld (Spec 4.11.11-2) sind wählbar (maxEintraege);
 * überzählige signalisiert ein nach unten gerichtetes Dreieck ▾ in der
 * Zelle (Invariante Spec 4.13-3) — die Zellgröße bleibt dabei fix.
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
import { MONTH_ABBR, WEEKDAY_ABBR, daysInMonth, monthStartOffset, toDateStr, shortLabel, type JahresAusrichtung } from './jahresRasterUtils';

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
  ausrichtung = 'kalendertage',
  maxEintraege = 2,
}: {
  year: number;
  /** Einträge des ausgewählten Mitarbeiters, Schlüssel "YYYY-MM-DD" (buildDayMap). */
  dayMap: Map<string, ScheduleEntry[]>;
  holidays: Set<string>;
  onMonthClick: (month: number) => void;
  /** Spaltenausrichtung (Spec 4.11.11-1), Default Kalendertage 1…31. */
  ausrichtung?: JahresAusrichtung;
  /** Sichtbare Einträge je Feld (Spec 4.11.11-2): 1 oder 2 — mehr passt
   *  nicht lesbar in die fixe 20px-Zelle (Taktwerk §11); Überzählige → ▾. */
  maxEintraege?: number;
}) {
  const isWt = ausrichtung === 'wochentage';
  // 37 Spalten Wochentags-Modus: Mo…So ×5 + Mo Di (max. Offset 6 + 31 Tage)
  const cols = Array.from({ length: isWt ? 37 : 31 }, (_, i) => i);
  const now = new Date();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
  // Theme provider-frei, Muster der Menü-Chips in Schedule.tsx
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const theme = isDark ? 'dark' : 'light';

  return (
    <div className="overflow-x-auto">
      {/* Feste Geometrie (Taktwerk §11): 34px + 31×21px (Kalendertage) bzw.
          34px + 37×21px (Wochentage) — Zellmaß 21×20px in beiden Modi */}
      <table className={`border-collapse table-fixed ${isWt ? 'w-[811px]' : 'w-[685px]'}`} data-testid="jahresraster">
        <colgroup>
          <col style={{ width: 34 }} />
          {cols.map(c => <col key={c} style={{ width: 21 }} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-ebene px-1 pb-[3px] text-left text-[7.5px] font-bold uppercase tracking-[.08em] text-schrift-3">
              Monat
            </th>
            {cols.map(c => (
              <th scope="col" key={c} className="pb-[3px] text-center font-mono text-[7.5px] font-medium tabular-nums text-schrift-3">
                {isWt ? WEEKDAY_ABBR[c % 7] : String(c + 1).padStart(2, '0')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MONTH_ABBR.map((abbr, mi) => {
            const month = mi + 1;
            const dim = daysInMonth(year, month);
            // Wochentags-Ausrichtung (Spec 4.11.11-1b): jede Monatszeile
            // beginnt in der Spalte ihres ersten Wochentags
            const offset = isWt ? monthStartOffset(year, month) : 0;
            return (
              <tr key={month}>
                <th scope="row" className="sticky left-0 z-10 bg-ebene px-1 text-left text-[9px] font-bold text-schrift-2 border-r border-b border-kontur-soft whitespace-nowrap">
                  {abbr}
                </th>
                {cols.map(c => {
                  const day = c - offset + 1;
                  // Tote Zellen vor Monatsbeginn (Offset) und außerhalb der
                  // Monatslänge (Tag-31/Schaltjahr) — Geometrie konstant (§11)
                  if (day < 1 || day > dim) {
                    return <td key={c} className="border-r border-b border-kontur-soft bg-[#f7f8fa] dark:bg-[#0a0e17]" aria-hidden="true" />;
                  }
                  const dateStr = toDateStr(year, month, day);
                  const entries = dayMap.get(dateStr) ?? [];
                  const wd = new Date(year, month - 1, day).getDay();
                  const isWe = wd === 0 || wd === 6;
                  const isHol = holidays.has(dateStr);
                  const isToday = dateStr === todayStr;
                  // Sichtbare Einträge je Feld (Spec 4.11.11-2): Überzählige
                  // werden abgeschnitten und per ▾ signalisiert (Spec 4.13-3)
                  const shown = entries.slice(0, Math.max(1, maxEintraege));
                  const hidden = entries.length - shown.length;
                  const hiddenTitle = hidden > 0
                    ? `▾ ${hidden === 1 ? '1 weiterer Eintrag' : `${hidden} weitere Einträge`}: ${entries.slice(shown.length).map(e => shortLabel(e.display_name || '?')).join(' ')}`
                    : '';
                  const title = [
                    dateStr,
                    isHol ? 'Feiertag' : '',
                    isToday ? 'Heute' : '',
                    hiddenTitle,
                    `Klick öffnet den Dienstplan ${abbr} ${year}`,
                  ].filter(Boolean).join(' · ');

                  // Einzeleintrag = Zelle als Chip (normalisierte Farbe);
                  // Abwesenheit = hohler Ring statt Füllung
                  const single = shown.length === 1 ? shown[0] : null;
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
                      key={c}
                      data-testid={`jr-cell-${month}-${day}`}
                      className={`relative border-r border-b border-kontur-soft p-0 h-[20px] text-center align-middle cursor-pointer hover:brightness-95 transition-[filter] overflow-hidden${isWe && !isToday && !isHol ? ' bg-wash' : ''}`}
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
                          title={[single.shift_name || single.leave_name || label, cycle ? CYCLE_TITLE : '', soll ? SOLL_TITLE : '', hiddenTitle].filter(Boolean).join(' · ')}
                        >
                          {cycle && <span className="text-[7px] opacity-80" aria-hidden="true">↻</span>}
                          {soll && <span className="text-[7px] opacity-80" aria-hidden="true">S</span>}
                          {label}
                        </span>
                      ) : shown.length > 1 ? (
                        <ScheduleCellStack entries={shown.map(e => ({ ...e, display_name: shortLabel(e.display_name || '?') }))} isDark={isDark} />
                      ) : null}
                      {/* ▾ = weitere, nicht sichtbare Einträge im Feld
                          (Spec 4.13-3) — Overlay, Zellmaß bleibt fix (§11) */}
                      {hidden > 0 && (
                        <span
                          data-testid={`jr-mehr-${month}-${day}`}
                          aria-hidden="true"
                          className="absolute bottom-0 right-[1px] text-[6px] leading-none pointer-events-none"
                        >▾</span>
                      )}
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
