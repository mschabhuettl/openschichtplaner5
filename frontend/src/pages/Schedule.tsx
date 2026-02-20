import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { api } from '../api/client';
import type { ShiftRequirement, Note, ConflictEntry } from '../api/client';
import type { Employee, Group, ScheduleEntry, ShiftType, LeaveType } from '../types';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';

// ── JS weekday → DB weekday (0=Mon..6=Sun) ────────────────────
function jsWdToDbWd(jsWd: number): number {
  return (jsWd + 6) % 7;
}

// ── Export helpers ────────────────────────────────────────────

function exportCSV(
  employees: Employee[],
  days: number[],
  entryMap: Map<string, ScheduleEntry>,
  year: number,
  month: number,
) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const header = ['Mitarbeiter', ...days.map(d => `${year}-${pad(month)}-${pad(d)}`)];
  const rows = employees.map(emp => {
    const cells = days.map(day => {
      const e = entryMap.get(`${emp.ID}-${day}`);
      return e ? (e.display_name || '') : '';
    });
    return [`${emp.NAME}, ${emp.FIRSTNAME}`, ...cells];
  });
  const csv = [header, ...rows]
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dienstplan_${year}_${pad(month)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildScheduleHTML(
  employees: Employee[],
  days: number[],
  entryMap: Map<string, ScheduleEntry>,
  holidays: Set<string>,
  year: number,
  month: number,
  monthName: string,
  groupLabel: string,
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const WD_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  const thStyle = 'border:1px solid #ccc;padding:3px 5px;background:#334155;color:#fff;font-size:11px;text-align:center;';
  const tdNameStyle = 'border:1px solid #ddd;padding:3px 6px;font-size:11px;white-space:nowrap;font-weight:500;';
  const tdStyle = (bk?: string, isWe = false, isHol = false) => {
    const bg = bk || (isHol ? '#fee2e2' : isWe ? '#f1f5f9' : '#fff');
    return `border:1px solid #ddd;padding:2px 3px;font-size:11px;text-align:center;background:${bg};`;
  };

  let headerCells = `<th style="${thStyle}min-width:140px">Mitarbeiter</th>`;
  for (const day of days) {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const wd = new Date(year, month - 1, day).getDay();
    const isHol = holidays.has(dateStr);
    const isWe = wd === 0 || wd === 6;
    const style = thStyle + (isHol ? 'background:#b91c1c;' : isWe ? 'background:#475569;' : '');
    headerCells += `<th style="${style}min-width:28px">${day}<br/><span style="font-size:9px;opacity:.8">${WD_ABBR[wd]}</span></th>`;
  }

  let bodyRows = '';
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';
    let cells = `<td style="${tdNameStyle}background:${rowBg}">${emp.NAME}, ${emp.FIRSTNAME}</td>`;
    for (const day of days) {
      const dateStr = `${year}-${pad(month)}-${pad(day)}`;
      const wd = new Date(year, month - 1, day).getDay();
      const isHol = holidays.has(dateStr);
      const isWe = wd === 0 || wd === 6;
      const entry = entryMap.get(`${emp.ID}-${day}`);
      const style = tdStyle(entry?.color_bk, isWe, isHol);
      const color = entry?.color_text || '#000';
      cells += `<td style="${style}"><span style="color:${color};font-weight:bold">${entry?.display_name || ''}</span></td>`;
    }
    bodyRows += `<tr>${cells}</tr>`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Dienstplan ${monthName} ${year}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 16px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  .subtitle { font-size: 12px; color: #555; margin-bottom: 10px; }
  table { border-collapse: collapse; }
  @media print {
    @page { size: landscape; margin: 8mm; }
    body { margin: 0; }
    h1 { font-size: 13px; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
<h1>Dienstplan – ${monthName} ${year}</h1>
<div class="subtitle">Gruppe: ${groupLabel} &nbsp;|&nbsp; ${employees.length} Mitarbeiter &nbsp;|&nbsp; Erstellt: ${new Date().toLocaleString('de-AT')}</div>
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
}

function exportHTML(
  employees: Employee[],
  days: number[],
  entryMap: Map<string, ScheduleEntry>,
  holidays: Set<string>,
  year: number,
  month: number,
  monthName: string,
) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const html = buildScheduleHTML(employees, days, entryMap, holidays, year, month, monthName, 'Alle Gruppen');
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dienstplan_${year}_${pad(month)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'width=1400,height=900');
  if (!w) { alert('Popup-Fenster blockiert! Bitte den Popup-Blocker für diese Seite deaktivieren.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  // slight delay so browser can render before print dialog
  setTimeout(() => w.print(), 500);
}

// ── Constants ─────────────────────────────────────────────────
const WEEKDAY_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getWeekday(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay(); // 0=Sun
}

// ── ShiftPicker ───────────────────────────────────────────────
function ShiftPicker({
  onSelect,
  onAbsence,
  onClose,
  shifts,
  leaveTypes,
}: {
  onSelect: (shiftId: number) => void;
  onAbsence: (leaveTypeId: number) => void;
  onClose: () => void;
  shifts: ShiftType[];
  leaveTypes: LeaveType[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[160px] text-xs"
      style={{ top: '100%', left: 0 }}
    >
      <div className="font-semibold text-gray-600 mb-1 px-1">Schicht wählen</div>
      {shifts.map(s => (
        <button
          key={s.ID}
          onClick={() => { onSelect(s.ID); onClose(); }}
          className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left"
        >
          <span
            className="inline-block w-4 h-4 rounded text-center text-[9px] font-bold leading-4 flex-shrink-0"
            style={{ backgroundColor: s.COLORBK_HEX, color: s.COLORTEXT_HEX }}
          >
            {s.SHORTNAME?.[0] || '?'}
          </span>
          <span>{s.SHORTNAME} – {s.NAME}</span>
        </button>
      ))}
      {leaveTypes.length > 0 && (
        <>
          <div className="border-t my-1" />
          <div className="font-semibold text-gray-600 mb-1 px-1">Abwesenheit</div>
          {leaveTypes.map(lt => (
            <button
              key={lt.ID}
              onClick={() => { onAbsence(lt.ID); onClose(); }}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left"
            >
              <span
                className="inline-block w-4 h-4 rounded text-center text-[9px] font-bold leading-4 flex-shrink-0"
                style={{ backgroundColor: lt.COLORBK_HEX, color: lt.COLORBAR_HEX }}
              >
                {lt.SHORTNAME?.[0] || 'A'}
              </span>
              <span>{lt.SHORTNAME} – {lt.NAME}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

// ── GroupMultiSelect ──────────────────────────────────────────
function GroupMultiSelect({
  groups,
  selectedIds,
  onChange,
}: {
  groups: Group[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label =
    selectedIds.length === 0
      ? 'Alle Gruppen'
      : selectedIds.length === 1
      ? (groups.find(g => g.ID === selectedIds[0])?.NAME ?? '1 Gruppe')
      : `${selectedIds.length} Gruppen`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 bg-white border rounded shadow-sm text-sm flex items-center gap-1.5 min-w-[150px]"
      >
        <span className="flex-1 text-left truncate">{label}</span>
        <span className="text-gray-400 text-xs flex-shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[190px] py-1">
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            onClick={() => { onChange([]); setOpen(false); }}
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0 ${
                selectedIds.length === 0 ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
              }`}
            >
              {selectedIds.length === 0 ? '✓' : ''}
            </span>
            Alle Gruppen
          </button>
          <div className="border-t my-1" />
          {groups.map(g => {
            const isSelected = selectedIds.includes(g.ID);
            return (
              <button
                key={g.ID}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => {
                  if (isSelected) {
                    onChange(selectedIds.filter(id => id !== g.ID));
                  } else {
                    onChange([...selectedIds, g.ID]);
                  }
                }}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0 ${
                    isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
                  }`}
                >
                  {isSelected ? '✓' : ''}
                </span>
                {g.NAME}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Note context menu ─────────────────────────────────────────
interface ContextMenuState {
  x: number;
  y: number;
  empId: number;
  day: number;
  dateStr: string;
}

function NoteContextMenu({
  state,
  onClose,
  onAddNote,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onAddNote: (empId: number, dateStr: string, text: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'menu' | 'input'>('menu');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    await onAddNote(state.empId, state.dateStr, noteText.trim());
    setSaving(false);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 text-xs"
      style={{ left: state.x, top: state.y, minWidth: 180 }}
    >
      {mode === 'menu' ? (
        <div className="py-1">
          <div className="px-3 py-1 text-gray-400 text-[10px] font-medium border-b mb-1">
            {state.dateStr}
          </div>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2"
            onClick={() => setMode('input')}
          >
            💬 Notiz hinzufügen
          </button>
        </div>
      ) : (
        <div className="p-2">
          <div className="text-gray-500 mb-1 font-medium">Notiz:</div>
          <textarea
            autoFocus
            className="w-full border rounded p-1 text-xs resize-none focus:outline-blue-400"
            rows={3}
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Notiz eingeben..."
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
              if (e.key === 'Escape') onClose();
            }}
          />
          <div className="flex gap-1 mt-1">
            <button
              className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || !noteText.trim()}
            >
              {saving ? '…' : 'Speichern'}
            </button>
            <button
              className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
              onClick={onClose}
            >
              Abbruch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── NoteDetailPopup ──────────────────────────────────────────
interface NoteDetailPopupState {
  x: number;
  y: number;
  empId: number;
  dateStr: string;
  notes: Note[];
}

function NoteDetailPopup({
  state,
  onClose,
  onDeleted,
  onEdited,
  onAdd,
}: {
  state: NoteDetailPopupState;
  onClose: () => void;
  onDeleted: (noteId: number) => Promise<void>;
  onEdited: (noteId: number, newText: string) => Promise<void>;
  onAdd: (empId: number, dateStr: string, text: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [addText, setAddText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditText(note.text1 || '');
    setAddMode(false);
  };

  const handleSaveEdit = async () => {
    if (editingId == null || !editText.trim()) return;
    setBusy(true);
    await onEdited(editingId, editText.trim());
    setBusy(false);
    setEditingId(null);
  };

  const handleDelete = async (noteId: number) => {
    if (!confirm('Notiz löschen?')) return;
    setBusy(true);
    await onDeleted(noteId);
    setBusy(false);
    onClose();
  };

  const handleAdd = async () => {
    if (!addText.trim()) return;
    setBusy(true);
    await onAdd(state.empId, state.dateStr, addText.trim());
    setBusy(false);
    setAddMode(false);
    setAddText('');
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-[110] bg-white rounded-lg shadow-xl border border-gray-200 text-xs"
      style={{ left: state.x, top: state.y, minWidth: 210, maxWidth: 290 }}
    >
      <div className="px-3 py-1.5 bg-indigo-50 border-b text-[10px] text-indigo-600 font-semibold rounded-t-lg flex justify-between items-center">
        <span>📝 Notizen · {state.dateStr}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs leading-none ml-2">×</button>
      </div>
      {state.notes.map(note => (
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
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
              <div className="flex gap-1 mt-1">
                <button
                  className="flex-1 px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-[11px]"
                  onClick={handleSaveEdit}
                  disabled={busy || !editText.trim()}
                >
                  {busy ? '…' : 'Speichern'}
                </button>
                <button
                  className="px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-[11px]"
                  onClick={() => setEditingId(null)}
                >
                  Abbruch
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-gray-700 mb-1.5 whitespace-pre-wrap break-words">{note.text1}{note.text2 ? `\n${note.text2}` : ''}</div>
              <div className="flex gap-1">
                <button
                  className="px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-[11px]"
                  onClick={() => startEdit(note)}
                >
                  ✏️ Bearbeiten
                </button>
                <button
                  className="px-2 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100 text-[11px]"
                  onClick={() => handleDelete(note.id)}
                  disabled={busy}
                >
                  🗑️ Löschen
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {addMode ? (
        <div className="p-2">
          <textarea
            autoFocus
            className="w-full border rounded p-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            rows={3}
            value={addText}
            onChange={e => setAddText(e.target.value)}
            placeholder="Neue Notiz..."
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); }
              if (e.key === 'Escape') setAddMode(false);
            }}
          />
          <div className="flex gap-1 mt-1">
            <button
              className="flex-1 px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-[11px]"
              onClick={handleAdd}
              disabled={busy || !addText.trim()}
            >
              {busy ? '…' : 'Speichern'}
            </button>
            <button
              className="px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-[11px]"
              onClick={() => setAddMode(false)}
            >
              Abbruch
            </button>
          </div>
        </div>
      ) : (
        <button
          className="w-full px-3 py-1.5 text-left text-[11px] text-blue-600 hover:bg-blue-50 border-t flex items-center gap-1"
          onClick={() => { setAddMode(true); setEditingId(null); }}
        >
          + Weitere Notiz hinzufügen
        </button>
      )}
    </div>
  );
}

// ── Auslastungsbereich ────────────────────────────────────────
function AuslastungsBereich({
  shifts,
  days,
  year,
  month,
  entries,
  staffingReqs,
  selectedGroupIds,
}: {
  shifts: ShiftType[];
  days: number[];
  year: number;
  month: number;
  entries: ScheduleEntry[];
  staffingReqs: ShiftRequirement[];
  selectedGroupIds: number[];
}) {
  const pad = (n: number) => String(n).padStart(2, '0');

  // Per shift_id, per day: count employees
  const countMap = useMemo(() => {
    const m = new Map<number, Map<number, number>>(); // shiftId → day → count
    for (const e of entries) {
      if ((e.kind !== 'shift' && e.kind !== 'special_shift') || !e.shift_id) continue;
      const day = parseInt(e.date.split('-')[2]);
      if (!m.has(e.shift_id)) m.set(e.shift_id, new Map());
      const dm = m.get(e.shift_id)!;
      dm.set(day, (dm.get(day) || 0) + 1);
    }
    return m;
  }, [entries]);

  // Requirements lookup: dbWeekday → shiftId → {min, max}
  const reqsLookup = useMemo(() => {
    const lookup = new Map<number, Map<number, { min: number; max: number }>>();
    const filteredReqs =
      selectedGroupIds.length > 0
        ? staffingReqs.filter(r => r.group_id == null || selectedGroupIds.includes(r.group_id))
        : staffingReqs;
    for (const req of filteredReqs) {
      if (req.shift_id == null) continue;
      const dbWd = req.weekday; // already in DB format
      if (!lookup.has(dbWd)) lookup.set(dbWd, new Map());
      const wdMap = lookup.get(dbWd)!;
      const existing = wdMap.get(req.shift_id);
      if (existing) {
        // Multiple groups: combine requirements
        wdMap.set(req.shift_id, { min: existing.min + req.min, max: existing.max + req.max });
      } else {
        wdMap.set(req.shift_id, { min: req.min, max: req.max });
      }
    }
    return lookup;
  }, [staffingReqs, selectedGroupIds]);

  // Active shifts: those with entries or requirements in this month
  const activeShifts = useMemo(() => {
    const shiftIdsWithEntries = new Set<number>();
    for (const e of entries) {
      if (e.shift_id) shiftIdsWithEntries.add(e.shift_id);
    }
    const shiftIdsWithReqs = new Set<number>();
    for (const req of staffingReqs) {
      if (req.shift_id) shiftIdsWithReqs.add(req.shift_id);
    }
    return shifts.filter(s => shiftIdsWithEntries.has(s.ID) || shiftIdsWithReqs.has(s.ID));
  }, [shifts, entries, staffingReqs]);

  if (activeShifts.length === 0) return null;

  function getCellStyle(shiftId: number, day: number): CSSProperties {
    const jsWd = getWeekday(year, month, day);
    const dbWd = jsWdToDbWd(jsWd);
    const count = countMap.get(shiftId)?.get(day) ?? 0;
    const req = reqsLookup.get(dbWd)?.get(shiftId);

    if (!req || (req.min === 0 && req.max === 0)) {
      // No requirement defined
      if (count === 0) return { backgroundColor: '#f8fafc', color: '#94a3b8' };
      return { backgroundColor: '#f0f9ff', color: '#3b82f6' };
    }

    if (count < req.min) return { backgroundColor: '#fef2f2', color: '#dc2626' }; // Unterbesetzt
    if (count > req.max) return { backgroundColor: '#fff7ed', color: '#ea580c' }; // Überbesetzt
    return { backgroundColor: '#f0fdf4', color: '#16a34a' }; // OK
  }

  function getCellTitle(shiftId: number, day: number): string {
    const jsWd = getWeekday(year, month, day);
    const dbWd = jsWdToDbWd(jsWd);
    const count = countMap.get(shiftId)?.get(day) ?? 0;
    const req = reqsLookup.get(dbWd)?.get(shiftId);
    if (!req || (req.min === 0 && req.max === 0)) return `${count} eingeteilt (kein Soll)`;
    return `${count} eingeteilt / Soll: ${req.min}–${req.max}`;
  }

  return (
    <div className="mt-3 bg-white rounded-lg shadow border border-gray-200 overflow-auto">
      <div className="px-3 py-2 bg-slate-50 border-b border-gray-200 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">📊 Auslastung nach Schichtart</span>
        <span className="text-[10px] text-gray-400">
          Grün = OK · Rot = Unterbesetzt · Orange = Überbesetzt · Grau = kein Soll
        </span>
      </div>
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr className="bg-slate-100">
            <th className="sticky left-0 z-20 bg-slate-100 px-3 py-1.5 text-left min-w-[100px] border-r border-gray-200 text-slate-600 font-semibold">
              Schicht
            </th>
            {days.map(day => {
              const jsWd = getWeekday(year, month, day);
              const dateStr = `${year}-${pad(month)}-${pad(day)}`;
              const isWe = jsWd === 0 || jsWd === 6;
              return (
                <th
                  key={day}
                  className={`px-0.5 py-1 text-center min-w-[34px] border-r border-gray-200 ${isWe ? 'bg-slate-200' : ''}`}
                  title={dateStr}
                >
                  <div className="text-[10px] font-medium text-slate-500">{day}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {activeShifts.map(shift => (
            <tr key={shift.ID}>
              <td className="sticky left-0 z-10 bg-white px-3 py-1 border-r border-gray-200 border-b border-b-gray-100 whitespace-nowrap">
                <span
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    className="inline-block w-5 h-5 rounded text-center text-[9px] font-bold leading-5 flex-shrink-0"
                    style={{ backgroundColor: shift.COLORBK_HEX, color: shift.COLORTEXT_HEX }}
                  >
                    {shift.SHORTNAME?.[0] || '?'}
                  </span>
                  <span className="text-slate-600 font-medium">{shift.SHORTNAME}</span>
                </span>
              </td>
              {days.map(day => {
                const count = countMap.get(shift.ID)?.get(day) ?? 0;
                const cellStyle = getCellStyle(shift.ID, day);
                const jsWd = getWeekday(year, month, day);
                const isWe = jsWd === 0 || jsWd === 6;
                return (
                  <td
                    key={day}
                    className={`border border-gray-100 text-center py-1 font-bold ${isWe ? 'opacity-70' : ''}`}
                    style={cellStyle}
                    title={getCellTitle(shift.ID, day)}
                  >
                    {count > 0 ? <span className="text-[11px]">{count}</span> : <span className="text-[9px] opacity-30">·</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Employee Count Badge ──────────────────────────────────────
function EmployeeCountBadge({ visible, total }: { visible: number; total: number }) {
  const filtered = visible < total;
  return (
    <span className={`text-sm font-medium ${filtered ? 'text-blue-600' : 'text-gray-500'}`}>
      {filtered ? (
        <>
          <span className="font-bold">{visible}</span>
          <span className="text-gray-400"> / {total} Mitarbeiter</span>
        </>
      ) : (
        <>{total} Mitarbeiter</>
      )}
    </span>
  );
}

// ── Shift Filter Dropdown (colored badges) ────────────────────
function ShiftFilterDropdown({
  shifts,
  value,
  onChange,
}: {
  shifts: ShiftType[];
  value: number | '';
  onChange: (id: number | '') => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = value !== '' ? shifts.find(s => s.ID === value) : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 border rounded bg-white text-xs hover:bg-gray-50"
      >
        {selected ? (
          <>
            <span
              className="inline-block w-4 h-4 rounded text-center text-[9px] font-bold leading-4 flex-shrink-0"
              style={{ backgroundColor: selected.COLORBK_HEX, color: selected.COLORTEXT_HEX }}
            >
              {selected.SHORTNAME?.[0] || '?'}
            </span>
            <span className="max-w-[120px] truncate">{selected.SHORTNAME} – {selected.NAME}</span>
          </>
        ) : (
          <span className="text-gray-500">Alle Schichten</span>
        )}
        <span className="text-gray-400 ml-1">▾</span>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[200px] py-1">
          <button
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
            onClick={() => { onChange(''); setOpen(false); }}
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0 ${
                value === '' ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
              }`}
            >
              {value === '' ? '✓' : ''}
            </span>
            Alle Schichten
          </button>
          <div className="border-t my-1" />
          {shifts.map(s => (
            <button
              key={s.ID}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
              onClick={() => { onChange(s.ID); setOpen(false); }}
            >
              <span
                className="inline-block w-4 h-4 rounded text-center text-[9px] font-bold leading-4 flex-shrink-0"
                style={{ backgroundColor: s.COLORBK_HEX, color: s.COLORTEXT_HEX }}
              >
                {s.SHORTNAME?.[0] || '?'}
              </span>
              <span className="flex-1 text-left">
                <span className="font-semibold">{s.SHORTNAME}</span>
                {s.NAME !== s.SHORTNAME && <span className="text-gray-500 ml-1">– {s.NAME}</span>}
              </span>
              {value === s.ID && <span className="text-blue-500 text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── BulkContextMenu ───────────────────────────────────────────
interface BulkContextMenuProps {
  x: number;
  y: number;
  selectionInfo: { cells: number; employees: number; days: number };
  shifts: ShiftType[];
  hasClipboard: boolean;
  onClose: () => void;
  onAssignShift: (shiftId: number) => void;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
}

function BulkContextMenu({
  x, y, selectionInfo, shifts, hasClipboard,
  onClose, onAssignShift, onDelete, onCopy, onPaste,
}: BulkContextMenuProps) {
  const [mode, setMode] = useState<'menu' | 'shift-select'>('menu');
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
      className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 text-xs"
      style={{ left: x, top: y, minWidth: 210 }}
    >
      <div className="px-3 py-1.5 bg-blue-50 border-b text-[10px] text-blue-700 font-semibold rounded-t-lg flex items-center justify-between">
        <span>✅ {selectionInfo.cells} Zellen ({selectionInfo.employees} MA × {selectionInfo.days} Tage)</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2">×</button>
      </div>
      {mode === 'menu' ? (
        <div className="py-1">
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2"
            onClick={() => setMode('shift-select')}
          >
            📋 Schicht zuweisen...
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
            onClick={() => { onDelete(); onClose(); }}
          >
            🗑️ Löschen
          </button>
          <div className="border-t my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2"
            onClick={() => { onCopy(); onClose(); }}
          >
            📄 Kopieren
          </button>
          {hasClipboard && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2"
              onClick={onPaste}
            >
              📌 Einfügen
            </button>
          )}
        </div>
      ) : (
        <div className="py-1">
          <div className="px-3 py-1 text-gray-400 text-[10px] font-medium border-b mb-1">Schicht wählen</div>
          {shifts.map(s => (
            <button
              key={s.ID}
              onClick={() => { onAssignShift(s.ID); onClose(); }}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 text-left"
            >
              <span
                className="inline-block w-4 h-4 rounded text-center text-[9px] font-bold leading-4 flex-shrink-0"
                style={{ backgroundColor: s.COLORBK_HEX, color: s.COLORTEXT_HEX }}
              >
                {s.SHORTNAME?.[0] || '?'}
              </span>
              <span>{s.SHORTNAME} – {s.NAME}</span>
            </button>
          ))}
          <div className="border-t my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 text-gray-500 flex items-center gap-1"
            onClick={() => setMode('menu')}
          >
            ← Zurück
          </button>
        </div>
      )}
    </div>
  );
}

// ── HoverTooltip ─────────────────────────────────────────────
interface HoverTooltipState {
  empId: number;
  day: number;
  x: number;
  y: number;
}

function HoverTooltip({
  state,
  emp,
  entry,
  dateStr,
  cellConflicts,
}: {
  state: HoverTooltipState;
  emp: Employee | null;
  entry: ScheduleEntry | null;
  dateStr: string;
  cellConflicts: ConflictEntry[];
}) {
  if (!entry && cellConflicts.length === 0) return null;
  return (
    <div
      className="fixed z-[150] pointer-events-none bg-gray-900 text-white text-xs rounded-lg shadow-xl px-3 py-2 max-w-[240px]"
      style={{ left: state.x + 14, top: state.y - 10 }}
    >
      {emp && (
        <div className="font-semibold text-blue-200 mb-0.5">{emp.NAME}, {emp.FIRSTNAME}</div>
      )}
      <div className="text-gray-400 text-[10px] mb-1">{dateStr}</div>
      {entry && (
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="inline-block w-3.5 h-3.5 rounded text-[8px] font-bold leading-[14px] text-center flex-shrink-0"
            style={{ backgroundColor: entry.color_bk || '#64748b', color: entry.color_text || '#fff' }}
          >
            {entry.display_name?.[0] || '?'}
          </span>
          <span className="font-medium">{entry.shift_name || entry.leave_name || entry.display_name}</span>
        </div>
      )}
      {cellConflicts.length > 0 && (
        <div className="mt-1 pt-1 border-t border-gray-700 space-y-0.5">
          {cellConflicts.map((c, i) => (
            <div key={i} className="flex items-start gap-1 text-amber-300">
              <span className="flex-shrink-0 text-[10px]">⚠️</span>
              <span className="text-[10px] leading-tight">{c.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Schedule Component ───────────────────────────────────
export default function Schedule() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Multi-group selection (empty = all groups)
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  // Core data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  // Group members: groupId → Set<employeeId>
  const [groupMembersMap, setGroupMembersMap] = useState<Map<number, Set<number>>>(new Map());

  // Staffing requirements
  const [staffingReqs, setStaffingReqs] = useState<ShiftRequirement[]>([]);

  // Notes: "empId-dateStr" → Note[]
  const [notesMap, setNotesMap] = useState<Map<string, Note[]>>(new Map());

  // Conflicts
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Filters
  const [filterShiftId, setFilterShiftId] = useState<number | ''>('');
  const [filterLeaveId, setFilterLeaveId] = useState<number | ''>('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  // UI state
  const [activePicker, setActivePicker] = useState<{ empId: number; day: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { toasts, showToast, removeToast } = useToast();
  const exportRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [notePopup, setNotePopup] = useState<NoteDetailPopupState | null>(null);

  // ── Multi-select state ─────────────────────────────────────
  const [selection, setSelection] = useState<{
    startEmpId: number; startDay: number;
    endEmpId: number;   endDay: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragAnchorRef = useRef<{ empId: number; day: number } | null>(null);
  const [clipboard, setClipboard] = useState<{
    entries: Array<{ relEmpIdx: number; relDay: number; shiftId: number | null }>;
    anchorEmpIdx: number; anchorDay: number;
  } | null>(null);
  const [bulkContextMenu, setBulkContextMenu] = useState<{
    x: number; y: number; empId: number; day: number;
  } | null>(null);
  const [bulkShiftId, setBulkShiftId] = useState<number | ''>('');

  // ── Undo/Redo ──────────────────────────────────────────────
  const [undoStack, setUndoStack] = useState<Array<{ cells: Array<{ empId: number; day: number; before: ScheduleEntry | null }> }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ cells: Array<{ empId: number; day: number; before: ScheduleEntry | null }> }>>([]);

  // ── Keyboard cursor (single selected cell for nav) ─────────
  const [selectedCell, setSelectedCell] = useState<{ empId: number; day: number } | null>(null);

  // ── HTML5 Drag & Drop ──────────────────────────────────────
  const [dndSource, setDndSource] = useState<{ empId: number; day: number } | null>(null);
  const [dndTarget, setDndTarget] = useState<{ empId: number; day: number } | null>(null);

  // ── Hover Tooltip ──────────────────────────────────────────
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-Plan modal state
  const [showAutoPlan, setShowAutoPlan] = useState(false);
  const [autoPlanForce, setAutoPlanForce] = useState(false);
  const [autoPlanEmployeeId, setAutoPlanEmployeeId] = useState<number | 'all'>('all');
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);
  const [autoPlanAssignments, setAutoPlanAssignments] = useState<Array<{ employee_id: number; cycle_id: number; start: string }>>([]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  // Load static data once
  useEffect(() => {
    api.getEmployees().then(setEmployees);
    api.getGroups().then(setGroups);
    api.getShifts().then(setShifts);
    api.getLeaveTypes().then(setLeaveTypes);
  }, []);

  // Load schedule + holidays when year/month/group changes
  const loadSchedule = () => {
    setLoading(true);
    // Always load without group filter; filtering done client-side for multi-group
    const groupIdForConflicts = selectedGroupIds.length === 1 ? selectedGroupIds[0] : undefined;
    Promise.all([
      api.getSchedule(year, month),
      api.getHolidays(year),
      api.getConflicts({ year, month, group_id: groupIdForConflicts }).catch(() => ({ conflicts: [] as ConflictEntry[] })),
    ]).then(([sched, hols, conflictsResult]) => {
      setEntries(sched);
      setHolidays(new Set(hols.map(h => h.DATE)));
      setConflicts(conflictsResult.conflicts);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadSchedule();
  }, [year, month]);

  // Load staffing requirements when year/month changes
  useEffect(() => {
    api.getStaffingRequirements(year, month)
      .then(data => setStaffingReqs(data.shift_requirements))
      .catch(() => setStaffingReqs([]));
  }, [year, month]);

  // Helper: build noteMap from array of notes
  const buildNotesMap = (notes: Note[]): Map<string, Note[]> => {
    const map = new Map<string, Note[]>();
    for (const note of notes) {
      if (!note.date) continue;
      const key = `${note.employee_id}-${note.date}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(note);
    }
    return map;
  };

  // Load notes for the month via year/month backend filter
  const loadNotesForMonth = () => {
    api.getNotes({ year, month }).then(notes => {
      setNotesMap(buildNotesMap(notes));
    }).catch(() => setNotesMap(new Map()));
  };

  useEffect(() => {
    loadNotesForMonth();
  }, [year, month]);

  // Load cycle assignments when Auto-Plan modal opens
  useEffect(() => {
    if (showAutoPlan) {
      api.getCycleAssignments()
        .then(data => setAutoPlanAssignments(data))
        .catch(() => setAutoPlanAssignments([]));
    }
  }, [showAutoPlan]);

  // Execute Auto-Plan generation
  const handleAutoPlan = async () => {
    setAutoPlanLoading(true);
    try {
      const params: { year: number; month: number; employee_ids?: number[]; force?: boolean } = {
        year,
        month,
        force: autoPlanForce,
      };
      if (autoPlanEmployeeId !== 'all') {
        params.employee_ids = [autoPlanEmployeeId as number];
      }
      const result = await api.generateSchedule(params);
      showToast(result.message, result.errors.length > 0 ? 'info' : 'success');
      setShowAutoPlan(false);
      setAutoPlanForce(false);
      setAutoPlanEmployeeId('all');
      loadSchedule();
    } catch (e: unknown) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setAutoPlanLoading(false);
    }
  };

  // Load group members for selected groups
  useEffect(() => {
    if (selectedGroupIds.length === 0) return;
    const toLoad = selectedGroupIds.filter(gid => !groupMembersMap.has(gid));
    if (toLoad.length === 0) return;
    Promise.all(
      toLoad.map(gid =>
        api.getGroupMembers(gid).then(members => ({ gid, members }))
      )
    ).then(results => {
      setGroupMembersMap(prev => {
        const next = new Map(prev);
        for (const { gid, members } of results) {
          next.set(gid, new Set(members.map(m => m.ID)));
        }
        return next;
      });
    });
  }, [selectedGroupIds]);

  // ── Computed values ─────────────────────────────────────────

  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const pad = (n: number) => String(n).padStart(2, '0');

  // Entry lookup: "empId-day" → entry
  const entryMap = useMemo(() => {
    const m = new Map<string, ScheduleEntry>();
    for (const e of entries) {
      const day = parseInt(e.date.split('-')[2]);
      m.set(`${e.employee_id}-${day}`, e);
    }
    return m;
  }, [entries]);

  // Conflict lookup: "empId_dateStr" → ConflictEntry[]
  const conflictMap = useMemo(() => {
    const m = new Map<string, ConflictEntry[]>();
    for (const c of conflicts) {
      const key = `${c.employee_id}_${c.date}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return m;
  }, [conflicts]);

  // Display rows with optional group separators
  interface DisplayRow {
    type: 'employee' | 'group-header';
    employee?: Employee;
    groupId?: number;
    groupName?: string;
  }

  const displayRows: DisplayRow[] = useMemo(() => {
    const searchLower = employeeSearch.toLowerCase();
    const matchesSearch = (emp: Employee) =>
      !searchLower ||
      `${emp.NAME} ${emp.FIRSTNAME}`.toLowerCase().includes(searchLower) ||
      `${emp.FIRSTNAME} ${emp.NAME}`.toLowerCase().includes(searchLower);

    if (selectedGroupIds.length === 0) {
      // All employees (no group separator)
      return employees.filter(matchesSearch).map(e => ({ type: 'employee' as const, employee: e }));
    }

    // Multiple groups: show with separators
    const rows: DisplayRow[] = [];
    for (const gid of selectedGroupIds) {
      const group = groups.find(g => g.ID === gid);
      rows.push({ type: 'group-header', groupId: gid, groupName: group?.NAME ?? `Gruppe ${gid}` });
      const members = groupMembersMap.get(gid) ?? new Set<number>();
      const groupEmps = employees.filter(e => members.has(e.ID) && matchesSearch(e));
      for (const e of groupEmps) {
        rows.push({ type: 'employee', employee: e });
      }
    }
    return rows;
  }, [selectedGroupIds, employees, groups, groupMembersMap, employeeSearch]);

  // Employees only (for export and counters)
  const displayEmployees = useMemo(
    () => displayRows.filter(r => r.type === 'employee').map(r => r.employee!),
    [displayRows],
  );

  // Apply shift/leave filter: which employee rows to show
  const filteredDisplayRows = useMemo(() => {
    if (!filterShiftId && !filterLeaveId) return displayRows;
    return displayRows.filter(row => {
      if (row.type === 'group-header') return true; // always show group headers
      const emp = row.employee!;
      // Check if this employee has the selected shift or leave type in any day
      for (let d = 1; d <= daysInMonth; d++) {
        const entry = entryMap.get(`${emp.ID}-${d}`);
        if (!entry) continue;
        if (filterShiftId && entry.shift_id === filterShiftId) return true;
        if (filterLeaveId && entry.leave_type_id === filterLeaveId) return true;
      }
      return false;
    });
  }, [displayRows, filterShiftId, filterLeaveId, entryMap, daysInMonth]);

  // Entries for display employees only (used by Auslastungsbereich)
  const filteredEntries = useMemo(() => {
    const empIds = new Set(displayEmployees.map(e => e.ID));
    return entries.filter(e => empIds.has(e.employee_id));
  }, [entries, displayEmployees]);

  // Visible employees (respects shift/leave filter) — used for selection range
  const visibleEmployees = useMemo(
    () => filteredDisplayRows.filter(r => r.type === 'employee').map(r => r.employee!),
    [filteredDisplayRows],
  );

  // Map: employee ID → row index within visibleEmployees
  const empIndexMap = useMemo(() => {
    const m = new Map<number, number>();
    visibleEmployees.forEach((e, i) => m.set(e.ID, i));
    return m;
  }, [visibleEmployees]);

  // Check if a (empId, day) cell is within the current selection rectangle
  const isCellSelected = (empId: number, day: number): boolean => {
    if (!selection) return false;
    const { startEmpId, startDay, endEmpId, endDay } = selection;
    const si = empIndexMap.get(startEmpId) ?? -1;
    const ei = empIndexMap.get(endEmpId) ?? -1;
    const ti = empIndexMap.get(empId) ?? -1;
    if (ti === -1 || si === -1 || ei === -1) return false;
    const minEi = Math.min(si, ei); const maxEi = Math.max(si, ei);
    const minDay = Math.min(startDay, endDay); const maxDay = Math.max(startDay, endDay);
    return ti >= minEi && ti <= maxEi && day >= minDay && day <= maxDay;
  };

  // Return all (empId, day) cells in the current selection
  const getSelectedCells = (): Array<{ empId: number; day: number }> => {
    if (!selection) return [];
    const { startEmpId, startDay, endEmpId, endDay } = selection;
    const si = empIndexMap.get(startEmpId) ?? -1;
    const ei = empIndexMap.get(endEmpId) ?? -1;
    if (si === -1 || ei === -1) return [];
    const minEi = Math.min(si, ei); const maxEi = Math.max(si, ei);
    const minDay = Math.min(startDay, endDay); const maxDay = Math.max(startDay, endDay);
    const cells: Array<{ empId: number; day: number }> = [];
    for (let i = minEi; i <= maxEi; i++) {
      const emp = visibleEmployees[i];
      if (!emp) continue;
      for (let d = minDay; d <= maxDay; d++) cells.push({ empId: emp.ID, day: d });
    }
    return cells;
  };

  // Selection info for toolbar / context menu
  const selectionInfo = useMemo(() => {
    if (!selection) return { cells: 0, employees: 0, days: 0 };
    const { startEmpId, startDay, endEmpId, endDay } = selection;
    const si = empIndexMap.get(startEmpId) ?? -1;
    const ei = empIndexMap.get(endEmpId) ?? -1;
    const empCount = si >= 0 && ei >= 0 ? Math.abs(ei - si) + 1 : 0;
    const dayCount = Math.abs(endDay - startDay) + 1;
    return { cells: empCount * dayCount, employees: empCount, days: dayCount };
  }, [selection, empIndexMap]);

  // Count shifts per day (for summary row)
  const empCountPerDay = useMemo(() => {
    const m = new Map<number, number>();
    const empIds = new Set(displayEmployees.map(e => e.ID));
    for (const e of entries) {
      if (!empIds.has(e.employee_id)) continue;
      if (e.kind === 'shift' || e.kind === 'special_shift') {
        const day = parseInt(e.date.split('-')[2]);
        m.set(day, (m.get(day) || 0) + 1);
      }
    }
    return m;
  }, [entries, displayEmployees]);

  // ── Navigation ──────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // ── Handlers ────────────────────────────────────────────────
  const handleAddShift = async (empId: number, day: number, shiftId: number) => {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    // Client-side warning: check if employee already has an absence on this day
    const existingEntry = entryMap.get(`${empId}-${day}`);
    if (existingEntry?.kind === 'absence') {
      showToast(
        `⚠️ Achtung: Mitarbeiter hat an diesem Tag bereits eine Abwesenheit (${existingEntry.display_name || 'Urlaub/Abwesenheit'})! Schicht wird trotzdem eingetragen.`,
        'warning',
      );
    }
    setSaving(true);
    try {
      await api.createScheduleEntry(empId, dateStr, shiftId);
      loadSchedule();
    } catch (e) {
      showToast('Fehler beim Speichern: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  const handleAddAbsence = async (empId: number, day: number, leaveTypeId: number) => {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    setSaving(true);
    try {
      await api.createAbsence(empId, dateStr, leaveTypeId);
      loadSchedule();
    } catch (e) {
      showToast('Fehler beim Speichern: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  const handleDeleteEntry = async (empId: number, day: number, silent = false) => {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const before = entryMap.get(`${empId}-${day}`) ?? null;
    if (!silent && !confirm('Eintrag löschen?')) return;
    setSaving(true);
    try {
      await api.deleteScheduleEntry(empId, dateStr);
      pushUndo([{ empId, day, before }]);
      loadSchedule();
    } catch (e) {
      showToast('Fehler beim Löschen: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  const handleAddNote = async (empId: number, dateStr: string, text: string) => {
    try {
      await api.addNote(dateStr, text, empId);
      loadNotesForMonth();
    } catch (e) {
      alert('Fehler beim Speichern der Notiz: ' + (e as Error).message);
    }
  };

  const handleNoteEdited = async (noteId: number, newText: string) => {
    try {
      await api.updateNote(noteId, { text: newText });
      loadNotesForMonth();
    } catch (e) {
      alert('Fehler beim Speichern der Notiz: ' + (e as Error).message);
    }
  };

  const handleNoteDeleted = async (noteId: number) => {
    try {
      await api.deleteNote(noteId);
      loadNotesForMonth();
    } catch (e) {
      alert('Fehler beim Löschen der Notiz: ' + (e as Error).message);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, empId: number, day: number) => {
    e.preventDefault();
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    // If a selection exists and the right-clicked cell is inside it → bulk context menu
    if (selection && isCellSelected(empId, day)) {
      setBulkContextMenu({ x: e.clientX, y: e.clientY, empId, day });
      return;
    }
    setContextMenu({ x: e.clientX, y: e.clientY, empId, day, dateStr });
  };

  // ── Global keyboard handler (ref-based to avoid stale closures)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => kbHandlerRef.current(e);
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Global mouseup handler (ends drag) ─────────────────────
  useEffect(() => {
    const handler = () => {
      if (isDragging) setIsDragging(false);
      dragAnchorRef.current = null;
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [isDragging]);

  // ── Cell drag-select handlers ───────────────────────────────
  const handleCellMouseDown = (e: React.MouseEvent, empId: number, day: number) => {
    if (e.button !== 0) return;
    // Always update keyboard cursor
    setSelectedCell({ empId, day });
    if (e.shiftKey && selection) {
      e.preventDefault();
      setSelection(s => s ? { ...s, endEmpId: empId, endDay: day } : null);
      return;
    }
    setSelection(null);
    // Only set multi-select anchor for empty cells; cells with entries use HTML5 DnD
    const entry = entryMap.get(`${empId}-${day}`);
    if (!entry) {
      dragAnchorRef.current = { empId, day };
    } else {
      dragAnchorRef.current = null;
    }
  };

  const handleCellMouseEnter = (empId: number, day: number) => {
    const anchor = dragAnchorRef.current;
    if (!anchor) return;
    const moving = anchor.empId !== empId || anchor.day !== day;
    if (moving) {
      if (!isDragging) {
        setIsDragging(true);
        setActivePicker(null);
      }
      setSelection({
        startEmpId: anchor.empId, startDay: anchor.day,
        endEmpId: empId, endDay: day,
      });
    }
  };

  // ── Bulk operation handlers ─────────────────────────────────
  const handleBulkAssignShift = async (shiftId: number) => {
    const cells = getSelectedCells();
    if (cells.length === 0) return;
    const beforeCells = cells.map(({ empId, day }) => ({
      empId, day, before: entryMap.get(`${empId}-${day}`) ?? null,
    }));
    const apiEntries = cells.map(({ empId, day }) => ({
      employee_id: empId,
      date: `${year}-${pad(month)}-${pad(day)}`,
      shift_id: shiftId,
    }));
    setSaving(true);
    try {
      const result = await api.bulkSchedule(apiEntries);
      showToast(`${result.created} erstellt, ${result.updated} aktualisiert`, 'success');
      pushUndo(beforeCells);
      loadSchedule();
      setSelection(null);
    } catch (e) {
      showToast('Fehler beim Speichern: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  const handleBulkDelete = async () => {
    const cells = getSelectedCells();
    if (cells.length === 0) return;
    if (!confirm(`${cells.length} Einträge löschen?`)) return;
    const beforeCells = cells.map(({ empId, day }) => ({
      empId, day, before: entryMap.get(`${empId}-${day}`) ?? null,
    }));
    const apiEntries = cells.map(({ empId, day }) => ({
      employee_id: empId,
      date: `${year}-${pad(month)}-${pad(day)}`,
      shift_id: null as null,
    }));
    setSaving(true);
    try {
      const result = await api.bulkSchedule(apiEntries);
      showToast(`${result.deleted} gelöscht`, 'success');
      pushUndo(beforeCells);
      loadSchedule();
      setSelection(null);
    } catch (e) {
      showToast('Fehler beim Löschen: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  const handleBulkCopy = () => {
    if (!selection) return;
    const { startEmpId, startDay, endEmpId, endDay } = selection;
    const si = empIndexMap.get(startEmpId) ?? 0;
    const ei = empIndexMap.get(endEmpId) ?? 0;
    const anchorEmpIdx = Math.min(si, ei);
    const anchorDay = Math.min(startDay, endDay);
    const cells = getSelectedCells();
    const clipEntries = cells.map(({ empId, day }) => {
      const empIdx = empIndexMap.get(empId) ?? 0;
      const entry = entryMap.get(`${empId}-${day}`);
      return {
        relEmpIdx: empIdx - anchorEmpIdx,
        relDay: day - anchorDay,
        shiftId: entry?.shift_id ?? null,
      };
    });
    setClipboard({ entries: clipEntries, anchorEmpIdx, anchorDay });
    showToast(`${cells.length} Zellen kopiert`, 'success');
  };

  const handleBulkPaste = async (targetEmpId: number, targetDay: number) => {
    if (!clipboard) return;
    const targetEmpIdx = empIndexMap.get(targetEmpId) ?? 0;
    const entries = clipboard.entries
      .filter(e => e.shiftId !== null)
      .map(e => {
        const empIdx = targetEmpIdx + e.relEmpIdx;
        const day = targetDay + e.relDay;
        if (empIdx < 0 || empIdx >= visibleEmployees.length) return null;
        if (day < 1 || day > daysInMonth) return null;
        const emp = visibleEmployees[empIdx];
        return { employee_id: emp.ID, date: `${year}-${pad(month)}-${pad(day)}`, shift_id: e.shiftId! };
      })
      .filter(Boolean) as Array<{ employee_id: number; date: string; shift_id: number }>;
    if (entries.length === 0) return;
    setSaving(true);
    try {
      const result = await api.bulkSchedule(entries);
      showToast(`${result.created} erstellt, ${result.updated} aktualisiert`, 'success');
      loadSchedule();
    } catch (e) {
      showToast('Fehler beim Einfügen: ' + (e as Error).message, 'error');
    }
    setSaving(false);
    setBulkContextMenu(null);
  };

  // ── Undo/Redo helpers ───────────────────────────────────────
  const UNDO_LIMIT = 20;

  const pushUndo = (cells: Array<{ empId: number; day: number; before: ScheduleEntry | null }>) => {
    setUndoStack(s => {
      const next = [...s, { cells }];
      return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
    });
    setRedoStack([]); // clear redo on new action
  };

  const restoreCell = async (empId: number, day: number, target: ScheduleEntry | null) => {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    try {
      if (target === null) {
        await api.deleteScheduleEntry(empId, dateStr);
      } else if (target.kind === 'shift' || target.kind === 'special_shift') {
        if (target.shift_id) await api.createScheduleEntry(empId, dateStr, target.shift_id);
      } else if (target.kind === 'absence') {
        if (target.leave_type_id) await api.createAbsence(empId, dateStr, target.leave_type_id);
      }
    } catch { /* ignore errors during undo/redo */ }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const record = undoStack[undoStack.length - 1];
    // Snapshot current state as redo record (= the "after" of the original operation)
    const redoRecord = {
      cells: record.cells.map(c => ({
        empId: c.empId,
        day: c.day,
        before: entryMap.get(`${c.empId}-${c.day}`) ?? null,
      })),
    };
    setSaving(true);
    for (const c of record.cells) {
      await restoreCell(c.empId, c.day, c.before);
    }
    setSaving(false);
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s, redoRecord]);
    loadSchedule();
    showToast('↩ Rückgängig', 'info');
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const record = redoStack[redoStack.length - 1];
    // Snapshot current state as new undo record
    const newUndoRecord = {
      cells: record.cells.map(c => ({
        empId: c.empId,
        day: c.day,
        before: entryMap.get(`${c.empId}-${c.day}`) ?? null,
      })),
    };
    setSaving(true);
    for (const c of record.cells) {
      await restoreCell(c.empId, c.day, c.before);
    }
    setSaving(false);
    setRedoStack(s => s.slice(0, -1));
    setUndoStack(s => [...s, newUndoRecord]);
    loadSchedule();
    showToast('↪ Wiederholt', 'info');
  };

  // ── HTML5 Drag & Drop handlers ──────────────────────────────
  const handleDragStart = (e: React.DragEvent, empId: number, day: number) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', `${empId}-${day}`);
    setDndSource({ empId, day });
    // Prevent multi-select drag from interfering
    dragAnchorRef.current = null;
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent, empId: number, day: number) => {
    if (!dndSource) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
    setDndTarget({ empId, day });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear target when leaving the grid entirely (not between cells)
    if (!(e.relatedTarget instanceof Element) || !e.currentTarget.closest('table')?.contains(e.relatedTarget)) {
      setDndTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetEmpId: number, targetDay: number) => {
    e.preventDefault();
    if (!dndSource) return;
    const { empId: srcEmpId, day: srcDay } = dndSource;
    // Don't drop onto same cell
    if (srcEmpId === targetEmpId && srcDay === targetDay) {
      setDndSource(null);
      setDndTarget(null);
      return;
    }
    const srcEntry = entryMap.get(`${srcEmpId}-${srcDay}`);
    if (!srcEntry) { setDndSource(null); setDndTarget(null); return; }

    const isCopy = e.altKey;
    const beforeTarget = entryMap.get(`${targetEmpId}-${targetDay}`) ?? null;
    const srcDateStr = `${year}-${pad(month)}-${pad(srcDay)}`;
    const targetDateStr = `${year}-${pad(month)}-${pad(targetDay)}`;

    setSaving(true);
    try {
      // Write to target cell
      if (srcEntry.kind === 'shift' || srcEntry.kind === 'special_shift') {
        if (srcEntry.shift_id) await api.createScheduleEntry(targetEmpId, targetDateStr, srcEntry.shift_id);
      } else if (srcEntry.kind === 'absence') {
        if (srcEntry.leave_type_id) await api.createAbsence(targetEmpId, targetDateStr, srcEntry.leave_type_id);
      }
      // Move: delete source
      if (!isCopy) {
        await api.deleteScheduleEntry(srcEmpId, srcDateStr);
      }
      // Record undo: restore target to beforeTarget, and (if move) restore source to srcEntry
      const undoCells: Array<{ empId: number; day: number; before: ScheduleEntry | null }> = [
        { empId: targetEmpId, day: targetDay, before: beforeTarget },
      ];
      if (!isCopy) {
        undoCells.push({ empId: srcEmpId, day: srcDay, before: srcEntry });
      }
      pushUndo(undoCells);
      showToast(isCopy ? '📋 Schicht kopiert' : '✂️ Schicht verschoben', 'success');
      loadSchedule();
    } catch (err) {
      showToast('Fehler: ' + (err as Error).message, 'error');
    }
    setSaving(false);
    setDndSource(null);
    setDndTarget(null);
  };

  const handleDragEnd = () => {
    setDndSource(null);
    setDndTarget(null);
  };

  // ── Keyboard handler (ref pattern avoids stale closures) ────
  const kbHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  kbHandlerRef.current = (e: KeyboardEvent) => {
    // Ctrl+Z / Cmd+Z → Undo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }
    // Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z → Redo
    if (
      ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
    ) {
      e.preventDefault();
      handleRedo();
      return;
    }
    // Escape → clear all UI state
    if (e.key === 'Escape') {
      setSelection(null);
      setBulkContextMenu(null);
      setSelectedCell(null);
      setActivePicker(null);
      return;
    }
    // Keys below require a selected cell
    if (!selectedCell) return;
    const { empId, day } = selectedCell;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const entry = entryMap.get(`${empId}-${day}`);
      if (entry) {
        e.preventDefault();
        handleDeleteEntry(empId, day, true);
      }
      return;
    }

    if (e.key === 'Enter') {
      // Don't trigger if a picker is already open or focus is in an input
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
      e.preventDefault();
      setActivePicker(p => (p?.empId === empId && p?.day === day ? null : { empId, day }));
      return;
    }

    // Arrow key navigation
    const empIdx = empIndexMap.get(empId) ?? -1;
    if (empIdx === -1) return;

    let newEmpIdx = empIdx;
    let newDay = day;

    if (e.key === 'ArrowLeft') { e.preventDefault(); newDay = Math.max(1, day - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); newDay = Math.min(daysInMonth, day + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); newEmpIdx = Math.max(0, empIdx - 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); newEmpIdx = Math.min(visibleEmployees.length - 1, empIdx + 1); }
    else return;

    const newEmp = visibleEmployees[newEmpIdx];
    if (newEmp) {
      setSelectedCell({ empId: newEmp.ID, day: newDay });
      setSelection({
        startEmpId: newEmp.ID, startDay: newDay,
        endEmpId: newEmp.ID, endDay: newDay,
      });
    }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="p-4 h-full flex flex-col" onClick={() => { setContextMenu(null); setNotePopup(null); setBulkContextMenu(null); }}>
      {/* Print styles – injected into <head> at runtime */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 8mm; }
          body { font-size: 9px !important; background: white !important; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { border-collapse: collapse; font-size: 9px; }
          th, td { padding: 1px 2px !important; }
          tr { break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>
      {/* Context menu */}
      {contextMenu && (
        <NoteContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onAddNote={handleAddNote}
        />
      )}
      {/* Auto-Plan Modal */}
      {showAutoPlan && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowAutoPlan(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-1">🔄 Auto-Plan</h2>
            <p className="text-sm text-gray-600 mb-4">
              Dienstplan aus Schichtmodellen befüllen für{' '}
              <span className="font-semibold">{MONTH_NAMES[month]} {year}</span>
            </p>

            {/* Mitarbeiter-Auswahl */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter</label>
              <select
                value={autoPlanEmployeeId}
                onChange={e => setAutoPlanEmployeeId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle MAs mit Schichtmodell ({autoPlanAssignments.length})</option>
                {autoPlanAssignments.map(a => {
                  const emp = employees.find(e => e.ID === a.employee_id);
                  const label = emp
                    ? `${emp.NAME}${emp.FIRSTNAME ? ', ' + emp.FIRSTNAME : ''}`
                    : `MA ${a.employee_id}`;
                  return (
                    <option key={a.employee_id} value={a.employee_id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Force-Checkbox */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPlanForce}
                  onChange={e => setAutoPlanForce(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Bestehende Einträge überschreiben (force)</span>
              </label>
              {autoPlanForce && (
                <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  ⚠️ Bereits eingetragene Schichten, Urlaube und Abwesenheiten werden gelöscht!
                </p>
              )}
              {!autoPlanForce && (
                <p className="mt-1 text-xs text-gray-500">
                  Tage mit bestehenden Einträgen werden übersprungen.
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowAutoPlan(false); setAutoPlanForce(false); setAutoPlanEmployeeId('all'); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                disabled={autoPlanLoading}
              >
                Abbrechen
              </button>
              <button
                onClick={handleAutoPlan}
                disabled={autoPlanLoading}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {autoPlanLoading ? (
                  <><span className="animate-spin">⏳</span> Befülle...</>
                ) : (
                  <>🔄 Befüllen</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {notePopup && (
        <NoteDetailPopup
          state={notePopup}
          onClose={() => setNotePopup(null)}
          onDeleted={handleNoteDeleted}
          onEdited={handleNoteEdited}
          onAdd={handleAddNote}
        />
      )}
      {bulkContextMenu && selection && (
        <BulkContextMenu
          x={bulkContextMenu.x}
          y={bulkContextMenu.y}
          selectionInfo={selectionInfo}
          shifts={shifts}
          hasClipboard={clipboard !== null}
          onClose={() => setBulkContextMenu(null)}
          onAssignShift={handleBulkAssignShift}
          onDelete={handleBulkDelete}
          onCopy={handleBulkCopy}
          onPaste={() => handleBulkPaste(bulkContextMenu.empId, bulkContextMenu.day)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">📅 Dienstplan</h1>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">‹</button>
          <span className="font-semibold text-gray-700 min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="px-2 py-1 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">›</button>
        </div>

        {/* Multi-group selector */}
        <GroupMultiSelect
          groups={groups}
          selectedIds={selectedGroupIds}
          onChange={setSelectedGroupIds}
        />

        <EmployeeCountBadge
          visible={filteredDisplayRows.filter(r => r.type === 'employee').length}
          total={employees.length}
        />

        {/* Undo/Redo buttons */}
        <div className="no-print flex items-center gap-1 ml-auto">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="px-2.5 py-1.5 bg-white border rounded shadow-sm text-sm flex items-center gap-1 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Rückgängig (Ctrl+Z) — ${undoStack.length} Einträge`}
          >
            ↩ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="px-2.5 py-1.5 bg-white border rounded shadow-sm text-sm flex items-center gap-1 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Wiederholen (Ctrl+Y) — ${redoStack.length} Einträge`}
          >
            ↪ Redo
          </button>
        </div>

        {/* Auto-Plan button */}
        <button
          onClick={() => setShowAutoPlan(true)}
          className="no-print px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded shadow-sm flex items-center gap-1.5"
          title="Dienstplan aus Schichtmodellen befüllen"
        >
          🔄 Auto-Plan
        </button>

        {/* Print button */}
        <button
          onClick={() => {
            const groupLabel =
              selectedGroupIds.length === 0
                ? 'Alle Gruppen'
                : selectedGroupIds
                    .map(id => groups.find(g => g.ID === id)?.NAME ?? `Gruppe ${id}`)
                    .join(', ');
            const html = buildScheduleHTML(
              displayEmployees, days, entryMap, holidays,
              year, month, MONTH_NAMES[month], groupLabel,
            );
            openPrintWindow(html);
          }}
          className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1.5"
          title="Dienstplan drucken"
        >
          🖨️ Drucken
        </button>

        {/* Export dropdown */}
        <div className="relative no-print" ref={exportRef}>
          <button
            onClick={() => setShowExportMenu(m => !m)}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded shadow-sm flex items-center gap-1.5"
          >
            ⬇ Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[160px] py-1">
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                onClick={() => {
                  exportCSV(displayEmployees, days, entryMap, year, month);
                  setShowExportMenu(false);
                }}
              >
                📄 CSV exportieren
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                onClick={() => {
                  exportHTML(displayEmployees, days, entryMap, holidays, year, month, MONTH_NAMES[month]);
                  setShowExportMenu(false);
                }}
              >
                🖨 HTML / Drucken
              </button>
            </div>
          )}
        </div>

        {(loading || saving) && (
          <span className="text-sm text-blue-500 animate-pulse">
            {saving ? 'Speichere...' : 'Lade...'}
          </span>
        )}
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="flex items-center gap-3 mb-3 flex-wrap bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 flex-shrink-0">🔍 Filter:</span>

        {/* Shift filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">Schicht:</label>
          <ShiftFilterDropdown
            shifts={shifts}
            value={filterShiftId}
            onChange={setFilterShiftId}
          />
        </div>

        {/* Leave filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">Abwesenheit:</label>
          <select
            value={filterLeaveId}
            onChange={e => setFilterLeaveId(e.target.value ? Number(e.target.value) : '')}
            className="text-xs px-2 py-1 border rounded bg-white"
          >
            <option value="">Alle</option>
            {leaveTypes.map(lt => (
              <option key={lt.ID} value={lt.ID}>{lt.SHORTNAME} – {lt.NAME}</option>
            ))}
          </select>
        </div>

        {/* Employee search */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">Mitarbeiter:</label>
          <input
            type="text"
            value={employeeSearch}
            onChange={e => setEmployeeSearch(e.target.value)}
            placeholder="Name suchen..."
            className="text-xs px-2 py-1 border rounded bg-white w-36"
          />
        </div>

        {/* Reset filters */}
        {(filterShiftId !== '' || filterLeaveId !== '' || employeeSearch !== '') && (
          <button
            className="text-xs px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
            onClick={() => { setFilterShiftId(''); setFilterLeaveId(''); setEmployeeSearch(''); }}
          >
            × Filter zurücksetzen
          </button>
        )}
      </div>

      {/* ── Conflict Banner ── */}
      {conflicts.length > 0 && (
        <div className="mb-3 flex items-center gap-3 px-4 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          <span className="text-base">⚠️</span>
          <span className="font-semibold">{conflicts.length} Konflikt{conflicts.length !== 1 ? 'e' : ''} gefunden</span>
          <button
            className="underline hover:text-amber-900 text-sm"
            onClick={e => { e.stopPropagation(); setShowConflictModal(true); }}
          >
            Details anzeigen
          </button>
        </div>
      )}

      {/* ── Conflict Modal ── */}
      {showConflictModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
          onClick={() => setShowConflictModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 p-5 max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-800 text-base">⚠️ Dienstplan-Konflikte</h2>
              <button
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                onClick={() => setShowConflictModal(false)}
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {conflicts.map((c, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded-lg text-sm border ${
                    c.type === 'shift_and_absence'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : c.type === 'holiday_ban'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-orange-50 border-orange-200 text-orange-800'
                  }`}
                >
                  <span className="mr-2">
                    {c.type === 'shift_and_absence' ? '🔴' : c.type === 'holiday_ban' ? '🟡' : '🟠'}
                  </span>
                  {c.message}
                  <span className="ml-2 text-xs opacity-60">
                    [{c.type === 'shift_and_absence' ? 'Schicht+Abwesenheit' : c.type === 'holiday_ban' ? 'Urlaubssperre' : 'Unterbesetzung'}]
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right">
              <button
                className="px-4 py-1.5 bg-gray-100 rounded hover:bg-gray-200 text-sm"
                onClick={() => setShowConflictModal(false)}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Action Toolbar ── */}
      {selection && (
        <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg shadow-sm text-xs flex-wrap no-print">
          <span className="text-blue-700 font-semibold flex-shrink-0">
            ✅ {selectionInfo.cells} Zellen ausgewählt ({selectionInfo.employees} MA × {selectionInfo.days} Tage)
          </span>
          {/* Shift assign */}
          <div className="flex items-center gap-1.5">
            <label className="text-blue-600 whitespace-nowrap">Schicht zuweisen:</label>
            <select
              value={bulkShiftId}
              onChange={e => setBulkShiftId(e.target.value ? Number(e.target.value) : '')}
              className="text-xs px-2 py-1 border border-blue-300 rounded bg-white"
            >
              <option value="">– Schicht wählen –</option>
              {shifts.map(s => (
                <option key={s.ID} value={s.ID}>{s.SHORTNAME} – {s.NAME}</option>
              ))}
            </select>
            <button
              disabled={!bulkShiftId}
              onClick={() => { if (bulkShiftId !== '') handleBulkAssignShift(Number(bulkShiftId)); setBulkShiftId(''); }}
              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anwenden
            </button>
          </div>
          <button
            onClick={handleBulkDelete}
            className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
          >
            🗑️ Löschen
          </button>
          <button
            onClick={handleBulkCopy}
            className="px-2 py-1 bg-white border border-blue-200 text-blue-700 rounded hover:bg-blue-50 flex items-center gap-1"
          >
            📄 Kopieren
          </button>
          {clipboard && (
            <span className="text-[10px] text-blue-500">📌 Clipboard bereit (Rechtsklick → Einfügen)</span>
          )}
          <button
            onClick={() => { setSelection(null); setBulkShiftId(''); }}
            className="ml-auto px-2 py-1 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
          >
            ✕ Auswahl aufheben
          </button>
        </div>
      )}

      {/* ── Schedule Grid ── */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="border-collapse text-xs" style={isDragging ? { userSelect: 'none' } : undefined}>
          <thead>
            <tr className="bg-slate-700 text-white">
              <th className="sticky left-0 z-20 bg-slate-700 px-3 py-2 text-left min-w-[160px] border-r border-slate-600">
                Mitarbeiter
              </th>
              {days.map(day => {
                const wd = getWeekday(year, month, day);
                const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                const isHol = holidays.has(dateStr);
                const isWe = wd === 0 || wd === 6;
                return (
                  <th
                    key={day}
                    className={`px-0.5 py-1 text-center min-w-[34px] border-r border-slate-600 ${
                      isHol ? 'bg-red-700' : isWe ? 'bg-slate-600' : ''
                    }`}
                  >
                    <div className="font-bold">{day}</div>
                    <div className="text-slate-300 text-[10px]">{WEEKDAY_ABBR[wd]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* ── Tagesnotizen row ── */}
            <tr className="bg-indigo-50 border-b border-indigo-200">
              <td className="sticky left-0 z-10 bg-indigo-50 px-3 py-1 border-r border-indigo-200 font-semibold text-[11px] text-indigo-700 whitespace-nowrap">
                📝 Tagesnotizen
              </td>
              {days.map(day => {
                const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                const dayNotes = notesMap.get(`0-${dateStr}`) ?? [];
                const hasDayNote = dayNotes.length > 0;
                const dayNoteTitle = hasDayNote
                  ? dayNotes.map(n => [n.text1, n.text2].filter(Boolean).join(' ')).join('\n')
                  : '';
                const wd = getWeekday(year, month, day);
                const isWe = wd === 0 || wd === 6;
                return (
                  <td
                    key={day}
                    className={`border border-indigo-100 text-center py-1 relative ${isWe ? 'bg-indigo-100' : ''}`}
                    onContextMenu={e => handleContextMenu(e, 0, day)}
                  >
                    {hasDayNote ? (
                      <button
                        className="text-[11px] hover:scale-125 transition-transform cursor-pointer"
                        title={dayNoteTitle}
                        onClick={e => {
                          e.stopPropagation();
                          setNotePopup({ x: e.clientX, y: e.clientY, empId: 0, dateStr, notes: dayNotes });
                        }}
                      >
                        📝
                      </button>
                    ) : (
                      <span className="text-gray-200 text-[10px] cursor-default select-none">·</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {filteredDisplayRows.map((row, idx) => {
              // Group header row
              if (row.type === 'group-header') {
                return (
                  <tr key={`grp-${row.groupId}`} className="bg-blue-50">
                    <td
                      colSpan={daysInMonth + 1}
                      className="sticky left-0 px-3 py-1 text-xs font-bold text-blue-700 border-b border-blue-200 bg-blue-50"
                    >
                      👥 {row.groupName}
                    </td>
                  </tr>
                );
              }

              // Employee row
              const emp = row.employee!;
              const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
              const empRowStyle = (emp.CBKSCHED != null && emp.CBKSCHED !== 16777215 && emp.CBKSCHED !== 0 && emp.CBKSCHED_HEX)
                ? { backgroundColor: emp.CBKSCHED_HEX }
                : undefined;
              const empNameStyle = (emp.CBKLABEL != null && emp.CBKLABEL !== 16777215 && emp.CBKLABEL !== 0 && emp.CBKLABEL_HEX)
                ? { backgroundColor: emp.CBKLABEL_HEX, color: emp.CFGLABEL_HEX || '#000' }
                : undefined;
              return (
                <tr key={emp.ID} className={empRowStyle ? undefined : rowBg} style={empRowStyle}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-1 border-r border-gray-200 border-b border-b-gray-100 font-medium whitespace-nowrap"
                      style={empNameStyle}>
                    {emp.BOLD === 1 ? <strong>{emp.NAME}, {emp.FIRSTNAME}</strong> : <>{emp.NAME}, {emp.FIRSTNAME}</>}
                  </td>
                  {days.map(day => {
                    const entry = entryMap.get(`${emp.ID}-${day}`);
                    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                    const isHol = holidays.has(dateStr);
                    const wd = getWeekday(year, month, day);
                    const isWe = wd === 0 || wd === 6;
                    const isPickerOpen = activePicker?.empId === emp.ID && activePicker?.day === day;
                    const noteKey = `${emp.ID}-${dateStr}`;
                    const cellNotes = notesMap.get(noteKey) ?? [];
                    const hasNote = cellNotes.length > 0;
                    const noteTitle = hasNote
                      ? cellNotes.map(n => [n.text1, n.text2].filter(Boolean).join(' ')).join('\n')
                      : '';

                    // Conflict detection for this cell
                    const cellConflicts = conflictMap.get(`${emp.ID}_${dateStr}`) ?? [];
                    const hasConflict = cellConflicts.length > 0;
                    const conflictTitle = hasConflict
                      ? cellConflicts.map(c => c.message).join('\n')
                      : '';

                    // Highlight if entry matches active filter
                    const isFilterMatch =
                      (filterShiftId !== '' && entry?.shift_id === filterShiftId) ||
                      (filterLeaveId !== '' && entry?.leave_type_id === filterLeaveId);

                    const isSelected = isCellSelected(emp.ID, day);
                    const isCursor = selectedCell?.empId === emp.ID && selectedCell?.day === day;
                    const isDndSrc = dndSource?.empId === emp.ID && dndSource?.day === day;
                    const isDndTgt = dndTarget?.empId === emp.ID && dndTarget?.day === day;
                    return (
                      <td
                        key={day}
                        className={`border border-gray-100 p-0 text-center relative group`}
                        draggable={!!entry}
                        style={{
                          backgroundColor: isDndTgt
                            ? '#bfdbfe'
                            : isSelected
                            ? '#dbeafe'
                            : (entry?.color_bk || (isHol ? '#fef2f2' : isWe ? '#f8fafc' : undefined)),
                          outline: isDndTgt
                            ? '2px solid #1d4ed8'
                            : isDndSrc
                            ? '2px dashed #6b7280'
                            : isCursor
                            ? '2px solid #f59e0b'
                            : isSelected
                            ? '2px solid #2563eb'
                            : (hasConflict ? '2px solid #ef4444' : isFilterMatch ? '2px solid #3b82f6' : undefined),
                          outlineOffset: '-2px',
                          opacity: isDndSrc ? 0.5 : 1,
                          cursor: entry ? 'grab' : 'default',
                        }}
                        onMouseDown={e => handleCellMouseDown(e, emp.ID, day)}
                        onMouseEnter={e => {
                          handleCellMouseEnter(emp.ID, day);
                          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                          hoverTimerRef.current = setTimeout(() => {
                            setHoverTooltip({ empId: emp.ID, day, x: e.clientX, y: e.clientY });
                          }, 500);
                        }}
                        onMouseLeave={() => {
                          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                          setHoverTooltip(null);
                        }}
                        onMouseMove={e => {
                          if (hoverTooltip?.empId === emp.ID && hoverTooltip?.day === day) {
                            setHoverTooltip((prev: HoverTooltipState | null) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                          }
                        }}
                        onDragStart={e => handleDragStart(e, emp.ID, day)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => handleDragOver(e, emp.ID, day)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, emp.ID, day)}
                        onContextMenu={e => handleContextMenu(e, emp.ID, day)}
                      >
                        {entry ? (
                          <div className="relative">
                            <span
                              className="block px-0.5 py-0.5 font-bold text-[11px]"
                              style={{ color: entry.color_text }}
                            >
                              {entry.display_name || '?'}
                            </span>
                            {/* Conflict warning icon */}
                            {hasConflict && (
                              <span
                                className="absolute top-0 left-0 text-[8px] leading-none z-10 cursor-help"
                                title={conflictTitle}
                              >
                                ⚠️
                              </span>
                            )}
                            {/* Note icon */}
                            {hasNote && (
                              <button
                                className="absolute top-0 right-0 text-[8px] leading-none z-10 hover:scale-125 transition-transform"
                                title={noteTitle}
                                onClick={e => {
                                  e.stopPropagation();
                                  setNotePopup({ x: e.clientX, y: e.clientY, empId: emp.ID, dateStr, notes: cellNotes });
                                }}
                              >
                                💬
                              </button>
                            )}
                            {/* Delete button on hover */}
                            <button
                              onClick={() => handleDeleteEntry(emp.ID, day)}
                              onMouseDown={e => e.stopPropagation()}
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] leading-none items-center justify-center hidden group-hover:flex z-10"
                              title="Eintrag löschen"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="relative h-6">
                            {/* Conflict icon for empty cells */}
                            {hasConflict && (
                              <span
                                className="absolute top-0 left-0 text-[8px] leading-none z-10 cursor-help"
                                title={conflictTitle}
                              >
                                ⚠️
                              </span>
                            )}
                            {/* Note icon for empty cells too */}
                            {hasNote && (
                              <button
                                className="absolute top-0 right-0 text-[8px] leading-none z-10 hover:scale-125 transition-transform"
                                title={noteTitle}
                                onClick={e => {
                                  e.stopPropagation();
                                  setNotePopup({ x: e.clientX, y: e.clientY, empId: emp.ID, dateStr, notes: cellNotes });
                                }}
                              >
                                💬
                              </button>
                            )}
                            <button
                              onClick={() => setActivePicker(p =>
                                p?.empId === emp.ID && p?.day === day ? null : { empId: emp.ID, day }
                              )}
                              onMouseDown={e => e.stopPropagation()}
                              className="absolute inset-0 w-full h-full flex items-center justify-center text-gray-300 hover:text-blue-400 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                              title="Schicht hinzufügen"
                            >
                              <span className="text-[10px] font-bold">+</span>
                            </button>
                          </div>
                        )}

                        {/* Shift picker popup */}
                        {isPickerOpen && (
                          <ShiftPicker
                            shifts={shifts}
                            leaveTypes={leaveTypes}
                            onSelect={shiftId => { handleAddShift(emp.ID, day, shiftId); setActivePicker(null); }}
                            onAbsence={leaveTypeId => { handleAddAbsence(emp.ID, day, leaveTypeId); setActivePicker(null); }}
                            onClose={() => setActivePicker(null)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {filteredDisplayRows.filter(r => r.type === 'employee').length === 0 && (
              <tr>
                <td colSpan={daysInMonth + 1} className="text-center py-8 text-gray-400">
                  {loading ? 'Lade Dienstplan...' : 'Keine Mitarbeiter gefunden'}
                </td>
              </tr>
            )}

            {/* Summary row */}
            {displayEmployees.length > 0 && (
              <tr className="bg-slate-50 border-t-2 border-slate-300">
                <td className="sticky left-0 z-10 bg-slate-100 px-3 py-1 border-r border-gray-300 font-semibold text-xs text-slate-600 whitespace-nowrap">
                  ∑ Einsätze
                </td>
                {days.map(day => {
                  const count = empCountPerDay.get(day) || 0;
                  const total = displayEmployees.length;
                  const pct = total > 0 ? count / total : 0;
                  const wd = getWeekday(year, month, day);
                  const isWe = wd === 0 || wd === 6;
                  return (
                    <td
                      key={day}
                      className={`border border-gray-200 text-center py-1 ${isWe ? 'bg-slate-100' : ''}`}
                      title={`${count} von ${total} MA eingeteilt`}
                    >
                      {count > 0 ? (
                        <div>
                          <div className={`text-[10px] font-bold ${pct >= 0.8 ? 'text-green-600' : pct >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
                            {count}
                          </div>
                          <div
                            className="mx-auto rounded-full mt-0.5"
                            style={{
                              width: '20px',
                              height: '3px',
                              backgroundColor: pct >= 0.8 ? '#16a34a' : pct >= 0.5 ? '#d97706' : '#dc2626',
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-gray-200 text-[10px]">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Auslastungsbereich ── */}
      <AuslastungsBereich
        shifts={shifts}
        days={days}
        year={year}
        month={month}
        entries={filteredEntries}
        staffingReqs={staffingReqs}
        selectedGroupIds={selectedGroupIds}
      />

      {/* ── Legend ── */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Legende:</span>
        <span className="text-xs px-2 py-0.5 bg-slate-200 rounded">Wochenende</span>
        <span className="text-xs px-2 py-0.5 bg-red-100 rounded">Feiertag</span>
        <span className="text-xs px-2 py-0.5 text-green-600 bg-green-50 rounded">■ ≥80% eingeteilt</span>
        <span className="text-xs px-2 py-0.5 text-amber-600 bg-amber-50 rounded">■ 50–79%</span>
        <span className="text-xs px-2 py-0.5 text-red-600 bg-red-50 rounded">■ &lt;50%</span>
        <span className="text-xs text-gray-400 ml-2">
          Hover → Tooltip · Drag & Drop (Alt=Kopieren) · Klick+Pfeiltasten → Navigation · Del → Löschen · Enter → Schicht · Ctrl+Z/Y → Undo/Redo · Shift+Klick → Mehrfachauswahl
        </span>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Hover Tooltip ── */}
      {hoverTooltip && (
        <HoverTooltip
          state={hoverTooltip}
          emp={employees.find(e => e.ID === hoverTooltip.empId) ?? null}
          entry={entryMap.get(`${hoverTooltip.empId}-${hoverTooltip.day}`) ?? null}
          dateStr={`${year}-${pad(month)}-${pad(hoverTooltip.day)}`}
          cellConflicts={conflictMap.get(`${hoverTooltip.empId}_${year}-${pad(month)}-${pad(hoverTooltip.day)}`) ?? []}
        />
      )}
    </div>
  );
}
