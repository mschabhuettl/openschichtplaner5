import { useState, useEffect, useRef, useMemo, memo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../api/client';
import type { ShiftRequirement, Note, ConflictEntry, CoverageDay } from '../api/client';
import type { Employee, Group, ScheduleEntry, ShiftType, LeaveType } from '../types';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';

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
  shifts: ShiftType[] = [],
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
    // Use employee's label color (CBKLABEL) if not white/default
    const empLabelBg = (emp.CBKLABEL != null && emp.CBKLABEL !== 16777215 && emp.CBKLABEL !== 0 && emp.CBKLABEL_HEX)
      ? emp.CBKLABEL_HEX : rowBg;
    const empLabelColor = emp.CFGLABEL_HEX || '#000';
    const empBold = emp.BOLD ? 'font-weight:700;' : '';
    let cells = `<td style="${tdNameStyle}background:${empLabelBg};color:${empLabelColor};${empBold}">${emp.NAME}, ${emp.FIRSTNAME}</td>`;
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
${shifts.length > 0 ? `<div class="no-print" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:5px;align-items:center"><strong style="font-size:11px">Legende:</strong>${shifts.filter(s => !s.HIDE).map(s => `<span style="background:${s.COLORBK_HEX || '#fff'};color:${s.COLORTEXT_HEX || '#000'};padding:2px 7px;border:1px solid #ccc;border-radius:3px;font-size:10px;font-weight:bold" title="${s.NAME}">${s.SHORTNAME}</span>`).join('')}</div>` : ''}
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
  shifts: ShiftType[] = [],
) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const html = buildScheduleHTML(employees, days, entryMap, holidays, year, month, monthName, 'Alle Gruppen', shifts);
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
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 p-2 min-w-[160px] text-xs dark:text-gray-200"
      style={{ top: '100%', left: 0 }}
    >
      <div className="font-semibold text-gray-600 mb-1 px-1">Schicht wählen</div>
      {shifts.map(s => (
        <button
          key={s.ID}
          onClick={() => { onSelect(s.ID); onClose(); }}
          className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
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
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
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
        <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl min-w-[190px] py-1">
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
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
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
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

// ── Full cell context menu (replaces old NoteContextMenu) ─────
type CellMenuMode = 'menu' | 'shift-select' | 'absence-select' | 'sonderdienst' | 'deviation' | 'note';

interface CellContextMenuProps {
  state: ContextMenuState;
  entry: ScheduleEntry | null;
  shifts: ShiftType[];
  leaveTypes: LeaveType[];
  hasClipboard: boolean;
  onClose: () => void;
  onAddNote: (empId: number, dateStr: string, text: string) => Promise<void>;
  onAssignShift: (empId: number, day: number, shiftId: number) => void;
  onAddAbsence: (empId: number, day: number, leaveTypeId: number) => void;
  onAddSonderdienst: (empId: number, dateStr: string, shiftId: number | null, startTime: string, endTime: string) => Promise<void>;
  onAddDeviation: (empId: number, dateStr: string, startTime: string, endTime: string) => Promise<void>;
  onDelete: (empId: number, day: number) => void;
  onCopy: (empId: number, day: number) => void;
  onPaste: (empId: number, day: number) => void;
}

function CellContextMenu({
  state, entry, shifts, leaveTypes, hasClipboard,
  onClose, onAddNote, onAssignShift, onAddAbsence,
  onAddSonderdienst, onAddDeviation, onDelete, onCopy, onPaste,
}: CellContextMenuProps) {
  const [mode, setMode] = useState<CellMenuMode>('menu');
  const [noteText, setNoteText] = useState('');
  const [sonderdienst, setSonderdienst] = useState({ shiftId: '' as number | '', startTime: '08:00', endTime: '16:00' });
  const [deviation, setDeviation] = useState({ startTime: '08:00', endTime: '16:00' });
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    await onAddNote(state.empId, state.dateStr, noteText.trim());
    setSaving(false);
    onClose();
  };

  const handleSaveSonderdienst = async () => {
    setSaving(true);
    await onAddSonderdienst(
      state.empId, state.dateStr,
      sonderdienst.shiftId !== '' ? sonderdienst.shiftId : null,
      sonderdienst.startTime, sonderdienst.endTime,
    );
    setSaving(false);
    onClose();
  };

  const handleSaveDeviation = async () => {
    setSaving(true);
    await onAddDeviation(state.empId, state.dateStr, deviation.startTime, deviation.endTime);
    setSaving(false);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 text-xs dark:text-gray-200"
      style={{ left: state.x, top: state.y, minWidth: 215 }}
    >
      {mode === 'menu' && (
        <div className="py-1">
          <div className="px-3 py-1 text-gray-400 text-[10px] font-medium border-b mb-1">
            {state.dateStr}
          </div>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => setMode('shift-select')}
          >
            📋 Schicht zuweisen...
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => setMode('absence-select')}
          >
            🏖️ Abwesenheit eintragen...
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => setMode('sonderdienst')}
          >
            ⚡ Sonderdienst...
          </button>
          {entry?.kind === 'shift' && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={() => setMode('deviation')}
            >
              ⏱️ Arbeitszeitabweichung...
            </button>
          )}
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => setMode('note')}
          >
            💬 Notiz hinzufügen
          </button>
          {entry && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
              onClick={() => { onDelete(state.empId, state.day); onClose(); }}
            >
              🗑️ Löschen
            </button>
          )}
          <div className="border-t my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => { onCopy(state.empId, state.day); onClose(); }}
          >
            📄 Kopieren
          </button>
          {hasClipboard && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={() => { onPaste(state.empId, state.day); onClose(); }}
            >
              📌 Einfügen
            </button>
          )}
        </div>
      )}

      {mode === 'shift-select' && (
        <div className="py-1">
          <div className="px-3 py-1 text-gray-400 text-[10px] font-medium border-b mb-1">Schicht wählen</div>
          <div className="overflow-y-auto max-h-60">
            {shifts.filter(s => !s.HIDE).map(s => (
              <button
                key={s.ID}
                onClick={() => { onAssignShift(state.empId, state.day, s.ID); onClose(); }}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
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
          </div>
          <div className="border-t my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 flex items-center gap-1"
            onClick={() => setMode('menu')}
          >
            ← Zurück
          </button>
        </div>
      )}

      {mode === 'absence-select' && (
        <div className="py-1">
          <div className="px-3 py-1 text-gray-400 text-[10px] font-medium border-b mb-1">Abwesenheitsart wählen</div>
          <div className="overflow-y-auto max-h-60">
            {leaveTypes.filter(lt => !lt.HIDE).map(lt => (
              <button
                key={lt.ID}
                onClick={() => { onAddAbsence(state.empId, state.day, lt.ID); onClose(); }}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <span
                  className="inline-block w-4 h-4 rounded text-center text-[9px] font-bold leading-4 flex-shrink-0"
                  style={{ backgroundColor: lt.COLORBK_HEX, color: '#333' }}
                >
                  {lt.SHORTNAME?.[0] || '?'}
                </span>
                <span>{lt.SHORTNAME} – {lt.NAME}</span>
              </button>
            ))}
          </div>
          <div className="border-t my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 flex items-center gap-1"
            onClick={() => setMode('menu')}
          >
            ← Zurück
          </button>
        </div>
      )}

      {mode === 'sonderdienst' && (
        <div className="p-2" style={{ minWidth: 225 }}>
          <div className="text-gray-500 mb-2 font-medium text-[11px] border-b pb-1">⚡ Sonderdienst</div>
          <div className="mb-2">
            <label className="text-gray-400 text-[10px] block mb-0.5">Schichtart (optional)</label>
            <select
              className="w-full border rounded p-1 text-xs focus:outline-blue-400"
              value={sonderdienst.shiftId}
              onChange={e => setSonderdienst(d => ({ ...d, shiftId: e.target.value ? Number(e.target.value) : '' }))}
            >
              <option value="">– keine –</option>
              {shifts.filter(s => !s.HIDE).map(s => (
                <option key={s.ID} value={s.ID}>{s.SHORTNAME} – {s.NAME}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-gray-400 text-[10px] block mb-0.5">Von</label>
              <input
                type="time"
                className="w-full border rounded p-1 text-xs focus:outline-blue-400"
                value={sonderdienst.startTime}
                onChange={e => setSonderdienst(d => ({ ...d, startTime: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-[10px] block mb-0.5">Bis</label>
              <input
                type="time"
                className="w-full border rounded p-1 text-xs focus:outline-blue-400"
                value={sonderdienst.endTime}
                onChange={e => setSonderdienst(d => ({ ...d, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-1">
            <button
              className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSaveSonderdienst}
              disabled={saving}
            >
              {saving ? '…' : 'Speichern'}
            </button>
            <button
              className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
              onClick={() => setMode('menu')}
            >
              ←
            </button>
          </div>
        </div>
      )}

      {mode === 'deviation' && (
        <div className="p-2" style={{ minWidth: 225 }}>
          <div className="text-gray-500 mb-2 font-medium text-[11px] border-b pb-1">⏱️ Arbeitszeitabweichung</div>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-gray-400 text-[10px] block mb-0.5">Von</label>
              <input
                type="time"
                className="w-full border rounded p-1 text-xs focus:outline-blue-400"
                value={deviation.startTime}
                onChange={e => setDeviation(d => ({ ...d, startTime: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-[10px] block mb-0.5">Bis</label>
              <input
                type="time"
                className="w-full border rounded p-1 text-xs focus:outline-blue-400"
                value={deviation.endTime}
                onChange={e => setDeviation(d => ({ ...d, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-1">
            <button
              className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSaveDeviation}
              disabled={saving}
            >
              {saving ? '…' : 'Speichern'}
            </button>
            <button
              className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
              onClick={() => setMode('menu')}
            >
              ←
            </button>
          </div>
        </div>
      )}

      {mode === 'note' && (
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
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveNote(); }
              if (e.key === 'Escape') onClose();
            }}
          />
          <div className="flex gap-1 mt-1">
            <button
              className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSaveNote}
              disabled={saving || !noteText.trim()}
            >
              {saving ? '…' : 'Speichern'}
            </button>
            <button
              className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
              onClick={() => setMode('menu')}
            >
              ←
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
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
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
    if (!await confirmDialog({ message: 'Notiz löschen?', danger: true })) return;
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
      className="fixed z-[110] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 text-xs dark:text-gray-200"
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
      <ConfirmDialog {...confirmDialogProps} />
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

  const { isDark } = useTheme();

  if (activeShifts.length === 0) return null;

  function getCellStyle(shiftId: number, day: number): CSSProperties {
    const jsWd = getWeekday(year, month, day);
    const dbWd = jsWdToDbWd(jsWd);
    const count = countMap.get(shiftId)?.get(day) ?? 0;
    const req = reqsLookup.get(dbWd)?.get(shiftId);

    if (!req || (req.min === 0 && req.max === 0)) {
      // No requirement defined
      if (count === 0) return isDark
        ? { backgroundColor: '#1a2535', color: '#64748b' }
        : { backgroundColor: '#f8fafc', color: '#94a3b8' };
      return isDark
        ? { backgroundColor: '#0d1f3c', color: '#60a5fa' }
        : { backgroundColor: '#f0f9ff', color: '#3b82f6' };
    }

    if (count < req.min) return isDark
      ? { backgroundColor: '#2d1212', color: '#f87171' }  // Unterbesetzt
      : { backgroundColor: '#fef2f2', color: '#dc2626' };
    if (count > req.max) return isDark
      ? { backgroundColor: '#2a1500', color: '#fb923c' }  // Überbesetzt
      : { backgroundColor: '#fff7ed', color: '#ea580c' };
    return isDark
      ? { backgroundColor: '#0d2218', color: '#4ade80' }  // OK
      : { backgroundColor: '#f0fdf4', color: '#16a34a' };
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
    <div className="mt-3 bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-600 overflow-auto">
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
              <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-1 border-r border-gray-200 dark:border-gray-700 border-b border-b-gray-100 dark:border-b-gray-700 whitespace-nowrap">
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
const EmployeeCountBadge = memo(function EmployeeCountBadge({ visible, total }: { visible: number; total: number }) {
  const filtered = visible < total;
  return (
    <span className={`text-sm font-medium ${filtered ? 'text-blue-600' : 'text-gray-500'}`}>
      {filtered ? (
        <>
          <span className="font-bold">{visible}</span>
          <span className="text-gray-400"> / {total} Mitarbeitende</span>
        </>
      ) : (
        <>{total} Mitarbeiter</>
      )}
    </span>
  );
});

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
        className="flex items-center gap-1.5 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
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
        <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl min-w-[200px] py-1">
          <button
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
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
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
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
      className="fixed z-[100] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 text-xs dark:text-gray-200"
      style={{ left: x, top: y, minWidth: 210 }}
    >
      <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 border-b dark:border-gray-600 text-[10px] text-blue-700 dark:text-blue-300 font-semibold rounded-t-lg flex items-center justify-between">
        <span>✅ {selectionInfo.cells} Zellen ({selectionInfo.employees} MA × {selectionInfo.days} Tage)</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2">×</button>
      </div>
      {mode === 'menu' ? (
        <div className="py-1">
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
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
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => { onCopy(); onClose(); }}
          >
            📄 Kopieren
          </button>
          {hasClipboard && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
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
              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
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
            className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 flex items-center gap-1"
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
  shift,
  monthCount,
  colleaguesWithSameShift,
}: {
  state: HoverTooltipState;
  emp: Employee | null;
  entry: ScheduleEntry | null;
  dateStr: string;
  cellConflicts: ConflictEntry[];
  shift?: ShiftType | null;
  monthCount?: number;
  colleaguesWithSameShift?: string[];
}) {
  if (!entry && cellConflicts.length === 0) return null;

  // Extract shift times from the ShiftType data
  let shiftTimes: string | null = null;
  if (shift && entry?.kind === 'shift') {
    // Determine DB weekday (0=Mon ... 6=Sun) from dateStr
    const jsWd = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun
    const dbWd = jsWdToDbWd(jsWd); // 0=Mon ... 6=Sun
    // STARTEND keys: 1=Mon ... 7=Sun → dbWd+1
    const wdKey = `STARTEND${dbWd + 1}` as keyof ShiftType;
    const defaultKey = 'STARTEND0' as keyof ShiftType;
    const startend = (shift[wdKey] as string | undefined) || (shift[defaultKey] as string | undefined);
    if (startend) {
      // Format: "HH:MM-HH:MM" → "HH:MM – HH:MM"
      const dashIdx = startend.lastIndexOf('-');
      if (dashIdx > 0) {
        shiftTimes = `${startend.substring(0, dashIdx)} – ${startend.substring(dashIdx + 1)}`;
      }
    }
    // Also try TIMES_BY_WEEKDAY for weekday-specific overrides
    if (shift.TIMES_BY_WEEKDAY) {
      const wdStr = String(dbWd + 1); // "1"=Mon ... "7"=Sun
      const wdTimes = shift.TIMES_BY_WEEKDAY[wdStr];
      if (wdTimes) shiftTimes = `${wdTimes.start} – ${wdTimes.end}`;
    }
  }

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
      {shiftTimes && (
        <div className="text-green-300 text-[10px] mb-0.5">⏰ {shiftTimes}</div>
      )}
      {entry?.workplace_id != null && (
        <div className="text-gray-400 text-[10px] mb-0.5">📍 Arbeitsplatz #{entry.workplace_id}</div>
      )}
      {/* Schicht-Statistik */}
      {entry?.kind === 'shift' && entry.shift_id != null && (
        <div className="mt-1 pt-1 border-t border-gray-700 space-y-0.5">
          {monthCount != null && monthCount > 0 && (
            <div className="text-[10px] text-purple-300 flex items-center gap-1">
              <span>📊</span>
              <span>Diesen Monat: <strong>{monthCount}×</strong> diese Schicht</span>
            </div>
          )}
          {colleaguesWithSameShift != null && colleaguesWithSameShift.length > 0 && (
            <div className="text-[10px] text-cyan-300 flex items-start gap-1">
              <span className="flex-shrink-0">👥</span>
              <span>Heute auch: {colleaguesWithSameShift.slice(0, 4).join(', ')}{colleaguesWithSameShift.length > 4 ? ` +${colleaguesWithSameShift.length - 4}` : ''}</span>
            </div>
          )}
          {colleaguesWithSameShift != null && colleaguesWithSameShift.length === 0 && (
            <div className="text-[10px] text-gray-500 flex items-center gap-1">
              <span>👤</span>
              <span>Einzige mit dieser Schicht heute</span>
            </div>
          )}
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

// ── Wochenvorlagen (Week Templates) ──────────────────────────
const TEMPLATES_KEY = 'sp5_week_templates';

interface WeekTemplate {
  id: string;
  name: string;
  createdAt: string;
  // weekday 0=Mon…6=Sun → employee_id → shift_id
  entries: Array<{ employee_id: number; weekday: number; shift_id: number }>;
}

function loadTemplates(): WeekTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTemplates(templates: WeekTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

interface WeekTemplateModalProps {
  onClose: () => void;
  year: number;
  month: number;
  employees: Employee[];
  entryMap: Map<string, import('../types').ScheduleEntry>;
  onApplyTemplate: (template: WeekTemplate, skipExisting: boolean) => Promise<void>;
}

function WeekTemplateModal({
  onClose,
  year,
  month,
  employees,
  entryMap,
  onApplyTemplate,
}: WeekTemplateModalProps) {
  const [templates, setTemplates] = useState<WeekTemplate[]>(loadTemplates);
  const [tab, setTab] = useState<'apply' | 'save'>('apply');
  const [newName, setNewName] = useState('');
  const [refWeekStart, setRefWeekStart] = useState<string>('');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applySkip, setApplySkip] = useState(true);

  // Build list of Mondays in the current month
  const mondays: string[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getDay() === 1) {
      mondays.push(`${year}-${pad(month)}-${pad(d)}`);
    }
  }
  // Default to first Monday of month
  useEffect(() => {
    if (!refWeekStart && mondays.length > 0) setRefWeekStart(mondays[0]);
  }, []);

  const handleSave = () => {
    if (!newName.trim() || !refWeekStart) return;
    // Extract week entries from the chosen reference week (Mon–Sun)
    const weekEntries: Array<{ employee_id: number; weekday: number; shift_id: number }> = [];
    const monday = new Date(refWeekStart + 'T00:00:00');
    for (let wd = 0; wd < 7; wd++) {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + wd);
      if (dt.getMonth() !== month - 1) continue; // skip days outside month
      const day = dt.getDate();
      for (const emp of employees) {
        const e = entryMap.get(`${emp.ID}-${day}`);
        if (e && e.kind === 'shift' && e.shift_id) {
          weekEntries.push({ employee_id: emp.ID, weekday: wd, shift_id: e.shift_id });
        }
      }
    }
    if (weekEntries.length === 0) return;
    const tpl: WeekTemplate = {
      id: Date.now().toString(),
      name: newName.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      entries: weekEntries,
    };
    const updated = [...templates, tpl];
    saveTemplates(updated);
    setTemplates(updated);
    setNewName('');
    setTab('apply');
  };

  const handleDelete = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    saveTemplates(updated);
    setTemplates(updated);
  };

  const handleApply = async (tpl: WeekTemplate) => {
    setApplyingId(tpl.id);
    await onApplyTemplate(tpl, applySkip);
    setApplyingId(null);
    onClose();
  };

  const WD_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold flex items-center gap-2 dark:text-white">
            📐 Wochenvorlagen
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-gray-700 px-5">
          <button
            onClick={() => setTab('apply')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'apply' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            Vorlage anwenden
          </button>
          <button
            onClick={() => setTab('save')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'save' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            Vorlage speichern
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">

          {tab === 'apply' && (
            <div className="space-y-3">
              {templates.length === 0 ? (
                <div className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
                  Noch keine Vorlagen gespeichert.<br />
                  <button onClick={() => setTab('save')} className="text-blue-500 underline mt-1">Vorlage speichern</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={applySkip} onChange={e => setApplySkip(e.target.checked)} className="rounded" />
                      Bereits belegte Tage überspringen
                    </label>
                  </div>
                  {templates.map(tpl => {
                    const empCount = new Set(tpl.entries.map(e => e.employee_id)).size;
                    const wdSet = new Set(tpl.entries.map(e => e.weekday));
                    const wdLabel = WD_NAMES.filter((_, i) => wdSet.has(i)).join(', ');
                    return (
                      <div key={tpl.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm dark:text-white truncate">{tpl.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {tpl.createdAt} · {empCount} MA · {wdLabel}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{tpl.entries.length} Einträge</div>
                        </div>
                        <button
                          onClick={() => handleApply(tpl)}
                          disabled={applyingId === tpl.id}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded shadow-sm disabled:opacity-50"
                        >
                          {applyingId === tpl.id ? '…' : 'Anwenden'}
                        </button>
                        <button
                          onClick={() => handleDelete(tpl.id)}
                          className="px-2 py-1.5 text-red-400 hover:text-red-600 text-xs"
                          title="Vorlage löschen"
                        >
                          🗑
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {tab === 'save' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Wähle eine Referenzwoche aus dem aktuellen Monat. Die Schichten dieser Woche werden als Muster gespeichert und können auf andere Monate übertragen werden.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name der Vorlage</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="z.B. Standard-Besetzung Sommer"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Referenzwoche (Montag)</label>
                <select
                  value={refWeekStart}
                  onChange={e => setRefWeekStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {mondays.length === 0 && <option value="">Kein Montag im Monat</option>}
                  {mondays.map(m => {
                    const dt = new Date(m + 'T00:00:00');
                    const sun = new Date(dt); sun.setDate(dt.getDate() + 6);
                    return (
                      <option key={m} value={m}>
                        {dt.getDate()}.{month}.{year} – {Math.min(sun.getDate(), daysInMonth)}.{month}.{year}
                      </option>
                    );
                  })}
                </select>
              </div>
              {refWeekStart && (() => {
                const monday = new Date(refWeekStart + 'T00:00:00');
                const preview: { wd: number; count: number }[] = [];
                for (let wd = 0; wd < 7; wd++) {
                  const dt = new Date(monday); dt.setDate(monday.getDate() + wd);
                  if (dt.getMonth() !== month - 1) continue;
                  const day = dt.getDate();
                  const count = employees.filter(emp => {
                    const e = entryMap.get(`${emp.ID}-${day}`);
                    return e && e.kind === 'shift' && e.shift_id;
                  }).length;
                  preview.push({ wd, count });
                }
                const total = preview.reduce((s, p) => s + p.count, 0);
                return (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-xs">
                    <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Vorschau:</div>
                    <div className="flex gap-2 flex-wrap">
                      {preview.map(({ wd, count }) => (
                        <span key={wd} className={`px-2 py-0.5 rounded ${count > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-200 text-gray-400 dark:bg-gray-600 dark:text-gray-500'}`}>
                          {WD_NAMES[wd]}: {count}×
                        </span>
                      ))}
                    </div>
                    <div className="mt-1.5 text-gray-500 dark:text-gray-400">{total} Schicht-Einträge werden gespeichert</div>
                  </div>
                );
              })()}
              <button
                onClick={handleSave}
                disabled={!newName.trim() || !refWeekStart}
                className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                💾 Vorlage speichern
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Schedule Component ───────────────────────────────────
export default function Schedule() {
  const now = new Date();
  const navigate = useNavigate();
  const { canEditSchedule } = usePermissions();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // ── Mobile week view ────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileWeekOffset, setMobileWeekOffset] = useState(0); // 0 = current/first week

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

  // Coverage (Personalbedarf-Ampel)
  const [coverage, setCoverage] = useState<CoverageDay[]>([]);

  // Notes: "empId-dateStr" → Note[]
  const [notesMap, setNotesMap] = useState<Map<string, Note[]>>(new Map());

  // Wishes: "empId-dateStr" → wish_type
  const [wishMap, setWishMap] = useState<Map<string, 'WUNSCH' | 'SPERRUNG'>>(new Map());

  // Conflicts
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictActionState, setConflictActionState] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({});

  // Keyboard help overlay
  const [showKbHelp, setShowKbHelp] = useState(false);
  const [showWorkloadBars, setShowWorkloadBars] = useState(false);

  // Filters
  const [filterShiftId, setFilterShiftId] = useState<number | ''>('');
  const [filterLeaveId, setFilterLeaveId] = useState<number | ''>('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [filterLetter, setFilterLetter] = useState('');
  const [showTerminated, setShowTerminated] = useState(false);
  const [employeeSort, setEmployeeSort] = useState<'position' | 'name-asc' | 'name-desc' | 'number-asc' | 'number-desc' | 'group'>('position');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [activePicker, setActivePicker] = useState<{ empId: number; day: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const { isDark } = useTheme();
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

  // ── Mitarbeiter-Hervorhebung ───────────────────────────────
  const [highlightedEmpId, setHighlightedEmpId] = useState<number | null>(null);

  // ── Vormonat kopieren ──────────────────────────────────────
  const [showCopyPrevMonth, setShowCopyPrevMonth] = useState(false);
  const [copyPrevMonthLoading, setCopyPrevMonthLoading] = useState(false);
  const [copyPrevMonthSkip, setCopyPrevMonthSkip] = useState(true);

  // Copy-Week modal state
  const [showCopyWeek, setShowCopyWeek] = useState(false);
  const [copyWeekSource, setCopyWeekSource] = useState<number | ''>('');
  const [copyWeekTargets, setCopyWeekTargets] = useState<Set<number>>(new Set());
  const [copyWeekSkip, setCopyWeekSkip] = useState(true);
  const [copyWeekLoading, setCopyWeekLoading] = useState(false);
  const [copyWeekMonday, setCopyWeekMonday] = useState<string>('');

  // Schicht-Tausch state
  const [showSwap, setShowSwap] = useState(false);
  const [swapEmp1, setSwapEmp1] = useState<number | ''>('');
  const [swapEmp2, setSwapEmp2] = useState<number | ''>('');
  const [swapDateFrom, setSwapDateFrom] = useState<string>('');
  const [swapDateTo, setSwapDateTo] = useState<string>('');
  const [swapLoading, setSwapLoading] = useState(false);

// Auto-Plan modal state
  const [showAutoPlan, setShowAutoPlan] = useState(false);
  const [autoPlanForce, setAutoPlanForce] = useState(false);
  const [autoPlanEmployeeId, setAutoPlanEmployeeId] = useState<number | 'all'>('all');
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);
  const [autoPlanAssignments, setAutoPlanAssignments] = useState<Array<{ employee_id: number; cycle_id: number; start: string }>>([]);
  const [autoPlanYear, setAutoPlanYear] = useState<number>(year);
  const [autoPlanMonth, setAutoPlanMonth] = useState<number>(month);
  const [autoPlanStep, setAutoPlanStep] = useState<'config' | 'preview'>('config');
  const [autoPlanPreview, setAutoPlanPreview] = useState<Array<{ employee_id: number; employee_name: string; date: string; shift_id: number; shift_name: string; status: 'new' | 'skip' | 'overwrite' }>>([]);

  // Schicht-Empfehlung state
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Wochenvorlagen state
  const [showWeekTemplates, setShowWeekTemplates] = useState(false);

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

  // Mobile viewport detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Reset week offset when month/year changes
  useEffect(() => {
    setMobileWeekOffset(0);
  }, [year, month]);

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

  // Reload trigger for copy-week (dispatched after successful copy)
  useEffect(() => {
    const handler = () => loadSchedule();
    window.addEventListener('sp5-reload-schedule', handler);
    return () => window.removeEventListener('sp5-reload-schedule', handler);
  }, [year, month]);

  // Load staffing requirements when year/month changes
  useEffect(() => {
    api.getStaffingRequirements(year, month)
      .then(data => setStaffingReqs(data.shift_requirements))
      .catch(() => setStaffingReqs([]));
  }, [year, month]);

  // Load coverage (Personalbedarf-Ampel) when year/month changes
  useEffect(() => {
    api.getCoverage(year, month)
      .then(setCoverage)
      .catch(() => setCoverage([]));
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

  // Load wishes for the month
  useEffect(() => {
    api.getWishes({ year, month }).then(ws => {
      const m = new Map<string, 'WUNSCH' | 'SPERRUNG'>();
      for (const w of ws) {
        const key = `${w.employee_id}-${w.date}`;
        // SPERRUNG takes priority if both exist
        if (!m.has(key) || w.wish_type === 'SPERRUNG') {
          m.set(key, w.wish_type as 'WUNSCH' | 'SPERRUNG');
        }
      }
      setWishMap(m);
    }).catch(() => setWishMap(new Map()));
  }, [year, month]);

  // Load cycle assignments when Auto-Plan modal opens
  useEffect(() => {
    if (showAutoPlan) {
      setAutoPlanYear(year);
      setAutoPlanMonth(month);
      setAutoPlanStep('config');
      setAutoPlanPreview([]);
      api.getCycleAssignments()
        .then(data => setAutoPlanAssignments(data))
        .catch(() => setAutoPlanAssignments([]));
    }
  }, [showAutoPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeAutoPlan = () => {
    setShowAutoPlan(false);
    setAutoPlanForce(false);
    setAutoPlanEmployeeId('all');
    setAutoPlanStep('config');
    setAutoPlanPreview([]);
  };

  // Preview Auto-Plan (dry_run)
  const handleAutoPlanPreview = async () => {
    setAutoPlanLoading(true);
    try {
      const params: { year: number; month: number; employee_ids?: number[]; force?: boolean; dry_run: boolean } = {
        year: autoPlanYear,
        month: autoPlanMonth,
        force: autoPlanForce,
        dry_run: true,
      };
      if (autoPlanEmployeeId !== 'all') {
        params.employee_ids = [autoPlanEmployeeId as number];
      }
      const result = await api.generateSchedule(params);
      setAutoPlanPreview(result.preview || []);
      setAutoPlanStep('preview');
    } catch (e: unknown) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setAutoPlanLoading(false);
    }
  };

  // Execute Auto-Plan generation
  const handleAutoPlan = async () => {
    setAutoPlanLoading(true);
    try {
      const params: { year: number; month: number; employee_ids?: number[]; force?: boolean } = {
        year: autoPlanYear,
        month: autoPlanMonth,
        force: autoPlanForce,
      };
      if (autoPlanEmployeeId !== 'all') {
        params.employee_ids = [autoPlanEmployeeId as number];
      }
      const result = await api.generateSchedule(params);
      showToast(result.message, result.errors.length > 0 ? 'info' : 'success');
      closeAutoPlan();
      if (autoPlanYear === year && autoPlanMonth === month) {
        loadSchedule();
      }
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

  // ── Today highlight ─────────────────────────────────────────
  // todayDay is the day number (1-31) if the currently displayed month is the current month,
  // or -1 if we're looking at a different month.
  const todayDay = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : -1;

  // ── Mobile week view: compute which 7 days to show ──────────
  const mobileWeekData = useMemo(() => {
    // Find the Monday of the reference week:
    // - If showing current month & today is in it: use current week
    // - Otherwise: use first week of the month
    const now2 = new Date();
    let refMonday: Date;
    const isCurrentMonth = now2.getFullYear() === year && now2.getMonth() + 1 === month;
    if (isCurrentMonth) {
      const wd = now2.getDay(); // 0=Sun,1=Mon,...
      const toMon = wd === 0 ? 6 : wd - 1;
      refMonday = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate() - toMon);
    } else {
      const firstDay = new Date(year, month - 1, 1);
      const wd = firstDay.getDay();
      const toMon = wd === 0 ? 6 : wd - 1;
      refMonday = new Date(year, month - 1, 1 - toMon);
    }
    // Apply week offset
    const weekStart = new Date(refMonday);
    weekStart.setDate(refMonday.getDate() + mobileWeekOffset * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Which days of the current month fall in this week?
    const weekDaysInMonth: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        weekDaysInMonth.push(d.getDate());
      }
    }

    // Formatted week label: "DD.MM – DD.MM"
    const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
    const label = `${fmt(weekStart)} – ${fmt(weekEnd)}`;

    return { weekDaysInMonth, label, weekStart, weekEnd };
  }, [year, month, mobileWeekOffset]);

  // Displayed days: 7-day week on mobile, full month on desktop
  const displayedDays = isMobile ? mobileWeekData.weekDaysInMonth : days;

  // Entry lookup: "empId-day" → entry
  const entryMap = useMemo(() => {
    const m = new Map<string, ScheduleEntry>();
    for (const e of entries) {
      const day = parseInt(e.date.split('-')[2]);
      m.set(`${e.employee_id}-${day}`, e);
    }
    return m;
  }, [entries]);

  // Workload map: employeeId → { actual, target } hours for the visible month
  const workloadMap = useMemo(() => {
    const shiftsById = new Map(shifts.map(s => [s.ID, s]));
    const m = new Map<number, { actual: number; target: number }>();
    for (const emp of employees) {
      // Count actual hours from entries
      let actual = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const entry = entryMap.get(`${emp.ID}-${d}`);
        if (!entry || !entry.shift_id) continue;
        const sh = shiftsById.get(entry.shift_id);
        if (!sh) continue;
        // Use weekday-specific duration if available, else DURATION0
        const wd = new Date(year, month - 1, d).getDay(); // 0=Sun
        const wdKey = wd === 0 ? 7 : wd; // DB: 1=Mo..7=So
        const dur = (sh as unknown as Record<string, unknown>)[`DURATION${wdKey}`] as number | undefined;
        actual += typeof dur === 'number' && dur > 0 ? dur : (sh.DURATION0 || 0);
      }
      // Target: prefer HRSMONTH, else HRSDAY * working days in month
      let target = emp.HRSMONTH || 0;
      if (!target && emp.HRSDAY) {
        let workDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const wd = new Date(year, month - 1, d).getDay();
          const dbWd = wd === 0 ? 6 : wd - 1; // 0=Mon..6=Sun
          if (emp.WORKDAYS_LIST && emp.WORKDAYS_LIST[dbWd]) workDays++;
        }
        target = emp.HRSDAY * workDays;
      }
      m.set(emp.ID, { actual: Math.round(actual * 10) / 10, target: Math.round(target * 10) / 10 });
    }
    return m;
  }, [employees, entries, entryMap, shifts, year, month, daysInMonth]);

  // Coverage lookup: day → CoverageDay
  const coverageMap = useMemo(() => {
    const m = new Map<number, CoverageDay>();
    for (const c of coverage) m.set(c.day, c);
    return m;
  }, [coverage]);

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

  const sortEmployees = (list: Employee[]): Employee[] => {
    if (employeeSort === 'position') return list;
    return [...list].sort((a, b) => {
      switch (employeeSort) {
        case 'name-asc':    return `${a.NAME} ${a.FIRSTNAME}`.localeCompare(`${b.NAME} ${b.FIRSTNAME}`, 'de');
        case 'name-desc':   return `${b.NAME} ${b.FIRSTNAME}`.localeCompare(`${a.NAME} ${a.FIRSTNAME}`, 'de');
        case 'number-asc':  return (Number(a.NUMBER) || 0) - (Number(b.NUMBER) || 0);
        case 'number-desc': return (Number(b.NUMBER) || 0) - (Number(a.NUMBER) || 0);
        case 'group':       return `${a.NAME} ${a.FIRSTNAME}`.localeCompare(`${b.NAME} ${b.FIRSTNAME}`, 'de');
        default:            return 0;
      }
    });
  };

  const displayRows: DisplayRow[] = useMemo(() => {
    const searchLower = employeeSearch.toLowerCase();
    const matchesSearch = (emp: Employee) => {
      if (filterLetter && (emp.NAME || '').toUpperCase().charAt(0) !== filterLetter) return false;
      if (!searchLower) return true;
      return (
        `${emp.NAME} ${emp.FIRSTNAME}`.toLowerCase().includes(searchLower) ||
        `${emp.FIRSTNAME} ${emp.NAME}`.toLowerCase().includes(searchLower) ||
        (emp.SHORTNAME || '').toLowerCase().includes(searchLower) ||
        (emp.NUMBER || '').toLowerCase().includes(searchLower)
      );
    };

    // First day of displayed month — employees who left before this are "terminated"
    const monthStart = new Date(year, month - 1, 1);
    const isActive = (emp: Employee): boolean => {
      if (showTerminated) return true; // show all
      if (!emp.EMPEND) return true;    // no end date → active
      try {
        const endDate = new Date(emp.EMPEND);
        return endDate >= monthStart;   // still here during this month
      } catch { return true; }
    };

    if (selectedGroupIds.length === 0) {
      // All employees (no group separator)
      const filtered = employees.filter(e => matchesSearch(e) && isActive(e));
      return sortEmployees(filtered).map(e => ({ type: 'employee' as const, employee: e }));
    }

    // Multiple groups: show with separators
    const rows: DisplayRow[] = [];
    for (const gid of selectedGroupIds) {
      const group = groups.find(g => g.ID === gid);
      rows.push({ type: 'group-header', groupId: gid, groupName: group?.NAME ?? `Gruppe ${gid}` });
      const members = groupMembersMap.get(gid) ?? new Set<number>();
      const groupEmps = employees.filter(e => members.has(e.ID) && matchesSearch(e) && isActive(e));
      for (const e of sortEmployees(groupEmps)) {
        rows.push({ type: 'employee', employee: e });
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupIds, employees, groups, groupMembersMap, employeeSearch, filterLetter, showTerminated, year, month, employeeSort]);

  // Employees only (for export and counters)
  const displayEmployees = useMemo(
    () => displayRows.filter(r => r.type === 'employee').map(r => r.employee!),
    [displayRows],
  );

  // Available first letters from all (unfiltered) employees for alphabet bar
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    for (const emp of employees) {
      const ch = (emp.NAME || '').toUpperCase().charAt(0);
      if (ch >= 'A' && ch <= 'Z') letters.add(ch);
    }
    return letters;
  }, [employees]);

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

  // Mobile week navigation
  const prevWeek = () => setMobileWeekOffset(o => o - 1);
  const nextWeek = () => setMobileWeekOffset(o => o + 1);

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

  // ── Single-cell Sonderdienst ───────────────────────────────
  const handleAddSonderdienst = async (
    empId: number, dateStr: string,
    shiftId: number | null, startTime: string, endTime: string,
  ) => {
    const startend = `${startTime}-${endTime}`;
    const shift = shiftId ? shifts.find(s => s.ID === shiftId) : null;
    setSaving(true);
    try {
      await api.createEinsatzplanEntry({
        employee_id: empId,
        date: dateStr,
        shift_id: shiftId ?? undefined,
        startend,
        name: shift ? shift.NAME : 'Sonderdienst',
        shortname: shift ? shift.SHORTNAME : 'SD',
      });
      showToast('Sonderdienst eingetragen', 'success');
      loadSchedule();
    } catch (e) {
      showToast('Fehler beim Speichern: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  // ── Arbeitszeitabweichung ──────────────────────────────────
  const handleAddDeviation = async (
    empId: number, dateStr: string, startTime: string, endTime: string,
  ) => {
    const startend = `${startTime}-${endTime}`;
    setSaving(true);
    try {
      await api.createDeviation({
        employee_id: empId,
        date: dateStr,
        startend,
        name: 'Arbeitszeitabweichung',
        shortname: 'AZA',
      });
      showToast('Arbeitszeitabweichung gespeichert', 'success');
      loadSchedule();
    } catch (e) {
      showToast('Fehler beim Speichern: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  // ── Single-cell copy/paste ─────────────────────────────────
  const handleSingleCellCopy = (empId: number, day: number) => {
    const empIdx = empIndexMap.get(empId) ?? 0;
    const entry = entryMap.get(`${empId}-${day}`);
    setClipboard({
      entries: [{ relEmpIdx: 0, relDay: 0, shiftId: entry?.shift_id ?? null }],
      anchorEmpIdx: empIdx,
      anchorDay: day,
    });
    showToast('Zelle kopiert', 'success');
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
    if (!await confirmDialog({ message: `${cells.length} Einträge löschen?`, danger: true })) return;
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

  // ── Apply Week Template ─────────────────────────────────────
  const handleApplyTemplate = async (template: WeekTemplate, skipExisting: boolean) => {
    const daysInCurMonth = new Date(year, month, 0).getDate();
    const toAssign: Array<{ employee_id: number; date: string; shift_id: number }> = [];
    for (let d = 1; d <= daysInCurMonth; d++) {
      const dt = new Date(year, month - 1, d);
      // JS weekday: 0=Sun, 1=Mon ... 6=Sat → convert to 0=Mon...6=Sun
      const jsWd = dt.getDay();
      const wd = (jsWd + 6) % 7; // 0=Mon...6=Sun
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      for (const te of template.entries) {
        if (te.weekday !== wd) continue;
        if (skipExisting && entryMap.has(`${te.employee_id}-${d}`)) continue;
        toAssign.push({ employee_id: te.employee_id, date: dateStr, shift_id: te.shift_id });
      }
    }
    if (toAssign.length === 0) {
      showToast('Keine Schichten zu übertragen (alles belegt?)', 'info');
      return;
    }
    setSaving(true);
    try {
      const result = await api.bulkSchedule(toAssign, !skipExisting);
      showToast(`✅ Vorlage angewandt: ${result.created} erstellt, ${result.updated} aktualisiert`, 'success');
      loadSchedule();
    } catch (e) {
      showToast('Fehler beim Anwenden der Vorlage: ' + (e as Error).message, 'error');
    }
    setSaving(false);
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

  // ── Vormonat kopieren ──────────────────────────────────────
  const handleCopyPrevMonth = async () => {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    const daysInCurMonth = new Date(year, month, 0).getDate();
    setCopyPrevMonthLoading(true);
    try {
      const prevEntries = await api.getSchedule(prevYear, prevMonth);
      // Map by same day-of-month: day 1..N of prev month → day 1..N of cur month (up to min of both)
      const maxDays = Math.min(daysInPrevMonth, daysInCurMonth);
      const toAssign: Array<{ employee_id: number; date: string; shift_id: number | null }> = [];
      for (const e of prevEntries) {
        if (e.kind !== 'shift' || !e.shift_id) continue;
        const prevDay = new Date(e.date).getDate();
        if (prevDay > maxDays) continue;
        // Skip if target already has an entry (if skip=true)
        if (copyPrevMonthSkip && entryMap.has(`${e.employee_id}-${prevDay}`)) continue;
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(prevDay).padStart(2,'0')}`;
        toAssign.push({ employee_id: e.employee_id, date: dateStr, shift_id: e.shift_id });
      }
      if (toAssign.length === 0) {
        showToast('Keine Schichten zu kopieren (alles bereits belegt?)', 'info');
      } else {
        await api.bulkSchedule(toAssign, !copyPrevMonthSkip);
        await loadSchedule();
        showToast(`✅ ${toAssign.length} Schichten aus dem Vormonat übernommen`, 'success');
      }
    } catch {
      showToast('Fehler beim Kopieren des Vormonats', 'error');
    } finally {
      setCopyPrevMonthLoading(false);
      setShowCopyPrevMonth(false);
    }
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
    // Ctrl+F → focus employee search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      // Only intercept if not already in an input
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
    }
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
    // ? → toggle keyboard help overlay
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
        e.preventDefault();
        setShowKbHelp(h => !h);
        return;
      }
    }

    // Escape → clear all UI state
    if (e.key === 'Escape') {
      if (showKbHelp) { setShowKbHelp(false); return; }
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
    else {
      // Letter shortcuts: first letter of shift shortname → assign shift
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't intercept when focus is in an input
        const activeTag = (document.activeElement as HTMLElement)?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
        const letter = e.key.toUpperCase();
        // Find shift whose SHORTNAME starts with this letter
        const matchShift = shifts.find(s => s.SHORTNAME?.toUpperCase().startsWith(letter));
        if (matchShift) {
          e.preventDefault();
          handleAddShift(empId, day, matchShift.ID);
        }
      }
      return;
    }

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
    <div className="p-2 sm:p-4 h-full flex flex-col" onClick={() => { setContextMenu(null); setNotePopup(null); setBulkContextMenu(null); }}>
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
        <CellContextMenu
          state={contextMenu}
          entry={entryMap.get(`${contextMenu.empId}-${contextMenu.day}`) ?? null}
          shifts={shifts}
          leaveTypes={leaveTypes}
          hasClipboard={!!clipboard}
          onClose={() => setContextMenu(null)}
          onAddNote={handleAddNote}
          onAssignShift={handleAddShift}
          onAddAbsence={handleAddAbsence}
          onAddSonderdienst={handleAddSonderdienst}
          onAddDeviation={handleAddDeviation}
          onDelete={handleDeleteEntry}
          onCopy={handleSingleCellCopy}
          onPaste={(empId, day) => handleBulkPaste(empId, day)}
        />
      )}
      {/* Auto-Planen Modal */}
      {showAutoPlan && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) closeAutoPlan(); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">🤖 Auto-Planen</h2>
              {autoPlanStep === 'preview' && (
                <button
                  onClick={() => setAutoPlanStep('config')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  ← Zurück
                </button>
              )}
            </div>

            {autoPlanStep === 'config' && (
              <>
                {/* Monat wählen */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monat</label>
                  <div className="flex gap-2">
                    <select
                      value={autoPlanMonth}
                      onChange={e => setAutoPlanMonth(Number(e.target.value))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {MONTH_NAMES.slice(1).map((name, i) => (
                        <option key={i + 1} value={i + 1}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={autoPlanYear}
                      onChange={e => setAutoPlanYear(Number(e.target.value))}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 5 }, (_, i) => year - 1 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

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
                <div className="mb-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPlanForce}
                      onChange={e => setAutoPlanForce(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Bestehende Einträge überschreiben</span>
                  </label>
                  {autoPlanForce ? (
                    <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      ⚠️ Bereits eingetragene Schichten, Urlaube und Abwesenheiten werden gelöscht und überschrieben!
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      Tage mit bestehenden Einträgen werden übersprungen (empfohlen).
                    </p>
                  )}
                </div>

                {autoPlanAssignments.length === 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                    ⚠️ Keine Schichtmodell-Zuweisungen gefunden. Bitte erst unter{' '}
                    <strong>Schichtmodell</strong> Mitarbeitern ein Modell zuweisen.
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={closeAutoPlan}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                    disabled={autoPlanLoading}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAutoPlanPreview}
                    disabled={autoPlanLoading || autoPlanAssignments.length === 0}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {autoPlanLoading ? (
                      <><span className="animate-spin inline-block">⏳</span> Prüfe...</>
                    ) : (
                      <>🔍 Vorschau anzeigen</>
                    )}
                  </button>
                </div>
              </>
            )}

            {autoPlanStep === 'preview' && (
              <>
                {/* Preview Summary */}
                {(() => {
                  const newEntries = autoPlanPreview.filter(p => p.status === 'new');
                  const skipEntries = autoPlanPreview.filter(p => p.status === 'skip');
                  const overwriteEntries = autoPlanPreview.filter(p => p.status === 'overwrite');
                  // Group new entries by employee for display
                  const byEmp = new Map<string, typeof autoPlanPreview>();
                  for (const p of [...newEntries, ...overwriteEntries]) {
                    const k = p.employee_name;
                    if (!byEmp.has(k)) byEmp.set(k, []);
                    byEmp.get(k)!.push(p);
                  }
                  return (
                    <>
                      <p className="text-sm text-gray-600 mb-3">
                        Vorschau für <span className="font-semibold">{MONTH_NAMES[autoPlanMonth]} {autoPlanYear}</span>:
                      </p>

                      {/* Stats row */}
                      <div className="flex gap-3 mb-4">
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-green-700">{newEntries.length + overwriteEntries.length}</div>
                          <div className="text-xs text-green-600 mt-0.5">werden erstellt{overwriteEntries.length > 0 ? ` (${overwriteEntries.length} überschrieben)` : ''}</div>
                        </div>
                        {skipEntries.length > 0 && (
                          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-gray-500">{skipEntries.length}</div>
                            <div className="text-xs text-gray-500 mt-0.5">bestehende werden übersprungen</div>
                          </div>
                        )}
                      </div>

                      {/* Employee breakdown */}
                      {byEmp.size > 0 ? (
                        <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-48 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-3 py-2 font-medium text-gray-600">Mitarbeiter</th>
                                <th className="text-center px-2 py-2 font-medium text-gray-600">Einträge</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from(byEmp.entries()).map(([empName, entries]) => (
                                <tr key={empName} className="border-b border-gray-100 last:border-0">
                                  <td className="px-3 py-1.5 text-gray-700">{empName}</td>
                                  <td className="px-2 py-1.5 text-center text-gray-700">{entries.length}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500 mb-4">
                          Keine neuen Einträge zu erstellen.
                          {skipEntries.length > 0 && ` (${skipEntries.length} bestehende übersprungen)`}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Buttons */}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={closeAutoPlan}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                    disabled={autoPlanLoading}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={() => setAutoPlanStep('config')}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                    disabled={autoPlanLoading}
                  >
                    ← Zurück
                  </button>
                  <button
                    onClick={handleAutoPlan}
                    disabled={autoPlanLoading || autoPlanPreview.filter(p => p.status !== 'skip').length === 0}
                    className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {autoPlanLoading ? (
                      <><span className="animate-spin inline-block">⏳</span> Befülle...</>
                    ) : (
                      <>✅ Jetzt generieren</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Wochenvorlagen Modal ──────────────────────────────── */}
      {showWeekTemplates && (
        <WeekTemplateModal
          onClose={() => setShowWeekTemplates(false)}
          year={year}
          month={month}
          employees={employees}
          entryMap={entryMap}
          onApplyTemplate={handleApplyTemplate}
        />
      )}

      {/* ── Vormonat kopieren Modal ────────────────────────────── */}
      {showCopyPrevMonth && (() => {
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevMonthName = MONTH_NAMES[prevMonth];
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setShowCopyPrevMonth(false)}>
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-2">📅 Vormonat kopieren</h3>
              <p className="text-sm text-gray-600 mb-4">
                Alle Schichten aus <strong>{prevMonthName} {prevYear}</strong> werden taggleich in{' '}
                <strong>{MONTH_NAMES[month]} {year}</strong> übernommen.
              </p>
              <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyPrevMonthSkip}
                  onChange={e => setCopyPrevMonthSkip(e.target.checked)}
                  className="rounded"
                />
                Bereits belegte Zellen überspringen
              </label>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowCopyPrevMonth(false)}
                  className="px-4 py-2 text-sm rounded border hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCopyPrevMonth}
                  disabled={copyPrevMonthLoading}
                  className="px-4 py-2 text-sm rounded bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                >
                  {copyPrevMonthLoading ? '⏳ Wird kopiert…' : '✅ Übernehmen'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Woche kopieren Modal ───────────────────────────────── */}
      {showCopyWeek && (() => {
        const pad2 = (n: number) => String(n).padStart(2, '0');
        // Build list of all Mondays in the current month
        const mondays: string[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const wd = new Date(year, month - 1, d).getDay();
          if (wd === 1) mondays.push(`${year}-${pad2(month)}-${pad2(d)}`);
        }
        // Fall back: if no Monday in list yet, use first day
        const effectiveMonday = copyWeekMonday && mondays.includes(copyWeekMonday)
          ? copyWeekMonday
          : (mondays[0] ?? `${year}-${pad2(month)}-01`);

        const getWeekDates = (mondayStr: string): string[] => {
          const [y, m, d] = mondayStr.split('-').map(Number);
          return Array.from({ length: 7 }, (_, i) => {
            const dt = new Date(y, m - 1, d + i);
            return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
          });
        };
        const weekDates = getWeekDates(effectiveMonday);
        const weekLabel = `${weekDates[0]} – ${weekDates[6]}`;
        const sourceEmp = employees.find(e => e.ID === copyWeekSource);
        // Only look at entries within the current visible month
        const sourceEntries = weekDates
          .filter(d => {
            const [wy, wm] = d.split('-').map(Number);
            return wy === year && wm === month;
          })
          .map(d => entryMap.get(`${copyWeekSource}-${new Date(d).getDate()}`))
          .filter(Boolean);

        const closeCopyWeek = () => {
          setShowCopyWeek(false);
          setCopyWeekTargets(new Set());
        };

        const handleCopy = async () => {
          if (!copyWeekSource || copyWeekTargets.size === 0) return;
          setCopyWeekLoading(true);
          try {
            const result = await api.copyWeek({
              source_employee_id: copyWeekSource as number,
              dates: weekDates,
              target_employee_ids: Array.from(copyWeekTargets),
              skip_existing: copyWeekSkip,
            });
            showToast(result.message, result.errors.length > 0 ? 'warning' : 'success');
            closeCopyWeek();
            window.dispatchEvent(new CustomEvent('sp5-reload-schedule'));
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Fehler beim Kopieren', 'error');
          } finally {
            setCopyWeekLoading(false);
          }
        };

        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={e => { if (e.target === e.currentTarget) closeCopyWeek(); }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-800">📋 Woche kopieren</h2>
                <button onClick={closeCopyWeek} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>

              {/* Source employee */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Quell-Mitarbeiter</label>
                <select
                  value={copyWeekSource}
                  onChange={e => setCopyWeekSource(Number(e.target.value))}
                  className="w-full text-sm px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">— auswählen —</option>
                  {displayEmployees.map(emp => (
                    <option key={emp.ID} value={emp.ID}>{emp.NAME}, {emp.FIRSTNAME}</option>
                  ))}
                </select>
              </div>

              {/* Source week */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Quell-Woche</label>
                <select
                  value={effectiveMonday}
                  onChange={e => setCopyWeekMonday(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-lg bg-white"
                >
                  {mondays.map(mon => {
                    const wkDates = getWeekDates(mon);
                    return (
                      <option key={mon} value={mon}>{wkDates[0]} – {wkDates[6]}</option>
                    );
                  })}
                </select>
              </div>

              {/* Preview source shifts */}
              {copyWeekSource !== '' && (
                <div className="mb-4 bg-slate-50 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-2">
                    Schichten von {sourceEmp ? `${sourceEmp.NAME}, ${sourceEmp.FIRSTNAME}` : '?'} · {weekLabel}
                  </div>
                  <div className="flex gap-1">
                    {weekDates.map(d => {
                      const dt = new Date(d);
                      const dayNum = dt.getDate();
                      const inMonth = dt.getFullYear() === year && dt.getMonth() + 1 === month;
                      const entry = inMonth ? entryMap.get(`${copyWeekSource}-${dayNum}`) : undefined;
                      const wdIdx = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
                      const wd = ['Mo','Di','Mi','Do','Fr','Sa','So'][wdIdx];
                      return (
                        <div key={d} className="flex flex-col items-center flex-1">
                          <span className="text-[10px] text-gray-400">{wd}</span>
                          {entry ? (
                            <span
                              className="text-[11px] font-bold px-1 rounded w-full text-center"
                              style={{ backgroundColor: entry.color_bk || '#e2e8f0', color: entry.color_text || '#1e293b' }}
                            >{entry.display_name || '?'}</span>
                          ) : (
                            <span className="text-[11px] text-gray-300 w-full text-center">–</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {sourceEntries.length === 0 && (
                    <div className="text-xs text-amber-600 mt-2">⚠️ Keine Schichten im sichtbaren Bereich dieser Woche</div>
                  )}
                </div>
              )}

              {/* Target employees */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Ziel-Mitarbeiter</label>
                  <div className="flex gap-2 text-xs text-blue-600">
                    <button
                      className="hover:underline"
                      onClick={() => setCopyWeekTargets(new Set(displayEmployees.filter(e => e.ID !== copyWeekSource).map(e => e.ID)))}
                    >alle</button>
                    <button className="hover:underline" onClick={() => setCopyWeekTargets(new Set())}>keine</button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-y-auto max-h-40 divide-y">
                  {displayEmployees.filter(e => e.ID !== copyWeekSource).map(emp => (
                    <label key={emp.ID} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={copyWeekTargets.has(emp.ID)}
                        onChange={ev => {
                          const next = new Set(copyWeekTargets);
                          if (ev.target.checked) next.add(emp.ID); else next.delete(emp.ID);
                          setCopyWeekTargets(next);
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{emp.NAME}, {emp.FIRSTNAME}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="mb-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyWeekSkip}
                    onChange={e => setCopyWeekSkip(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Bestehende Einträge überspringen (nicht überschreiben)</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={closeCopyWeek}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                  disabled={copyWeekLoading}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCopy}
                  disabled={copyWeekLoading || !copyWeekSource || copyWeekTargets.size === 0}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copyWeekLoading ? '⏳ Kopiere…' : `📋 auf ${copyWeekTargets.size} MA übertragen`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Schicht-Tausch Modal ───────────────────────────────── */}
      {showSwap && (() => {
        const closeSwap = () => setShowSwap(false);

        const handleSwap = async () => {
          if (!swapEmp1 || !swapEmp2 || !swapDateFrom || !swapDateTo) return;
          if (swapEmp1 === swapEmp2) { showToast('Bitte zwei verschiedene Mitarbeiter wählen', 'error'); return; }

          // Build date list
          const dates: string[] = [];
          const cur = new Date(swapDateFrom);
          const end = new Date(swapDateTo);
          while (cur <= end) {
            dates.push(cur.toISOString().slice(0, 10));
            cur.setDate(cur.getDate() + 1);
          }
          if (dates.length > 62) { showToast('Maximaler Zeitraum: 62 Tage', 'error'); return; }

          setSwapLoading(true);
          try {
            const res = await api.swapShifts({ employee_id_1: swapEmp1 as number, employee_id_2: swapEmp2 as number, dates });
            showToast(res.message || `${res.swapped_days} Tag(e) getauscht`, res.errors?.length ? 'warning' : 'success');
            closeSwap();
            window.dispatchEvent(new CustomEvent('sp5-reload-schedule'));
          } catch (e: any) {
            showToast(e.message || 'Fehler beim Tausch', 'error');
          } finally {
            setSwapLoading(false);
          }
        };

        const emp1 = employees.find(e => e.ID === swapEmp1);
        const emp2 = employees.find(e => e.ID === swapEmp2);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeSwap}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">🔄 Schicht-Tausch</h2>
                <button onClick={closeSwap} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Alle Schichteinträge der zwei Mitarbeiter im gewählten Zeitraum werden gegenseitig getauscht.
              </p>

              {/* Employee selects */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mitarbeiter A</label>
                  <select
                    className="w-full border rounded-lg p-2 text-sm focus:outline-blue-400"
                    value={swapEmp1}
                    onChange={e => setSwapEmp1(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">– wählen –</option>
                    {employees.map(e => (
                      <option key={e.ID} value={e.ID}>{e.SHORTNAME || e.FIRSTNAME} {e.NAME}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mitarbeiter B</label>
                  <select
                    className="w-full border rounded-lg p-2 text-sm focus:outline-blue-400"
                    value={swapEmp2}
                    onChange={e => setSwapEmp2(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">– wählen –</option>
                    {employees.map(e => (
                      <option key={e.ID} value={e.ID}>{e.SHORTNAME || e.FIRSTNAME} {e.NAME}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview arrow */}
              {emp1 && emp2 && (
                <div className="flex items-center justify-center gap-3 mb-4 text-sm font-medium text-gray-700">
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full">{emp1.SHORTNAME || emp1.FIRSTNAME}</span>
                  <span className="text-gray-400 text-lg">⇄</span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full">{emp2.SHORTNAME || emp2.FIRSTNAME}</span>
                </div>
              )}

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Von</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg p-2 text-sm focus:outline-blue-400"
                    value={swapDateFrom}
                    onChange={e => setSwapDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bis</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg p-2 text-sm focus:outline-blue-400"
                    value={swapDateTo}
                    min={swapDateFrom}
                    onChange={e => setSwapDateTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeSwap}
                  className="flex-1 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSwap}
                  disabled={swapLoading || !swapEmp1 || !swapEmp2 || !swapDateFrom || !swapDateTo || swapEmp1 === swapEmp2}
                  className="flex-1 px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {swapLoading ? '⏳ Tausche…' : '🔄 Tauschen'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* ── Schicht-Empfehlung Modal ── */}
      {showRecommendations && (() => {
        // Analyse: aktueller Monat, alle Tage
        const daysInMonth = getDaysInMonth(year, month);
        const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        // Für jeden MA: Wie viele Schichten hat er diesen Monat?
        const empShiftCount = new Map<number, number>();
        const empLastShifts = new Map<number, number[]>(); // shift IDs used (for suggestion)
        for (const emp of displayEmployees) {
          let count = 0;
          const shiftIds: number[] = [];
          for (const day of allDays) {
            const entry = entryMap.get(`${emp.ID}-${day}`);
            if (entry?.kind === 'shift' && entry.shift_id) {
              count++;
              shiftIds.push(entry.shift_id);
            }
          }
          empShiftCount.set(emp.ID, count);
          empLastShifts.set(emp.ID, shiftIds);
        }

        // Durchschnitt berechnen
        const counts = [...empShiftCount.values()];
        const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;

        // Empfehle MAs die unter dem Durchschnitt liegen
        const recommendations: Array<{
          emp: Employee;
          currentCount: number;
          suggestedShift: ShiftType | null;
          suggestedDays: number[];
        }> = [];

        const activeShiftsList = shifts.filter(s => !s.HIDE);

        for (const emp of displayEmployees) {
          const count = empShiftCount.get(emp.ID) ?? 0;
          if (count >= Math.ceil(avg)) continue; // already at/above average

          // Find most frequent shift for this employee
          const shiftIds = empLastShifts.get(emp.ID) ?? [];
          const freq = new Map<number, number>();
          for (const id of shiftIds) freq.set(id, (freq.get(id) ?? 0) + 1);
          let suggestedShift: ShiftType | null = null;
          if (freq.size > 0) {
            const bestId = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
            suggestedShift = activeShiftsList.find(s => s.ID === bestId) ?? null;
          }
          if (!suggestedShift && activeShiftsList.length > 0) {
            suggestedShift = activeShiftsList[0];
          }

          // Find free weekdays to suggest
          const suggestedDays: number[] = [];
          for (const day of allDays) {
            if (suggestedDays.length >= 3) break;
            const entry = entryMap.get(`${emp.ID}-${day}`);
            if (!entry) {
              const wd = getWeekday(year, month, day);
              if (wd !== 0 && wd !== 6) suggestedDays.push(day);
            }
          }

          recommendations.push({ emp, currentCount: count, suggestedShift, suggestedDays });
        }

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowRecommendations(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-xl">
                <div>
                  <h2 className="text-base font-bold text-gray-800">💡 Schicht-Empfehlungen</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Mitarbeiter unter Ø ({avg.toFixed(1)} Schichten) · {MONTH_NAMES[month]} {year}
                  </p>
                </div>
                <button
                  onClick={() => setShowRecommendations(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >×</button>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                {recommendations.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="font-medium text-gray-600">Alle gut ausgelastet!</p>
                    <p className="text-sm mt-1">Kein Mitarbeiter liegt deutlich unter dem Durchschnitt.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recommendations.map(({ emp, currentCount, suggestedShift, suggestedDays }) => (
                      <div key={emp.ID} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800 text-sm">
                              {emp.FIRSTNAME} {emp.NAME}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {currentCount} Schichten (Ø {avg.toFixed(1)}) · fehlen ~{Math.ceil(avg) - currentCount}
                            </div>
                            {suggestedShift && suggestedDays.length > 0 && (
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-gray-600">Empfehle</span>
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
                                  style={{ backgroundColor: suggestedShift.COLORBK_HEX, color: suggestedShift.COLORTEXT_HEX }}
                                >
                                  {suggestedShift.SHORTNAME}
                                </span>
                                <span className="text-xs text-gray-500">an freien Werktagen:</span>
                                <div className="flex gap-1 flex-wrap">
                                  {suggestedDays.map(day => (
                                    <button
                                      key={day}
                                      onClick={async () => {
                                        if (suggestedShift) {
                                          await handleAddShift(emp.ID, day, suggestedShift.ID);
                                          setShowRecommendations(false);
                                        }
                                      }}
                                      className="px-2 py-0.5 bg-white border border-amber-300 rounded text-xs font-medium text-amber-700 hover:bg-amber-100 hover:border-amber-500 transition-colors"
                                      title={`${suggestedShift.SHORTNAME} am ${day}.${month}.${year} zuweisen`}
                                    >
                                      {day}.
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div
                              className="text-xs font-bold px-2 py-1 rounded-full"
                              style={{
                                backgroundColor: currentCount < avg * 0.5 ? '#fef2f2' : '#fef9c3',
                                color: currentCount < avg * 0.5 ? '#dc2626' : '#92400e',
                              }}
                            >
                              {currentCount}×
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-5 py-3 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
                <span className="text-xs text-gray-400">
                  {recommendations.length} Mitarbeiter unter Durchschnitt
                </span>
                <button
                  onClick={() => setShowRecommendations(false)}
                  className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h1 className="text-lg sm:text-xl font-bold text-gray-800">📅 Dienstplan</h1>

        {/* Month navigation */}
        <div className="flex items-center gap-1.5">
          <button onClick={prevMonth} className="px-2 py-1.5 bg-white border rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] min-w-[44px]">‹</button>
          <span className="font-semibold text-gray-700 min-w-[120px] sm:min-w-[140px] text-center text-sm">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="px-2 py-1.5 bg-white border rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-sm min-h-[44px] min-w-[44px]">›</button>
        </div>

        {/* Mobile: Week navigation — only shown on small screens */}
        {isMobile && (
          <div className="flex items-center gap-1.5 sm:hidden">
            <button
              onClick={prevWeek}
              className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded shadow-sm hover:bg-indigo-100 text-sm min-h-[44px] min-w-[44px] text-indigo-700"
              title="Vorherige Woche" aria-label="Vorherige Woche"
            >‹</button>
            <span className="font-medium text-indigo-700 text-sm min-w-[140px] text-center bg-indigo-50 border border-indigo-200 rounded px-2 py-1.5">
              📅 {mobileWeekData.label}
            </span>
            <button
              onClick={nextWeek}
              className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded shadow-sm hover:bg-indigo-100 text-sm min-h-[44px] min-w-[44px] text-indigo-700"
              title="Nächste Woche" aria-label="Nächste Woche"
            >›</button>
          </div>
        )}

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

        {(loading || saving) && (
          <span className="text-sm text-blue-500 animate-pulse">
            {saving ? 'Speichere...' : 'Lade...'}
          </span>
        )}

        {/* Action buttons - right aligned, wrap on mobile */}
        <div className="no-print flex items-center gap-1 ml-auto flex-wrap">
          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="px-2 py-1.5 bg-white border rounded shadow-sm text-xs sm:text-sm flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed min-h-[32px]"
            title={`Rückgängig (Ctrl+Z) — ${undoStack.length} Einträge`}
          >
            ↩ <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="px-2 py-1.5 bg-white border rounded shadow-sm text-xs sm:text-sm flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed min-h-[32px]"
            title={`Wiederholen (Ctrl+Y) — ${redoStack.length} Einträge`}
          >
            ↪ <span className="hidden sm:inline">Redo</span>
          </button>

          {/* Vormonat kopieren button */}
          <button
            onClick={() => setShowCopyPrevMonth(true)}
            className="px-2 sm:px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm rounded shadow-sm flex items-center gap-1 min-h-[32px]"
            title="Schichten des Vormonats als Vorlage übernehmen"
          >
            📅 <span className="hidden sm:inline">Vormonat</span>
          </button>

          {/* Woche kopieren button */}
          <button
            onClick={() => { setCopyWeekSource(displayEmployees[0]?.ID ?? ''); setCopyWeekTargets(new Set()); setShowCopyWeek(true); }}
            className="px-2 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm rounded shadow-sm flex items-center gap-1 min-h-[32px]"
            title="Schichtwoche eines Mitarbeiters auf andere übertragen"
          >
            📋 <span className="hidden sm:inline">Woche kopieren</span>
          </button>

          {/* Schicht-Tausch button */}
          <button
            onClick={() => {
              const today = new Date();
              const y = today.getFullYear(), m = today.getMonth();
              const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
              const lastDay = new Date(y, m + 1, 0);
              const lastDayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
              setSwapEmp1(displayEmployees[0]?.ID ?? '');
              setSwapEmp2(displayEmployees[1]?.ID ?? '');
              setSwapDateFrom(firstDay);
              setSwapDateTo(lastDayStr);
              setShowSwap(true);
            }}
            className="px-2 sm:px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm rounded shadow-sm flex items-center gap-1 min-h-[32px]"
            title="Schichten zweier Mitarbeiter für einen Zeitraum tauschen"
          >
            🔄 <span className="hidden sm:inline">Tausch</span>
          </button>

          {/* Schicht-Empfehlung button */}
          <button
            onClick={() => setShowRecommendations(true)}
            className="px-2 sm:px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm rounded shadow-sm flex items-center gap-1 min-h-[32px]"
            title="Mitarbeiter mit wenig Schichten anzeigen und Empfehlungen erhalten"
          >
            💡 <span className="hidden sm:inline">Empfehlungen</span>
          </button>

          {/* Wochenvorlagen button */}
          <button
            onClick={() => setShowWeekTemplates(true)}
            className="px-2 sm:px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs sm:text-sm rounded shadow-sm flex items-center gap-1 min-h-[32px]"
            title="Wochenmuster als Vorlage speichern und auf diesen Monat anwenden"
          >
            📐 <span className="hidden sm:inline">Vorlagen</span>
          </button>

          {/* Auto-Planen button */}
          <button
            onClick={() => setShowAutoPlan(true)}
            className="px-2 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded shadow-sm flex items-center gap-1 min-h-[32px]"
            title="Dienstplan aus Schichtmodellen automatisch befüllen"
          >
            🤖 <span className="hidden sm:inline">Auto-Planen</span>
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
                year, month, MONTH_NAMES[month], groupLabel, shifts,
              );
              openPrintWindow(html);
            }}
            className="px-2 sm:px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs sm:text-sm rounded shadow-sm flex items-center gap-1 min-h-[32px]"
            title="Dienstplan drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>

          {/* Keyboard help button */}
          <button
            onClick={() => setShowKbHelp(h => !h)}
            className="px-2 py-1.5 bg-white border rounded shadow-sm text-xs sm:text-sm flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[32px]"
            title="Tastaturkürzel anzeigen (?)"
          >
            ⌨️
          </button>

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(m => !m)}
              className="px-2 sm:px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm rounded shadow-sm flex items-center gap-1 min-h-[32px]"
            >
              ⬇ <span className="hidden sm:inline">Export</span>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[160px] py-1">
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    exportCSV(displayEmployees, days, entryMap, year, month);
                    setShowExportMenu(false);
                  }}
                >
                  📄 CSV exportieren
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    exportHTML(displayEmployees, days, entryMap, holidays, year, month, MONTH_NAMES[month], shifts);
                    setShowExportMenu(false);
                  }}
                >
                  🖨 HTML / Drucken
                </button>
              </div>
            )}
          </div>
        </div>
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
            ref={searchInputRef}
            type="text"
            value={employeeSearch}
            onChange={e => setEmployeeSearch(e.target.value)}
            placeholder="🔍 Suchen... (Strg+F)"
            className="text-xs px-2 py-1 border rounded bg-white w-44"
            onKeyDown={e => { if (e.key === 'Escape') { setEmployeeSearch(''); e.currentTarget.blur(); } }}
          />
          {employeeSearch && (
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setEmployeeSearch('')} title="Suche löschen">×</button>
          )}
        </div>

        {/* Alphabet quick filter — hidden on mobile to save space */}
        <div className="hidden sm:flex items-center gap-1 flex-wrap">
          {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map(letter => {
            const available = availableLetters.has(letter);
            const active = filterLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => setFilterLetter(active ? '' : letter)}
                disabled={!available}
                title={available ? `Mitarbeiter mit ${letter}` : 'Kein Mitarbeiter'}
                className={[
                  'w-5 h-5 text-[10px] font-semibold rounded transition-all select-none',
                  active
                    ? 'bg-blue-600 text-white shadow-sm scale-110'
                    : available
                      ? 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 cursor-pointer'
                      : 'bg-transparent text-gray-300 cursor-default',
                ].join(' ')}
              >
                {letter}
              </button>
            );
          })}
          {filterLetter && (
            <button
              onClick={() => setFilterLetter('')}
              className="ml-1 text-xs text-blue-500 hover:text-blue-700 font-medium"
              title="Buchstabenfilter zurücksetzen"
            >
              ×
            </button>
          )}
        </div>

        {/* Employee sort */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">Sortierung:</label>
          <select
            value={employeeSort}
            onChange={e => setEmployeeSort(e.target.value as typeof employeeSort)}
            className="text-xs px-2 py-1 border rounded bg-white"
            title="Mitarbeiterliste sortieren"
          >
            <option value="position">Reihenfolge ↕</option>
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
            <option value="number-asc">Nummer ↑</option>
            <option value="number-desc">Nummer ↓</option>
          </select>
        </div>

        {/* Workload bars toggle */}
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-500" title="Stunden-Auslastung pro Mitarbeiter anzeigen">
            <input
              type="checkbox"
              checked={showWorkloadBars}
              onChange={e => setShowWorkloadBars(e.target.checked)}
              className="rounded"
            />
            📊 Auslastung
          </label>
        </div>

        {/* Terminated employee toggle */}
        <div className="flex items-center gap-1.5 ml-auto">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-500">
            <input
              type="checkbox"
              checked={showTerminated}
              onChange={e => setShowTerminated(e.target.checked)}
              className="rounded"
            />
            Ausgeschiedene anzeigen
          </label>
        </div>

        {/* Reset filters */}
        {(filterShiftId !== '' || filterLeaveId !== '' || employeeSearch !== '' || filterLetter !== '') && (
          <button
            className="text-xs px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
            onClick={() => { setFilterShiftId(''); setFilterLeaveId(''); setEmployeeSearch(''); setFilterLetter(''); }}
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
          <button
            className="ml-auto px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
            onClick={() => navigate('/konflikte')}
          >
            ⚠️ Konflikte bereinigen
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
            className="bg-white rounded-xl shadow-2xl border border-gray-200 p-5 max-w-xl w-full max-h-[80vh] flex flex-col"
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
              {conflicts.map((c, i) => {
                const shiftKey = `shift-${c.employee_id}-${c.date}`;
                const absKey = `abs-${c.employee_id}-${c.date}`;
                const shiftState = conflictActionState[shiftKey] ?? 'idle';
                const absState = conflictActionState[absKey] ?? 'idle';
                const handleConflictDelete = async (type: 'shift' | 'absence') => {
                  const key = type === 'shift' ? shiftKey : absKey;
                  setConflictActionState(s => ({ ...s, [key]: 'loading' }));
                  try {
                    if (type === 'shift') {
                      await api.deleteScheduleEntry(c.employee_id, c.date);
                    } else {
                      await api.deleteAbsence(c.employee_id, c.date);
                    }
                    setConflictActionState(s => ({ ...s, [key]: 'done' }));
                    setTimeout(() => loadSchedule(), 300);
                  } catch {
                    setConflictActionState(s => ({ ...s, [key]: 'error' }));
                    setTimeout(() => setConflictActionState(s => ({ ...s, [key]: 'idle' })), 3000);
                  }
                };
                return (
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="mr-2">
                          {c.type === 'shift_and_absence' ? '🔴' : c.type === 'holiday_ban' ? '🟡' : '🟠'}
                        </span>
                        {c.message}
                        <span className="ml-2 text-xs opacity-60">
                          [{c.type === 'shift_and_absence' ? 'Schicht+Abwesenheit' : c.type === 'holiday_ban' ? 'Urlaubssperre' : 'Unterbesetzung'}]
                        </span>
                      </div>
                      {c.type === 'shift_and_absence' && (
                        <div className="flex gap-1 flex-shrink-0 mt-0.5">
                          <button
                            onClick={() => handleConflictDelete('shift')}
                            disabled={shiftState === 'loading' || shiftState === 'done'}
                            className={`px-2 py-0.5 text-xs rounded font-medium whitespace-nowrap ${
                              shiftState === 'done' ? 'bg-green-100 text-green-700' :
                              shiftState === 'loading' ? 'bg-gray-200 text-gray-500 cursor-wait' :
                              shiftState === 'error' ? 'bg-red-200 text-red-700' :
                              'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {shiftState === 'done' ? '✓' : shiftState === 'loading' ? '…' : '🗑 Schicht'}
                          </button>
                          <button
                            onClick={() => handleConflictDelete('absence')}
                            disabled={absState === 'loading' || absState === 'done'}
                            className={`px-2 py-0.5 text-xs rounded font-medium whitespace-nowrap ${
                              absState === 'done' ? 'bg-green-100 text-green-700' :
                              absState === 'loading' ? 'bg-gray-200 text-gray-500 cursor-wait' :
                              absState === 'error' ? 'bg-red-200 text-red-700' :
                              'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                          >
                            {absState === 'done' ? '✓' : absState === 'loading' ? '…' : '🗑 Abwesenheit'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                onClick={() => { setShowConflictModal(false); navigate('/konflikte'); }}
              >
                ⚠️ Alle Konflikte verwalten
              </button>
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

      {/* ── Keyboard Help Modal ── */}
      {showKbHelp && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40"
          onClick={() => setShowKbHelp(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 p-5 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
                ⌨️ Tastaturkürzel — Keyboard Power-Mode
              </h2>
              <button className="text-gray-400 hover:text-gray-600 text-xl leading-none" onClick={() => setShowKbHelp(false)}>×</button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Navigation</h3>
                <div className="space-y-1">
                  {[
                    ['↑ ↓ ← →', 'Zwischen Zellen navigieren'],
                    ['Escape', 'Auswahl aufheben / Overlays schließen'],
                    ['Ctrl+F', 'Mitarbeiter-Suche fokussieren'],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex items-center gap-2">
                      <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono min-w-[80px] text-center">{key}</kbd>
                      <span className="text-gray-600">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Aktionen</h3>
                <div className="space-y-1">
                  {[
                    ['Enter', 'Schicht-Picker öffnen'],
                    ['Del / Backspace', 'Eintrag löschen'],
                    ['Ctrl+Z', 'Rückgängig'],
                    ['Ctrl+Y', 'Wiederholen'],
                    ['?', 'Dieses Hilfe-Overlay öffnen'],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex items-center gap-2">
                      <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono min-w-[80px] text-center">{key}</kbd>
                      <span className="text-gray-600">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              {shifts.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Buchstaben-Shortcuts (Schicht zuweisen)</h3>
                  <div className="space-y-1">
                    {shifts.map(s => {
                      const letter = s.SHORTNAME?.[0]?.toUpperCase();
                      if (!letter) return null;
                      return (
                        <div key={s.ID} className="flex items-center gap-2">
                          <kbd className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs font-mono min-w-[80px] text-center text-blue-700">{letter}</kbd>
                          <span className="text-gray-600">{s.SHORTNAME} – {s.NAME}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Tipp: Zelle auswählen, dann Buchstaben drücken um Schicht direkt zuzuweisen.</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t text-right">
              <button
                className="px-4 py-1.5 bg-gray-100 rounded hover:bg-gray-200 text-sm"
                onClick={() => setShowKbHelp(false)}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Action Toolbar ── */}
      {selection && (
        <div className="overflow-x-auto mb-2 no-print">
        <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm text-xs flex-wrap min-w-[480px]">
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
            className="ml-auto px-2 py-1 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ✕ Auswahl aufheben
          </button>
        </div>
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
              {displayedDays.map(day => {
                const wd = getWeekday(year, month, day);
                const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                const isHol = holidays.has(dateStr);
                const isWe = wd === 0 || wd === 6;
                const isToday = day === todayDay;
                const cov = coverageMap.get(day);
                const coverageDot = cov
                  ? cov.status === 'ok'
                    ? { color: '#4ade80', label: '🟢' }
                    : cov.status === 'low'
                    ? { color: '#fbbf24', label: '🟡' }
                    : { color: '#f87171', label: '🔴' }
                  : null;
                const coverageTitle = cov
                  ? `${cov.scheduled_count}/${cov.required_count} Mitarbeiter besetzt`
                  : '';
                const thTitle = [
                  isHol ? `Feiertag · ${dateStr}` : isToday ? `Heute · ${dateStr}` : dateStr,
                  coverageTitle,
                ].filter(Boolean).join(' · ');
                return (
                  <th
                    key={day}
                    className={`px-0.5 py-1 text-center min-w-[34px] border-r border-slate-600 ${
                      isHol ? 'bg-red-700' : isToday ? 'bg-blue-500' : isWe ? 'bg-slate-600' : ''
                    }`}
                    title={thTitle}
                  >
                    <div className="font-bold">{day}</div>
                    <div className="text-slate-300 text-[10px]">{WEEKDAY_ABBR[wd]}</div>
                    {isHol && <div className="text-yellow-300 text-[8px] leading-none">★</div>}
                    {isToday && !isHol && <div className="text-blue-200 text-[8px] leading-none">●</div>}
                    {coverageDot && (
                      <div
                        className="mx-auto mt-0.5 rounded-full"
                        title={coverageTitle}
                        style={{
                          width: '6px',
                          height: '6px',
                          backgroundColor: coverageDot.color,
                          boxShadow: `0 0 3px ${coverageDot.color}`,
                        }}
                      />
                    )}
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
              {displayedDays.map(day => {
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
                  <tr key={`grp-${row.groupId}`} className="bg-blue-50 dark:bg-blue-900/20">
                    <td
                      colSpan={displayedDays.length + 1}
                      className="sticky left-0 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
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
                  <td
                    className="sticky left-0 z-10 bg-inherit px-3 py-1 border-r border-gray-200 border-b border-b-gray-100 font-medium whitespace-nowrap cursor-pointer select-none"
                    style={highlightedEmpId === emp.ID
                      ? { ...(empNameStyle || {}), outline: '2px solid #0ea5e9', outlineOffset: '-2px', backgroundColor: empNameStyle?.backgroundColor ?? '#e0f2fe' }
                      : empNameStyle}
                    title="Klicken zum Hervorheben aller Schichten dieses Mitarbeiters"
                    onClick={() => setHighlightedEmpId(id => id === emp.ID ? null : emp.ID)}
                  >
                    {(() => {
                      // Birthday indicator: 🎂 if employee's birthday is in the current display month
                      const hasBirthdayThisMonth = emp.BIRTHDAY
                        ? (() => { try { return new Date(emp.BIRTHDAY!).getMonth() + 1 === month; } catch { return false; } })()
                        : false;
                      const birthdayDate = hasBirthdayThisMonth && emp.BIRTHDAY
                        ? new Date(emp.BIRTHDAY).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })
                        : '';
                      const wl = workloadMap.get(emp.ID);
                      const wlPct = wl && wl.target > 0 ? Math.min(100, Math.round((wl.actual / wl.target) * 100)) : null;
                      const wlColor = wlPct === null ? '#94a3b8'
                        : wlPct >= 95 ? '#22c55e'
                        : wlPct >= 70 ? '#f59e0b'
                        : '#ef4444';
                      const wlTitle = wl ? `${wl.actual}h / ${wl.target}h (${wlPct ?? '?'}%)` : '';
                      return (
                        <>
                          {emp.BOLD === 1
                            ? <strong>{emp.NAME}, {emp.FIRSTNAME}</strong>
                            : <>{emp.NAME}, {emp.FIRSTNAME}</>}
                          {hasBirthdayThisMonth && (
                            <span
                              className="ml-1 text-sm cursor-default"
                              title={`🎂 Geburtstag: ${birthdayDate}`}
                            >🎂</span>
                          )}
                          {showWorkloadBars && wl && (
                            <div className="mt-0.5" title={wlTitle}>
                              <div className="flex items-center gap-1">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden" style={{ minWidth: 48 }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{ width: `${wlPct ?? 0}%`, backgroundColor: wlColor }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono tabular-nums" style={{ color: wlColor, minWidth: 32 }}>
                                  {wl.actual}h
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  {displayedDays.map(day => {
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

                    // Wish indicator for this cell
                    const wishType = wishMap.get(`${emp.ID}-${dateStr}`);

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
                    const isToday = day === todayDay;
                    const isEmpHighlighted = highlightedEmpId !== null && highlightedEmpId === emp.ID;
                    const isOtherEmpDimmed = highlightedEmpId !== null && highlightedEmpId !== emp.ID;
                    return (
                      <td
                        key={day}
                        className={`border border-gray-100 p-0 text-center relative group`}
                        draggable={!!entry}
                        style={{
                          backgroundColor: isDndTgt
                            ? (isDark ? '#1e3a5f' : '#bfdbfe')
                            : isSelected
                            ? (isDark ? '#1e3060' : '#dbeafe')
                            : (entry?.color_bk || (isHol
                                ? (isDark ? '#2d1212' : '#fef2f2')
                                : isToday
                                ? (isDark ? '#0d1f3c' : '#eff6ff')
                                : isWe
                                ? (isDark ? '#1a2535' : '#f8fafc')
                                : (isDark ? undefined : undefined))),
                          outline: isDndTgt
                            ? '2px solid #1d4ed8'
                            : isDndSrc
                            ? '2px dashed #6b7280'
                            : isCursor
                            ? '2px solid #1d4ed8'
                            : isSelected
                            ? '2px solid #2563eb'
                            : isEmpHighlighted && entry
                            ? '2px solid #0ea5e9'
                            : isToday && !hasConflict && !isFilterMatch
                            ? '2px solid #93c5fd'
                            : (hasConflict ? '2px solid #ef4444' : isFilterMatch ? '2px solid #3b82f6' : undefined),
                          outlineOffset: '-2px',
                          opacity: isDndSrc ? 0.5 : isOtherEmpDimmed ? 0.35 : 1,
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
                            {/* Wish / Sperrtag indicator */}
                            {wishType && (
                              <span
                                className="absolute bottom-0 left-0 text-[7px] leading-none z-10 cursor-help"
                                title={wishType === 'WUNSCH' ? 'Schicht-Wunsch eingetragen' : 'Sperrtag eingetragen'}
                              >
                                {wishType === 'WUNSCH' ? '🟢' : '🔴'}
                              </span>
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
                            {/* Wish / Sperrtag indicator for empty cells */}
                            {wishType && (
                              <span
                                className="absolute bottom-0 left-0 text-[7px] leading-none z-10 cursor-help"
                                title={wishType === 'WUNSCH' ? 'Schicht-Wunsch eingetragen' : 'Sperrtag eingetragen'}
                              >
                                {wishType === 'WUNSCH' ? '🟢' : '🔴'}
                              </span>
                            )}
                            {canEditSchedule && (
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
                            )}
                          </div>
                        )}

                        {/* Shift picker popup — only for users who can edit */}
                        {isPickerOpen && canEditSchedule && (
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
                <td colSpan={displayedDays.length + 1} className="text-center py-8 text-gray-400">
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
                {displayedDays.map(day => {
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
        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">● Heute</span>
        <span className="text-xs px-2 py-0.5 bg-slate-200 rounded">Wochenende</span>
        <span className="text-xs px-2 py-0.5 bg-red-100 rounded">★ Feiertag</span>
        <span className="text-xs px-2 py-0.5 text-green-600 bg-green-50 rounded">■ ≥80%</span>
        <span className="text-xs px-2 py-0.5 text-amber-600 bg-amber-50 rounded">■ 50–79%</span>
        <span className="text-xs px-2 py-0.5 text-red-600 bg-red-50 rounded">■ &lt;50%</span>
      </div>
      {/* ── Shift Color Legend ── */}
      {shifts.filter(s => !s.HIDE).length > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500">Schichten:</span>
          {shifts.filter(s => !s.HIDE).map(s => (
            <span
              key={s.ID}
              className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-black/10"
              style={{ backgroundColor: s.COLORBK_HEX || '#e5e7eb', color: s.COLORTEXT_HEX || '#111' }}
              title={s.NAME}
            >
              {s.SHORTNAME}
            </span>
          ))}
          <span className="hidden sm:inline text-xs text-gray-400 ml-2">
            Hover → Tooltip · Drag &amp; Drop (Alt=Kopieren) · Pfeiltasten → Navigation · Del → Löschen · Enter → Schicht · Ctrl+Z/Y → Undo/Redo
          </span>
        </div>
      )}


      {/* ── Hover Tooltip ── */}
      {hoverTooltip && (() => {
        const tooltipEntry = entryMap.get(`${hoverTooltip.empId}-${hoverTooltip.day}`) ?? null;
        const tooltipShift = tooltipEntry?.shift_id
          ? (shifts.find(s => s.ID === tooltipEntry.shift_id) ?? null)
          : null;

        // ── Schicht-Statistik berechnen ──────────────────────
        let monthCount: number | undefined;
        let colleaguesWithSameShift: string[] | undefined;
        if (tooltipEntry?.kind === 'shift' && tooltipEntry.shift_id != null) {
          // Count: how many times this shift for this employee this month
          monthCount = entries.filter(
            e => e.employee_id === hoverTooltip.empId && e.shift_id === tooltipEntry.shift_id
          ).length;
          // Colleagues: other employees with same shift today
          const todayStr = `${year}-${pad(month)}-${pad(hoverTooltip.day)}`;
          colleaguesWithSameShift = entries
            .filter(e =>
              e.employee_id !== hoverTooltip.empId &&
              e.shift_id === tooltipEntry.shift_id &&
              e.date === todayStr
            )
            .map(e => {
              const emp = employees.find(x => x.ID === e.employee_id);
              return emp ? `${emp.NAME}, ${emp.FIRSTNAME}` : `MA ${e.employee_id}`;
            });
        }

        return (
          <HoverTooltip
            state={hoverTooltip}
            emp={employees.find(e => e.ID === hoverTooltip.empId) ?? null}
            entry={tooltipEntry}
            dateStr={`${year}-${pad(month)}-${pad(hoverTooltip.day)}`}
            cellConflicts={conflictMap.get(`${hoverTooltip.empId}_${year}-${pad(month)}-${pad(hoverTooltip.day)}`) ?? []}
            shift={tooltipShift}
            monthCount={monthCount}
            colleaguesWithSameShift={colleaguesWithSameShift}
          />
        );
      })()}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
