import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WEEKDAY_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

interface ShiftEntry {
  shift_id: number | null;
  short: string;
  name: string;
  color: string;
  count: number;
  pct: number;
}

interface WeekdayData {
  weekday: number;
  total: number;
  configured: boolean;
  shifts: ShiftEntry[];
  dominant_shift: ShiftEntry | null;
}

interface Employee {
  id: number;
  name: string;
  short: string;
  groups: string[];
  pattern: string;
  pattern_icon: string;
  total_shifts: number;
  shift_mix: ShiftEntry[];
  weekdays: WeekdayData[];
  workdays_config: boolean[];
}

interface WeekdayCoverage {
  weekday: number;
  configured: number;
  actual_data: number;
}

interface ShiftDef {
  id: number;
  name: string;
  short: string;
  color: string;
}

interface MatrixData {
  year: number;
  months: number;
  start_date: string;
  end_date: string;
  employees: Employee[];
  weekday_coverage: WeekdayCoverage[];
  shifts: ShiftDef[];
}

interface Group {
  ID: number;
  NAME: string;
}

type ViewMode = 'matrix' | 'heatmap' | 'coverage';
type DataMode = 'configured' | 'actual';

function PatternBadge({ icon, pattern }: { icon: string; pattern: string }) {
  const colors: Record<string, string> = {
    '3-Schicht-Rotation': 'bg-purple-100 text-purple-800 border-purple-200',
    '2-Schicht-Wechsel': 'bg-blue-100 text-blue-800 border-blue-200',
    'Tagschicht Mo–Fr': 'bg-green-100 text-green-800 border-green-200',
    'Teilzeit': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Wenige Einsätze': 'bg-orange-100 text-orange-800 border-orange-200',
    'Keine Daten': 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[pattern] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      <span>{icon}</span>
      <span>{pattern}</span>
    </span>
  );
}


