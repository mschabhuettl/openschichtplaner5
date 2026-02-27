import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL ?? '';

interface OnDutyEntry {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  shift_name: string;
  shift_short: string;
  color_bk: string;
  color_text: string;
  workplace_name: string;
  startend: string;
}

interface AbsenceEntry {
  employee_name: string;
  employee_short: string;
  leave_type: string;
  date_from: string;
  date_to: string;
}

interface TodayData {
  date: string;
  is_holiday: boolean;
  on_duty: OnDutyEntry[];
  absences: AbsenceEntry[];
  on_duty_count: number;
  absences_count: number;
  week_days?: { date: string; on_duty_count: number; absences_count: number }[];
}

interface Warning {
  level: string;
  message: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-AT', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function isActiveShift(startend: string): boolean {
  if (!startend || !startend.includes('-')) return false;
  const now = new Date();
  const [startStr, endStr] = startend.split('-');
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);

  const todayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(todayBase.getTime() + (sh * 60 + sm) * 60000);
  let end = new Date(todayBase.getTime() + (eh * 60 + em) * 60000);
  if (end <= start) end = new Date(end.getTime() + 86400000); // next day

  return now >= start && now <= end;
}

function shiftProgress(startend: string): number {
  if (!startend || !startend.includes('-')) return 0;
  const now = new Date();
  const [startStr, endStr] = startend.split('-');
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);

  const todayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(todayBase.getTime() + (sh * 60 + sm) * 60000);
  let end = new Date(todayBase.getTime() + (eh * 60 + em) * 60000);
  if (end <= start) end = new Date(end.getTime() + 86400000);

  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

function minutesUntilEnd(startend: string): number {
  if (!startend || !startend.includes('-')) return 0;
  const now = new Date();
  const endStr = startend.split('-')[1];
  const [eh, em] = endStr.split(':').map(Number);
  const todayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end = new Date(todayBase.getTime() + (eh * 60 + em) * 60000);
  if (end < now) end = new Date(end.getTime() + 86400000);
  return Math.round((end.getTime() - now.getTime()) / 60000);
}

