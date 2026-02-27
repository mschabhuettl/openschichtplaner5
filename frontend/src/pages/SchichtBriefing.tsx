import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Employee {
  ID: number;
  NAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
  FUNCTION: string;
  PHOTO?: string;
}

interface ScheduleEntry {
  employee_id: number;
  date: string;
  kind: 'shift' | 'absence' | 'free';
  shift_id?: number;
  shift_name?: string;
  display_name: string;
  color_bk: string;
  color_text: string;
  leave_type_id?: number;
}

interface Absence {
  id: number;
  employee_id: number;
  date: string;
  leave_type_name: string;
  leave_type_short: string;
}

interface Weather {
  temp_c: number;
  desc: string;
  icon: string;
  wind_kph: number;
  humidity: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function formatDate(ds: string): string {
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function isLight(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️', clear: '☀️', overcast: '☁️', cloudy: '🌤️',
  rain: '🌧️', snow: '❄️', storm: '⛈️', fog: '🌫️', drizzle: '🌦️',
};
function weatherIcon(desc: string): string {
  const d = desc.toLowerCase();
  for (const [k, v] of Object.entries(WEATHER_ICONS)) {
    if (d.includes(k)) return v;
  }
  return '🌡️';
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ShiftBadge({ entry }: { entry: ScheduleEntry }) {
  const light = isLight(entry.color_bk);
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: entry.color_bk, color: entry.color_text || (light ? '#1e293b' : '#fff') }}
    >
      {entry.display_name}
    </span>
  );
}

