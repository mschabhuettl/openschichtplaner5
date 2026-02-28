import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Note } from '../api/client';
import type { Employee, Group } from '../types';
import { useToast } from '../hooks/useToast';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';

const WEEKDAY_ABBR = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Get days in a month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// JS weekday (0=Sun) → Mon-based index (0=Mon..6=Sun)
function firstDayOffset(year: number, month: number): number {
  const d = new Date(year, month - 1, 1).getDay();
  return (d + 6) % 7; // 0=Mon
}

interface NoteModalProps {
  open: boolean;
  initialDate?: string;
  initialNote?: Note | null;
  employees: Employee[];
  onSave: (data: { date: string; text: string; text2: string; employee_id: number }) => Promise<void>;
  onClose: () => void;
}

function NoteModal({ open, initialDate, initialNote, employees, onSave, onClose }: NoteModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initialDate || today);
  const [text, setText] = useState('');
  const [text2, setText2] = useState('');
  const [empId, setEmpId] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(initialNote?.date || initialDate || today);
      setText(initialNote?.text1 || '');
      setText2(initialNote?.text2 || '');
      setEmpId(initialNote?.employee_id ?? 0);
      setError(null);
    }
  }, [open, initialNote, initialDate]);

  if (!open) return null;

  const handleSave = async () => {
    if (!text.trim()) { setError('Notiztext darf nicht leer sein.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ date, text: text.trim(), text2: text2.trim(), employee_id: empId });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          {initialNote ? '✏️ Notiz bearbeiten' : '📝 Neue Notiz'}
        </h2>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mitarbeiter (optional)</label>
            <select
              value={empId}
              onChange={e => setEmpId(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>– Allgemein (kein Bezug) –</option>
              {employees.map(emp => (
                <option key={emp.ID} value={emp.ID}>
                  {emp.NAME}, {emp.FIRSTNAME}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notiz</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              placeholder="Notiztext eingeben..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ergänzung (optional)</label>
            <input
              type="text"
              value={text2}
              onChange={e => setText2(e.target.value)}
              placeholder="Weitere Info..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface NoteCardProps {
  note: Note;
  employeeName: string;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  canEdit?: boolean;
}

function NoteCard({ note, employeeName, onEdit, onDelete, canEdit = true }: NoteCardProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 group relative">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {employeeName && (
            <div className="text-xs font-medium text-blue-700 mb-1">👤 {employeeName}</div>
          )}
          <div className="text-sm text-slate-800 break-words">{note.text1}</div>
          {note.text2 && (
            <div className="text-xs text-slate-500 mt-1 break-words">{note.text2}</div>
          )}
        </div>
        {canEdit && (
        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(note)}
            title="Bearbeiten"
            className="p-1 rounded hover:bg-yellow-200 text-slate-600 hover:text-slate-800 text-xs"
          >
            ✏️
          </button>
          <button
            onClick={() => onDelete(note)}
            title="Löschen"
            className="p-1 rounded hover:bg-red-100 text-slate-600 hover:text-red-600 text-xs"
          >
            🗑️
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

export default function Notizen() {
  const today = new Date();
  const { canEditSchedule: canEdit } = usePermissions();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [notes, setNotes] = useState<Note[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterEmpId, setFilterEmpId] = useState<number>(0);
  const [filterGroupId, setFilterGroupId] = useState<number>(0);
  const [groupMembers, setGroupMembers] = useState<Set<number>>(new Set());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [modalDate, setModalDate] = useState<string>('');
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();

  const monthPrefix = `${year}-${pad(month)}`;

  const loadNotes = useCallback(() => {
    setLoading(true);
    api.getNotes().then(all => {
      setNotes(all.filter(n => n.date && String(n.date).startsWith(monthPrefix)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [monthPrefix]);

  useEffect(() => {
    api.getEmployees().then(setEmployees).catch(() => {});
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    if (filterGroupId > 0) {
      api.getGroupMembers(filterGroupId).then(members => {
        setGroupMembers(new Set(members.map(m => m.ID)));
      }).catch(() => setGroupMembers(new Set()));
    } else {
      setGroupMembers(new Set());
    }
  }, [filterGroupId]);

  // Build notes map: date → Note[]
  const notesMap = new Map<string, Note[]>();
  for (const note of notes) {
    const key = note.date;
    if (!notesMap.has(key)) notesMap.set(key, []);
    notesMap.get(key)!.push(note);
  }

  // Filter notes by employee/group
  const filteredNotes = (day: string) => {
    const dayNotes = notesMap.get(day) ?? [];
    return dayNotes.filter(n => {
      if (filterEmpId > 0 && n.employee_id !== filterEmpId && n.employee_id !== 0) return false;
      if (filterGroupId > 0 && n.employee_id !== 0 && !groupMembers.has(n.employee_id)) return false;
      return true;
    });
  };

  // Calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const offset = firstDayOffset(year, month);
  const totalCells = Math.ceil((daysInMonth + offset) / 7) * 7;

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const empMap = new Map(employees.map(e => [e.ID, e]));

  const openCreate = (day: string) => {
    setEditNote(null);
    setModalDate(day);
    setModalOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditNote(note);
    setModalDate(note.date);
    setModalOpen(true);
  };

  const handleDelete = async (note: Note) => {
    if (!await confirmDialog({ message: `Notiz vom ${note.date} löschen?`, danger: true })) return;
    try {
      await api.deleteNote(note.id);
      showToast('Notiz gelöscht', 'success');
      loadNotes();
    } catch {
      showToast('Fehler beim Löschen der Notiz', 'error');
    }
  };

  const handleSave = async (data: { date: string; text: string; text2: string; employee_id: number }) => {
    try {
      if (editNote) {
        await api.updateNote(editNote.id, {
          text: data.text,
          text2: data.text2,
          employee_id: data.employee_id,
          date: data.date,
        });
        showToast('Notiz gespeichert ✓', 'success');
      } else {
        await api.addNote(data.date, data.text, data.employee_id, data.text2);
        showToast('Notiz erstellt ✓', 'success');
      }
      loadNotes();
    } catch {
      showToast('Fehler beim Speichern der Notiz', 'error');
    }
  };

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // All notes for list view (selected day)
  const selectedDayNotes = selectedDay ? filteredNotes(selectedDay) : [];

  // All notes for the month, sorted, for the list panel
  const allMonthNotes = notes
    .filter(n => {
      if (filterEmpId > 0 && n.employee_id !== filterEmpId && n.employee_id !== 0) return false;
      if (filterGroupId > 0 && n.employee_id !== 0 && !groupMembers.has(n.employee_id)) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800">📝 Notizen</h1>
            {loading && <span className="text-xs text-slate-400 animate-pulse">Lädt...</span>}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Group filter */}
            <select
              value={filterGroupId}
              onChange={e => { setFilterGroupId(Number(e.target.value)); setFilterEmpId(0); }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Alle Gruppen</option>
              {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
            </select>

            {/* Employee filter */}
            <select
              value={filterEmpId}
              onChange={e => setFilterEmpId(Number(e.target.value))}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Alle Mitarbeiter</option>
              {employees
                .filter(e => filterGroupId === 0 || groupMembers.has(e.ID))
                .map(e => (
                  <option key={e.ID} value={e.ID}>{e.NAME}, {e.FIRSTNAME}</option>
                ))}
            </select>

            {/* New note button — hidden for Leser */}
            {canEdit && (
            <button
              onClick={() => openCreate(selectedDay || todayStr)}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
            >
              <span>＋</span> Neue Notiz
            </button>
            )}
            {/* Print button */}
            <button
              onClick={() => window.print()}
              className="no-print flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-lg"
              title="Seite drucken"
            >
              🖨️ <span className="hidden sm:inline">Drucken</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content: Calendar + Detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar */}
        <div className="flex-1 overflow-auto p-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 text-lg"
            >
              ‹
            </button>
            <h2 className="text-lg font-semibold text-slate-800">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 text-lg"
            >
              ›
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_ABBR.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: totalCells }).map((_, i) => {
              const dayNum = i - offset + 1;
              const isValid = dayNum >= 1 && dayNum <= daysInMonth;
              const ds = isValid ? dateStr(year, month, dayNum) : '';
              const dayNotes = isValid ? filteredNotes(ds) : [];
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDay;
              const wd = isValid ? new Date(year, month - 1, dayNum).getDay() : -1;
              const isWeekend = wd === 0 || wd === 6;

              return (
                <div
                  key={i}
                  onClick={() => isValid && setSelectedDay(isSelected ? null : ds)}
                  className={[
                    'min-h-[80px] rounded-lg p-1.5 cursor-pointer transition-all border text-sm',
                    !isValid ? 'bg-transparent border-transparent cursor-default' : '',
                    isValid && !isSelected && !isToday ? (isWeekend ? 'bg-slate-100 border-slate-200 hover:bg-slate-200' : 'bg-white border-slate-200 hover:bg-blue-50') : '',
                    isSelected ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300' : '',
                    isToday && !isSelected ? 'bg-blue-50 border-blue-300' : '',
                  ].join(' ')}
                >
                  {isValid && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${isToday ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-500'}`}>
                          {dayNum}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); openCreate(ds); }}
                          className="text-slate-300 hover:text-blue-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Notiz hinzufügen"
                        >
                          ＋
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {dayNotes.slice(0, 3).map(n => {
                          const emp = n.employee_id ? empMap.get(n.employee_id) : null;
                          return (
                            <div
                              key={n.id}
                              className="text-xs bg-yellow-100 border border-yellow-300 rounded px-1 py-0.5 truncate text-slate-700"
                              title={n.text1}
                            >
                              {emp ? `${emp.SHORTNAME}: ` : ''}{n.text1}
                            </div>
                          );
                        })}
                        {dayNotes.length > 3 && (
                          <div className="text-xs text-slate-400 pl-1">+{dayNotes.length - 3} weitere</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-80 border-l border-slate-200 bg-white flex flex-col flex-shrink-0 overflow-hidden">
          {selectedDay ? (
            <>
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">
                  📅 {new Date(selectedDay + 'T00:00:00').toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <button
                  onClick={() => openCreate(selectedDay)}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  ＋ Neu
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedDayNotes.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-8">
                    <div className="text-3xl mb-2">📭</div>
                    Keine Notizen für diesen Tag
                    <div className="mt-3">
                      <button
                        onClick={() => openCreate(selectedDay)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Notiz hinzufügen
                      </button>
                    </div>
                  </div>
                ) : (
                  selectedDayNotes.map(note => {
                    const emp = note.employee_id ? empMap.get(note.employee_id) : null;
                    const empName = emp ? `${emp.NAME}, ${emp.FIRSTNAME}` : '';
                    return (
                      <NoteCard
                        key={note.id}
                        note={note}
                        employeeName={empName}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        canEdit={canEdit}
                      />
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 text-sm">📋 Alle Notizen – {MONTH_NAMES[month - 1]} {year}</h3>
                <div className="text-xs text-slate-400 mt-0.5">{allMonthNotes.length} Notiz{allMonthNotes.length !== 1 ? 'en' : ''}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {allMonthNotes.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-8">
                    <div className="text-3xl mb-2">📭</div>
                    Keine Notizen in diesem Monat
                  </div>
                ) : (
                  allMonthNotes.map(note => {
                    const emp = note.employee_id ? empMap.get(note.employee_id) : null;
                    const empName = emp ? `${emp.NAME}, ${emp.FIRSTNAME}` : '';
                    return (
                      <div key={note.id}>
                        <div
                          className="text-xs text-slate-400 mb-1 cursor-pointer hover:text-blue-600"
                          onClick={() => setSelectedDay(note.date)}
                        >
                          📅 {new Date(note.date + 'T00:00:00').toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        <NoteCard
                          note={note}
                          employeeName={empName}
                          onEdit={openEdit}
                          onDelete={handleDelete}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      <NoteModal
        open={modalOpen}
        initialDate={modalDate}
        initialNote={editNote}
        employees={employees}
        onSave={handleSave}
        onClose={() => setModalOpen(false)}
      />

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
