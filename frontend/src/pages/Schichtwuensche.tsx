/**
 * Schichtwünsche & Sperrtage
 *
 * Mitarbeiter können Wünsche (bevorzugte Schichten) und Sperrtage
 * (Tage, an denen sie nicht können) eintragen.
 * Planer sehen alle Einträge in einer Monatsübersicht.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import type { Wish } from '../api/client';
import type { Employee, ShiftType } from '../types';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';

// ── helpers ──────────────────────────────────────────────────

const MONTH_NAMES = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
];
const WD_ABBR = ['So','Mo','Di','Mi','Do','Fr','Sa'];

function formatDateDE(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pad(n: number) { return String(n).padStart(2,'0'); }

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// ── component ────────────────────────────────────────────────

export default function Schichtwuensche() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [shifts,    setShifts]      = useState<ShiftType[]>([]);
  const [wishes,    setWishes]      = useState<Wish[]>([]);
  const [loading,   setLoading]     = useState(false);

  // filter / view state
  const [filterEmp,   setFilterEmp]   = useState<number | ''>('');
  const [filterType,  setFilterType]  = useState<'ALL' | 'WUNSCH' | 'SPERRUNG'>('ALL');
  const [viewMode,    setViewMode]    = useState<'calendar' | 'list'>('calendar');

  // add-wish dialog
  const [adding,      setAdding]      = useState(false);
  const [newDate,     setNewDate]     = useState('');
  const [newType,     setNewType]     = useState<'WUNSCH' | 'SPERRUNG'>('WUNSCH');
  const [newEmp,      setNewEmp]      = useState<number | ''>('');
  const [newShift,    setNewShift]    = useState<number | ''>('');
  const [newNote,     setNewNote]     = useState('');
  const [saving,      setSaving]      = useState(false);

  // Escape key closes add dialog
  useEffect(() => {
    if (!adding) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAdding(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [adding]);

  // ── load data ──────────────────────────────────────────────
  useEffect(() => {
    api.getEmployees().then(r => setEmployees(r.filter(e => !e.HIDE)));
    api.getShifts().then(r => setShifts(r.filter(s => !s.HIDE)));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.getWishes({ year, month })
      .then(w => setWishes(w))
      .catch(() => showToast('Fehler beim Laden der Wünsche', 'error'))
      .finally(() => setLoading(false));
  }, [year, month]);

  // ── derived ────────────────────────────────────────────────
  const empMap  = useMemo(() => new Map(employees.map(e => [e.ID, e])), [employees]);
  const shiftMap = useMemo(() => new Map(shifts.map(s => [s.ID, s])), [shifts]);

  const filteredWishes = useMemo(() =>
    wishes
      .filter(w => filterEmp === '' || w.employee_id === filterEmp)
      .filter(w => filterType === 'ALL' || w.wish_type === filterType),
    [wishes, filterEmp, filterType]);

  // Build map: date → wishes for calendar
  const wishMap = useMemo(() => {
    const m = new Map<string, Wish[]>();
    for (const w of filteredWishes) {
      const arr = m.get(w.date) ?? [];
      arr.push(w);
      m.set(w.date, arr);
    }
    return m;
  }, [filteredWishes]);

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

  // ── add wish ───────────────────────────────────────────────
  async function handleAdd() {
    if (!newDate || newEmp === '') {
      showToast('Bitte Mitarbeiter und Datum wählen', 'error');
      return;
    }
    setSaving(true);
    try {
      const w = await api.createWish({
        employee_id: newEmp as number,
        date: newDate,
        wish_type: newType,
        shift_id: newShift !== '' ? (newShift as number) : null,
        note: newNote,
      });
      setWishes(prev => [...prev, w]);
      showToast(`${newType === 'WUNSCH' ? 'Wunsch' : 'Sperrtag'} eingetragen ✓`, 'success');
      setAdding(false);
      setNewDate(''); setNewEmp(''); setNewShift(''); setNewNote('');
    } catch {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!await confirmDialog({ message: 'Eintrag löschen?', danger: true })) return;
    try {
      await api.deleteWish(id);
      setWishes(prev => prev.filter(w => w.id !== id));
      showToast('Gelöscht', 'success');
    } catch {
      showToast('Fehler beim Löschen', 'error');
    }
  }

  // ── open dialog for specific day (click on calendar cell) ──
  function openAddForDay(dateStr: string) {
    setNewDate(dateStr);
    setNewType('WUNSCH');
    setNewShift('');
    setNewNote('');
    setAdding(true);
  }

  // ── styles ─────────────────────────────────────────────────
  const bg      = isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900';
  const card    = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls= isDark
    ? 'bg-gray-700 border-gray-600 text-gray-100 focus:border-indigo-400'
    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500';
  const btnPrimary = 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition';

  // ── calendar cell ──────────────────────────────────────────
  function CalCell({ day }: { day: number }) {
    const dateStr  = isoDate(year, month, day);
    const jsWd     = new Date(year, month - 1, day).getDay();
    const isWe     = jsWd === 0 || jsWd === 6;
    const dayWishes = wishMap.get(dateStr) ?? [];
    const hasSperr  = dayWishes.some(w => w.wish_type === 'SPERRUNG');
    const hasWunsch = dayWishes.some(w => w.wish_type === 'WUNSCH');

    const cellBg = hasSperr
      ? (isDark ? 'bg-red-900/40' : 'bg-red-50')
      : hasWunsch
        ? (isDark ? 'bg-green-900/40' : 'bg-green-50')
        : isWe
          ? (isDark ? 'bg-gray-750' : 'bg-slate-50')
          : '';

    return (
      <div
        className={`relative min-h-[90px] border rounded-lg p-1.5 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition ${cellBg} ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
        onClick={() => openAddForDay(dateStr)}
        title={`${day}. ${MONTH_NAMES[month-1]} — klicken zum Hinzufügen`}
      >
        <div className={`text-xs font-semibold mb-1 ${isWe ? 'text-indigo-400' : ''}`}>
          {day} <span className="font-normal opacity-60">{WD_ABBR[jsWd]}</span>
        </div>
        <div className="space-y-0.5">
          {dayWishes.slice(0, 4).map(w => {
            const emp = empMap.get(w.employee_id);
            const sh  = w.shift_id ? shiftMap.get(w.shift_id) : null;
            const isS = w.wish_type === 'SPERRUNG';
            return (
              <div
                key={w.id}
                className={`flex items-center gap-1 text-[10px] rounded px-1 py-0.5 leading-tight group ${
                  isS
                    ? (isDark ? 'bg-red-800/60 text-red-200' : 'bg-red-100 text-red-800')
                    : (isDark ? 'bg-green-800/60 text-green-200' : 'bg-green-100 text-green-800')
                }`}
                title={w.note || undefined}
              >
                <span className="font-semibold truncate max-w-[70px]">
                  {emp ? (emp.SHORTNAME || emp.FIRSTNAME) : `MA${w.employee_id}`}
                </span>
                {sh && <span className="opacity-75 truncate">{sh.SHORTNAME}</span>}
                {isS && <span>🔴</span>}
                {!isS && <span>🟢</span>}
                <button aria-label="Schließen"
                  onClick={e => { e.stopPropagation(); handleDelete(w.id); }}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-current hover:text-red-500 transition"
                  title="Löschen"
                >×</button>
              </div>
            );
          })}
          {dayWishes.length > 4 && (
            <div className="text-[10px] opacity-60">+{dayWishes.length - 4} weitere</div>
          )}
        </div>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────
  return (
    <div className={`min-h-screen p-4 md:p-6 ${bg}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">🗓️ Schichtwünsche & Sperrtage</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Mitarbeiterwünsche und gesperrte Tage auf einen Blick
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm font-medium transition ${viewMode === 'calendar' ? 'bg-indigo-600 text-white' : (isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50')}`}
            >📅 Kalender</button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium transition ${viewMode === 'list' ? 'bg-indigo-600 text-white' : (isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50')}`}
            >📋 Liste</button>
          </div>
          <button onClick={() => { setAdding(true); setNewDate(isoDate(year, month, 1)); }} className={btnPrimary}>
            + Wunsch eintragen
          </button>
        </div>
      </div>

      {/* Month navigation + filter */}
      <div className={`flex flex-wrap items-center gap-4 mb-4 p-3 rounded-xl border ${card}`}>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition`}>‹</button>
          <span className="font-semibold text-base min-w-[160px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition`}>›</button>
        </div>

        {/* Employee filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium opacity-70">Mitarbeiter:</label>
          <select
            value={filterEmp}
            onChange={e => setFilterEmp(e.target.value === '' ? '' : Number(e.target.value))}
            className={`border rounded-lg px-2 py-1.5 text-sm ${inputCls}`}
          >
            <option value="">Alle</option>
            {employees.map(e => (
              <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>
            ))}
          </select>
        </div>

        {/* Type filter */}
        <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
          {(['ALL', 'WUNSCH', 'SPERRUNG'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-sm font-medium transition ${filterType === t ? 'bg-indigo-600 text-white' : (isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50')}`}
            >
              {t === 'ALL' ? 'Alle' : t === 'WUNSCH' ? '🟢 Wünsche' : '🔴 Sperrtage'}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 ml-auto text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500 inline-block"></span>
            <span className="opacity-70">Wunsch</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500 inline-block"></span>
            <span className="opacity-70">Sperrtag</span>
          </span>
        </div>
      </div>

      {/* Summary bar */}
      {filteredWishes.length > 0 && (
        <div className={`flex gap-4 mb-4 p-3 rounded-xl border text-sm ${card}`}>
          <span className="text-green-500 font-medium">
            🟢 {filteredWishes.filter(w => w.wish_type === 'WUNSCH').length} Wünsche
          </span>
          <span className="text-red-500 font-medium">
            🔴 {filteredWishes.filter(w => w.wish_type === 'SPERRUNG').length} Sperrtage
          </span>
          <span className="opacity-60">
            {filteredWishes.length} Einträge im {MONTH_NAMES[month - 1]}
          </span>
        </div>
      )}

      {loading && (
        <div className="text-center py-8 opacity-60">Lade Wünsche…</div>
      )}

      {/* ── Calendar view ── */}
      {!loading && viewMode === 'calendar' && (
        <div>
          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
              <div key={d} className={`text-center text-xs font-semibold py-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>
          {/* Day grid */}
          {(() => {
            // First weekday of month (0=Mo..6=So in our grid)
            const firstJs  = new Date(year, month - 1, 1).getDay(); // 0=Sun
            const firstOff = (firstJs + 6) % 7; // convert to 0=Mon
            const cells: React.ReactElement[] = [];
            // empty leading cells
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
          <p className={`text-xs mt-2 opacity-50`}>Auf einen Tag klicken, um einen Wunsch/Sperrtag hinzuzufügen.</p>
        </div>
      )}

      {/* ── List view ── */}
      {!loading && viewMode === 'list' && (
        <div className={`rounded-xl border overflow-hidden ${card}`}>
          {filteredWishes.length === 0 ? (
            <div className="py-12 text-center opacity-50">
              Keine Einträge für {MONTH_NAMES[month - 1]} {year}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
                  <th className="text-left px-4 py-2.5 font-semibold">Datum</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Mitarbeiter</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Typ</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Schicht</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Notiz</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filteredWishes
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((w, i) => {
                    const emp = empMap.get(w.employee_id);
                    const sh  = w.shift_id ? shiftMap.get(w.shift_id) : null;
                    const isS = w.wish_type === 'SPERRUNG';
                    const jsWd = new Date(w.date).getDay();
                    return (
                      <tr key={w.id} className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'} ${i % 2 === 0 ? '' : (isDark ? 'bg-gray-750' : 'bg-gray-50/50')}`}>
                        <td className="px-4 py-2">
                          <span className="font-medium">{formatDateDE(w.date)}</span>
                          <span className={`ml-1 text-xs opacity-60`}>{WD_ABBR[jsWd]}</span>
                        </td>
                        <td className="px-4 py-2">
                          {emp ? `${emp.NAME}, ${emp.FIRSTNAME}` : `MA${w.employee_id}`}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isS
                              ? (isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-700')
                              : (isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700')
                          }`}>
                            {isS ? '🔴 Sperrtag' : '🟢 Wunsch'}
                          </span>
                        </td>
                        <td className="px-4 py-2 opacity-80">
                          {sh ? <span className="font-medium">{sh.SHORTNAME}</span> : <span className="opacity-40">–</span>}
                        </td>
                        <td className="px-4 py-2 opacity-70 max-w-xs truncate">{w.note || '–'}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => handleDelete(w.id)}
                            className={`text-xs px-2 py-1 rounded transition ${isDark ? 'bg-red-900/50 hover:bg-red-800 text-red-300' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                          >Löschen</button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* ── Add dialog ── */}
      {adding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 border ${card}`}>
            <h2 className="text-lg font-bold mb-4">Wunsch / Sperrtag eintragen</h2>

            <div className="space-y-3">
              {/* Employee */}
              <div>
                <label className="block text-sm font-medium mb-1">Mitarbeiter *</label>
                <select
                  value={newEmp}
                  onChange={e => setNewEmp(e.target.value === '' ? '' : Number(e.target.value))}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${inputCls}`}
                >
                  <option value="">— wählen —</option>
                  {employees.map(e => (
                    <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium mb-1">Datum *</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${inputCls}`}
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Typ *</label>
                <div className="flex gap-3">
                  {(['WUNSCH', 'SPERRUNG'] as const).map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={newType === t}
                        onChange={() => setNewType(t)}
                        className="accent-indigo-600"
                      />
                      <span className={`text-sm font-medium ${t === 'WUNSCH' ? 'text-green-500' : 'text-red-500'}`}>
                        {t === 'WUNSCH' ? '🟢 Wunsch' : '🔴 Sperrtag'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Shift (optional, only for WUNSCH) */}
              {newType === 'WUNSCH' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Gewünschte Schicht (optional)</label>
                  <select
                    value={newShift}
                    onChange={e => setNewShift(e.target.value === '' ? '' : Number(e.target.value))}
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
                <input
                  type="text"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="z.B. Arzttermin, Urlaub geplant…"
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${inputCls}`}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={handleAdd} disabled={saving || !newDate || newEmp === ''} className={`flex-1 ${btnPrimary}`}>
                {saving ? 'Speichere…' : 'Speichern'}
              </button>
              <button
                onClick={() => setAdding(false)}
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
