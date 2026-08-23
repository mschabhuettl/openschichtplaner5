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
import { shiftCellColorsMemo, tint, spine } from '../utils/shiftColor';

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

// ── Taktwerk-Farbhilfen ──────────────────────────────────────
// Block-/Zeilenkopf in Schicht-/Abwesenheitsfarbe: Tint-Fläche + 3px-Spine
// (Rohfarben nie roh rendern, docs/design-system.md §4).
function kopfStyle(raw: string | undefined, isDark: boolean): React.CSSProperties | undefined {
  if (!raw) return undefined;
  const theme = isDark ? 'dark' : 'light';
  return { backgroundColor: tint(raw, theme), boxShadow: `inset 3px 0 0 ${spine(raw, theme)}` };
}

// Spalten-Zustände der Wochenmatrix im Raster-Geist des Dienstplans:
// Heute = Glut-Wanne, Wochenende = Wash-Fläche.
function tagesZellKlasse(d: string, todayIso: string): string {
  if (d === todayIso) return 'bg-[rgba(201,106,20,.045)] dark:bg-[rgba(240,163,92,.05)]';
  const dow = new Date(d + 'T12:00:00').getDay();
  return dow === 0 || dow === 6 ? 'bg-wash' : '';
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
      className="fixed z-[200] bg-ebene dark:bg-ebene-2 rounded-panel shadow-overlay dark:shadow-overlay-dark border border-kontur py-1 min-w-[200px]"
      style={style}
    >
      <div className="px-3 py-1.5 text-[10.5px] font-bold text-schrift border-b border-kontur-soft mb-1">
        {entry.employee_name}
      </div>
      {/* G-1: Menüpunkte nur mit dem jeweiligen Schreibrecht */}
      {canDuties && (
        <button
          className="w-full text-left px-3 py-1.5 text-sm text-schrift hover:bg-[rgba(201,106,20,.08)] dark:hover:bg-[rgba(240,163,92,.12)] flex items-center gap-2"
          onClick={() => { onAddSonderdienst(entry); onClose(); }}
        >
          <span>🔷</span> Sonderdienst eintragen
        </button>
      )}
      {canDeviation && (
        <button
          className="w-full text-left px-3 py-1.5 text-sm text-schrift hover:bg-[rgba(201,106,20,.08)] dark:hover:bg-[rgba(240,163,92,.12)] flex items-center gap-2"
          onClick={() => { onAddAbweichung(entry); onClose(); }}
        >
          <span>⏱️</span> Arbeitszeitabweichung erfassen
        </button>
      )}
      {hasSpshi && canDuties && (
        <>
          <div className="border-t border-kontur-soft my-1" />
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-schrift hover:bg-[rgba(201,106,20,.08)] dark:hover:bg-[rgba(240,163,92,.12)] flex items-center gap-2"
            onClick={() => { onEditSonderdienst(entry); onClose(); }}
          >
            <span>✏️</span> Sonderdienst bearbeiten
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-signal hover:bg-[rgba(201,106,20,.08)] dark:hover:bg-[rgba(240,163,92,.12)] flex items-center gap-2"
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
  // Theme provider-frei vom Dokument lesen (Muster der Menü-Chips im Dienstplan)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
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
      <div className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-[13px] font-bold text-schrift -mx-4 px-4 pb-3 mb-3 border-b border-kontur flex items-center gap-2">
          <span>🔷</span> {isEdit ? 'Sonderdienst bearbeiten' : 'Sonderdienst eintragen'}
        </h2>
        <div className="mb-3 p-2 bg-wash rounded-ui text-sm text-schrift">
          <strong>{employee.employee_name}</strong> · {date}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Schicht *</label>
            <select
              value={shiftId}
              onChange={e => onShiftChange(Number(e.target.value))}
              className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
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
              <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setNameTouched(true); }}
                maxLength={100}
                className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Kürzel</label>
              <input
                type="text"
                value={shortname}
                onChange={e => { setShortname(e.target.value); setNameTouched(true); }}
                maxLength={20}
                className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Arbeitsplatz (optional)</label>
            <select
              value={workplaceId}
              onChange={e => setWorkplaceId(Number(e.target.value))}
              className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
            >
              <option value={0}>— kein Arbeitsplatz —</option>
              {workplaces.map(w => (
                <option key={w.ID} value={w.ID}>{w.NAME}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Zeitbereich (optional, z.B. 06:00-14:00)</label>
            <input
              type="text"
              value={startend}
              onChange={e => setStartend(e.target.value)}
              placeholder="HH:MM-HH:MM"
              className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
            />
          </div>
          {/* Mehrtages-Erfassung (A6) — nur beim Neuanlegen; leer = nur der eine Tag */}
          {!isEdit && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Bis (optional — mehrere Tage)</label>
              <input
                type="date"
                aria-label="Bis-Datum"
                value={endDate}
                min={date}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
              />
              {endDate && endDate >= date && (
                <p className="text-xs text-schrift-3 mt-0.5">{datesInRange(date, endDate).length} Tage ({date} – {endDate})</p>
              )}
            </div>
          )}
          {/* Getrennte Arbeitsstunden (A6) — Default = Schichtstunden des Tages */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Arbeitsstunden</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={hours}
              onChange={e => { setHours(e.target.value); setHoursTouched(true); }}
              className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
            />
          </div>
          {/* SonderdiensteEintragen.12 — nur bei der Neuanlage */}
          {!isEdit && (
            <label className="flex items-center gap-2 text-sm text-schrift cursor-pointer">
              <input
                type="checkbox"
                checked={noextra}
                onChange={e => setNoextra(e.target.checked)}
                className="rounded border-kontur accent-[var(--glut)]"
              />
              Keine Arbeitszeitzuschläge berechnen
            </label>
          )}
          {/* Freie Farben (A6) — Hintergrund + Schrift, Default = gewählte Schicht */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Hintergrundfarbe</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Hintergrundfarbe"
                  value={bgHex}
                  onChange={e => { setBgHex(e.target.value); setColorsTouched(true); }}
                  className="w-10 h-8 rounded-ui border border-kontur cursor-pointer"
                />
                {/* Vorschau wie im Raster: Rohfarbe normalisiert, Vordergrund berechnet */}
                <div className="flex-1 h-8 rounded-cell border border-kontur flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: shiftCellColorsMemo(bgHex, isDark ? 'dark' : 'light').background,
                    color: shiftCellColorsMemo(bgHex, isDark ? 'dark' : 'light').color,
                  }}>
                  {shortname || name || 'SD'}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Schriftfarbe</label>
              <input
                type="color"
                aria-label="Schriftfarbe"
                value={textHex}
                onChange={e => { setTextHex(e.target.value); setColorsTouched(true); }}
                className="w-10 h-8 rounded-ui border border-kontur cursor-pointer"
              />
            </div>
          </div>
          {error && <div className="text-signal text-xs">{error}</div>}
          <div className="flex gap-2 -mx-4 -mb-4 mt-1 px-4 py-3 border-t border-kontur bg-[#fafbfc] dark:bg-[#0e1522] rounded-b-[10px]">
            <button
              type="submit"
              disabled={busy || !shiftId}
              className="flex-1 px-4 py-2 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui font-semibold hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {busy ? 'Speichern…' : '✅ Speichern'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui hover:bg-wash text-sm"
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
      <div className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-[13px] font-bold text-schrift -mx-4 px-4 pb-3 mb-3 border-b border-kontur flex items-center gap-2">
          <span>⏱️</span> Arbeitszeitabweichung
        </h2>
        <div className="mb-3 p-2 bg-wash rounded-ui text-sm text-schrift">
          <strong>{employee.employee_name}</strong> · {date}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Bezeichnung *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Kürzel</label>
            <input
              type="text"
              value={shortname}
              onChange={e => setShortname(e.target.value)}
              maxLength={10}
              className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Erfassungsmodus</label>
            <div className="flex rounded-ui overflow-hidden border border-kontur text-xs">
              <button
                type="button"
                onClick={() => setDurationMode('times')}
                className={`flex-1 py-1.5 ${durationMode === 'times' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift-2 hover:bg-wash'}`}
              >Start – Ende</button>
              <button
                type="button"
                onClick={() => setDurationMode('duration')}
                className={`flex-1 py-1.5 border-l border-kontur ${durationMode === 'duration' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift-2 hover:bg-wash'}`}
              >Dauer (Min)</button>
            </div>
          </div>
          {durationMode === 'times' ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Beginn</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Ende</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Dauer (Minuten)</label>
              <input
                type="number"
                min={0}
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
                className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
              />
            </div>
          )}
          {computedDuration > 0 && (
            <div className="text-xs text-schrift-2 font-mono tabular-nums">
              Dauer: {Math.floor(computedDuration / 60)}h {computedDuration % 60}min ({computedDuration} Min.)
            </div>
          )}
          {error && <div className="text-signal text-xs">{error}</div>}
          <div className="flex gap-2 -mx-4 -mb-4 mt-1 px-4 py-3 border-t border-kontur bg-[#fafbfc] dark:bg-[#0e1522] rounded-b-[10px]">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex-1 px-4 py-2 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui font-semibold hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {busy ? 'Speichern…' : '✅ Speichern'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui hover:bg-wash text-sm"
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
      className="fixed z-[110] bg-ebene dark:bg-ebene-2 rounded-panel shadow-overlay dark:shadow-overlay-dark border border-kontur text-xs text-schrift"
      style={{ left: x, top: y, minWidth: 200, maxWidth: 280 }}
    >
      <div className="px-3 py-1.5 bg-[#fafbfc] dark:bg-[#111927] border-b border-kontur text-[10px] text-schrift font-bold rounded-t-panel flex justify-between">
        <span>📝 Notizen</span>
        <button aria-label="Schließen" onClick={onClose} className="text-schrift-3 hover:text-schrift">×</button>
      </div>
      {notes.map(note => (
        <div key={note.id} className="p-2 border-b border-kontur-soft last:border-b-0">
          {editingId === note.id ? (
            <div>
              <textarea
                autoFocus
                className="w-full border border-kontur rounded-ui p-1 text-xs resize-none bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:ring-1 focus:ring-glut"
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
                  className="flex-1 px-2 py-0.5 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold rounded-ui hover:opacity-90 disabled:opacity-50 text-[11px]"
                  disabled={busy || !editText.trim()}
                  onClick={() => {
                    setBusy(true);
                    onEdited(note.id, editText.trim()).then(() => { setBusy(false); setEditingId(null); });
                  }}
                >{busy ? '…' : 'Speichern'}</button>
                <button className="px-2 py-0.5 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui hover:bg-wash text-[11px]" onClick={() => setEditingId(null)}>Abbruch</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-schrift mb-1.5 whitespace-pre-wrap break-words">{note.text1}{note.text2 ? `\n${note.text2}` : ''}</div>
              <div className="flex gap-1">
                <button
                  className="px-2 py-0.5 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui hover:bg-wash text-[11px]"
                  onClick={() => { setEditingId(note.id); setEditText(note.text1 || ''); }}
                >✏️ Bearbeiten</button>
                <button
                  className="px-2 py-0.5 bg-ebene dark:bg-ebene-2 border border-kontur text-signal rounded-ui hover:bg-wash text-[11px]"
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

// Badge der Schichtzuweisung eines MA
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
  const isAbsence = entry.kind === 'absence';
  // DBF-Rohfarbe nie roh rendern — normalisieren, Vordergrund wird berechnet;
  // Abwesenheiten als Hohl-Chip (gestrichelt, keine Füllung).
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const chip = entry.color_bk ? shiftCellColorsMemo(entry.color_bk, isDark ? 'dark' : 'light', { hollow: isAbsence }) : null;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-cell text-xs font-semibold cursor-context-menu ${chip ? '' : 'text-schrift-2'}`}
      style={{
        backgroundColor: chip && !isAbsence ? chip.background : undefined,
        color: chip ? chip.color : undefined,
        border: isAbsence
          ? `1.5px dashed ${chip ? chip.color : 'var(--kontur)'}`
          : isDeviation
            ? '2px dashed var(--glut)'
            : isSpshi
              ? `2px dashed ${chip ? chip.color : 'var(--schrift-3)'}`
              : undefined,
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

// ── Leere MA-Zelle (Rechtsklick zum Hinzufügen) ──────────────
function EmptyEmployeeCell({
  entry,
  onContextMenu,
}: {
  entry: DayEntry;
  onContextMenu?: (e: React.MouseEvent, entry: DayEntry) => void;
}) {
  return (
    <span
      className="text-xs px-2 py-0.5 bg-wash rounded-cell text-schrift-2 cursor-context-menu hover:text-schrift"
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, entry); }}
      title="Rechtsklick für Optionen"
    >
      {entry.employee_name}
    </span>
  );
}

// Day view: one date
export function DayView({
  date,
  entries,
  shifts,
  notesByEmpId,
  onNoteClick,
  onContextMenu,
  listMode = 'alle',
}: {
  date: string;
  entries: DayEntry[];
  shifts: ShiftType[];
  notesByEmpId?: Map<number, Note[]>;
  onNoteClick?: (e: React.MouseEvent, notes: Note[]) => void;
  onContextMenu?: (e: React.MouseEvent, entry: DayEntry) => void;
  /** Auflisten-Modus wie das Original (Spec 4.3): alle | arbeitend | abwesend */
  listMode?: 'alle' | 'arbeitend' | 'abwesend';
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
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-schrift border-b border-kontur pb-1">
        {weekdayName}, {date}
      </h2>

      {listMode !== 'abwesend' && shifts.map(shift => {
        const shiftEntries = byShift.get(shift.ID) || [];
        return (
          <div key={shift.ID} className="rounded-panel border border-kontur overflow-hidden">
            {/* Blockkopf in Schichtfarbe: Tint-Fläche + 3px-Spine statt Rohfarbe */}
            <div
              className="px-3 py-1.5 text-sm font-bold text-schrift bg-wash"
              style={kopfStyle(shift.COLORBK_HEX, isDark)}
            >
              {shift.NAME} ({shift.SHORTNAME})
              <span className="ml-2 font-normal text-schrift-2">— {shiftEntries.length} MA</span>
            </div>
            <div className="p-2 flex flex-wrap gap-1.5 bg-ebene min-h-[40px]">
              {shiftEntries.length === 0 ? (
                <span className="text-xs text-schrift-3 italic">Niemand eingetragen</span>
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
      {listMode !== 'arbeitend' && byShift.has(null) && (
        <div className="rounded-panel border border-kontur overflow-hidden">
          <div className="px-3 py-1.5 text-sm font-bold bg-wash text-schrift">
            Abwesend — {byShift.get(null)!.length} MA
          </div>
          <div className="p-2 flex flex-wrap gap-1.5 bg-ebene">
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
      {listMode === 'alle' && (
      <div className="rounded-panel border border-kontur overflow-hidden">
        <div className="px-3 py-1.5 text-sm font-bold bg-wash text-schrift-2">
          Frei / kein Eintrag — {freeEntries.length} MA
          <span className="ml-2 text-[10px] font-normal text-schrift-3">Rechtsklick zum Eintragen</span>
        </div>
        <div className="p-2 flex flex-wrap gap-1.5 bg-ebene min-h-[36px]">
          {freeEntries.length === 0 ? (
            <span className="text-xs text-schrift-3 italic">Alle eingeteilt</span>
          ) : (
            freeEntries.map(e => (
              <EmptyEmployeeCell key={e.employee_id} entry={e} onContextMenu={onContextMenu} />
            ))
          )}
        </div>
      </div>
      )}
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
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const todayIso = toIsoDate(new Date());
  return (
    <ResponsiveTable stickyFirstCol minWidth="600px">
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr className="bg-[#fafbfc] dark:bg-[#0e1522] border-b border-kontur">
            <th scope="col" className="px-3 py-2 text-left uppercase text-[9px] font-bold tracking-[.08em] text-schrift-3 min-w-[120px] border-r border-kontur sticky left-0 z-10 bg-[#fafbfc] dark:bg-[#0e1522]">
              Schicht
            </th>
            {weekDates.map(d => {
              const date = new Date(d + 'T12:00:00');
              const dow = date.getDay();
              const isWe = dow === 0 || dow === 6;
              const isToday = d === todayIso;
              return (
                <th scope="col"
                  key={d}
                  className={`px-2 py-1.5 text-center uppercase text-[9px] font-bold tracking-[.08em] min-w-[120px] border-r border-kontur ${isToday ? 'bg-glut-flaeche text-glut' : isWe ? 'bg-wash text-schrift-3' : 'text-schrift-3'}`}
                >
                  <div>{WEEKDAY_ABBR[dow]}</div>
                  <div className={`text-[10px] font-medium font-mono tabular-nums tracking-normal ${isToday ? 'text-glut' : 'text-schrift-3'}`}>{d.slice(8)}.{d.slice(5, 7)}.</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shifts.map(shift => (
            <tr key={shift.ID}>
              {/* Zeilenkopf in Schichtfarbe: Tint-Fläche + 3px-Spine statt Rohfarbe */}
              <td
                className="sticky left-0 z-10 px-3 py-1.5 border border-kontur-soft bg-wash text-schrift font-semibold text-sm whitespace-nowrap"
                style={kopfStyle(shift.COLORBK_HEX, isDark)}
              >
                {shift.SHORTNAME}
              </td>
              {weekDates.map(d => {
                const dayEntries = entriesByDate.get(d) || [];
                const shiftEntries = dayEntries.filter(e => e.shift_id === shift.ID).sort(byEmployeeName);
                return (
                  <td key={d} className={`border border-kontur-soft p-1 align-top ${tagesZellKlasse(d, todayIso)}`}>
                    <div className="flex flex-col gap-0.5">
                      {shiftEntries.map(e => {
                        const isSpshi = e.kind === 'special_shift';
                        const isDeviation = isSpshi && e.spshi_type === 1;
                        const isCycle = e.source === 'cycle';
                        // Rohfarbe normalisieren, Vordergrund berechnen (nie COLORTEXT)
                        const chip = e.color_bk ? shiftCellColorsMemo(e.color_bk, isDark ? 'dark' : 'light') : null;
                        return (
                          <div
                            key={e.employee_id}
                            className={`px-1 py-0.5 rounded-cell text-[10px] font-semibold cursor-context-menu ${chip ? '' : 'text-schrift-2'}`}
                            style={{
                              backgroundColor: chip?.background,
                              color: chip?.color,
                              border: isDeviation
                                ? '2px dashed var(--glut)'
                                : isSpshi
                                  ? `2px dashed ${chip ? chip.color : 'var(--schrift-3)'}`
                                  : undefined,
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
              {/* Zeilenkopf in Abwesenheitsfarbe: Tint + Spine; Vordergrund = Token */}
              <td
                className="sticky left-0 z-10 px-3 py-1.5 border border-kontur-soft bg-wash text-schrift font-semibold text-sm whitespace-nowrap"
                style={kopfStyle(lt.COLORBK_HEX || undefined, isDark)}
              >
                {lt.NAME}
              </td>
              {weekDates.map(d => {
                const absences = (entriesByDate.get(d) || []).filter(
                  e => e.kind === 'absence' && (e.leave_name || e.display_name) === lt.NAME,
                ).sort(byEmployeeName);
                return (
                  <td key={d} className={`border border-kontur-soft p-1 align-top ${tagesZellKlasse(d, todayIso)}`}>
                    <div className="flex flex-col gap-0.5">
                      {absences.map(e => {
                        // Abwesenheit = Hohl-Chip: gestrichelte Kontur + Textfarbe, keine Füllung
                        const chip = e.color_bk ? shiftCellColorsMemo(e.color_bk, isDark ? 'dark' : 'light', { hollow: true }) : null;
                        return (
                          <div
                            key={e.employee_id}
                            className={`px-1 py-0.5 rounded-cell text-[10px] font-semibold cursor-context-menu ${chip ? '' : 'text-schrift-2'}`}
                            style={{
                              color: chip?.color,
                              border: `1.5px dashed ${chip ? chip.color : 'var(--kontur)'}`,
                            }}
                            onContextMenu={ev => { ev.preventDefault(); onContextMenu?.(ev, e, d); }}
                          >
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
          {/* Free row */}
          <tr>
            <td className="sticky left-0 z-10 px-3 py-1.5 border border-kontur-soft font-semibold text-sm bg-wash text-schrift-2 whitespace-nowrap">
              Frei
            </td>
            {weekDates.map(d => {
              const dayEntries = entriesByDate.get(d) || [];
              const free = dayEntries.filter(e => !e.kind);
              return (
                <td key={d} className="border border-kontur-soft p-1 align-top bg-wash">
                  <div className="flex flex-col gap-0.5">
                    {free.map(e => (
                      <div
                        key={e.employee_id}
                        className="text-[10px] text-schrift-3 cursor-context-menu px-1 py-0.5 rounded-cell hover:text-schrift"
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
      <div className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-[13px] font-bold text-schrift -mx-4 px-4 pb-3 mb-3 border-b border-kontur flex items-center gap-2">
          <span>📋</span> Woche als Vorlage speichern
        </h2>
        <p className="text-sm text-schrift-2 font-mono tabular-nums mb-4">{weekLabel}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Name *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Standard-Wochenbelegung"
              className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Beschreibung (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="z.B. Sommer-Schichtplan"
              className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
            />
          </div>
          {error && <div className="text-signal text-xs">{error}</div>}
          <div className="flex gap-2 -mx-4 -mb-4 mt-1 px-4 py-3 border-t border-kontur bg-[#fafbfc] dark:bg-[#0e1522] rounded-b-[10px]">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex-1 px-4 py-2 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui font-semibold hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {busy ? 'Speichern…' : '💾 Speichern'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui hover:bg-wash text-sm">
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
      <div className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-[13px] font-bold text-schrift -mx-4 px-4 pb-3 mb-3 border-b border-kontur flex items-center gap-2">
          <span>▶️</span> Vorlage anwenden
        </h2>
        <p className="text-sm font-semibold text-schrift mb-1">„{template.name}"</p>
        {template.description && (
          <p className="text-xs text-schrift-3 mb-3">{template.description}</p>
        )}
        <p className="text-xs text-schrift-3 mb-4">
          {template.assignments.length} Einträge · erstellt {template.created_at.slice(0, 10)}
        </p>
        {result ? (
          <div className="space-y-3">
            <div className="text-schrift text-sm bg-wash rounded-ui p-3 border border-kontur">
              <p className="font-semibold mb-1">✅ Vorlage angewendet!</p>
              <p className="text-xs font-mono tabular-nums">{result.created} erstellt · {result.updated} aktualisiert · {result.skipped} übersprungen</p>
            </div>
            <button onClick={onClose} className="w-full px-4 py-2 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui hover:bg-wash text-sm">
              Schließen
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Ziel-Montag (Wochenanfang)</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-schrift cursor-pointer">
              <input
                type="checkbox"
                checked={force}
                onChange={e => setForce(e.target.checked)}
                className="rounded border-kontur accent-[var(--glut)]"
              />
              Bestehende Einträge überschreiben
            </label>
            {error && <div className="text-signal text-xs">{error}</div>}
            <div className="flex gap-2 -mx-4 -mb-4 mt-1 px-4 py-3 border-t border-kontur bg-[#fafbfc] dark:bg-[#0e1522] rounded-b-[10px]">
              <button
                onClick={handleApply}
                disabled={busy}
                className="flex-1 px-4 py-2 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui font-semibold hover:opacity-90 disabled:opacity-50 text-sm"
              >
                {busy ? 'Anwenden…' : '▶️ Anwenden'}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui hover:bg-wash text-sm">
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
      className="fixed z-[250] right-4 top-16 bg-ebene dark:bg-ebene-2 rounded-panel shadow-overlay dark:shadow-overlay-dark border border-kontur w-80 max-h-[70vh] flex flex-col"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-kontur bg-[#fafbfc] dark:bg-[#111927] rounded-t-panel">
        <h3 className="font-bold text-[13px] text-schrift flex items-center gap-2">
          <span>📋</span> Gespeicherte Vorlagen
        </h3>
        <button aria-label="Schließen" onClick={onClose} className="text-schrift-3 hover:text-schrift text-lg leading-none">×</button>
      </div>
      <div className="overflow-y-auto flex-1 p-3 space-y-2">
        {loading && <p className="text-sm text-schrift-2 text-center py-4">Lade…</p>}
        {!loading && templates.length === 0 && (
          <p className="text-sm text-schrift-2 text-center py-6">
            Keine Vorlagen vorhanden.<br />
            <span className="text-xs text-schrift-3">Woche anzeigen → „Als Vorlage speichern"</span>
          </p>
        )}
        {templates.map(t => (
          <div key={t.id} className="border border-kontur rounded-ui p-3 bg-ebene dark:bg-ebene-2 hover:bg-wash transition-colors">
            <div className="font-semibold text-sm text-schrift truncate">{t.name}</div>
            {t.description && <div className="text-xs text-schrift-3 truncate mb-1">{t.description}</div>}
            <div className="text-[11px] text-schrift-2 font-mono tabular-nums mb-2">
              {t.assignments.length} Eintr. · {t.created_at.slice(0, 10)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onApply(t)}
                className="flex-1 px-2 py-1 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] text-xs rounded-ui hover:opacity-90 font-semibold"
              >
                ▶️ Anwenden
              </button>
              <button
                onClick={() => {
                  if (confirm(`Vorlage „${t.name}" wirklich löschen?`)) onDelete(t.id);
                }}
                className="px-2 py-1 border border-kontur text-signal text-xs rounded-ui hover:bg-wash"
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
          // Undo eines Anlegens → die angelegten Sätze löschen.
          // Sonderdienst kann mehrere Tage umfassen (createdIds), Abweichung genau einen.
          const ids = (action.undoData.createdIds as number[] | undefined)
            ?? [action.undoData.createdId as number];
          for (const id of ids) await api.deleteEinsatzplanEntry(id);
          break;
        }
        case 'delete_entry': {
          // Undo eines Löschens → den Eintrag neu anlegen
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
  // Auflisten-Modus der Tagesansicht wie das Original (Spec 4.3)
  const [listMode, setListMode] = useState<'alle' | 'arbeitend' | 'abwesend'>('alle');

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

  // Notizen der Tagesansicht: empId → Note[]
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
        <h1 className="text-xl font-extrabold tracking-[-0.02em] text-schrift">📋 Einsatzplan</h1>

        {/* View mode toggle */}
        <div className="flex rounded-ui overflow-hidden border border-kontur text-sm">
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 ${viewMode === 'day' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift-2 hover:bg-wash'}`}
          >
            Tagesansicht
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 border-l border-kontur ${viewMode === 'week' ? 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold' : 'bg-ebene dark:bg-ebene-2 text-schrift-2 hover:bg-wash'}`}
          >
            Wochenansicht
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={viewMode === 'day' ? prevDay : prevWeek}
            className="px-2 py-1 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui hover:bg-wash text-sm text-schrift"
          >‹</button>

          {viewMode === 'day' ? (
            <input
              type="date"
              value={toIsoDate(selectedDate)}
              onChange={e => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
              className="px-2 py-1 border border-kontur rounded-ui text-sm bg-ebene dark:bg-ebene-2 text-schrift font-mono tabular-nums"
            />
          ) : (
            <span className="text-sm font-semibold text-schrift font-mono tabular-nums min-w-[200px] text-center">
              {toIsoDate(monday)} – {toIsoDate(sunday)}
            </span>
          )}

          <button
            onClick={viewMode === 'day' ? nextDay : nextWeek}
            className="px-2 py-1 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui hover:bg-wash text-sm text-schrift"
          >›</button>

          <button
            onClick={goToday}
            className="px-2 py-1 bg-glut-flaeche border border-[#d9a675] dark:border-[#a15618] rounded-ui text-sm font-semibold text-[#a64a08] dark:text-glut"
          >
            Heute
          </button>
        </div>

        {/* Group filter */}
        <select
          value={groupId ?? ''}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-sm text-schrift"
        >
          <option value="">Alle Gruppen</option>
          {groupTreeOptions(groups).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        {/* Employee search */}
        <div className="flex items-center gap-1.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui px-2 py-1.5">
          <span className="text-schrift-3 text-sm">🔍</span>
          <input
            type="text"
            value={employeeSearch}
            onChange={e => setEmployeeSearch(e.target.value)}
            placeholder="Mitarbeiter suchen..."
            className="text-sm outline-none focus-visible:ring-2 focus-visible:ring-glut focus-visible:rounded w-36 bg-transparent text-schrift placeholder:text-schrift-3"
          />
          {employeeSearch && (
            <button
              onClick={() => setEmployeeSearch('')}
              className="text-schrift-3 hover:text-schrift text-xs leading-none"
              title="Suche zurücksetzen"
            >
              ×
            </button>
          )}
        </div>

        {/* Employee count */}
        {!loading && totalCount > 0 && (
          <span className={`text-sm font-medium ${visibleCount < totalCount ? 'text-glut' : 'text-schrift-2'}`}>
            {visibleCount < totalCount
              ? <><span className="font-bold">{visibleCount}</span><span className="text-schrift-2"> / {totalCount} Mitarbeiter</span></>
              : <>{totalCount} Mitarbeiter</>
            }
          </span>
        )}

        {loading && <span className="text-sm text-schrift-3 animate-pulse">Lade...</span>}

        {/* Leere Schichtzeilen ausblenden (Spec 4.3-5 / 4.11.10-2) */}
        <button
          onClick={() => setHideEmptyShifts(v => !v)}
          aria-pressed={hideEmptyShifts}
          className={`no-print px-3 py-1.5 text-sm rounded-ui flex items-center gap-1.5 border ${hideEmptyShifts ? 'bg-glut-flaeche border-[#d9a675] dark:border-[#a15618] text-[#a64a08] dark:text-glut' : 'bg-ebene dark:bg-ebene-2 border-kontur text-schrift-2 hover:bg-wash'}`}
          title="Schichtarten ohne Einteilung im sichtbaren Zeitraum ausblenden"
        >
          {hideEmptyShifts ? '👁️' : '🚫'} Leere Zeilen ausblenden
        </button>

        {viewMode === 'day' && (
          <label className="no-print flex items-center gap-1.5 text-sm text-schrift">
            Auflisten:
            <select
              value={listMode}
              onChange={e => setListMode(e.target.value as 'alle' | 'arbeitend' | 'abwesend')}
              className="border border-kontur rounded-ui px-2 py-1.5 text-sm bg-ebene dark:bg-ebene-2 text-schrift"
            >
              <option value="alle">Alle Mitarbeiter</option>
              <option value="arbeitend">Nur Arbeitende</option>
              <option value="abwesend">Nur Abwesende</option>
            </select>
          </label>
        )}

        {/* Template buttons */}
        {viewMode === 'week' && (
          <button
            onClick={() => setSaveTemplateModal(true)}
            className="no-print px-3 py-1.5 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold hover:opacity-90 text-sm rounded-ui flex items-center gap-1.5"
            title="Aktuelle Woche als Vorlage speichern"
          >
            💾 Als Vorlage speichern
          </button>
        )}
        <button
          onClick={() => { setShowTemplatesPanel(v => !v); if (!showTemplatesPanel) loadTemplates(); }}
          className={`no-print px-3 py-1.5 text-sm rounded-ui flex items-center gap-1.5 border ${showTemplatesPanel ? 'bg-glut-flaeche border-[#d9a675] dark:border-[#a15618] text-[#a64a08] dark:text-glut' : 'bg-ebene dark:bg-ebene-2 border-kontur text-schrift-2 hover:bg-wash'}`}
          title="Gespeicherte Vorlagen anzeigen"
        >
          📋 Vorlagen {templates.length > 0 && <span className="bg-glut text-glut-ink text-[10px] font-mono rounded-full px-1.5 py-0.5 leading-none">{templates.length}</span>}
        </button>

        {/* Undo/Redo buttons */}
        {canEdit && <UndoRedoStatus handle={undoRedo} />}

        {/* Print button */}
        <button
          onClick={() => window.print()}
          className="no-print px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift hover:bg-wash text-sm rounded-ui flex items-center gap-1.5"
          title="Einsatzplan drucken (Landscape)"
        >
          🖨️ Drucken
        </button>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-schrift-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-3 rounded-cell border-2 border-dashed border-schrift-3" />
            Sonderdienst
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-3 rounded-cell border-2 border-dashed border-glut" />
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
      <div className="flex-1 overflow-auto bg-ebene rounded-panel border border-kontur p-4">
        {viewMode === 'day' ? (
          <DayView
            date={toIsoDate(selectedDate)}
            listMode={listMode}
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
