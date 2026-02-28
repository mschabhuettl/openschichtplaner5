/**
 * Übergabe-Protokoll 📋
 * Digitales Schicht-Übergabe-System: ausgehende Schicht schreibt Notizen
 * für eingehende Schicht. Offene Punkte, Hinweise, kritische Ereignisse.
 */
import { useCallback, useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL ?? '';
function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}

interface Shift {
  id: number;
  name: string;
  short: string;
  color: string;
}

interface HandoverNote {
  id: string;
  date: string;
  shift_id: number | null;
  shift_name: string;
  author: string;
  text: string;
  priority: 'normal' | 'wichtig' | 'kritisch';
  tags: string[];
  created_at: string;
  resolved: boolean;
}

const PRIORITY_STYLE: Record<string, { label: string; cls: string; icon: string }> = {
  normal:   { label: 'Normal',   cls: 'bg-gray-100 text-gray-700 border-gray-200',      icon: '📝' },
  wichtig:  { label: 'Wichtig',  cls: 'bg-yellow-50 text-yellow-800 border-yellow-300', icon: '⚠️' },
  kritisch: { label: 'Kritisch', cls: 'bg-red-50 text-red-800 border-red-300',          icon: '🚨' },
};

const QUICK_TAGS = ['Maschine', 'Personal', 'Sicherheit', 'Qualität', 'Übergabe', 'Wartung', 'Kunde'];

export default function Uebergabe() {
  const today = new Date().toISOString().slice(0, 10);

  const [notes, setNotes]           = useState<HandoverNote[]>([]);
  const [shifts, setShifts]         = useState<Shift[]>([]);
  const [filterDate, setFilterDate] = useState(today);
  const [filterShift, setFilterShift] = useState<string>('');
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading]       = useState(true);

  // Form state
  const [form, setForm] = useState({
    date: today,
    shift_id: '',
    author: '',
    text: '',
    priority: 'normal' as HandoverNote['priority'],
    tags: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState('');

  // Load shifts
  useEffect(() => {
    fetch(`${API}/api/shifts`, { headers: getAuthHeaders() }).then(r => r.json()).then(setShifts).catch(() => {});
  }, []);

  // Load notes
  const loadNotes = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDate) params.set('date', filterDate);
    if (filterShift) params.set('shift_id', filterShift);
    params.set('limit', '100');
    fetch(`${API}/api/handover?${params}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => { setNotes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterDate, filterShift]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSubmit = async () => {
    if (!form.text.trim()) return;
    setSaving(true);
    const shift = shifts.find(s => s.id === Number(form.shift_id));
    const payload = {
      ...form,
      shift_id: form.shift_id ? Number(form.shift_id) : null,
      shift_name: shift?.name ?? '',
      created_at: new Date().toISOString(),
    };
    await fetch(`${API}/api/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setForm(f => ({ ...f, text: '', tags: [], priority: 'normal' }));
    showToast('✅ Übergabe-Notiz gespeichert');
    loadNotes();
  };

  const toggleResolved = async (note: HandoverNote) => {
    await fetch(`${API}/api/handover/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ resolved: !note.resolved }),
    });
    loadNotes();
  };

  const deleteNote = async (id: string) => {
    await fetch(`${API}/api/handover/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    loadNotes();
  };

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };

  const visibleNotes = showResolved ? notes : notes.filter(n => !n.resolved);
  const openCount = notes.filter(n => !n.resolved).length;

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">📋</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Übergabe-Protokoll</h1>
          <p className="text-sm text-gray-500">Digitale Schicht-Übergabe — Notizen für die nächste Schicht</p>
        </div>
        {openCount > 0 && (
          <span className="ml-auto bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full">
            {openCount} offen
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Neue Notiz erstellen */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>✍️</span> Neue Übergabe
            </h2>

            {/* Datum */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Datum</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Schicht */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Schicht</label>
              <select
                value={form.shift_id}
                onChange={e => setForm(f => ({ ...f, shift_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">— Alle Schichten —</option>
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Autor */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Schichtleiter / Autor</label>
              <input
                type="text"
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                placeholder="Name eingeben…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Priorität */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Priorität</label>
              <div className="flex gap-2">
                {(['normal', 'wichtig', 'kritisch'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                    className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-all ${
                      form.priority === p
                        ? PRIORITY_STYLE[p].cls + ' ring-2 ring-offset-1 ring-blue-400'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    {PRIORITY_STYLE[p].icon} {PRIORITY_STYLE[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Tags</label>
              <div className="flex flex-wrap gap-1">
                {QUICK_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                      form.tags.includes(tag)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Text */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Notiz / Hinweise</label>
              <textarea
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                placeholder="Was muss die nächste Schicht wissen? Offene Aufgaben, Ereignisse, Besonderheiten…"
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!form.text.trim() || saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? 'Speichern…' : '📤 Übergabe eintragen'}
            </button>
          </div>
        </div>

        {/* Right: Notizen-Liste */}
        <div className="lg:col-span-2">
          {/* Filter */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Datum:</span>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Schicht:</span>
              <select
                value={filterShift}
                onChange={e => setFilterShift(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
              >
                <option value="">Alle</option>
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={e => setShowResolved(e.target.checked)}
                className="rounded"
              />
              Erledigte anzeigen
            </label>
          </div>

          {/* Notes */}
          {loading ? (
            <div className="text-center text-gray-600 py-12">Lade…</div>
          ) : visibleNotes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-gray-500">Keine Übergabe-Notizen für diesen Filter</p>
              <p className="text-xs text-gray-600 mt-1">Erstelle die erste Notiz links</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleNotes.map(note => {
                const p = PRIORITY_STYLE[note.priority] ?? PRIORITY_STYLE.normal;
                const shift = shifts.find(s => s.id === note.shift_id);
                return (
                  <div
                    key={note.id}
                    className={`rounded-xl border p-4 transition-all ${
                      note.resolved
                        ? 'bg-gray-50 border-gray-200 opacity-60'
                        : p.cls
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xl">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="font-medium text-gray-700">{note.date}</span>
                          {shift && (
                            <span
                              className="px-2 py-0.5 rounded-full text-white text-xs font-bold"
                              style={{ backgroundColor: shift.color === '#FFFFFF' ? '#6b7280' : shift.color }}
                            >
                              {shift.short}
                            </span>
                          )}
                          {note.author && <span>von <strong>{note.author}</strong></span>}
                          <span className="ml-auto">{note.created_at ? new Date(note.created_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Text */}
                    <p className={`text-sm whitespace-pre-wrap mb-2 ${note.resolved ? 'line-through text-gray-600' : 'text-gray-800'}`}>
                      {note.text}
                    </p>

                    {/* Tags */}
                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {note.tags.map(tag => (
                          <span key={tag} className="text-xs bg-white bg-opacity-70 border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => toggleResolved(note)}
                        className={`text-xs px-3 py-1 rounded-lg border font-medium transition-colors ${
                          note.resolved
                            ? 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                            : 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                        }`}
                      >
                        {note.resolved ? '↩ Wiedereröffnen' : '✓ Erledigt'}
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      >
                        🗑 Löschen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
