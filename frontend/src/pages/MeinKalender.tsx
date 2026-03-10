/**
 * Mein Kalender — Persönlicher Schichtwunsch-Kalender
 *
 * Monatsansicht für Mitarbeiter (Leser-Rolle):
 * - Zeigt eigene zugewiesene Schichten
 * - Erlaubt Schichtwünsche einzutragen ("Ich möchte Frühschicht" / "Bitte nicht Spätschicht")
 * - Erreichbar im Self-Service-Bereich
 */

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import type { Wish } from '../api/client';
import type { ScheduleEntry, ShiftType } from '../types';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';

// ── helpers ──────────────────────────────────────────────────

const MONTH_NAMES = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
];
const WD_ABBR = ['So','Mo','Di','Mi','Do','Fr','Sa'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function isToday(year: number, month: number, day: number) {
  const t = new Date();
  return t.getFullYear() === year && t.getMonth() + 1 === month && t.getDate() === day;
}

// ── component ────────────────────────────────────────────────

export default function MeinKalender() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(false);

  // wish dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState('');
  const [wishType, setWishType] = useState<'WUNSCH' | 'SPERRUNG'>('WUNSCH');
  const [wishShift, setWishShift] = useState<number | ''>('');
  const [wishNote, setWishNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Escape key closes dialog
  useEffect(() => {
    if (!dialogOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDialogOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dialogOpen]);

  // ── load shifts once ───────────────────────────────────────
  useEffect(() => {
    api.getShifts().then(r => setShifts(r.filter(s => !s.HIDE)));
  }, []);

  // ── load schedule + wishes on month change ─────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getMySchedule(year, month),
      api.getMyWishes(year, month),
    ])
      .then(([sched, w]) => {
        setSchedule(sched);
        setWishes(w);
      })
      .catch(() => showToast('Fehler beim Laden', 'error'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // ── derived maps ───────────────────────────────────────────
  const shiftMap = useMemo(() => new Map(shifts.map(s => [s.ID, s])), [shifts]);

  const scheduleMap = useMemo(() => {
    const m = new Map<string, ScheduleEntry[]>();
    for (const e of schedule) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [schedule]);

  const wishMap = useMemo(() => {
    const m = new Map<string, Wish[]>();
    for (const w of wishes) {
      const arr = m.get(w.date) ?? [];
      arr.push(w);
      m.set(w.date, arr);
    }
    return m;
  }, [wishes]);

  const days = daysInMonth(year, month);

  // ── navigation ─────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }

  // ── open wish dialog ──────────────────────────────────────
  function openWishDialog(dateStr: string) {
    setDialogDate(dateStr);
    setWishType('WUNSCH');
    setWishShift('');
    setWishNote('');
    setDialogOpen(true);
  }

  // ── save wish ──────────────────────────────────────────────
  async function handleSaveWish() {
    if (!dialogDate) return;
    setSaving(true);
    try {
      const w = await api.createSelfWish({
        date: dialogDate,
        wish_type: wishType,
        shift_id: wishShift !== '' ? (wishShift as number) : null,
        note: wishNote || undefined,
      });
      setWishes(prev => [...prev, w]);
      showToast(
        wishType === 'WUNSCH' ? 'Schichtwunsch eingetragen ✓' : 'Sperrtag eingetragen ✓',
        'success',
      );
      setDialogOpen(false);
    } catch {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── delete wish ────────────────────────────────────────────
  async function handleDeleteWish(id: number) {
    if (!await confirmDialog({ message: 'Wunsch löschen?', danger: true })) return;
    try {
      await api.deleteSelfWish(id);
      setWishes(prev => prev.filter(w => w.id !== id));
      showToast('Gelöscht', 'success');
    } catch {
      showToast('Fehler beim Löschen', 'error');
    }
  }

  // ── styles ─────────────────────────────────────────────────
  const bg = isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900';
  const card = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = isDark
    ? 'bg-gray-700 border-gray-600 text-gray-100 focus:border-indigo-400'
    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500';
  const btnPrimary = 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition';

  // ── calendar cell ──────────────────────────────────────────
  function CalCell({ day }: { day: number }) {
    const dateStr = isoDate(year, month, day);
    const jsWd = new Date(year, month - 1, day).getDay();
    const isWe = jsWd === 0 || jsWd === 6;
    const isTod = isToday(year, month, day);

    const daySchedule = scheduleMap.get(dateStr) ?? [];
    const dayWishes = wishMap.get(dateStr) ?? [];

    const hasShift = daySchedule.length > 0;
    const hasSperr = dayWishes.some(w => w.wish_type === 'SPERRUNG');
    const hasWunsch = dayWishes.some(w => w.wish_type === 'WUNSCH');

    let cellBg = '';
    if (hasShift) cellBg = isDark ? 'bg-blue-900/30' : 'bg-blue-50';
    if (hasSperr) cellBg = isDark ? 'bg-red-900/40' : 'bg-red-50';
    if (!cellBg && isWe) cellBg = isDark ? 'bg-gray-750' : 'bg-slate-50';

    return (
      <div
        className={`relative min-h-[100px] border rounded-lg p-1.5 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition ${cellBg} ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isTod ? 'ring-2 ring-indigo-500' : ''}`}
        onClick={() => openWishDialog(dateStr)}
        title={`${day}. ${MONTH_NAMES[month - 1]} — klicken für Wunsch`}
      >
        {/* Day number */}
        <div className={`text-xs font-semibold mb-1 flex items-center gap-1 ${isWe ? 'text-indigo-400' : ''}`}>
          {isTod && <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">{day}</span>}
          {!isTod && <span>{day}</span>}
          <span className="font-normal opacity-60">{WD_ABBR[jsWd]}</span>
        </div>

        {/* Assigned shifts */}
        {daySchedule.map((entry, i) => (
          <div
            key={`s-${i}`}
            className="flex items-center gap-1 text-[10px] rounded px-1 py-0.5 mb-0.5 leading-tight"
            style={{
              backgroundColor: entry.color_bk || (isDark ? '#374151' : '#e5e7eb'),
              color: entry.color_text || (isDark ? '#f3f4f6' : '#1f2937'),
            }}
          >
            <span className="font-bold">📋</span>
            <span className="font-semibold truncate">{entry.display_name}</span>
          </div>
        ))}

        {/* Wishes */}
        {dayWishes.map(w => {
          const isS = w.wish_type === 'SPERRUNG';
          const sh = w.shift_id ? shiftMap.get(w.shift_id) : null;
          return (
            <div
              key={`w-${w.id}`}
              className={`flex items-center gap-1 text-[10px] rounded px-1 py-0.5 mb-0.5 leading-tight group ${
                isS
                  ? (isDark ? 'bg-red-800/60 text-red-200' : 'bg-red-100 text-red-800')
                  : (isDark ? 'bg-green-800/60 text-green-200' : 'bg-green-100 text-green-800')
              }`}
              title={w.note || undefined}
            >
              <span>{isS ? '🚫' : '💬'}</span>
              <span className="truncate">
                {isS ? 'Gesperrt' : (sh ? sh.SHORTNAME : 'Wunsch')}
              </span>
              {w.note && <span className="opacity-60 truncate">({w.note})</span>}
              <button
                aria-label="Löschen"
                onClick={e => { e.stopPropagation(); handleDeleteWish(w.id); }}
                className="ml-auto opacity-0 group-hover:opacity-100 text-current hover:text-red-500 transition"
                title="Löschen"
              >×</button>
            </div>
          );
        })}

        {/* Indicator if no entries but weekend */}
        {!hasShift && !hasWunsch && !hasSperr && (
          <div className="text-[10px] opacity-30 mt-1">+ Wunsch</div>
        )}
      </div>
    );
  }

  // ── summary stats ──────────────────────────────────────────
  const totalShifts = schedule.filter(e => e.kind === 'shift' || e.kind === 'special_shift').length;
  const totalWishes = wishes.filter(w => w.wish_type === 'WUNSCH').length;
  const totalBlocked = wishes.filter(w => w.wish_type === 'SPERRUNG').length;

  // ── render ─────────────────────────────────────────────────
  return (
    <div className={`min-h-screen p-4 md:p-6 ${bg}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">📅 Mein Kalender</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Deine Schichten und Wünsche auf einen Blick
          </p>
        </div>
      </div>

      {/* Month navigation */}
      <div className={`flex flex-wrap items-center gap-4 mb-4 p-3 rounded-xl border ${card}`}>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} aria-label="Vorheriger Monat" className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition`}>‹</button>
          <span className="font-semibold text-base min-w-[160px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} aria-label="Nächster Monat" className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition`}>›</button>
          <button onClick={goToday} className={`ml-2 px-3 py-1.5 text-xs rounded-lg font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} transition`}>Heute</button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 ml-auto text-sm flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }}></span>
            <span className="opacity-70">Zugewiesene Schicht</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500 inline-block"></span>
            <span className="opacity-70">Wunsch</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500 inline-block"></span>
            <span className="opacity-70">Gesperrt</span>
          </span>
        </div>
      </div>

      {/* Summary bar */}
      <div className={`flex gap-4 mb-4 p-3 rounded-xl border text-sm ${card}`}>
        <span className="text-blue-500 font-medium">📋 {totalShifts} Schichten</span>
        <span className="text-green-500 font-medium">💬 {totalWishes} Wünsche</span>
        <span className="text-red-500 font-medium">🚫 {totalBlocked} Sperrtage</span>
      </div>

      {loading && <LoadingSpinner />}

      {/* Calendar grid */}
      {!loading && (
        <div>
          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
              <div key={d} className={`text-center text-xs font-semibold py-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>
          {/* Day grid */}
          {(() => {
            const firstJs = new Date(year, month - 1, 1).getDay(); // 0=Sun
            const firstOff = (firstJs + 6) % 7; // convert to 0=Mon
            const cells: React.ReactElement[] = [];
            for (let i = 0; i < firstOff; i++) {
              cells.push(<div key={`e-${i}`} />);
            }
            for (let d = 1; d <= days; d++) {
              cells.push(<CalCell key={d} day={d} />);
            }
            return (
              <div className="grid grid-cols-7 gap-1">
                {cells}
              </div>
            );
          })()}
          <p className="text-xs mt-2 opacity-50">Auf einen Tag klicken, um einen Schichtwunsch oder Sperrtag einzutragen.</p>
        </div>
      )}

      {/* Upcoming wishes list */}
      {wishes.length > 0 && (
        <div className={`mt-6 rounded-xl border overflow-hidden ${card}`}>
          <h2 className={`px-4 py-3 font-semibold text-sm border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
            Meine Wünsche im {MONTH_NAMES[month - 1]}
          </h2>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {wishes
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(w => {
                const jsWd = new Date(w.date + 'T00:00:00').getDay();
                const sh = w.shift_id ? shiftMap.get(w.shift_id) : null;
                const isS = w.wish_type === 'SPERRUNG';
                const d = new Date(w.date + 'T00:00:00');
                return (
                  <div key={w.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isDark ? 'hover:bg-gray-700' : 'hover:bg-blue-50'} transition-colors`}>
                    <span className="text-lg">{isS ? '🚫' : '💬'}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">
                        {d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <span className="ml-1 opacity-60">{WD_ABBR[jsWd]}</span>
                      <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isS
                          ? (isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-700')
                          : (isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700')
                      }`}>
                        {isS ? 'Sperrtag' : (sh ? `Wunsch: ${sh.SHORTNAME}` : 'Wunsch')}
                      </span>
                      {w.note && <span className="ml-2 opacity-60 truncate">— {w.note}</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteWish(w.id)}
                      className={`text-xs px-2 py-1 rounded transition ${isDark ? 'bg-red-900/50 hover:bg-red-800 text-red-300' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                    >Löschen</button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Wish dialog ── */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-backdropIn">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 border ${card}`}>
            <h2 className="text-lg font-bold mb-1">Schichtwunsch eintragen</h2>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {new Date(dialogDate + 'T00:00:00').toLocaleDateString('de-AT', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>

            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Was möchtest du eintragen?</label>
                <div className="flex gap-3">
                  <label
                    className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                      wishType === 'WUNSCH'
                        ? (isDark ? 'border-green-500 bg-green-900/30' : 'border-green-500 bg-green-50')
                        : (isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300')
                    }`}
                  >
                    <input
                      type="radio"
                      checked={wishType === 'WUNSCH'}
                      onChange={() => setWishType('WUNSCH')}
                      className="accent-green-600"
                    />
                    <div>
                      <div className="text-sm font-medium">💬 Schichtwunsch</div>
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        &quot;Ich möchte gerne...&quot;
                      </div>
                    </div>
                  </label>
                  <label
                    className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                      wishType === 'SPERRUNG'
                        ? (isDark ? 'border-red-500 bg-red-900/30' : 'border-red-500 bg-red-50')
                        : (isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300')
                    }`}
                  >
                    <input
                      type="radio"
                      checked={wishType === 'SPERRUNG'}
                      onChange={() => setWishType('SPERRUNG')}
                      className="accent-red-600"
                    />
                    <div>
                      <div className="text-sm font-medium">🚫 Sperrtag</div>
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        &quot;Bitte nicht an diesem Tag&quot;
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Shift preference (only for WUNSCH) */}
              {wishType === 'WUNSCH' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Gewünschte Schicht (optional)</label>
                  <select
                    value={wishShift}
                    onChange={e => setWishShift(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${inputCls}`}
                  >
                    <option value="">— keine Präferenz —</option>
                    {shifts.map(s => (
                      <option key={s.ID} value={s.ID}>{s.SHORTNAME} – {s.NAME}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-medium mb-1">Notiz (optional)</label>
                <textarea
                  value={wishNote}
                  onChange={e => setWishNote(e.target.value)}
                  placeholder={wishType === 'WUNSCH'
                    ? 'z.B. "Ich würde gerne Frühschicht arbeiten"'
                    : 'z.B. "Arzttermin", "Bitte nicht Spätschicht"'
                  }
                  rows={2}
                  className={`w-full border rounded-lg px-3 py-2 text-sm resize-none ${inputCls}`}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSaveWish}
                disabled={saving}
                className={`flex-1 ${btnPrimary}`}
              >
                {saving ? 'Speichere…' : 'Eintragen'}
              </button>
              <button
                onClick={() => setDialogOpen(false)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium border transition ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >Abbrechen</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