function WeatherCard({ weather }: { weather: Weather | null }) {
  if (!weather) return (
    <div className="bg-gradient-to-br from-sky-100 to-blue-100 rounded-xl p-4 flex items-center gap-3 border border-sky-200 animate-pulse">
      <span className="text-3xl">🌤️</span>
      <div className="text-sm text-sky-600">Wetter wird geladen…</div>
    </div>
  );
  return (
    <div className="bg-gradient-to-br from-sky-100 to-blue-100 rounded-xl p-4 flex items-center gap-4 border border-sky-200">
      <span className="text-4xl">{weatherIcon(weather.desc)}</span>
      <div>
        <div className="text-2xl font-bold text-sky-800">{weather.temp_c}°C</div>
        <div className="text-sm text-sky-600">{weather.desc}</div>
        <div className="text-xs text-sky-500 mt-0.5">💨 {weather.wind_kph} km/h · 💧 {weather.humidity}%</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SchichtBriefing() {
  const todayStr = toDateStr(new Date());
  const [date, setDate] = useState(todayStr);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load notes from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('briefing-notes') ?? '{}');
      setSavedNotes(saved);
      setNotes(saved[date] ?? '');
    } catch { /* ignore */ }
  }, [date]);

  const saveNotes = useCallback(() => {
    const updated = { ...savedNotes, [date]: notes };
    setSavedNotes(updated);
    localStorage.setItem('briefing-notes', JSON.stringify(updated));
  }, [savedNotes, date, notes]);

  // Load employees once
  useEffect(() => {
    fetch(`${API}/api/employees`)
      .then(r => r.json())
      .then(setEmployees)
      .catch(() => {});
  }, []);

  // Load schedule + absences for chosen date
  useEffect(() => {
    const d = new Date(date + 'T12:00:00');
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/schedule?year=${year}&month=${month}`).then(r => r.json()),
      fetch(`${API}/api/absences?date_from=${date}&date_to=${date}`).then(r => r.json()),
    ]).then(([sched, abs]) => {
      const dayEntries: ScheduleEntry[] = (sched as ScheduleEntry[]).filter(e => e.date === date);
      setSchedule(dayEntries);
      setAbsences((abs as Absence[]).filter(a => a.date === date));
      setLastUpdated(new Date());
    }).catch(() => {}).finally(() => setLoading(false));
  }, [date]);

  // Load weather once (Vienna as default)
  useEffect(() => {
    fetch('https://wttr.in/?format=j1')
      .then(r => r.json())
      .then(data => {
        const cur = data.current_condition?.[0];
        if (!cur) return;
        setWeather({
          temp_c: parseInt(cur.temp_C),
          desc: cur.weatherDesc?.[0]?.value ?? '',
          icon: cur.weatherCode,
          wind_kph: parseInt(cur.windspeedKmph),
          humidity: parseInt(cur.humidity),
        });
      })
      .catch(() => {});
  }, []);

  // Build employee map
  const empMap = Object.fromEntries(employees.map(e => [e.ID, e]));

  // Group schedule entries by shift
  const shiftGroups: Record<string, { name: string; color_bk: string; color_text: string; entries: (ScheduleEntry & { emp: Employee | undefined })[] }> = {};
  for (const entry of schedule) {
    if (entry.kind !== 'shift') continue;
    const key = entry.display_name;
    if (!shiftGroups[key]) {
      shiftGroups[key] = { name: entry.shift_name ?? key, color_bk: entry.color_bk, color_text: entry.color_text, entries: [] };
    }
    shiftGroups[key].entries.push({ ...entry, emp: empMap[entry.employee_id] });
  }

  // Absent employees for this day
  const absentEmps = absences.map(a => ({ ...a, emp: empMap[a.employee_id] })).filter(a => a.emp);

  const totalOnDuty = Object.values(shiftGroups).reduce((s, g) => s + g.entries.length, 0);
  const totalAbsent = absentEmps.length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            📋 Schicht-Briefing
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tagesübersicht für die Schichtleitung
            {lastUpdated && <span className="ml-2 text-xs text-gray-400">· Stand: {lastUpdated.toLocaleTimeString('de-AT')}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={() => setDate(todayStr)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Heute
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            🖨️ Drucken
          </button>
        </div>
      </div>

      {/* Date title */}
      <div className="mb-5 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-2xl p-5 shadow-md print:shadow-none">
        <div className="text-lg font-bold">{formatDate(date)}</div>
        <div className="flex gap-6 mt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold text-2xl">{loading ? '…' : totalOnDuty}</span>
            <span className="text-slate-300">im Dienst</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-bold text-2xl">{loading ? '…' : totalAbsent}</span>
            <span className="text-slate-300">abwesend</span>
          </div>
          {totalOnDuty + totalAbsent > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sky-400 font-bold text-2xl">
                {Math.round(totalOnDuty / (totalOnDuty + totalAbsent) * 100)}%
              </span>
              <span className="text-slate-300">Besetzung</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Shifts */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm border border-gray-200">
              <div className="text-3xl mb-2">⏳</div>
              <div>Lade Dienstplan…</div>
            </div>
          ) : Object.keys(shiftGroups).length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm border border-gray-200">
              <div className="text-3xl mb-2">📭</div>
              <div>Kein Dienstplan für diesen Tag eingetragen</div>
            </div>
          ) : (
            Object.entries(shiftGroups).map(([key, group]) => {
              const light = isLight(group.color_bk);
              return (
                <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div
                    className="px-5 py-3 flex items-center justify-between"
                    style={{ background: group.color_bk, color: group.color_text || (light ? '#1e293b' : '#fff') }}
                  >
                    <div className="font-bold text-base flex items-center gap-2">
                      <ShiftBadge entry={{ display_name: key, color_bk: group.color_bk, color_text: group.color_text, date, kind: 'shift', shift_name: group.name } as ScheduleEntry} />
                      <span>{group.name}</span>
                    </div>
                    <span className="text-sm font-semibold opacity-80">{group.entries.length} MA</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {group.entries.map(entry => (
                      <div key={entry.employee_id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: '#64748b' }}
                        >
                          {entry.emp ? entry.emp.FIRSTNAME?.[0] ?? '?' : '?'}
                          {entry.emp ? entry.emp.NAME?.[0] ?? '' : ''}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800">
                            {entry.emp ? `${entry.emp.FIRSTNAME} ${entry.emp.NAME}` : `MA #${entry.employee_id}`}
                          </div>
                          {entry.emp?.FUNCTION && (
                            <div className="text-xs text-slate-500">{entry.emp.FUNCTION}</div>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          {entry.emp?.SHORTNAME ?? ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {/* Absences */}
          {absentEmps.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                <div className="font-bold text-red-700 flex items-center gap-2">
                  🏥 Abwesend heute
                </div>
                <span className="text-sm font-semibold text-red-500">{absentEmps.length} MA</span>
              </div>
              <div className="divide-y divide-gray-100">
                {absentEmps.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-red-400">
                      {a.emp!.FIRSTNAME?.[0] ?? '?'}{a.emp!.NAME?.[0] ?? ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">
                        {a.emp!.FIRSTNAME} {a.emp!.NAME}
                      </div>
                      {a.emp!.FUNCTION && <div className="text-xs text-slate-500">{a.emp!.FUNCTION}</div>}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                      {a.leave_type_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Weather + Notes */}
        <div className="space-y-4">
          {/* Weather */}
          <div>
            <h2 className="text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">🌤️ Wetter</h2>
            <WeatherCard weather={weather} />
          </div>

          {/* Quick Stats */}
          <div>
            <h2 className="text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">📊 Übersicht</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-200">
                <div className="text-3xl font-bold text-green-600">{totalOnDuty}</div>
                <div className="text-xs text-gray-500 mt-1">Im Dienst</div>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-200">
                <div className="text-3xl font-bold text-red-500">{totalAbsent}</div>
                <div className="text-xs text-gray-500 mt-1">Abwesend</div>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-200">
                <div className="text-3xl font-bold text-blue-600">{Object.keys(shiftGroups).length}</div>
                <div className="text-xs text-gray-500 mt-1">Schichten</div>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-200">
                <div className="text-3xl font-bold text-slate-600">
                  {totalOnDuty + totalAbsent > 0 ? `${Math.round(totalOnDuty / (totalOnDuty + totalAbsent) * 100)}%` : '–'}
                </div>
                <div className="text-xs text-gray-500 mt-1">Besetzung</div>
              </div>
            </div>
          </div>

          {/* Shift breakdown */}
          {Object.keys(shiftGroups).length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">🕐 Schichten</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {Object.entries(shiftGroups).map(([key, group], idx) => (
                  <div key={key} className={`flex items-center gap-3 px-4 py-2.5 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                    <ShiftBadge entry={{ display_name: key, color_bk: group.color_bk, color_text: group.color_text, date, kind: 'shift' } as ScheduleEntry} />
                    <span className="flex-1 text-sm text-slate-700 truncate">{group.name}</span>
                    <span className="text-sm font-bold text-slate-600">{group.entries.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <h2 className="text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">📝 Briefing-Notizen</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notizen für heute: Besonderheiten, Hinweise, Aufgaben…"
                className="w-full text-sm text-slate-700 resize-none focus:outline-none placeholder-gray-400 min-h-[120px]"
                rows={6}
              />
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">{notes.length} Zeichen</span>
                <button
                  onClick={saveNotes}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  💾 Speichern
                </button>
              </div>
            </div>
            {savedNotes[date] && (
              <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                ✓ Notiz gespeichert
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const d = new Date(date + 'T12:00:00');
                d.setDate(d.getDate() - 1);
                setDate(toDateStr(d));
              }}
              className="flex-1 py-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-600 hover:bg-gray-50 transition-colors font-medium"
            >
              ← Vorheriger Tag
            </button>
            <button
              onClick={() => {
                const d = new Date(date + 'T12:00:00');
                d.setDate(d.getDate() + 1);
                setDate(toDateStr(d));
              }}
              className="flex-1 py-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-600 hover:bg-gray-50 transition-colors font-medium"
            >
              Nächster Tag →
            </button>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white; }
          button, input[type="date"] { display: none !important; }
          .no-print { display: none !important; }
          textarea { border: 1px solid #ccc !important; }
        }
      `}</style>
    </div>
  );
}
