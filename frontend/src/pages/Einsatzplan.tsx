import { usePermissions } from '../hooks/usePermissions';
import { useGridPermissions, isPastDate } from '../hooks/useGridPermissions';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import { useSSERefresh } from '../contexts/SSEContext';
import type { DayEntry, Note, ScheduleTemplate } from '../api/client';
import type { Group, LeaveType, ShiftType, Workplace } from '../types';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useUndoRedo } from '../hooks/useUndoRedo';
import type { UndoableAction } from '../hooks/useUndoRedo';
import { UndoRedoStatus } from '../components/UndoRedoStatus';
import { ResponsiveTable } from '../components/ResponsiveTable';
import { occupiedShiftIds, shiftDurationForDate, datesInRange, byEmployeeName } from './einsatzplanUtils';
import { groupTreeOptions } from '../utils/groupTree';

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEKDAY_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// COLORREF (BGR-Int) ↔ #RRGGBB — wie in den Stammdaten-Dialogen (Shifts/Workplaces).
function hexToBGR(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (b << 16) | (g << 8) | r;
}
function bgrToHex(bgr: number | undefined): string {
  if (bgr == null) return '#ffffff';
  const b = bgr & 0xff, g = (bgr >> 8) & 0xff, r = (bgr >> 16) & 0xff;
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function getMondayOfWeek(d: Date): Date {
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(d, diff);
}

// ── Context Menu ──────────────────────────────────────────────
interface ContextMenuProps {
  x: number;
  y: number;
  entry: DayEntry;
  date: string;
  /** G-1: Sonderdienste eintragen/löschen (WDUTIES). */
  canDuties: boolean;
  /** G-1: Arbeitszeitabweichungen erfassen (WDEVIATION). */
  canDeviation: boolean;
  onClose: () => void;
  onAddSonderdienst: (entry: DayEntry) => void;
  onEditSonderdienst: (entry: DayEntry) => void;
  onAddAbweichung: (entry: DayEntry) => void;
  onDelete: (entry: DayEntry) => void;
}

function ContextMenu({ x, y, entry, canDuties, canDeviation, onClose, onAddSonderdienst, onEditSonderdienst, onAddAbweichung, onDelete }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasSpshi = entry.kind === 'special_shift' && entry.spshi_id != null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  // Adjust position to stay in viewport
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 160),
  };

  return (
    <div
      ref={ref}
      className="fixed z-[200] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-600 py-1 min-w-[200px]"
      style={style}
    >
      <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 mb-1">
        {entry.employee_name}
      </div>
      {/* G-1: Menüpunkte nur mit dem jeweiligen Schreibrecht */}
      {canDuties && (
        <button
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
          onClick={() => { onAddSonderdienst(entry); onClose(); }}
        >
          <span>🔷</span> Sonderdienst eintragen
        </button>
      )}
      {canDeviation && (
        <button
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2"
          onClick={() => { onAddAbweichung(entry); onClose(); }}
        >
          <span>⏱️</span> Arbeitszeitabweichung erfassen
        </button>
      )}
      {hasSpshi && canDuties && (
        <>
          <div className="border-t border-gray-100 my-1" />
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
            onClick={() => { onEditSonderdienst(entry); onClose(); }}
          >
            <span>✏️</span> Sonderdienst bearbeiten
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
            onClick={() => { onDelete(entry); onClose(); }}
          >
            <span>🗑️</span> Einsatzplan-Eintrag löschen
          </button>
        </>
      )}
    </div>
  );
}

// ── Sonderdienst Modal ────────────────────────────────────────
export interface SonderdienstEdit {
  id: number;
  name: string;
  shortname: string;
  shift_id: number;
  workplace_id: number;
  startend: string;
  colorBkHex?: string;   // A6: bestehende Farben/Stunden vorbefüllen
  colorTextHex?: string;
  duration?: number;
}

interface SonderdiensteModalProps {
  employee: DayEntry;
  date: string;
  shifts: ShiftType[];
  workplaces: Workplace[];
  existing?: SonderdienstEdit;  // gesetzt = Bearbeiten statt Neu (A6)
  onClose: () => void;
  onSave: (data: {
    id?: number;
    employee_id: number;
    date: string;
    name: string;
    shortname: string;
    shift_id: number;
    workplace_id: number;
    startend: string;
    colorbk: number;
    colortext: number;
    duration: number;
    noextra: boolean;  // SonderdiensteEintragen.12: keine Arbeitszeitzuschläge
    endDate?: string;  // A6: Mehrtages-Erfassung (nur Neuanlage)
  }) => Promise<void>;
}

const MAX_RANGE_DAYS = 92;  // A6: Sonderdienst-Mehrtages-Erfassung sinnvoll begrenzt

