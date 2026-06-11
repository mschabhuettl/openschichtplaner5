/**
 * AbsenceIntervalPicker — kompakte Auswahl der Tageszeit-Ausprägung einer
 * Abwesenheit (V-3, Spec R6.6: ganz / vormittags / nachmittags / stundenweise).
 *
 * Liefert 5ABSEN.INTERVAL-kompatible Werte (0|1|2|3, bei 3 mit start/end "HH:MM").
 */
import type { AbsenceInterval } from '../api/client';
import type { AbsenceTimeState } from './scheduleGridUtils';

const OPTIONS: { value: AbsenceInterval; label: string; title: string }[] = [
  { value: 0, label: 'Ganz', title: 'Ganztägig' },
  { value: 1, label: 'Vorm.', title: 'Vormittags' },
  { value: 2, label: 'Nachm.', title: 'Nachmittags' },
  { value: 3, label: 'Std.', title: 'Stundenweise (Zeitraum)' },
];

export function AbsenceIntervalPicker({
  value,
  onChange,
}: {
  value: AbsenceTimeState;
  onChange: (v: AbsenceTimeState) => void;
}) {
  return (
    <div className="px-2 py-1">
      <div className="flex rounded border dark:border-gray-600 overflow-hidden text-[10px]">
        {OPTIONS.map((o, i) => (
          <button
            key={o.value}
            type="button"
            title={o.title}
            onClick={() => onChange({ ...value, interval: o.value })}
            className={`flex-1 px-1 py-0.5 ${
              value.interval === o.value
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            } ${i > 0 ? 'border-l dark:border-gray-600' : ''}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value.interval === 3 && (
        <div className="flex gap-1 mt-1">
          <input
            type="time"
            aria-label="Beginn"
            value={value.start_time}
            onChange={e => onChange({ ...value, start_time: e.target.value })}
            className="flex-1 border dark:border-gray-600 rounded px-1 py-0.5 text-[10px] dark:bg-gray-700"
          />
          <input
            type="time"
            aria-label="Ende"
            value={value.end_time}
            onChange={e => onChange({ ...value, end_time: e.target.value })}
            className="flex-1 border dark:border-gray-600 rounded px-1 py-0.5 text-[10px] dark:bg-gray-700"
          />
        </div>
      )}
    </div>
  );
}