function isColorDark(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function MatrixCell({ wd, dataMode }: { wd: WeekdayData; dataMode: DataMode; shifts?: ShiftEntry[] }) {
  const [hovered, setHovered] = useState(false);

  if (dataMode === 'configured') {
    // Show configured workday
    const isWorkday = wd.configured;
    return (
      <td className="px-1 py-1 text-center relative">
        <div
          className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition-transform ${
            isWorkday
              ? 'bg-green-400 text-white shadow-sm'
              : 'bg-gray-100 text-gray-300'
          }`}
          title={isWorkday ? 'Arbeitstag (konfiguriert)' : 'Kein Arbeitstag'}
        >
          {isWorkday ? '✓' : '–'}
        </div>
      </td>
    );
  }

  // Actual data mode
  const dominant = wd.dominant_shift;
  const hasData = wd.total > 0;

  return (
    <td
      className="px-1 py-1 text-center relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hasData && dominant ? (
        <div
          className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold cursor-default shadow-sm transition-transform hover:scale-110"
          style={{
            backgroundColor: dominant.color,
            color: isColorDark(dominant.color) ? '#fff' : '#000',
          }}
          title={`${WEEKDAY_LONG[wd.weekday]}: ${dominant.name} (${dominant.pct}%), ${wd.total} Einsätze`}
        >
          {dominant.short}
        </div>
      ) : wd.configured ? (
        <div
          className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-300"
          title="Kein Einsatz in diesem Zeitraum (aber als Arbeitstag konfiguriert)"
        >
          –
        </div>
      ) : (
        <div className="w-8 h-8 mx-auto" />
      )}

      {/* Tooltip with all shifts */}
      {hovered && hasData && wd.shifts.length > 1 && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2 min-w-28 text-left">
          <div className="text-[10px] font-semibold text-gray-500 mb-1">{WEEKDAY_LONG[wd.weekday]}</div>
          {wd.shifts.map(s => (
            <div key={s.shift_id ?? 'abs'} className="flex items-center gap-1 text-xs py-0.5">
              <span
                className="w-4 h-4 rounded text-center text-[9px] font-bold flex items-center justify-center"
                style={{ backgroundColor: s.color, color: isColorDark(s.color) ? '#fff' : '#000' }}
              >
                {s.short}
              </span>
              <span className="text-gray-700 dark:text-gray-300">{s.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </td>
  );
}

function HeatmapView({ employees, dataMode }: { employees: Employee[]; dataMode: DataMode }) {
  // Per-weekday aggregate
  const wdCounts = WEEKDAYS.map((_, wd) =>
    employees.filter(e => dataMode === 'configured' ? e.workdays_config[wd] : e.weekdays[wd].total > 0).length
  );
  return (
    <div className="space-y-4">
      {/* Coverage bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Besetzung pro Wochentag</h3>
        <div className="flex gap-2">
          {WEEKDAYS.map((wd, i) => (
            <div key={wd} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">{wdCounts[i]}</div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full" style={{ height: 80 }}>
                <div
                  className="w-full rounded-full transition-all"
                  style={{
                    height: `${(wdCounts[i] / employees.length) * 100}%`,
                    backgroundColor: i >= 5 ? '#f97316' : '#22c55e',
                    marginTop: `${100 - (wdCounts[i] / employees.length) * 100}%`,
                  }}
                />
              </div>
              <div className={`text-xs font-bold ${i >= 5 ? 'text-orange-500' : 'text-gray-500'}`}>{wd}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Employee heatmap grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-40">Mitarbeiter</th>
                {WEEKDAYS.map(wd => (
                  <th key={wd} className="text-center px-2 py-2 text-xs font-semibold text-gray-500">{wd}</th>
                ))}
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Muster</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, idx) => (
                <tr
                  key={emp.id}
                  className={`border-b border-gray-100 dark:border-gray-700 ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate max-w-36">{emp.name}</div>
                    <div className="text-xs text-gray-400">{emp.short}</div>
                  </td>
                  {emp.weekdays.map(wd => (
                    <MatrixCell key={wd.weekday} wd={wd} dataMode={dataMode} shifts={emp.shift_mix} />
                  ))}
                  <td className="px-4 py-2">
                    <PatternBadge icon={emp.pattern_icon} pattern={emp.pattern} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CoverageView({ coverage, employees }: { coverage: WeekdayCoverage[]; employees: Employee[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
      {coverage.map((wdc, i) => {
        const pct = Math.round((wdc.configured / Math.max(employees.length, 1)) * 100);
        const isWeekend = i >= 5;
        return (
          <div
            key={wdc.weekday}
            className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${
              isWeekend ? 'border-orange-200 dark:border-orange-800' : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className={`text-lg font-bold mb-1 ${isWeekend ? 'text-orange-500' : 'text-gray-700 dark:text-gray-200'}`}>
              {WEEKDAY_LONG[i]}
            </div>
            <div className="text-3xl font-black text-gray-800 dark:text-white">{wdc.configured}</div>
            <div className="text-xs text-gray-400 mb-3">von {employees.length} MA</div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${isWeekend ? 'bg-orange-400' : 'bg-green-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">{pct}% Besetzung</div>

            {/* Whos on this day */}
            <div className="mt-3 space-y-1">
              {employees
                .filter(e => e.workdays_config[i])
                .slice(0, 5)
                .map(e => (
                  <div key={e.id} className="flex items-center gap-1">
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-px rounded font-mono text-gray-600 dark:text-gray-400">{e.short}</span>
                  </div>
                ))}
              {employees.filter(e => e.workdays_config[i]).length > 5 && (
                <div className="text-xs text-gray-400">+{employees.filter(e => e.workdays_config[i]).length - 5} weitere</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function VerfuegbarkeitsMatrix() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState(12);
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [dataMode, setDataMode] = useState<DataMode>('configured');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'pattern' | 'workdays'>('name');

  useEffect(() => {
    fetch(`${API}/api/groups`).then(r => r.json()).then(setGroups).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ year: String(year), months: String(months) });
    if (selectedGroup) params.set('group_id', String(selectedGroup));
    fetch(`${API}/api/availability-matrix?${params}`)
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, months, selectedGroup]);

  useEffect(() => { load(); }, [load]);

  const filteredEmployees = (data?.employees ?? [])
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.short.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'pattern') return a.pattern.localeCompare(b.pattern);
      if (sortBy === 'workdays') {
        const awd = a.workdays_config.filter(Boolean).length;
        const bwd = b.workdays_config.filter(Boolean).length;
        return bwd - awd;
      }
      return 0;
    });

  const patternStats = (data?.employees ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.pattern] = (acc[e.pattern] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🗓️ Verfügbarkeits-Matrix
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Wochentag-Muster & Besetzungsübersicht pro Mitarbeiter
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            value={months}
            onChange={e => setMonths(Number(e.target.value))}
          >
            <option value={3}>3 Monate</option>
            <option value={6}>6 Monate</option>
            <option value={12}>12 Monate</option>
            <option value={24}>24 Monate</option>
          </select>
          <select
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            value={selectedGroup ?? ''}
            onChange={e => setSelectedGroup(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Alle Gruppen</option>
            {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
          </select>
        </div>
      </div>

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-2xl font-black text-gray-800 dark:text-white">{data.employees.length}</div>
            <div className="text-xs text-gray-500">Mitarbeiter</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-2xl font-black text-green-500">
              {data.weekday_coverage.slice(0, 5).reduce((a, w) => a + w.configured, 0)}
            </div>
            <div className="text-xs text-gray-500">Mo–Fr Einsätze</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-2xl font-black text-orange-500">
              {data.weekday_coverage.slice(5).reduce((a, w) => a + w.configured, 0)}
            </div>
            <div className="text-xs text-gray-500">Sa–So Einsätze</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-2xl font-black text-purple-500">
              {Object.keys(patternStats).filter(p => p !== 'Keine Daten').length}
            </div>
            <div className="text-xs text-gray-500">Schicht-Muster</div>
          </div>
        </div>
      )}

      {/* Pattern summary */}
      {data && Object.entries(patternStats).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(patternStats).map(([pattern, count]) => {
            const emp = data.employees.find(e => e.pattern === pattern);
            return (
              <div key={pattern} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1">
                <span className="text-base">{emp?.pattern_icon}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{pattern}</span>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full px-1.5">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* View controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {([
            { id: 'heatmap', label: '🗂️ Matrix' },
            { id: 'coverage', label: '📊 Tagesbesetzung' },
          ] as { id: ViewMode; label: string }[]).map(v => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === v.id
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {viewMode === 'heatmap' && (
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {([
              { id: 'configured', label: '⚙️ Konfiguriert' },
              { id: 'actual', label: '📈 Tatsächlich' },
            ] as { id: DataMode; label: string }[]).map(v => (
              <button
                key={v.id}
                onClick={() => setDataMode(v.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  dataMode === v.id
                    ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Suchen..."
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 w-32 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="name">Name</option>
            <option value="pattern">Muster</option>
            <option value="workdays">Arbeitstage</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      {viewMode === 'heatmap' && dataMode === 'actual' && data && data.shifts.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500">Legende:</span>
          {data.shifts.map(s => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: s.color, color: isColorDark(s.color) ? '#fff' : '#000' }}
            >
              {s.short} – {s.name}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 text-red-700 dark:text-red-400">
          ⚠️ {error}
        </div>
      )}

      {!loading && data && viewMode === 'heatmap' && (
        <HeatmapView employees={filteredEmployees} dataMode={dataMode} />
      )}

      {!loading && data && viewMode === 'coverage' && (
        <CoverageView coverage={data.weekday_coverage} employees={filteredEmployees} />
      )}

      {/* Info box */}
      {!loading && data && dataMode === 'actual' && data.employees.every(e => e.total_shifts === 0) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
          <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">ℹ️ Keine Einsatzdaten im gewählten Zeitraum</div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Wechsle zu <strong>„⚙️ Konfiguriert"</strong>, um die konfigurierten Arbeitstage pro Mitarbeiter zu sehen.
            Oder wähle einen anderen Zeitraum mit tatsächlichen Schichtdaten.
          </div>
        </div>
      )}
    </div>
  );
}
