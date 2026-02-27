import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DayEntry {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  shift_id: number | null;
  shift_name: string;
  shift_short: string;
  color_bk: string;
  color_text: string;
  kind: string | null;
  leave_name: string;
  display_name: string;
  spshi_startend: string;
  spshi_duration: number;
  workplace_name: string;
}

interface Shift {
  ID: number;
  NAME: string;
  SHORTNAME: string;
  COLORBK_HEX: string;
  COLORTEXT_HEX: string;
  TIMES_BY_WEEKDAY: Record<string, { start: string; end: string }>;
}

interface Group {
  ID: number;
  NAME: string;
}

const WEEKDAY_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const wd = WEEKDAY_LONG[d.getDay()];
  return `${wd}, ${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

function isLight(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function ShiftBadge({ entry }: { entry: DayEntry }) {
  const bg = entry.color_bk || '#E5E7EB';
  const fg = isLight(bg) ? '#111827' : '#FFFFFF';
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold shadow-sm"
      style={{ background: bg, color: fg }}
      title={entry.shift_name || entry.leave_name}
    >
      {entry.display_name || entry.shift_short || '?'}
    </span>
  );
}

function StatusPill({ kind, leaveName }: { kind: string | null; leaveName: string }) {
  if (kind === 'shift') return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
      🟢 Dienst
    </span>
  );
  if (kind === 'absence') return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
      🟡 {leaveName || 'Abwesend'}
    </span>
  );
  if (kind === 'special') return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
      🔵 Sonder
    </span>
  );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
      ⚪ Frei
    </span>
  );
}

// Visual shift timeline bar — 24h scale
function TimelineBar({ entry, shifts }: { entry: DayEntry; shifts: Shift[] }) {
  if (!entry.shift_id) return null;
  const shift = shifts.find(s => s.ID === entry.shift_id);
  if (!shift) return null;

  const dateObj = new Date();
  const wd = dateObj.getDay().toString();
  const times = shift.TIMES_BY_WEEKDAY?.[wd];
  if (!times) return null;

  const [sh, sm] = times.start.split(':').map(Number);
  const [eh, em] = times.end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60; // overnight

  const totalMins = 24 * 60;
  const leftPct = (startMin / totalMins) * 100;
  const widthPct = Math.min(((endMin - startMin) / totalMins) * 100, 100 - leftPct);

  const bg = entry.color_bk || '#6B7280';
  const fg = isLight(bg) ? '#111827' : '#FFFFFF';

  return (
    <div className="relative w-full h-5 bg-gray-100 rounded overflow-hidden">
      <div
        className="absolute top-0 h-full rounded flex items-center px-1 text-xs font-bold overflow-hidden"
        style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: bg, color: fg, minWidth: '20px' }}
        title={`${times.start}–${times.end}`}
      >
        {widthPct > 8 ? `${times.start}` : ''}
      </div>
    </div>
  );
}

export default function DienstBoard() {
  const today = toDateStr(new Date());
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'timeline' | 'list'>('board');
  const [showFree, setShowFree] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${API}/api/schedule/day?date=${date}${groupId ? `&group_id=${groupId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setEntries(data);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [date, groupId]);

  useEffect(() => {
    fetch(`${API}/api/shifts`).then(r => r.json()).then(setShifts);
    fetch(`${API}/api/groups`).then(r => r.json()).then(setGroups);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  // Navigate date
  const prevDay = () => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setDate(toDateStr(d));
  };
  const nextDay = () => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setDate(toDateStr(d));
  };

  // Stats
  const onShift = entries.filter(e => e.kind === 'shift');
  const absent = entries.filter(e => e.kind === 'absence');
  const special = entries.filter(e => e.kind === 'special');
  const free = entries.filter(e => !e.kind);

  // Group by shift
  const byShift: Record<string, DayEntry[]> = {};
  for (const e of onShift) {
    const key = e.shift_name || 'Unbekannt';
    if (!byShift[key]) byShift[key] = [];
    byShift[key].push(e);
  }

  const displayedFree = showFree ? free : [];

  // Hours timeline for board view: which hour is it now?
  const nowHour = new Date().getHours();
  const nowMin = new Date().getMinutes();

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🖥️ Dienst-Board</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live-Übersicht: Wer arbeitet wann?</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-Refresh
          </label>
          {lastRefresh && (
            <span className="text-xs text-gray-400">
              Stand: {lastRefresh.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? '⟳' : '🔄'} Aktualisieren
          </button>
        </div>
      </div>

      {/* Date selector + Group filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm p-1">
          <button onClick={prevDay} className="p-1.5 hover:bg-gray-100 rounded text-gray-600">‹</button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="text-sm font-medium text-gray-800 border-none outline-none bg-transparent px-2"
          />
          <button onClick={nextDay} className="p-1.5 hover:bg-gray-100 rounded text-gray-600">›</button>
          <button
            onClick={() => setDate(today)}
            className={`px-2 py-1 text-xs rounded font-medium ${date === today ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            Heute
          </button>
        </div>

        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm"
        >
          <option value="">Alle Gruppen</option>
          {groups.map(g => (
            <option key={g.ID} value={g.ID}>{g.NAME}</option>
          ))}
        </select>

        {/* View mode switcher */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 ml-auto">
          {(['board', 'timeline', 'list'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {m === 'board' ? '⊞ Board' : m === 'timeline' ? '⏱ Timeline' : '☰ Liste'}
            </button>
          ))}
        </div>
      </div>

      {/* Date headline */}
      <div className="text-center py-1">
        <h2 className="text-lg font-semibold text-gray-700">{formatDate(date)}</h2>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Im Dienst', value: onShift.length, icon: '✅', color: 'bg-green-50 border-green-200 text-green-800' },
          { label: 'Abwesend', value: absent.length, icon: '🟡', color: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: 'Sonder', value: special.length, icon: '🔵', color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: 'Frei / kein Plan', value: free.length, icon: '⚪', color: 'bg-gray-50 border-gray-200 text-gray-600' },
        ].map(kpi => (
          <div key={kpi.label} className={`rounded-xl border p-3 flex flex-col items-center gap-1 shadow-sm ${kpi.color}`}>
            <span className="text-2xl">{kpi.icon}</span>
            <span className="text-2xl font-bold">{kpi.value}</span>
            <span className="text-xs font-medium">{kpi.label}</span>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-400 animate-pulse">Lade Daten…</div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">📭</div>
          <div>Keine Daten für dieses Datum</div>
        </div>
      )}

      {/* BOARD VIEW — Grouped by shift */}
      {!loading && viewMode === 'board' && entries.length > 0 && (
        <div className="space-y-4">
          {Object.entries(byShift).map(([shiftName, emps]) => {
            const sample = emps[0];
            const bg = sample.color_bk || '#E5E7EB';
            const fg = isLight(bg) ? '#111827' : '#FFFFFF';
            // Find shift for times
            const shiftObj = shifts.find(s => s.NAME === shiftName);
            const wd = new Date(date + 'T00:00:00').getDay().toString();
            const times = shiftObj?.TIMES_BY_WEEKDAY?.[wd];
            return (
              <div key={shiftName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: bg, color: fg }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{shiftName}</span>
                    {times && (
                      <span className="text-sm opacity-80 font-mono">
                        {times.start}–{times.end}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-lg">{emps.length} MA</span>
                </div>
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {emps.map(e => (
                    <div
                      key={e.employee_id}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      title={e.employee_name}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm"
                        style={{ background: bg, color: fg }}
                      >
                        {e.employee_short.slice(0, 2)}
                      </div>
                      <span className="text-xs font-medium text-center text-gray-700 leading-tight">
                        {e.employee_name.split(', ').reverse().join(' ')}
                      </span>
                      {e.workplace_name && (
                        <span className="text-xs text-gray-400">{e.workplace_name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Absent section */}
          {absent.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50">
                <span className="font-semibold text-amber-800">🟡 Abwesend</span>
                <span className="font-bold text-amber-800">{absent.length} MA</span>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {absent.map(e => (
                  <div key={e.employee_id} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-sm font-medium text-amber-900">
                      {e.employee_name.split(', ').reverse().join(' ')}
                    </span>
                    <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">{e.leave_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Free/unplanned toggle */}
          {free.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowFree(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-semibold text-gray-500">⚪ Frei / kein Plan</span>
                <span className="text-gray-400 text-sm">{free.length} MA {showFree ? '▲' : '▼'}</span>
              </button>
              {showFree && (
                <div className="p-3 flex flex-wrap gap-2">
                  {displayedFree.map(e => (
                    <div key={e.employee_id} className="px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                      {e.employee_name.split(', ').reverse().join(' ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TIMELINE VIEW */}
      {!loading && viewMode === 'timeline' && entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Hour ruler */}
          <div className="border-b border-gray-200 px-4 py-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-36 shrink-0 text-xs text-gray-400">Mitarbeiter</div>
              <div className="relative flex-1 h-5">
                {/* 24h ruler */}
                <div className="flex w-full">
                  {Array.from({ length: 25 }, (_, i) => (
                    <div key={i} className="flex-1 text-center" style={{ fontSize: '9px', color: '#9CA3AF' }}>
                      {i % 3 === 0 ? `${i}` : ''}
                    </div>
                  ))}
                </div>
                {/* Now indicator */}
                {date === today && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 opacity-80"
                    style={{ left: `${((nowHour * 60 + nowMin) / (24 * 60)) * 100}%` }}
                    title={`Jetzt: ${nowHour}:${nowMin.toString().padStart(2, '0')}`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {onShift.concat(absent).map(e => (
              <div key={e.employee_id} className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50">
                <div className="w-36 shrink-0 flex items-center gap-2">
                  <ShiftBadge entry={e} />
                  <span className="text-xs text-gray-700 font-medium truncate">
                    {e.employee_name.split(', ').reverse().join(' ')}
                  </span>
                </div>
                <div className="flex-1">
                  {e.kind === 'shift' ? (
                    <TimelineBar entry={e} shifts={shifts} />
                  ) : (
                    <div className="h-5 bg-amber-100 rounded flex items-center px-2">
                      <span className="text-xs text-amber-700">{e.leave_name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 24h tick marks footer */}
          <div className="border-t border-gray-100 px-4 py-1">
            <div className="flex items-center gap-2">
              <div className="w-36 shrink-0" />
              <div className="flex-1 flex">
                {[0, 6, 12, 18, 24].map(h => (
                  <div key={h} className="flex-1 text-xs text-gray-300 text-left"
                    style={{ marginLeft: h === 0 ? 0 : undefined }}>
                    {h < 24 ? `${h}:00` : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {!loading && viewMode === 'list' && entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Mitarbeiter</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Kürzel</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Schicht</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Zeiten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries
                .filter(e => e.kind || showFree)
                .sort((a, b) => {
                  const order = { shift: 0, special: 1, absence: 2 };
                  return (order[a.kind as keyof typeof order] ?? 3) - (order[b.kind as keyof typeof order] ?? 3);
                })
                .map(e => {
                  const shift = shifts.find(s => s.ID === e.shift_id);
                  const wd = new Date(date + 'T00:00:00').getDay().toString();
                  const times = shift?.TIMES_BY_WEEKDAY?.[wd];
                  return (
                    <tr key={e.employee_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {e.employee_name.split(', ').reverse().join(' ')}
                      </td>
                      <td className="px-4 py-2">
                        <ShiftBadge entry={e} />
                      </td>
                      <td className="px-4 py-2 text-gray-600">{e.shift_name || e.leave_name || '—'}</td>
                      <td className="px-4 py-2">
                        <StatusPill kind={e.kind} leaveName={e.leave_name} />
                      </td>
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                        {times ? `${times.start}–${times.end}` : '—'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {!showFree && free.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setShowFree(true)} className="text-xs text-blue-600 hover:underline">
                + {free.length} Mitarbeiter ohne Eintrag einblenden
              </button>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span className="font-semibold">Legende:</span>
        <span>🟢 Im Dienst</span>
        <span>🟡 Abwesend (Urlaub / Krank)</span>
        <span>🔵 Sonderschicht</span>
        <span>⚪ Kein Eintrag</span>
        {date === today && viewMode === 'timeline' && (
          <span className="text-red-400">│ Roter Strich = Jetzt</span>
        )}
      </div>
    </div>
  );
}
