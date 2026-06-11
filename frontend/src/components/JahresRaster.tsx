/**
 * JahresRaster — Jahres-Tagesraster eines Mitarbeiters (V-8, Spec 4.4).
 *
 * 12 Zeilen (Monate) × 31 Spalten (Kalendertage 1…31, Spec 4.11.11-1a);
 * jede Zelle zeigt die Einträge des Tages als Kürzel mit den
 * COLORREF-Farben des Dienstplans (color_bk/color_text aus ScheduleEntry).
 * Wochenenden und Feiertage sind dezent hinterlegt, der heutige Tag ist
 * markiert; Zyklusdienste (source==='cycle') werden wie im Dienstplan
 * über ScheduleCellStack gekennzeichnet (↻ + Schraffur, APP-INT-4).
 *
 * Bewusste Web-Abweichung zum Original (Spec R6.1-1): Eintragen/Löschen
 * direkt im Jahresraster gibt es NICHT — ein Klick auf eine Zelle
 * navigiert stattdessen in den Dienstplan des jeweiligen Monats, wo die
 * volle Bearbeitung zur Verfügung steht.
 */
import type { ScheduleEntry } from '../types';
import { ScheduleCellStack } from './ScheduleCellStack';
import { MONTH_ABBR, daysInMonth, toDateStr } from './jahresRasterUtils';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

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

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs" data-testid="jahresraster">
        <thead>
          <tr className="bg-slate-700 text-white">
            <th scope="col" className="sticky left-0 z-10 bg-slate-700 px-2 py-1.5 text-left min-w-[52px] border-r border-slate-600">
              Monat
            </th>
            {DAYS.map(d => (
              <th scope="col" key={d} className="px-0.5 py-1.5 text-center min-w-[30px] border-r border-slate-600 font-bold">
                {d}
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
                <th scope="row" className="sticky left-0 z-10 bg-slate-100 px-2 py-1 text-left font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">
                  {abbr}
                </th>
                {DAYS.map(day => {
                  // Tag-31-Handling/Schaltjahr: Tage außerhalb des Monats sind tote Zellen
                  if (day > dim) {
                    return <td key={day} className="border border-gray-100 bg-gray-100" aria-hidden="true" />;
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
                  return (
                    <td
                      key={day}
                      data-testid={`jr-cell-${month}-${day}`}
                      className="border border-gray-200 p-0 h-7 text-center align-middle cursor-pointer hover:brightness-95 transition-[filter]"
                      style={{
                        // Farbkonvention wie im Dienstplan-Grid: Einzeleintrag
                        // färbt die Zelle (color_bk), sonst Feiertag/Heute/
                        // Wochenende-Tönung
                        backgroundColor:
                          (entries.length === 1 ? entries[0].color_bk : undefined) ||
                          (isHol ? '#fef2f2' : isToday ? '#eff6ff' : isWe ? '#f1f5f9' : undefined),
                        outline: isToday ? '2px solid #93c5fd' : undefined,
                        outlineOffset: '-2px',
                      }}
                      title={title}
                      onClick={() => onMonthClick(month)}
                    >
                      <ScheduleCellStack entries={entries} />
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
