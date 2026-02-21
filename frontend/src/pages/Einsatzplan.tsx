import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import type { DayEntry, Note } from '../api/client';
import type { Group, ShiftType, Workplace } from '../types';

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEKDAY_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

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
  onClose: () => void;
  onAddSonderdienst: (entry: DayEntry) => void;
  onAddAbweichung: (entry: DayEntry) => void;
  onDelete: (entry: DayEntry) => void;
}

function ContextMenu({ x, y, entry, onClose, onAddSonderdienst, onAddAbweichung, onDelete }: ContextMenuProps) {
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
      className="fixed z-[200] bg-white rounded-lg shadow-2xl border border-gray-200 py-1 min-w-[200px]"
      style={style}
    >
      <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 border-b border-gray-100 mb-1">
        {entry.employee_name}
      </div>
      <button
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
        onClick={() => { onAddSonderdienst(entry); onClose(); }}
      >
        <span>🔷</span> Sonderdienst eintragen
      </button>
      <button
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2"
        onClick={() => { onAddAbweichung(entry); onClose(); }}
      >
        <span>⏱️</span> Arbeitszeitabweichung erfassen
      </button>
      {hasSpshi && (
        <>
          <div className="border-t border-gray-100 my-1" />
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
interface SonderdiensteModalProps {
  employee: DayEntry;
  date: string;
  shifts: ShiftType[];
  workplaces: Workplace[];
  onClose: () => void;
  onSave: (data: {
    employee_id: number;
    date: string;
    name: string;
    shortname: string;
    shift_id: number;
    workplace_id: number;
    startend: string;
    colorbk: number;
    colortext: number;
  }) => Promise<void>;
}

function SonderdiensteModal({ employee, date, shifts, workplaces, onClose, onSave }: SonderdiensteModalProps) {
  const [shiftId, setShiftId] = useState<number>(shifts[0]?.ID ?? 0);
  const [workplaceId, setWorkplaceId] = useState<number>(0);
  const [startend, setStartend] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedShift = shifts.find(s => s.ID === shiftId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftId) { setError('Bitte Schicht auswählen'); return; }
    setBusy(true);
    setError('');
    try {
      await onSave({
        employee_id: employee.employee_id,
        date,
        name: selectedShift?.NAME ?? '',
        shortname: selectedShift?.SHORTNAME ?? '',
        shift_id: shiftId,
        workplace_id: workplaceId,
        startend,
        colorbk: selectedShift?.COLORBK ?? 16777215,
        colortext: selectedShift?.COLORTEXT ?? 0,
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🔷</span> Sonderdienst eintragen
        </h2>
        <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-800">
          <strong>{employee.employee_name}</strong> · {date}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Schicht *</label>
            <select
              value={shiftId}
              onChange={e => setShiftId(Number(e.target.value))}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            >
              <option value={0}>— Schicht wählen —</option>
              {shifts.map(s => (
                <option key={s.ID} value={s.ID}>{s.NAME} ({s.SHORTNAME})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Arbeitsplatz (optional)</label>
            <select
              value={workplaceId}
              onChange={e => setWorkplaceId(Number(e.target.value))}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value={0}>— kein Arbeitsplatz —</option>
              {workplaces.map(w => (
                <option key={w.ID} value={w.ID}>{w.NAME}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Zeitbereich (optional, z.B. 06:00-14:00)</label>
            <input
              type="text"
              value={startend}
              onChange={e => setStartend(e.target.value)}
              placeholder="HH:MM-HH:MM"
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
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
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>⏱️</span> Arbeitszeitabweichung
        </h2>
        <div className="mb-3 p-2 bg-amber-50 rounded text-sm text-amber-800">
          <strong>{employee.employee_name}</strong> · {date}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bezeichnung *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kürzel</label>
            <input
              type="text"
              value={shortname}
              onChange={e => setShortname(e.target.value)}
              maxLength={10}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Erfassungsmodus</label>
            <div className="flex rounded overflow-hidden border text-xs">
              <button
                type="button"
                onClick={() => setDurationMode('times')}
                className={`flex-1 py-1.5 ${durationMode === 'times' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >Start – Ende</button>
              <button
                type="button"
                onClick={() => setDurationMode('duration')}
                className={`flex-1 py-1.5 border-l ${durationMode === 'duration' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >Dauer (Min)</button>
            </div>
          </div>
          {durationMode === 'times' ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Beginn</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Ende</label>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Dauer (Minuten)</label>
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
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
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
      className="fixed z-[110] bg-white rounded-lg shadow-xl border border-gray-200 text-xs"
      style={{ left: x, top: y, minWidth: 200, maxWidth: 280 }}
    >
      <div className="px-3 py-1.5 bg-indigo-50 border-b text-[10px] text-indigo-600 font-semibold rounded-t-lg flex justify-between">
        <span>📝 Notizen</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
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
              <div className="text-gray-700 mb-1.5 whitespace-pre-wrap break-words">{note.text1}{note.text2 ? `\n${note.text2}` : ''}</div>
              <div className="flex gap-1">
                <button
                  className="px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-[11px]"
                  onClick={() => { setEditingId(note.id); setEditText(note.text1 || ''); }}
                >✏️ Bearbeiten</button>
                <button
                  className="px-2 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100 text-[11px]"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm('Notiz löschen?')) return;
                    setBusy(true);
                    onDeleted(note.id).then(() => { setBusy(false); onClose(); });
                  }}
                >🗑️ Löschen</button>
              </div>
            </div>
          )}
        </div>
      ))}
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
      }}
      title={entry.shift_name || entry.leave_name || entry.display_name}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, entry); }}
    >
      {isDeviation && <span className="text-[9px]">⏱</span>}
      {isSpshi && !isDeviation && <span className="text-[9px]">★</span>}
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

  const d = new Date(date + 'T12:00:00');
  const weekdayName = WEEKDAY_NAMES[d.getDay()];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-700 border-b pb-1">
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
            <div className="p-2 flex flex-wrap gap-1.5 bg-white min-h-[40px]">
              {shiftEntries.length === 0 ? (
                <span className="text-xs text-gray-400 italic">Niemand eingetragen</span>
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
          <div className="px-3 py-1.5 text-sm font-bold bg-amber-50 text-amber-800">
            Abwesend — {byShift.get(null)!.length} MA
          </div>
          <div className="p-2 flex flex-wrap gap-1.5 bg-white">
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
        <div className="px-3 py-1.5 text-sm font-bold bg-gray-100 text-gray-600">
          Frei / kein Eintrag — {freeEntries.length} MA
          <span className="ml-2 text-[10px] font-normal text-gray-400">Rechtsklick zum Eintragen</span>
        </div>
        <div className="p-2 flex flex-wrap gap-1.5 bg-white min-h-[36px]">
          {freeEntries.length === 0 ? (
            <span className="text-xs text-gray-400 italic">Alle eingeteilt</span>
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
  onContextMenu,
}: {
  weekDates: string[];
  entriesByDate: Map<string, DayEntry[]>;
  shifts: ShiftType[];
  onContextMenu?: (e: React.MouseEvent, entry: DayEntry, date: string) => void;
}) {
  return (
    <div className="overflow-auto">
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr className="bg-slate-700 text-white">
            <th className="px-3 py-2 text-left min-w-[120px] border-r border-slate-600 sticky left-0 z-10 bg-slate-700">
              Schicht
            </th>
            {weekDates.map(d => {
              const date = new Date(d + 'T12:00:00');
              const dow = date.getDay();
              const isWe = dow === 0 || dow === 6;
              return (
                <th
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
                const shiftEntries = dayEntries.filter(e => e.shift_id === shift.ID);
                return (
                  <td key={d} className="border border-gray-200 p-1 align-top">
                    <div className="flex flex-col gap-0.5">
                      {shiftEntries.map(e => {
                        const isSpshi = e.kind === 'special_shift';
                        const isDeviation = isSpshi && e.spshi_type === 1;
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
                            }}
                            onContextMenu={ev => { ev.preventDefault(); onContextMenu?.(ev, e, d); }}
                            title={`${e.employee_name}${isSpshi ? ' (Sonderdienst)' : ''}${isDeviation ? ' (Abweichung)' : ''}`}
                          >
                            {isDeviation && '⏱'}
                            {isSpshi && !isDeviation && '★'}
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
          {/* Absence row */}
          <tr>
            <td className="sticky left-0 z-10 px-3 py-1.5 border border-gray-200 font-semibold text-sm bg-amber-50 text-amber-700 whitespace-nowrap">
              Abwesend
            </td>
            {weekDates.map(d => {
              const dayEntries = entriesByDate.get(d) || [];
              const absences = dayEntries.filter(e => e.kind === 'absence');
              return (
                <td key={d} className="border border-gray-200 p-1 align-top bg-amber-50">
                  <div className="flex flex-col gap-0.5">
                    {absences.map(e => (
                      <div
                        key={e.employee_id}
                        className="px-1 py-0.5 rounded text-[10px] font-semibold cursor-context-menu"
                        style={{ backgroundColor: e.color_bk, color: e.color_text, border: '1px solid rgba(0,0,0,0.1)' }}
                        onContextMenu={ev => { ev.preventDefault(); onContextMenu?.(ev, e, d); }}
                      >
                        {e.display_name} {e.employee_name}
                      </div>
                    ))}
                  </div>
                </td>
              );
            })}
          </tr>
          {/* Free row */}
          <tr>
            <td className="sticky left-0 z-10 px-3 py-1.5 border border-gray-200 font-semibold text-sm bg-gray-100 text-gray-600 whitespace-nowrap">
              Frei
            </td>
            {weekDates.map(d => {
              const dayEntries = entriesByDate.get(d) || [];
              const free = dayEntries.filter(e => !e.kind);
              return (
                <td key={d} className="border border-gray-200 p-1 align-top bg-gray-50">
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
    </div>
  );
}

export default function Einsatzplan() {
  const today = new Date();
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);

  const [groups, setGroups] = useState<Group[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Employee search
  const [employeeSearch, setEmployeeSearch] = useState('');

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
  const [sonderdiensteModal, setSonderdiensteModal] = useState<{ entry: DayEntry; date: string } | null>(null);
  const [abweichungModal, setAbweichungModal] = useState<{ entry: DayEntry; date: string } | null>(null);

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
  }, []);

  const loadData = useCallback(() => {
    setError(null);
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
      }).catch(e => { setError(e.message); setLoading(false); });
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
        .catch(e => { setError(e.message); setLoading(false); });
    }
  }, [selectedDate, viewMode, groupId]);

  // Load data when date/mode/group changes
  useEffect(() => {
    loadData();
  }, [loadData]);

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
    await api.updateNote(id, { text });
    reloadDayNotes();
  };

  const handleEinsatzplanNoteDeleted = async (id: number) => {
    await api.deleteNote(id);
    reloadDayNotes();
  };

  // ── Einsatzplan write handlers ────────────────────────────
  const handleOpenContextMenu = useCallback((e: React.MouseEvent, entry: DayEntry, date?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
      date: date ?? toIsoDate(selectedDate),
    });
  }, [selectedDate]);

  const handleSonderdienste = (entry: DayEntry) => {
    setSonderdiensteModal({ entry, date: contextMenu?.date ?? toIsoDate(selectedDate) });
  };

  const handleAbweichung = (entry: DayEntry) => {
    setAbweichungModal({ entry, date: contextMenu?.date ?? toIsoDate(selectedDate) });
  };

  const handleDeleteSpshi = async (entry: DayEntry) => {
    if (!entry.spshi_id) return;
    if (!confirm(`Sonderdienst-Eintrag für ${entry.employee_name} löschen?`)) return;
    try {
      await api.deleteEinsatzplanEntry(entry.spshi_id);
      loadData();
    } catch (e: unknown) {
      alert('Fehler beim Löschen: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleSaveSonderdienst = async (data: {
    employee_id: number;
    date: string;
    name: string;
    shortname: string;
    shift_id: number;
    workplace_id: number;
    startend: string;
    colorbk: number;
    colortext: number;
  }) => {
    await api.createEinsatzplanEntry({
      employee_id: data.employee_id,
      date: data.date,
      name: data.name,
      shortname: data.shortname,
      shift_id: data.shift_id,
      workplace_id: data.workplace_id,
      startend: data.startend,
      colorbk: data.colorbk,
      colortext: data.colortext,
    });
    loadData();
  };

  const handleSaveAbweichung = async (data: {
    employee_id: number;
    date: string;
    name: string;
    shortname: string;
    startend: string;
    duration: number;
  }) => {
    await api.createDeviation({
      employee_id: data.employee_id,
      date: data.date,
      name: data.name,
      shortname: data.shortname,
      startend: data.startend,
      duration: data.duration,
    });
    loadData();
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
            className={`px-3 py-1.5 ${viewMode === 'day' ? 'bg-slate-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Tagesansicht
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 border-l ${viewMode === 'week' ? 'bg-slate-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Wochenansicht
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={viewMode === 'day' ? prevDay : prevWeek}
            className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
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
            className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm"
          >›</button>

          <button
            onClick={goToday}
            className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm text-blue-600"
          >
            Heute
          </button>
        </div>

        {/* Group filter */}
        <select
          value={groupId ?? ''}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-1.5 bg-white border rounded shadow-sm text-sm"
        >
          <option value="">Alle Gruppen</option>
          {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
        </select>

        {/* Employee search */}
        <div className="flex items-center gap-1.5 bg-white border rounded shadow-sm px-2 py-1.5">
          <span className="text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={employeeSearch}
            onChange={e => setEmployeeSearch(e.target.value)}
            placeholder="Mitarbeiter suchen..."
            className="text-sm outline-none w-36 bg-transparent"
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
              ? <><span className="font-bold">{visibleCount}</span><span className="text-gray-400"> / {totalCount} Mitarbeiter</span></>
              : <>{totalCount} Mitarbeiter</>
            }
          </span>
        )}

        {loading && <span className="text-sm text-blue-500 animate-pulse">Lade...</span>}
        {error && <span className="text-sm text-red-500">Fehler: {error}</span>}

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
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          date={contextMenu.date}
          onClose={() => setContextMenu(null)}
          onAddSonderdienst={handleSonderdienste}
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

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow border border-gray-200 p-4">
        {viewMode === 'day' ? (
          <DayView
            date={toIsoDate(selectedDate)}
            entries={filteredDayEntries}
            shifts={shifts}
            notesByEmpId={dayNotesMap}
            onNoteClick={(e, notes) => {
              e.stopPropagation();
              setNotePopup({ x: e.clientX, y: e.clientY, notes });
            }}
            onContextMenu={handleOpenContextMenu}
          />
        ) : (
          <WeekView
            weekDates={weekDates}
            entriesByDate={filteredWeekEntries}
            shifts={shifts}
            onContextMenu={(e, entry, date) => handleOpenContextMenu(e, entry, date)}
          />
        )}
      </div>
    </div>
  );
}