// Group by shift type
function groupByShift(entries: OnDutyEntry[]) {
  const map = new Map<string, OnDutyEntry[]>();
  for (const e of entries) {
    const key = e.shift_name || 'Unbekannt';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Clock({ now }: { now: Date }) {
  const time = now.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div className="text-right">
      <div className="font-mono text-6xl font-bold text-white tracking-widest leading-none tabular-nums">
        {time}
      </div>
    </div>
  );
}

function ShiftCard({ entry }: { entry: OnDutyEntry }) {
  const active = isActiveShift(entry.startend);
  const progress = active ? shiftProgress(entry.startend) : 0;
  const minsLeft = active ? minutesUntilEnd(entry.startend) : 0;

  const bg = entry.color_bk || '#334155';
  const fg = entry.color_text || '#ffffff';

  // Decide text color for card body (always readable on dark bg)
  const nameParts = entry.employee_name.split(',');
  const displayName = nameParts.length >= 2
    ? `${nameParts[1].trim()} ${nameParts[0].trim()}`
    : entry.employee_name;

  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-lg border-2 transition-all duration-500 ${
      active ? 'border-emerald-400 shadow-emerald-500/30 shadow-2xl scale-[1.01]' : 'border-white/10 opacity-80'
    }`}
      style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}
    >
      {/* Shift color band top */}
      <div className="h-2 w-full" style={{ backgroundColor: bg }} />

      <div className="p-3">
        {/* Name + active badge */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div>
            <div className="font-bold text-white text-sm leading-tight">{displayName}</div>
            <div className="text-xs text-white/50 font-mono">{entry.employee_short}</div>
          </div>
          {active && (
            <span className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              aktiv
            </span>
          )}
        </div>

        {/* Shift info */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ backgroundColor: bg, color: fg, border: `1px solid ${bg}88` }}
          >
            {entry.shift_short}
          </span>
          <span className="text-xs text-white/60">{entry.startend}</span>
          {entry.workplace_name && (
            <span className="text-[10px] text-white/40 truncate">📍 {entry.workplace_name}</span>
          )}
        </div>

        {/* Progress bar */}
        {active && (
          <div className="mt-1">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${bg}cc, ${bg})`,
                }}
              />
            </div>
            <div className="text-[10px] text-white/40 mt-0.5 text-right">
              noch {minsLeft < 60 ? `${minsLeft} Min` : `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}min`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekBar({ weekDays }: { weekDays: { date: string; on_duty_count: number; absences_count: number }[] }) {
  if (!weekDays || weekDays.length === 0) return null;
  const max = Math.max(...weekDays.map(d => d.on_duty_count), 1);
  const today = new Date().toISOString().slice(0, 10);
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div className="flex items-end justify-center gap-3 h-20">
      {weekDays.map((d, i) => {
        const isToday = d.date === today;
        const h = Math.round((d.on_duty_count / max) * 56);
        return (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-white/40">{d.on_duty_count}</span>
            <div
              className={`w-7 rounded-t transition-all duration-500 ${isToday ? 'bg-emerald-400' : 'bg-white/20'}`}
              style={{ height: `${Math.max(h, 4)}px` }}
            />
            <span className={`text-xs font-bold ${isToday ? 'text-emerald-400' : 'text-white/40'}`}>
              {dayNames[i] ?? '?'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Leitwand() {
  const now = useNow(1000);
  const [data, setData] = useState<TodayData | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [ticker, setTicker] = useState(0); // rotating ticker index

  const load = useCallback(() => {
    Promise.all([
      fetch(`${API}/api/dashboard/today`).then(r => r.json()),
      fetch(`${API}/api/warnings`).then(r => r.json()).catch(() => []),
    ]).then(([today, warns]) => {
      setData(today);
      setWarnings(Array.isArray(warns) ? warns.slice(0, 5) : []);
      setLastRefresh(new Date());
    }).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh every 2 minutes
  useEffect(() => {
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, [load]);

  // Ticker rotation every 5s
  useEffect(() => {
    const id = setInterval(() => setTicker(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const onDuty = data?.on_duty ?? [];
  const absences = data?.absences ?? [];
  const grouped = groupByShift(onDuty);
  const shiftGroups = [...grouped.entries()];

  // Active shifts (currently running)
  const activeNow = onDuty.filter(e => isActiveShift(e.startend));

  // Ticker items: warnings + absences
  const tickerItems: string[] = [
    ...warnings.map(w => `${w.level === 'error' ? '⚠️' : 'ℹ️'} ${w.message}`),
    ...absences.map(a => `🏖️ ${a.employee_name} — ${a.leave_type}`),
    `🔄 Zuletzt aktualisiert: ${lastRefresh.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`,
  ];
  const currentTicker = tickerItems.length > 0 ? tickerItems[ticker % tickerItems.length] : null;

  const secondsToNextMinute = 60 - now.getSeconds();
  const progressToNextMinute = ((60 - secondsToNextMinute) / 60) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col select-none overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-8 pt-6 pb-4">
        {/* Left: date + weekbar */}
        <div>
          <div className="text-white/50 text-sm uppercase tracking-widest mb-1 font-medium">
            {data?.is_holiday ? '🎉 Feiertag · ' : ''}Dienstübersicht
          </div>
          <div className="text-white text-2xl font-semibold">
            {data ? formatDate(data.date) : '...'}
          </div>
          {data?.week_days && (
            <div className="mt-3">
              <WeekBar weekDays={data.week_days} />
            </div>
          )}
        </div>

        {/* Right: clock + controls */}
        <div className="flex flex-col items-end gap-4">
          <Clock now={now} />
          {/* Minute progress ring */}
          <div className="flex items-center gap-3">
            <div className="relative w-6 h-6">
              <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
                <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                <circle
                  cx="12" cy="12" r="10" fill="none"
                  stroke="rgba(52,211,153,0.8)" strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 10}`}
                  strokeDashoffset={`${2 * Math.PI * 10 * (1 - progressToNextMinute / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
            </div>
            <button
              onClick={load}
              className="text-white/30 hover:text-white/70 transition-colors text-xs"
              title="Jetzt aktualisieren"
            >
              🔄
            </button>
            <button
              onClick={toggleFullscreen}
              className="text-white/30 hover:text-white/70 transition-colors"
              title={fullscreen ? 'Vollbild beenden' : 'Vollbild'}
            >
              {fullscreen ? '⊡' : '⛶'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex gap-4 px-8 mb-5">
        <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 flex items-center gap-3">
          <span className="text-emerald-400 text-2xl font-bold">{activeNow.length}</span>
          <div>
            <div className="text-emerald-300 text-xs font-semibold uppercase tracking-wide">Aktiv jetzt</div>
            <div className="text-white/40 text-[10px]">Schicht läuft gerade</div>
          </div>
        </div>
        <div className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2 flex items-center gap-3">
          <span className="text-blue-400 text-2xl font-bold">{onDuty.length}</span>
          <div>
            <div className="text-blue-300 text-xs font-semibold uppercase tracking-wide">Im Dienst heute</div>
            <div className="text-white/40 text-[10px]">Gesamt eingeteilt</div>
          </div>
        </div>
        <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 flex items-center gap-3">
          <span className="text-amber-400 text-2xl font-bold">{absences.length}</span>
          <div>
            <div className="text-amber-300 text-xs font-semibold uppercase tracking-wide">Abwesend</div>
            <div className="text-white/40 text-[10px]">Urlaub / Krank</div>
          </div>
        </div>
        <div className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2 flex items-center gap-3">
          <span className="text-purple-400 text-2xl font-bold">{shiftGroups.length}</span>
          <div>
            <div className="text-purple-300 text-xs font-semibold uppercase tracking-wide">Schichttypen</div>
            <div className="text-white/40 text-[10px]">Heute aktiv</div>
          </div>
        </div>
      </div>

      {/* ── Main content: shift groups ── */}
      <div className="flex-1 px-8 overflow-y-auto">
        {onDuty.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30">
            <div className="text-6xl mb-4">🌙</div>
            <div className="text-xl font-medium">Keine Schichten heute</div>
          </div>
        ) : (
          <div className="space-y-6">
            {shiftGroups.map(([shiftName, entries]) => {
              const sampleEntry = entries[0];
              const bg = sampleEntry?.color_bk || '#334155';
              // color_text unused in group header
              const activeInGroup = entries.filter(e => isActiveShift(e.startend)).length;

              return (
                <div key={shiftName}>
                  {/* Group header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: bg }}
                    />
                    <h2 className="text-white/80 text-sm font-bold uppercase tracking-widest">
                      {shiftName}
                    </h2>
                    <span className="text-white/30 text-xs">{sampleEntry?.startend}</span>
                    {activeInGroup > 0 && (
                      <span className="ml-auto flex items-center gap-1 text-emerald-400 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                        {activeInGroup} aktiv
                      </span>
                    )}
                    <div className="flex-1 h-px bg-white/10 max-w-xs" />
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {entries.map(entry => (
                      <ShiftCard key={entry.employee_id} entry={entry} />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Absences section */}
            {absences.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <h2 className="text-white/80 text-sm font-bold uppercase tracking-widest">Abwesenheiten</h2>
                  <div className="flex-1 h-px bg-white/10 max-w-xs" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {absences.map((a, i) => {
                    const nameParts = a.employee_name.split(',');
                    const displayName = nameParts.length >= 2
                      ? `${nameParts[1].trim()} ${nameParts[0].trim()}`
                      : a.employee_name;
                    return (
                      <div
                        key={i}
                        className="rounded-2xl p-3 border border-amber-500/20"
                        style={{ background: 'rgba(251,191,36,0.06)', backdropFilter: 'blur(8px)' }}
                      >
                        <div className="text-amber-100 font-bold text-sm mb-0.5 truncate">{displayName}</div>
                        <div className="text-amber-300/70 text-xs">{a.leave_type}</div>
                        <div className="text-white/30 text-[10px] mt-1 font-mono">
                          {a.date_from}{a.date_to && a.date_to !== a.date_from ? ` – ${a.date_to}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Ticker bar ── */}
      <div className="mt-4 border-t border-white/10 bg-black/20 px-8 py-2 flex items-center gap-4">
        <span className="text-white/20 text-xs font-mono uppercase tracking-widest whitespace-nowrap">TICKER</span>
        <div className="flex-1 overflow-hidden">
          <div
            key={ticker}
            className="text-white/50 text-xs truncate transition-all duration-700 ease-in-out"
            style={{ animation: 'fadeSlide 0.5s ease' }}
          >
            {currentTicker ?? `SP5 Leitwand · ${onDuty.length} Mitarbeiter im Dienst`}
          </div>
        </div>
        <span className="text-white/20 text-[10px] font-mono whitespace-nowrap">
          ↻ {Math.ceil((120000 - (now.getTime() - lastRefresh.getTime())) / 1000 / 60)}min
        </span>
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