export function SonderdiensteModal({ employee, date, shifts, workplaces, existing, onClose, onSave }: SonderdiensteModalProps) {
  const isEdit = existing != null;
  const [shiftId, setShiftId] = useState<number>(existing?.shift_id || shifts[0]?.ID || 0);
  const [workplaceId, setWorkplaceId] = useState<number>(existing?.workplace_id ?? 0);
  const [startend, setStartend] = useState(existing?.startend ?? '');
  // Freier Name/Kurzname (A6) — vorbefüllt aus Bestand bzw. der gewählten Schicht
  const initShift = shifts.find(s => s.ID === (existing?.shift_id || shifts[0]?.ID));
  const [name, setName] = useState(existing?.name ?? initShift?.NAME ?? '');
  const [shortname, setShortname] = useState(existing?.shortname ?? initShift?.SHORTNAME ?? '');
  const [nameTouched, setNameTouched] = useState(isEdit);
  // Freie Farben + getrennte Arbeitsstunden (A6) — Default = gewählte Schicht/Tag.
  const [bgHex, setBgHex] = useState(existing?.colorBkHex ?? bgrToHex(initShift?.COLORBK ?? 16777215));
  const [textHex, setTextHex] = useState(existing?.colorTextHex ?? bgrToHex(initShift?.COLORTEXT ?? 0));
  const [colorsTouched, setColorsTouched] = useState(isEdit);
  const [hours, setHours] = useState(
    String(existing?.duration ?? shiftDurationForDate(initShift, date)),
  );
  const [hoursTouched, setHoursTouched] = useState(isEdit);
  const [endDate, setEndDate] = useState('');  // A6: leer = nur der eine Tag
  // SonderdiensteEintragen.12: „keine Arbeitszeitzuschläge berechnen" (5SPSHI.NOEXTRA);
  // nur bei der Neuanlage; beim Bearbeiten bleibt das gespeicherte Flag unberührt.
  const [noextra, setNoextra] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Schichtwechsel: Name/Kurzname/Farben/Stunden auf die neue Schicht setzen,
  // solange der Nutzer sie nicht selbst überschrieben hat (freie Werte bleiben).
  const onShiftChange = (id: number) => {
    setShiftId(id);
    const s = shifts.find(x => x.ID === id);
    if (!nameTouched) {
      setName(s?.NAME ?? '');
      setShortname(s?.SHORTNAME ?? '');
    }
    if (!colorsTouched) {
      setBgHex(bgrToHex(s?.COLORBK ?? 16777215));
      setTextHex(bgrToHex(s?.COLORTEXT ?? 0));
    }
    if (!hoursTouched) setHours(String(shiftDurationForDate(s, date)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftId) { setError('Bitte Schicht auswählen'); return; }
    if (!name.trim()) { setError('Bitte einen Namen angeben'); return; }
    if (!isEdit && endDate) {
      if (endDate < date) { setError('Das Bis-Datum liegt vor dem Startdatum'); return; }
      if (datesInRange(date, endDate).length > MAX_RANGE_DAYS) {
        setError(`Zeitraum zu groß (max. ${MAX_RANGE_DAYS} Tage)`); return;
      }
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        id: existing?.id,
        employee_id: employee.employee_id,
        date,
        name: name.trim(),
        shortname: (shortname || name).trim().slice(0, 20),
        shift_id: shiftId,
        workplace_id: workplaceId,
        startend,
        colorbk: hexToBGR(bgHex),
        colortext: hexToBGR(textHex),
        duration: parseFloat(hours) || 0,
        noextra,
        endDate: !isEdit && endDate ? endDate : undefined,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl animate-scaleIn w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          <span>🔷</span> {isEdit ? 'Sonderdienst bearbeiten' : 'Sonderdienst eintragen'}
        </h2>
        <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-800">
          <strong>{employee.employee_name}</strong> · {date}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Schicht *</label>
            <select
              value={shiftId}
              onChange={e => onShiftChange(Number(e.target.value))}
              className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            >
              <option value={0}>— Schicht wählen —</option>
              {shifts.map(s => (
                <option key={s.ID} value={s.ID}>{s.NAME} ({s.SHORTNAME})</option>
              ))}
            </select>
          </div>
          {/* Freier Name/Kurzname (A6) — abweichend von der Schichtbezeichnung */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setNameTouched(true); }}
                maxLength={100}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Kürzel</label>
              <input
                type="text"
                value={shortname}
                onChange={e => { setShortname(e.target.value); setNameTouched(true); }}
                maxLength={20}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Arbeitsplatz (optional)</label>
            <select
              value={workplaceId}
              onChange={e => setWorkplaceId(Number(e.target.value))}
              className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value={0}>— kein Arbeitsplatz —</option>
              {workplaces.map(w => (
                <option key={w.ID} value={w.ID}>{w.NAME}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Zeitbereich (optional, z.B. 06:00-14:00)</label>
            <input
              type="text"
              value={startend}
              onChange={e => setStartend(e.target.value)}
              placeholder="HH:MM-HH:MM"
              className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {/* Mehrtages-Erfassung (A6) — nur beim Neuanlegen; leer = nur der eine Tag */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Bis (optional — mehrere Tage)</label>
              <input
                type="date"
                aria-label="Bis-Datum"
                value={endDate}
                min={date}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {endDate && endDate >= date && (
                <p className="text-xs text-gray-500 mt-0.5">{datesInRange(date, endDate).length} Tage ({date} – {endDate})</p>
              )}
            </div>
          )}
          {/* Getrennte Arbeitsstunden (A6) — Default = Schichtstunden des Tages */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Arbeitsstunden</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={hours}
              onChange={e => { setHours(e.target.value); setHoursTouched(true); }}
              className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {/* SonderdiensteEintragen.12 — nur bei der Neuanlage */}
          {!isEdit && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={noextra}
                onChange={e => setNoextra(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              Keine Arbeitszeitzuschläge berechnen
            </label>
          )}
          {/* Freie Farben (A6) — Hintergrund + Schrift, Default = gewählte Schicht */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Hintergrundfarbe</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Hintergrundfarbe"
                  value={bgHex}
                  onChange={e => { setBgHex(e.target.value); setColorsTouched(true); }}
                  className="w-10 h-8 rounded border cursor-pointer"
                />
                <div className="flex-1 h-8 rounded border border-gray-200 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: bgHex, color: textHex }}>
                  {shortname || name || 'SD'}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Schriftfarbe</label>
              <input
                type="color"
                aria-label="Schriftfarbe"
                value={textHex}
                onChange={e => { setTextHex(e.target.value); setColorsTouched(true); }}
                className="w-10 h-8 rounded border cursor-pointer"
              />
            </div>
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={busy || !shiftId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {busy ? 'Speichern…' : '✅ Speichern'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
            >
              Abbruch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Abweichung Modal ─────────────────────────────────────────
interface AbweichungModalProps {
  employee: DayEntry;
  date: string;
  onClose: () => void;
  onSave: (data: {
    employee_id: number;
    date: string;
    name: string;
    shortname: string;
    startend: string;
    duration: number;
  }) => Promise<void>;
}

function AbweichungModal({ employee, date, onClose, onSave }: AbweichungModalProps) {
  const [name, setName] = useState('Arbeitszeitabweichung');
  const [shortname, setShortname] = useState('AZA');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMode, setDurationMode] = useState<'times' | 'duration'>('times');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const computedDuration = useMemo(() => {
    if (durationMode === 'duration') return parseFloat(durationMinutes) || 0;
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const start = sh * 60 + sm;
      let end = eh * 60 + em;
      if (end < start) end += 24 * 60;
      return end - start;
    }
    return 0;
  }, [durationMode, durationMinutes, startTime, endTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Bitte Bezeichnung eingeben'); return; }
    setBusy(true);
    setError('');
    const startend = (startTime && endTime) ? `${startTime}-${endTime}` : '';
    try {
      await onSave({
        employee_id: employee.employee_id,
        date,
        name: name.trim(),
        shortname: shortname.trim() || 'AZA',
        startend,
        duration: computedDuration,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl animate-scaleIn w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          <span>⏱️</span> Arbeitszeitabweichung
        </h2>
        <div className="mb-3 p-2 bg-amber-50 rounded text-sm text-amber-800">
          <strong>{employee.employee_name}</strong> · {date}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Bezeichnung *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Kürzel</label>
            <input
              type="text"
              value={shortname}
              onChange={e => setShortname(e.target.value)}
              maxLength={10}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Erfassungsmodus</label>
            <div className="flex rounded overflow-hidden border text-xs">
              <button
                type="button"
                onClick={() => setDurationMode('times')}
                className={`flex-1 py-1.5 ${durationMode === 'times' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >Start – Ende</button>
              <button
                type="button"
                onClick={() => setDurationMode('duration')}
                className={`flex-1 py-1.5 border-l ${durationMode === 'duration' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >Dauer (Min)</button>
            </div>
          </div>
          {durationMode === 'times' ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Beginn</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Ende</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Dauer (Minuten)</label>
              <input
                type="number"
                min={0}
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}
          {computedDuration > 0 && (
            <div className="text-xs text-gray-500">
              Dauer: {Math.floor(computedDuration / 60)}h {computedDuration % 60}min ({computedDuration} Min.)
            </div>
          )}
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 text-sm"
            >
              {busy ? 'Speichern…' : '✅ Speichern'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
            >
              Abbruch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EinsatzplanNotePopup ──────────────────────────────────────
function EinsatzplanNotePopup({
  x, y, notes, onClose, onEdited, onDeleted,
}: {
  x: number; y: number; notes: Note[];
  onClose: () => void;
  onEdited: (id: number, text: string) => Promise<void>;
  onDeleted: (id: number) => Promise<void>;
}) {
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[110] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 text-xs dark:text-gray-200"
      style={{ left: x, top: y, minWidth: 200, maxWidth: 280 }}
    >
      <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 border-b dark:border-gray-600 text-[10px] text-indigo-600 dark:text-indigo-300 font-semibold rounded-t-lg flex justify-between">
        <span>📝 Notizen</span>
        <button aria-label="Schließen" onClick={onClose} className="text-gray-600 hover:text-gray-200 dark:text-gray-500 dark:hover:text-gray-200">×</button>
      </div>
      {notes.map(note => (
        <div key={note.id} className="p-2 border-b last:border-b-0">
          {editingId === note.id ? (
            <div>
              <textarea
                autoFocus
                className="w-full border rounded p-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                rows={3}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setBusy(true);
                    onEdited(note.id, editText.trim()).then(() => { setBusy(false); setEditingId(null); });
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
              <div className="flex gap-1 mt-1">
                <button
                  className="flex-1 px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-[11px]"
                  disabled={busy || !editText.trim()}
                  onClick={() => {
                    setBusy(true);
                    onEdited(note.id, editText.trim()).then(() => { setBusy(false); setEditingId(null); });
                  }}
                >{busy ? '…' : 'Speichern'}</button>
                <button className="px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-[11px]" onClick={() => setEditingId(null)}>Abbruch</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-gray-700 dark:text-gray-300 mb-1.5 whitespace-pre-wrap break-words">{note.text1}{note.text2 ? `\n${note.text2}` : ''}</div>
              <div className="flex gap-1">
                <button
                  className="px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-[11px]"
                  onClick={() => { setEditingId(note.id); setEditText(note.text1 || ''); }}
                >✏️ Bearbeiten</button>
                <button
                  className="px-2 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100 text-[11px]"
                  disabled={busy}
                  onClick={async () => {
                    if (!await confirmDialog({ message: 'Notiz löschen?', danger: true })) return;
                    setBusy(true);
                    onDeleted(note.id).then(() => { setBusy(false); onClose(); });
                  }}
                >🗑️ Löschen</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}

// Badge showing shift assignment for one employee
function ShiftBadge({
  entry, notes, onNoteClick, onContextMenu,
}: {
  entry: DayEntry;
  notes?: Note[];
  onNoteClick?: (e: React.MouseEvent, notes: Note[]) => void;
  onContextMenu?: (e: React.MouseEvent, entry: DayEntry) => void;
}) {
  if (!entry.kind) return null;
  const hasNote = notes && notes.length > 0;
  const noteTitle = hasNote ? notes.map(n => [n.text1, n.text2].filter(Boolean).join(' ')).join('\n') : '';
  const isSpshi = entry.kind === 'special_shift';
  const isDeviation = isSpshi && entry.spshi_type === 1;
  const isCycle = entry.source === 'cycle';

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold cursor-context-menu"
      style={{
        backgroundColor: entry.color_bk,
        color: entry.color_text,
        border: isDeviation
          ? '2px dashed #F59E0B'
          : isSpshi
            ? '2px dashed rgba(0,0,0,0.35)'
            : '1px solid rgba(0,0,0,0.1)',
        boxShadow: isSpshi ? '0 0 0 1px rgba(255,255,255,0.4) inset' : undefined,
        backgroundImage: isCycle
          ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 2px, transparent 2px, transparent 6px)'
          : undefined,
      }}
      title={(entry.shift_name || entry.leave_name || entry.display_name) + (isCycle ? ' · aus Schichtmodell (Zyklus)' : '')}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, entry); }}
    >
      {isDeviation && <span className="text-[9px]">⏱</span>}
      {isSpshi && !isDeviation && <span className="text-[9px]">★</span>}
      {isCycle && <span className="text-[9px]" aria-hidden="true">↻</span>}
      <span>{entry.display_name || '?'}</span>
      <span className="opacity-70 font-normal">{entry.employee_name}</span>
      {hasNote && (
        <button
          className="ml-0.5 text-[10px] hover:scale-125 transition-transform leading-none"
          title={noteTitle}
          onClick={e => { e.stopPropagation(); onNoteClick?.(e, notes!); }}
        >
          💬
        </button>
      )}
    </div>
  );
}

// ── Empty employee cell (for right-clicking to add) ──────────
function EmptyEmployeeCell({
  entry,
  onContextMenu,
}: {
  entry: DayEntry;
  onContextMenu?: (e: React.MouseEvent, entry: DayEntry) => void;
}) {
  return (
    <span
      className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 cursor-context-menu hover:bg-gray-200"
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, entry); }}
      title="Rechtsklick für Optionen"
    >
      {entry.employee_name}
    </span>
  );
}

// Day view: one date
function DayView({
  date,
  entries,
  shifts,
  notesByEmpId,
  onNoteClick,
  onContextMenu,
}: {
  date: string;
  entries: DayEntry[];
  shifts: ShiftType[];
  notesByEmpId?: Map<number, Note[]>;
  onNoteClick?: (e: React.MouseEvent, notes: Note[]) => void;
  onContextMenu?: (e: React.MouseEvent, entry: DayEntry) => void;
}) {
  // Group entries by shift_id
  const byShift = new Map<number | null, DayEntry[]>();
  const freeEntries: DayEntry[] = [];

  for (const e of entries) {
    if (!e.kind) {
      freeEntries.push(e);
    } else if (e.kind === 'absence') {
      const key = null;
      if (!byShift.has(key)) byShift.set(key, []);
      byShift.get(key)!.push(e);
    } else {
      const key = e.shift_id;
      if (!byShift.has(key)) byShift.set(key, []);
      byShift.get(key)!.push(e);
    }
  }
  byShift.forEach(list => list.sort(byEmployeeName));
  freeEntries.sort(byEmployeeName);

  const d = new Date(date + 'T12:00:00');
  const weekdayName = WEEKDAY_NAMES[d.getDay()];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 border-b dark:border-gray-600 pb-1">
        {weekdayName}, {date}
      </h2>

      {shifts.map(shift => {
        const shiftEntries = byShift.get(shift.ID) || [];
        return (
          <div key={shift.ID} className="rounded-lg border overflow-hidden">
            <div
              className="px-3 py-1.5 text-sm font-bold"
              style={{ backgroundColor: shift.COLORBK_HEX, color: shift.COLORTEXT_HEX }}
            >
              {shift.NAME} ({shift.SHORTNAME})
              <span className="ml-2 font-normal opacity-80">— {shiftEntries.length} MA</span>
            </div>
            <div className="p-2 flex flex-wrap gap-1.5 bg-white dark:bg-gray-800 min-h-[40px]">
              {shiftEntries.length === 0 ? (
                <span className="text-xs text-gray-600 dark:text-gray-500 italic">Niemand eingetragen</span>
              ) : (
                shiftEntries.map(e => (
                  <ShiftBadge
                    key={e.employee_id}
                    entry={e}
                    notes={notesByEmpId?.get(e.employee_id)}
                    onNoteClick={onNoteClick}
                    onContextMenu={onContextMenu}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}

      {/* Absences section */}
      {byShift.has(null) && (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-3 py-1.5 text-sm font-bold bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
            Abwesend — {byShift.get(null)!.length} MA
          </div>
          <div className="p-2 flex flex-wrap gap-1.5 bg-white dark:bg-gray-800">
            {byShift.get(null)!.map(e => (
              <ShiftBadge
                key={e.employee_id}
                entry={e}
                notes={notesByEmpId?.get(e.employee_id)}
                onNoteClick={onNoteClick}
                onContextMenu={onContextMenu}
              />
            ))}
          </div>
        </div>
      )}

      {/* Free employees */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-3 py-1.5 text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          Frei / kein Eintrag — {freeEntries.length} MA
          <span className="ml-2 text-[10px] font-normal text-gray-600 dark:text-gray-500">Rechtsklick zum Eintragen</span>
        </div>
        <div className="p-2 flex flex-wrap gap-1.5 bg-white dark:bg-gray-800 min-h-[36px]">
          {freeEntries.length === 0 ? (
            <span className="text-xs text-gray-600 dark:text-gray-500 italic">Alle eingeteilt</span>
          ) : (
            freeEntries.map(e => (
              <EmptyEmployeeCell key={e.employee_id} entry={e} onContextMenu={onContextMenu} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Week view: Mon–Sun columns, shifts as rows
function WeekView({
  weekDates,
  entriesByDate,
  shifts,
  leaveTypes,
  hideEmpty,
  onContextMenu,
}: {
  weekDates: string[];
  entriesByDate: Map<string, DayEntry[]>;
  shifts: ShiftType[];
  leaveTypes: LeaveType[];
  hideEmpty: boolean;
  onContextMenu?: (e: React.MouseEvent, entry: DayEntry, date: string) => void;
}) {
  // Original-Layout (Spec 4.3): unter den Schichtzeilen eine Zeile JE
  // Abwesenheitsart mit den abwesenden Mitarbeitern; leere Arten sind über
  // die bestehende Ausblenden-Option (hideEmpty) abschaltbar.
  const absenceNamesInWeek = new Set<string>();
  for (const d of weekDates) {
    for (const e of entriesByDate.get(d) || []) {
      if (e.kind === 'absence') absenceNamesInWeek.add(e.leave_name || e.display_name);
    }
  }
  const absenceRows = leaveTypes.filter(lt => !hideEmpty || absenceNamesInWeek.has(lt.NAME));
  return (
    <ResponsiveTable stickyFirstCol minWidth="600px">
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr className="bg-slate-700 text-white">
            <th scope="col" className="px-3 py-2 text-left min-w-[120px] border-r border-slate-600 sticky left-0 z-10 bg-slate-700">
              Schicht
            </th>
            {weekDates.map(d => {
              const date = new Date(d + 'T12:00:00');
              const dow = date.getDay();
              const isWe = dow === 0 || dow === 6;
              return (
                <th scope="col"
                  key={d}
                  className={`px-2 py-1.5 text-center min-w-[120px] border-r border-slate-600 ${isWe ? 'bg-slate-600' : ''}`}
                >
                  <div className="font-bold">{WEEKDAY_ABBR[dow]}</div>
                  <div className="text-slate-300 text-[10px]">{d.slice(8)}.{d.slice(5, 7)}.</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shifts.map(shift => (
            <tr key={shift.ID}>
              <td
                className="sticky left-0 z-10 px-3 py-1.5 border border-gray-200 font-semibold text-sm whitespace-nowrap"
                style={{ backgroundColor: shift.COLORBK_HEX, color: shift.COLORTEXT_HEX }}
              >
                {shift.SHORTNAME}
              </td>
              {weekDates.map(d => {
                const dayEntries = entriesByDate.get(d) || [];
                const shiftEntries = dayEntries.filter(e => e.shift_id === shift.ID).sort(byEmployeeName);
                return (
                  <td key={d} className="border border-gray-200 p-1 align-top">
                    <div className="flex flex-col gap-0.5">
                      {shiftEntries.map(e => {
                        const isSpshi = e.kind === 'special_shift';
                        const isDeviation = isSpshi && e.spshi_type === 1;
                        const isCycle = e.source === 'cycle';
                        return (
                          <div
                            key={e.employee_id}
                            className="px-1 py-0.5 rounded text-[10px] font-semibold cursor-context-menu"
                            style={{
                              backgroundColor: e.color_bk,
                              color: e.color_text,
                              border: isDeviation
                                ? '2px dashed #F59E0B'
                                : isSpshi
                                  ? '2px dashed rgba(0,0,0,0.3)'
                                  : '1px solid rgba(0,0,0,0.1)',
                              backgroundImage: isCycle
                                ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 2px, transparent 2px, transparent 6px)'
                                : undefined,
                            }}
                            onContextMenu={ev => { ev.preventDefault(); onContextMenu?.(ev, e, d); }}
                            title={`${e.employee_name}${isSpshi ? ' (Sonderdienst)' : ''}${isDeviation ? ' (Abweichung)' : ''}${isCycle ? ' (aus Schichtmodell/Zyklus)' : ''}`}
                          >
                            {isDeviation && '⏱'}
                            {isSpshi && !isDeviation && '★'}
                            {isCycle && '↻ '}
                            {e.employee_name}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {/* Je Abwesenheitsart eine Zeile (Original-Layout) */}
          {absenceRows.map(lt => (
            <tr key={`lt-${lt.ID}`} data-testid={`einsatz-absence-row-${lt.ID}`}>
              <td
                className="sticky left-0 z-10 px-3 py-1.5 border border-gray-200 font-semibold text-sm whitespace-nowrap"
                style={{ backgroundColor: lt.COLORBK_HEX || '#fef3c7', color: lt.COLORBK_LIGHT === false ? '#fff' : '#374151' }}
              >
                {lt.NAME}
              </td>
              {weekDates.map(d => {
                const absences = (entriesByDate.get(d) || []).filter(
                  e => e.kind === 'absence' && (e.leave_name || e.display_name) === lt.NAME,
                ).sort(byEmployeeName);
                return (
                  <td key={d} className="border border-gray-200 p-1 align-top">
                    <div className="flex flex-col gap-0.5">
                      {absences.map(e => (
                        <div
                          key={e.employee_id}
                          className="px-1 py-0.5 rounded text-[10px] font-semibold cursor-context-menu"
                          style={{ backgroundColor: e.color_bk, color: e.color_text, border: '1px solid rgba(0,0,0,0.1)' }}
                          onContextMenu={ev => { ev.preventDefault(); onContextMenu?.(ev, e, d); }}
                        >
                          {e.employee_name}
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {/* Free row */}
          <tr>
            <td className="sticky left-0 z-10 px-3 py-1.5 border border-gray-200 dark:border-gray-600 font-semibold text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
              Frei
            </td>
            {weekDates.map(d => {
              const dayEntries = entriesByDate.get(d) || [];
              const free = dayEntries.filter(e => !e.kind);
              return (
                <td key={d} className="border border-gray-200 dark:border-gray-600 p-1 align-top bg-gray-50 dark:bg-gray-800">
                  <div className="flex flex-col gap-0.5">
                    {free.map(e => (
                      <div
                        key={e.employee_id}
                        className="text-[10px] text-gray-500 cursor-context-menu px-1 py-0.5 rounded hover:bg-gray-200"
                        onContextMenu={ev => { ev.preventDefault(); onContextMenu?.(ev, e, d); }}
                        title="Rechtsklick für Optionen"
                      >
                        {e.employee_name}
                      </div>
                    ))}
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

// ── Save Template Modal ───────────────────────────────────────
function SaveTemplateModal({
  weekLabel,
  onClose,
  onSave,
}: {
  weekLabel: string;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Bitte einen Namen eingeben'); return; }
    setBusy(true);
    setError('');
    try {
      await onSave(name.trim(), description.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl animate-scaleIn w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
          <span>📋</span> Woche als Vorlage speichern
        </h2>
        <p className="text-sm text-gray-500 mb-4">{weekLabel}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Name *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Standard-Wochenbelegung"
              className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Beschreibung (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="z.B. Sommer-Schichtplan"
              className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {busy ? 'Speichern…' : '💾 Speichern'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm">
              Abbruch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Apply Template Modal ───────────────────────────────────────
function ApplyTemplateModal({
  template,
  onClose,
  onApply,
}: {
  template: ScheduleTemplate;
  onClose: () => void;
  onApply: (templateId: number, targetDate: string, force: boolean) => Promise<{ created: number; updated: number; skipped: number; template_name: string }>;
}) {
  const today = new Date();
  const mondayStr = toIsoDate(getMondayOfWeek(today));
  const [targetDate, setTargetDate] = useState(mondayStr);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; template_name: string } | null>(null);
  const [error, setError] = useState('');

  const handleApply = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await onApply(template.id, targetDate, force);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anwenden');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl animate-scaleIn w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
          <span>▶️</span> Vorlage anwenden
        </h2>
        <p className="text-sm font-medium text-blue-700 mb-1">„{template.name}"</p>
        {template.description && (
          <p className="text-xs text-gray-500 mb-3">{template.description}</p>
        )}
        <p className="text-xs text-gray-500 mb-4">
          {template.assignments.length} Einträge · erstellt {template.created_at.slice(0, 10)}
        </p>
        {result ? (
          <div className="space-y-3">
            <div className="text-green-700 text-sm bg-green-50 rounded-lg p-3 border border-green-200">
              <p className="font-semibold mb-1">✅ Vorlage angewendet!</p>
              <p className="text-xs">{result.created} erstellt · {result.updated} aktualisiert · {result.skipped} übersprungen</p>
            </div>
            <button onClick={onClose} className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
              Schließen
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Ziel-Montag (Wochenanfang)</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={force}
                onChange={e => setForce(e.target.checked)}
                className="rounded"
              />
              Bestehende Einträge überschreiben
            </label>
            {error && <div className="text-red-600 text-xs">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleApply}
                disabled={busy}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {busy ? 'Anwenden…' : '▶️ Anwenden'}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm">
                Abbruch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Templates Panel ───────────────────────────────────────────
function TemplatesPanel({
  templates,
  onClose,
  onApply,
  onDelete,
  loading,
}: {
  templates: ScheduleTemplate[];
  onClose: () => void;
  onApply: (template: ScheduleTemplate) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[250] right-4 top-16 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 w-80 max-h-[70vh] flex flex-col"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b bg-indigo-50 rounded-t-xl">
        <h3 className="font-bold text-indigo-900 flex items-center gap-2">
          <span>📋</span> Gespeicherte Vorlagen
        </h3>
        <button aria-label="Schließen" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>
      <div className="overflow-y-auto flex-1 p-3 space-y-2">
        {loading && <p className="text-sm text-gray-600 text-center py-4">Lade…</p>}
        {!loading && templates.length === 0 && (
          <p className="text-sm text-gray-600 text-center py-6">
            Keine Vorlagen vorhanden.<br />
            <span className="text-xs">Woche anzeigen → „Als Vorlage speichern"</span>
          </p>
        )}
        {templates.map(t => (
          <div key={t.id} className="border rounded-lg p-3 bg-gray-50 hover:bg-white transition-colors">
            <div className="font-semibold text-sm text-gray-800 truncate">{t.name}</div>
            {t.description && <div className="text-xs text-gray-500 truncate mb-1">{t.description}</div>}
            <div className="text-[11px] text-gray-600 mb-2">
              {t.assignments.length} Eintr. · {t.created_at.slice(0, 10)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onApply(t)}
                className="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 font-medium"
              >
                ▶️ Anwenden
              </button>
              <button
                onClick={() => {
                  if (confirm(`Vorlage „${t.name}" wirklich löschen?`)) onDelete(t.id);
                }}
                className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Einsatzplan() {
  const { canEditSchedule: canEdit } = usePermissions();
  // G-1: granulare 5USER-Schreibrechte (WDUTIES/WDEVIATION/WPAST)
  const grid = useGridPermissions();
  const today = new Date();
  const todayStr = toIsoDate(today);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();

  // Keep a ref to loadData so undo/redo callbacks can call it
  const loadDataRef = useRef<() => void>(() => {});

  // ── Undo/Redo ─────────────────────────────────────────────
  const undoRedo = useUndoRedo({
    onUndo: async (action: UndoableAction) => {
      switch (action.type) {
        case 'create_sonderdienst':
        case 'create_deviation': {
          // Undo a create → delete the created record(s).
          // Sonderdienst kann mehrere Tage umfassen (createdIds), Abweichung genau einen.
          const ids = (action.undoData.createdIds as number[] | undefined)
            ?? [action.undoData.createdId as number];
          for (const id of ids) await api.deleteEinsatzplanEntry(id);
          break;
        }
        case 'delete_entry': {
          // Undo a delete → re-create the entry
          const d = action.undoData as Record<string, unknown>;
          if (d.type === 1) {
            // It was a deviation
            await api.createDeviation({
              employee_id: d.employee_id as number,
              date: d.date as string,
              name: d.name as string,
              shortname: d.shortname as string,
              startend: d.startend as string,
              duration: d.duration as number,
            });
          } else {
            // Regular Sonderdienst
            await api.createEinsatzplanEntry({
              employee_id: d.employee_id as number,
              date: d.date as string,
              name: d.name as string,
              shortname: d.shortname as string,
              shift_id: d.shift_id as number,
              workplace_id: d.workplace_id as number,
              startend: d.startend as string,
              colorbk: d.colorbk as number,
              colortext: d.colortext as number,
              duration: d.duration as number,
            });
          }
          break;
        }
      }
      loadDataRef.current();
    },
    onRedo: async (action: UndoableAction) => {
      switch (action.type) {
        case 'create_sonderdienst': {
          const d = action.redoData as Record<string, unknown>;
          // Mehrtages-Erfassung: je Tag neu anlegen (Fallback: der eine Tag).
          const days = (d.dates as string[] | undefined) ?? [d.date as string];
          const createdIds: number[] = [];
          for (const day of days) {
            const res = await api.createEinsatzplanEntry({
              employee_id: d.employee_id as number,
              date: day,
              name: d.name as string,
              shortname: d.shortname as string,
              shift_id: d.shift_id as number,
              workplace_id: d.workplace_id as number,
              startend: d.startend as string,
              colorbk: d.colorbk as number,
              colortext: d.colortext as number,
              duration: d.duration as number,
            });
            createdIds.push(res.record.id);
          }
          action.undoData.createdIds = createdIds;
          break;
        }
        case 'create_deviation': {
          const d = action.redoData as Record<string, unknown>;
          const res = await api.createDeviation({
            employee_id: d.employee_id as number,
            date: d.date as string,
            name: d.name as string,
            shortname: d.shortname as string,
            startend: d.startend as string,
            duration: d.duration as number,
          });
          action.undoData.createdId = res.record.id;
          break;
        }
        case 'delete_entry': {
          const id = action.redoData.entryId as number;
          await api.deleteEinsatzplanEntry(id);
          break;
        }
      }
      loadDataRef.current();
    },
  });

  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  useEffect(() => { api.getLeaveTypes().then(setLeaveTypes).catch(() => {}); }, []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);

  const [groups, setGroups] = useState<Group[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(false);

  // Employee search
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Leere Schichtzeilen im sichtbaren Zeitraum ausblenden (Spec 4.3-5 / 4.11.10-2)
  const [hideEmptyShifts, setHideEmptyShifts] = useState(false);

  // Notes for day view: empId → Note[]
  const [dayNotesMap, setDayNotesMap] = useState<Map<number, Note[]>>(new Map());
  const [notePopup, setNotePopup] = useState<{ x: number; y: number; notes: Note[] } | null>(null);

  // Day mode: single date entries
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);

  // Week mode: map date → entries
  const [weekEntries, setWeekEntries] = useState<Map<string, DayEntry[]>>(new Map());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; entry: DayEntry; date: string;
  } | null>(null);

  // Modal state
  const [sonderdiensteModal, setSonderdiensteModal] = useState<{ entry: DayEntry; date: string; existing?: SonderdienstEdit } | null>(null);
  const [abweichungModal, setAbweichungModal] = useState<{ entry: DayEntry; date: string } | null>(null);

  // ── Template state ────────────────────────────────────────
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [applyTemplateModal, setApplyTemplateModal] = useState<ScheduleTemplate | null>(null);

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    api.getScheduleTemplates()
      .then(data => { setTemplates(data); setTemplatesLoading(false); })
      .catch(() => setTemplatesLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      api.getGroups(),
      api.getShifts(),
      api.getWorkplaces(),
    ]).then(([g, s, w]) => {
      setGroups(g);
      setShifts(s);
      setWorkplaces(w);
    });
    loadTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(() => {
    if (viewMode === 'day') {
      setLoading(true);
      const dateStr = toIsoDate(selectedDate);
      Promise.all([
        api.getScheduleDay(dateStr, groupId),
        api.getNotes({ date: dateStr }),
      ]).then(([data, notes]) => {
        setDayEntries(data);
        const nmap = new Map<number, Note[]>();
        for (const n of notes) {
          const eid = n.employee_id ?? 0;
          if (!nmap.has(eid)) nmap.set(eid, []);
          nmap.get(eid)!.push(n);
        }
        setDayNotesMap(nmap);
        setLoading(false);
      }).catch(e => { showToast(e.message ?? 'Ladefehler', 'error'); setLoading(false); });
    } else {
      const monday = getMondayOfWeek(selectedDate);
      const weekDates = Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(monday, i)));
      setLoading(true);
      Promise.all(weekDates.map(d => api.getScheduleDay(d, groupId)))
        .then(results => {
          const map = new Map<string, DayEntry[]>();
          weekDates.forEach((d, i) => map.set(d, results[i]));
          setWeekEntries(map);
          setLoading(false);
        })
        .catch(e => { showToast(e.message ?? 'Ladefehler', 'error'); setLoading(false); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, viewMode, groupId]);

  // Load data when date/mode/group changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep loadDataRef in sync
  loadDataRef.current = loadData;

  // Real-time SSE refresh
  useSSERefresh(['schedule_changed', 'absence_changed', 'employee_changed', 'note_added', 'note_updated', 'note_deleted'], loadData);

  const reloadDayNotes = () => {
    const dateStr = toIsoDate(selectedDate);
    api.getNotes({ date: dateStr }).then(notes => {
      const nmap = new Map<number, Note[]>();
      for (const n of notes) {
        const eid = n.employee_id ?? 0;
        if (!nmap.has(eid)) nmap.set(eid, []);
        nmap.get(eid)!.push(n);
      }
      setDayNotesMap(nmap);
    }).catch(() => {});
  };

  const handleEinsatzplanNoteEdited = async (id: number, text: string) => {
    if (!grid.notes) { showToast('Keine Schreibberechtigung für Notizen (WNOTES)', 'error'); return; }
    await api.updateNote(id, { text });
    reloadDayNotes();
  };

  const handleEinsatzplanNoteDeleted = async (id: number) => {
    if (!grid.notes) { showToast('Keine Schreibberechtigung für Notizen (WNOTES)', 'error'); return; }
    await api.deleteNote(id);
    reloadDayNotes();
  };

  // ── Einsatzplan write handlers ────────────────────────────
  const handleOpenContextMenu = useCallback((e: React.MouseEvent, entry: DayEntry, date?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit) return; // Leser: no context menu
    // G-1: ohne jegliches Schreibrecht kein Menü; WPAST sperrt Vergangenheit
    if (!grid.duties && !grid.deviation) return;
    const menuDate = date ?? toIsoDate(selectedDate);
    if (isPastDate(menuDate, todayStr) && !grid.past) {
      showToast('Änderungen in der Vergangenheit sind gesperrt (WPAST)', 'error');
      return;
    }
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
      date: menuDate,
    });
  }, [selectedDate, canEdit, grid.duties, grid.deviation, grid.past, todayStr, showToast]);

  const handleSonderdienste = (entry: DayEntry) => {
    setSonderdiensteModal({ entry, date: contextMenu?.date ?? toIsoDate(selectedDate) });
  };

  // A6: bestehenden Sonderdienst bearbeiten (Vorbefüllen aus dem Eintrag)
  const handleEditSonderdienst = (entry: DayEntry) => {
    if (entry.spshi_id == null) return;
    setSonderdiensteModal({
      entry,
      date: contextMenu?.date ?? toIsoDate(selectedDate),
      existing: {
        id: entry.spshi_id,
        name: entry.shift_name || entry.display_name || '',
        shortname: entry.display_name || '',
        shift_id: entry.shift_id ?? 0,
        workplace_id: entry.workplace_id ?? 0,
        startend: entry.spshi_startend ?? '',
        colorBkHex: entry.color_bk || undefined,
        colorTextHex: entry.color_text || undefined,
        duration: entry.spshi_duration ?? 0,
      },
    });
  };

  const handleAbweichung = (entry: DayEntry) => {
    setAbweichungModal({ entry, date: contextMenu?.date ?? toIsoDate(selectedDate) });
  };

  const handleDeleteSpshi = async (entry: DayEntry) => {
    if (!entry.spshi_id) return;
    if (!grid.duties) { showToast('Keine Schreibberechtigung für Dienste (WDUTIES)', 'error'); return; }
    const delDate = contextMenu?.date ?? toIsoDate(selectedDate);
    if (isPastDate(delDate, todayStr) && !grid.past) {
      showToast('Änderungen in der Vergangenheit sind gesperrt (WPAST)', 'error');
      return;
    }
    if (!await confirmDialog({ message: `Sonderdienst-Eintrag für ${entry.employee_name} löschen?`, danger: true })) return;
    try {
      const entryId = entry.spshi_id;
      // Capture data needed to recreate on undo
      const undoData: Record<string, unknown> = {
        employee_id: entry.employee_id,
        date: contextMenu?.date ?? toIsoDate(selectedDate),
        name: entry.shift_name || entry.display_name || '',
        shortname: entry.shift_short || entry.display_name || '',
        shift_id: entry.shift_id ?? 0,
        workplace_id: entry.workplace_id ?? 0,
        startend: entry.spshi_startend ?? '',
        duration: entry.spshi_duration ?? 0,
        type: entry.spshi_type ?? 0,
        colorbk: entry.color_bk ? hexToBGR(entry.color_bk) : 0,
        colortext: entry.color_text ? hexToBGR(entry.color_text) : 0,
      };
      await api.deleteEinsatzplanEntry(entryId);
      undoRedo.push({
        type: 'delete_entry',
        label: `${entry.display_name} für ${entry.employee_name} entfernt`,
        undoData,
        redoData: { entryId },
        timestamp: Date.now(),
      });
      loadData();
      showToast('Eintrag gelöscht', 'success');
    } catch (e: unknown) {
      showToast('Fehler beim Löschen: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const handleSaveSonderdienst = async (data: {
    id?: number;
    employee_id: number;
    date: string;
    name: string;
    shortname: string;
    shift_id: number;
    workplace_id: number;
    startend: string;
    colorbk: number;
    colortext: number;
    duration: number;
    noextra: boolean;
    endDate?: string;
  }) => {
    if (!grid.duties) throw new Error('Keine Schreibberechtigung für Dienste (WDUTIES)');
    if (isPastDate(data.date, todayStr) && !grid.past) {
      throw new Error('Änderungen in der Vergangenheit sind gesperrt (WPAST)');
    }
    // A6: Bearbeiten eines bestehenden Sonderdienstes (PUT) vs. Neuanlage (POST)
    if (data.id != null) {
      await api.updateEinsatzplanEntry(data.id, {
        name: data.name,
        shortname: data.shortname,
        shift_id: data.shift_id,
        workplace_id: data.workplace_id,
        startend: data.startend,
        colorbk: data.colorbk,
        colortext: data.colortext,
        duration: data.duration,
      });
      loadData();
      showToast('Sonderdienst aktualisiert', 'success');
      return;
    }
    // A6: Mehrtages-Erfassung — ein Eintrag je Tag im Bereich (sonst genau einer).
    const dates = data.endDate ? datesInRange(data.date, data.endDate) : [data.date];
    const createOne = (day: string) => api.createEinsatzplanEntry({
      employee_id: data.employee_id,
      date: day,
      name: data.name,
      shortname: data.shortname,
      shift_id: data.shift_id,
      workplace_id: data.workplace_id,
      startend: data.startend,
      colorbk: data.colorbk,
      colortext: data.colortext,
      duration: data.duration,
      noextra: data.noextra,
    });
    const createdIds: number[] = [];
    for (const day of dates) {
      const res = await createOne(day);
      createdIds.push(res.record.id);
    }
    const empName = dayEntries.find(e => e.employee_id === data.employee_id)?.employee_name ?? `MA #${data.employee_id}`;
    undoRedo.push({
      type: 'create_sonderdienst',
      label: dates.length > 1
        ? `Sonderdienst ${data.shortname} für ${empName} (${dates.length} Tage)`
        : `Sonderdienst ${data.shortname} für ${empName}`,
      undoData: { createdIds },
      redoData: { ...data, dates },
      timestamp: Date.now(),
    });
    loadData();
    showToast(dates.length > 1 ? `Sonderdienst an ${dates.length} Tagen gespeichert` : 'Sonderdienst gespeichert', 'success');
  };

  const handleSaveAbweichung = async (data: {
    employee_id: number;
    date: string;
    name: string;
    shortname: string;
    startend: string;
    duration: number;
  }) => {
    if (!grid.deviation) throw new Error('Keine Schreibberechtigung für Arbeitszeitabweichungen (WDEVIATION)');
    if (isPastDate(data.date, todayStr) && !grid.past) {
      throw new Error('Änderungen in der Vergangenheit sind gesperrt (WPAST)');
    }
    const res = await api.createDeviation({
      employee_id: data.employee_id,
      date: data.date,
      name: data.name,
      shortname: data.shortname,
      startend: data.startend,
      duration: data.duration,
    });
    const empName = dayEntries.find(e => e.employee_id === data.employee_id)?.employee_name ?? `MA #${data.employee_id}`;
    undoRedo.push({
      type: 'create_deviation',
      label: `Abweichung ${data.shortname} für ${empName}`,
      undoData: { createdId: res.record.id },
      redoData: { ...data },
      timestamp: Date.now(),
    });
    loadData();
    showToast('Abweichung gespeichert', 'success');
  };

  // ── Template handlers ────────────────────────────────────
  const handleSaveTemplate = async (name: string, description: string) => {
    const mon = getMondayOfWeek(selectedDate);
    await api.captureScheduleTemplate({
      name,
      description,
      year: mon.getFullYear(),
      month: mon.getMonth() + 1,
      week_start_day: mon.getDate(),
      group_id: groupId,
    });
    loadTemplates();
    showToast(`Vorlage „${name}" gespeichert`, 'success');
  };

  const handleApplyTemplate = async (templateId: number, targetDate: string, force: boolean) => {
    if (!grid.duties) throw new Error('Keine Schreibberechtigung für Dienste (WDUTIES)');
    const result = await api.applyScheduleTemplate(templateId, { target_date: targetDate, force });
    loadData();
    showToast('Vorlage angewendet', 'success');
    return result;
  };

  const handleDeleteTemplate = async (id: number) => {
    await api.deleteScheduleTemplate(id);
    loadTemplates();
    showToast('Vorlage gelöscht', 'success');
  };

  const prevDay = () => setSelectedDate(d => addDays(d, -1));
  const nextDay = () => setSelectedDate(d => addDays(d, 1));
  const prevWeek = () => setSelectedDate(d => addDays(d, -7));
  const nextWeek = () => setSelectedDate(d => addDays(d, 7));
  const goToday = () => setSelectedDate(today);

  const monday = getMondayOfWeek(selectedDate);
  const sunday = addDays(monday, 6);
  const weekDates = Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(monday, i)));

  // ── Filtered entries (by employee search) ──────────────────
  const filteredDayEntries = useMemo(() => {
    if (!employeeSearch.trim()) return dayEntries;
    const q = employeeSearch.toLowerCase();
    return dayEntries.filter(e => e.employee_name?.toLowerCase().includes(q));
  }, [dayEntries, employeeSearch]);

  const filteredWeekEntries = useMemo(() => {
    if (!employeeSearch.trim()) return weekEntries;
    const q = employeeSearch.toLowerCase();
    const filtered = new Map<string, DayEntry[]>();
    weekEntries.forEach((entries, date) => {
      filtered.set(date, entries.filter(e => e.employee_name?.toLowerCase().includes(q)));
    });
    return filtered;
  }, [weekEntries, employeeSearch]);

  // Schichtarten, die im sichtbaren Zeitraum besetzt sind — Grundlage für das
  // optionale Ausblenden leerer Zeilen (Spec 4.3-5 / 4.11.10-2). Abwesend-/Frei-
  // Zeilen bleiben immer sichtbar.
  const visibleShifts = useMemo(() => {
    if (!hideEmptyShifts) return shifts;
    const entries = viewMode === 'day'
      ? filteredDayEntries
      : Array.from(filteredWeekEntries.values()).flat();
    const occupied = occupiedShiftIds(entries);
    return shifts.filter(s => occupied.has(s.ID));
  }, [hideEmptyShifts, shifts, viewMode, filteredDayEntries, filteredWeekEntries]);

  const totalCount = useMemo(() => {
    if (viewMode === 'day') {
      return new Set(dayEntries.map(e => e.employee_id)).size;
    }
    const ids = new Set<number>();
    weekEntries.forEach(entries => entries.forEach(e => ids.add(e.employee_id)));
    return ids.size;
  }, [viewMode, dayEntries, weekEntries]);

  const visibleCount = useMemo(() => {
    if (viewMode === 'day') {
      return new Set(filteredDayEntries.map(e => e.employee_id)).size;
    }
    const ids = new Set<number>();
    filteredWeekEntries.forEach(entries => entries.forEach(e => ids.add(e.employee_id)));
    return ids.size;
  }, [viewMode, filteredDayEntries, filteredWeekEntries]);

  return (
    <div
      className="p-2 sm:p-4 lg:p-6 h-full flex flex-col"
      onClick={() => { setNotePopup(null); setContextMenu(null); }}
    >
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { font-size: 9px !important; background: white !important; }
          .no-print { display: none !important; }
          nav, aside, header { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { border-collapse: collapse; font-size: 9px; table-layout: fixed; }
          th, td { padding: 2px 3px !important; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          .print-area { display: block !important; }
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">📋 Einsatzplan</h1>

        {/* View mode toggle */}
        <div className="flex rounded overflow-hidden border border-gray-300 text-sm">
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 ${viewMode === 'day' ? 'bg-slate-700 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-600'}`}
          >
            Tagesansicht
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 border-l ${viewMode === 'week' ? 'bg-slate-700 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-600'}`}
          >
            Wochenansicht
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={viewMode === 'day' ? prevDay : prevWeek}
            className="px-2 py-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-600 text-sm dark:text-gray-200"
          >‹</button>

          {viewMode === 'day' ? (
            <input
              type="date"
              value={toIsoDate(selectedDate)}
              onChange={e => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
              className="px-2 py-1 border rounded text-sm"
            />
          ) : (
            <span className="text-sm font-semibold text-gray-700 min-w-[200px] text-center">
              {toIsoDate(monday)} – {toIsoDate(sunday)}
            </span>
          )}

          <button
            onClick={viewMode === 'day' ? nextDay : nextWeek}
            className="px-2 py-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-600 text-sm dark:text-gray-200"
          >›</button>

          <button
            onClick={goToday}
            className="px-2 py-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-600 text-sm text-blue-600 dark:text-blue-400"
          >
            Heute
          </button>
        </div>

        {/* Group filter */}
        <select
          value={groupId ?? ''}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-sm text-sm dark:text-gray-200"
        >
          <option value="">Alle Gruppen</option>
          {groupTreeOptions(groups).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        {/* Employee search */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-sm px-2 py-1.5">
          <span className="text-gray-600 text-sm">🔍</span>
          <input
            type="text"
            value={employeeSearch}
            onChange={e => setEmployeeSearch(e.target.value)}
            placeholder="Mitarbeiter suchen..."
            className="text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:rounded w-36 bg-transparent"
          />
          {employeeSearch && (
            <button
              onClick={() => setEmployeeSearch('')}
              className="text-gray-400 hover:text-gray-600 text-xs leading-none"
              title="Suche zurücksetzen"
            >
              ×
            </button>
          )}
        </div>

        {/* Employee count */}
        {!loading && totalCount > 0 && (
          <span className={`text-sm font-medium ${visibleCount < totalCount ? 'text-blue-600' : 'text-gray-500'}`}>
            {visibleCount < totalCount
              ? <><span className="font-bold">{visibleCount}</span><span className="text-gray-600"> / {totalCount} Mitarbeiter</span></>
              : <>{totalCount} Mitarbeiter</>
            }
          </span>
        )}

        {loading && <span className="text-sm text-blue-500 animate-pulse">Lade...</span>}

        {/* Leere Schichtzeilen ausblenden (Spec 4.3-5 / 4.11.10-2) */}
        <button
          onClick={() => setHideEmptyShifts(v => !v)}
          aria-pressed={hideEmptyShifts}
          className={`no-print px-3 py-1.5 text-sm rounded shadow-sm flex items-center gap-1.5 border ${hideEmptyShifts ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600'}`}
          title="Schichtarten ohne Einteilung im sichtbaren Zeitraum ausblenden"
        >
          {hideEmptyShifts ? '👁️' : '🚫'} Leere Zeilen ausblenden
        </button>

        {/* Template buttons */}
        {viewMode === 'week' && (
          <button
            onClick={() => setSaveTemplateModal(true)}
            className="no-print px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded shadow-sm flex items-center gap-1.5"
            title="Aktuelle Woche als Vorlage speichern"
          >
            💾 Als Vorlage speichern
          </button>
        )}
        <button
          onClick={() => { setShowTemplatesPanel(v => !v); if (!showTemplatesPanel) loadTemplates(); }}
          className={`no-print px-3 py-1.5 text-sm rounded shadow-sm flex items-center gap-1.5 border ${showTemplatesPanel ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          title="Gespeicherte Vorlagen anzeigen"
        >
          📋 Vorlagen {templates.length > 0 && <span className="bg-indigo-600 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">{templates.length}</span>}
        </button>

        {/* Undo/Redo buttons */}
        {canEdit && <UndoRedoStatus handle={undoRedo} />}

        {/* Print button */}
        <button
          onClick={() => window.print()}
          className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1.5"
          title="Einsatzplan drucken (Landscape)"
        >
          🖨️ Drucken
        </button>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-3 rounded border border-gray-300 bg-white" style={{ border: '2px dashed rgba(0,0,0,0.3)' }} />
            Sonderdienst
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-3 rounded" style={{ border: '2px dashed #F59E0B' }} />
            Abweichung
          </span>
          <span className="flex items-center gap-1" title="Generierter Dienst aus dem Schichtmodell — änderbar nur per Überschreiben">
            <span aria-hidden="true">↻</span>
            Zyklusdienst (generiert)
          </span>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          date={contextMenu.date}
          canDuties={grid.duties}
          canDeviation={grid.deviation}
          onClose={() => setContextMenu(null)}
          onAddSonderdienst={handleSonderdienste}
          onEditSonderdienst={handleEditSonderdienst}
          onAddAbweichung={handleAbweichung}
          onDelete={handleDeleteSpshi}
        />
      )}

      {/* Sonderdienst Modal */}
      {sonderdiensteModal && (
        <SonderdiensteModal
          employee={sonderdiensteModal.entry}
          date={sonderdiensteModal.date}
          shifts={shifts}
          workplaces={workplaces}
          existing={sonderdiensteModal.existing}
          onClose={() => setSonderdiensteModal(null)}
          onSave={handleSaveSonderdienst}
        />
      )}

      {/* Abweichung Modal */}
      {abweichungModal && (
        <AbweichungModal
          employee={abweichungModal.entry}
          date={abweichungModal.date}
          onClose={() => setAbweichungModal(null)}
          onSave={handleSaveAbweichung}
        />
      )}

      {/* Note popup for Einsatzplan */}
      {notePopup && (
        <EinsatzplanNotePopup
          x={notePopup.x}
          y={notePopup.y}
          notes={notePopup.notes}
          onClose={() => setNotePopup(null)}
          onEdited={handleEinsatzplanNoteEdited}
          onDeleted={handleEinsatzplanNoteDeleted}
        />
      )}

      {/* Templates Panel */}
      {showTemplatesPanel && (
        <TemplatesPanel
          templates={templates}
          loading={templatesLoading}
          onClose={() => setShowTemplatesPanel(false)}
          onApply={t => { setApplyTemplateModal(t); setShowTemplatesPanel(false); }}
          onDelete={handleDeleteTemplate}
        />
      )}

      {/* Save Template Modal */}
      {saveTemplateModal && (
        <SaveTemplateModal
          weekLabel={`Woche ${toIsoDate(monday)} – ${toIsoDate(sunday)}`}
          onClose={() => setSaveTemplateModal(false)}
          onSave={handleSaveTemplate}
        />
      )}

      {/* Apply Template Modal */}
      {applyTemplateModal && (
        <ApplyTemplateModal
          template={applyTemplateModal}
          onClose={() => setApplyTemplateModal(null)}
          onApply={handleApplyTemplate}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-600 p-4">
        {viewMode === 'day' ? (
          <DayView
            date={toIsoDate(selectedDate)}
            entries={filteredDayEntries}
            shifts={visibleShifts}
            notesByEmpId={dayNotesMap}
            onNoteClick={(e, notes) => {
              e.stopPropagation();
              setNotePopup({ x: e.clientX, y: e.clientY, notes });
            }}
            onContextMenu={handleOpenContextMenu}
          />
        ) : (
          <WeekView
            leaveTypes={leaveTypes}
            hideEmpty={hideEmptyShifts}
            weekDates={weekDates}
            entriesByDate={filteredWeekEntries}
            shifts={visibleShifts}
            onContextMenu={(e, entry, date) => handleOpenContextMenu(e, entry, date)}
          />
        )}
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
