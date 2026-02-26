import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { ShiftType } from '../types';
import { useToast } from '../hooks/useToast';

// Convert HTML #RRGGBB to BGR integer (Windows color storage)
function hexToBGR(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (b << 16) | (g << 8) | r;
}

// Parse "HH:MM-HH:MM" startend string → {start, end}
function parseStartend(s?: string | null): { start: string; end: string } {
  if (!s || !s.includes('-')) return { start: '', end: '' };
  const parts = s.split('-');
  return { start: parts[0] || '', end: parts[1] || '' };
}

// Format {start, end} → "HH:MM-HH:MM"
function formatStartend(start: string, end: string): string {
  if (!start && !end) return '';
  return `${start}-${end}`;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface WeekdayTime {
  start: string;
  end: string;
  duration: number;
}

const EMPTY_WEEKDAY_TIME: WeekdayTime = { start: '', end: '', duration: 0 };

interface ShiftForm {
  NAME: string;
  SHORTNAME: string;
  colorHex: string;
  DURATION0: number;
  STARTEND0: string;  // "HH:MM-HH:MM"
  HIDE: boolean;
  useIndividual: boolean;  // toggle for per-weekday times
  weekdays: WeekdayTime[];  // index 0=Mo..6=So (maps to DURATION1..7, STARTEND1..7)
}

const EMPTY_FORM: ShiftForm = {
  NAME: '',
  SHORTNAME: '',
  colorHex: '#FFFFFF',
  DURATION0: 8,
  STARTEND0: '',
  HIDE: false,
  useIndividual: false,
  weekdays: Array(7).fill(null).map(() => ({ ...EMPTY_WEEKDAY_TIME })),
};

export default function Shifts() {
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ShiftForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    api.getShifts().then(data => {
      setShifts(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (s: ShiftType) => {
    setEditId(s.ID);
    // Build weekday times from DURATION1-7 and STARTEND1-7
    const weekdays: WeekdayTime[] = Array(7).fill(null).map((_, i) => {
      const dKey = `DURATION${i + 1}` as keyof ShiftType;
      const sKey = `STARTEND${i + 1}` as keyof ShiftType;
      const dur = s[dKey] as number | undefined;
      const se = s[sKey] as string | undefined;
      const parsed = parseStartend(se);
      return {
        start: parsed.start,
        end: parsed.end,
        duration: dur ?? 0,
      };
    });
    // Detect if any weekday-specific data is set
    const hasIndividual = weekdays.some(w => w.duration > 0 || w.start || w.end);
    setForm({
      NAME: s.NAME || '',
      SHORTNAME: s.SHORTNAME || '',
      colorHex: s.COLORBK_HEX || '#FFFFFF',
      DURATION0: s.DURATION0 || 0,
      STARTEND0: s.STARTEND0 || '',
      HIDE: s.HIDE || false,
      useIndividual: hasIndividual,
      weekdays,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      NAME: form.NAME,
      SHORTNAME: form.SHORTNAME,
      COLORBK: hexToBGR(form.colorHex),
      DURATION0: form.DURATION0,
      STARTEND0: form.STARTEND0 || null,
      HIDE: form.HIDE,
    };

    if (form.useIndividual) {
      form.weekdays.forEach((wd, i) => {
        payload[`DURATION${i + 1}`] = wd.duration || null;
        const se = formatStartend(wd.start, wd.end);
        payload[`STARTEND${i + 1}`] = se || null;
      });
    } else {
      // Clear all per-weekday fields
      for (let i = 1; i <= 7; i++) {
        payload[`DURATION${i}`] = null;
        payload[`STARTEND${i}`] = null;
      }
    }

    try {
      if (editId !== null) {
        await api.updateShift(editId, payload as Partial<ShiftType>);
        showToast('Schichtart aktualisiert ✓', 'success');
      } else {
        await api.createShift(payload as Partial<ShiftType>);
        showToast('Schichtart erstellt ✓', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: ShiftType) => {
    if (!confirm(`Schichtart "${s.NAME}" wirklich ausblenden?`)) return;
    try {
      await api.deleteShift(s.ID);
      showToast('Schichtart ausgeblendet', 'success');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  // Check if shift has individual weekday times
  const hasIndividualTimes = (s: ShiftType) =>
    [1,2,3,4,5,6,7].some(i => {
      const d = s[`DURATION${i}` as keyof ShiftType] as number | undefined;
      return d != null && d > 0;
    });

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🕐 Schichtarten ({shifts.length})</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            + Neu
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop: Table layout */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-700 text-white text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Farbe</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Kürzel</th>
                  <th className="px-4 py-2 text-center">Mo–Fr</th>
                  <th className="px-4 py-2 text-center">Sa</th>
                  <th className="px-4 py-2 text-center">So</th>
                  <th className="px-4 py-2 text-right">Dauer</th>
                  <th className="px-4 py-2 text-center">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s, i) => {
                  const times = s.TIMES_BY_WEEKDAY || {};
                  const weekdayTime = times['0'] || times['1'] || null;
                  const satTime = times['5'] || null;
                  const sunTime = times['6'] || null;
                  const indiv = hasIndividualTimes(s);
                  return (
                    <tr key={s.ID} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                      <td className="px-4 py-2">
                        <div
                          className="w-8 h-6 rounded border border-gray-300 flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: s.COLORBK_HEX, color: s.COLORBK_LIGHT ? '#333' : '#fff' }}
                        >
                          {s.SHORTNAME}
                        </div>
                      </td>
                      <td className="px-4 py-2 font-semibold">{s.NAME}</td>
                      <td className="px-4 py-2 text-gray-500">{s.SHORTNAME}</td>
                      <td className="px-4 py-2 text-center text-gray-600 font-mono text-xs">
                        {indiv
                          ? <span className="text-purple-600 font-semibold">Individuell</span>
                          : weekdayTime ? `${weekdayTime.start}–${weekdayTime.end}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-500 font-mono text-xs">
                        {indiv ? '' : satTime ? `${satTime.start}–${satTime.end}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-500 font-mono text-xs">
                        {indiv ? '' : sunTime ? `${sunTime.start}–${sunTime.end}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {s.DURATION0 ? `${s.DURATION0}h` : '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => openEdit(s)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">Bearbeiten</button>
                          <button onClick={() => handleDelete(s)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Ausblenden</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shifts.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Keine Schichtarten</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card layout */}
          <div className="block md:hidden space-y-3">
            {shifts.map(s => {
              const times = s.TIMES_BY_WEEKDAY || {};
              const weekdayTime = times['0'] || times['1'] || null;
              const satTime = times['5'] || null;
              const sunTime = times['6'] || null;
              const indiv = hasIndividualTimes(s);
              return (
                <div key={s.ID} className="bg-white rounded-lg shadow p-4 border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-14 h-12 rounded-lg border border-gray-200 flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0"
                        style={{ backgroundColor: s.COLORBK_HEX, color: s.COLORBK_LIGHT ? '#333' : '#fff' }}
                      >
                        {s.SHORTNAME}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate">{s.NAME}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {s.DURATION0 ? `${s.DURATION0}h` : '—'}
                          {indiv
                            ? <span className="ml-2 text-purple-600 font-semibold">Individuelle Zeiten</span>
                            : weekdayTime && <span className="ml-2 font-mono">{weekdayTime.start}–{weekdayTime.end}</span>
                          }
                        </div>
                        {!indiv && (satTime || sunTime) && (
                          <div className="text-xs text-gray-400 font-mono">
                            {satTime && <span>Sa: {satTime.start}–{satTime.end}</span>}
                            {satTime && sunTime && ' · '}
                            {sunTime && <span>So: {sunTime.start}–{sunTime.end}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-base leading-none"
                        title="Bearbeiten"
                      >✏️</button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-base leading-none"
                        title="Ausblenden"
                      >🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {shifts.length === 0 && (
              <div className="text-center py-8 text-gray-400">Keine Schichtarten</div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editId !== null ? 'Schichtart bearbeiten' : 'Neue Schichtart'}
            </h2>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.NAME}
                  onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kürzel</label>
                <input
                  type="text"
                  value={form.SHORTNAME}
                  onChange={e => setForm(f => ({ ...f, SHORTNAME: e.target.value }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Farbe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))}
                    className="w-12 h-9 rounded border cursor-pointer"
                  />
                  <div
                    className="flex-1 h-9 rounded border border-gray-200 flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: form.colorHex }}
                  >
                    {form.SHORTNAME || form.NAME}
                  </div>
                </div>
              </div>

              {/* Time mode toggle */}
              <div className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700">⏱️ Schichtzeiten</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-gray-600">{form.useIndividual ? 'Individuelle Zeiten pro Wochentag' : 'Gleiche Zeiten alle Tage'}</span>
                    <div
                      onClick={() => setForm(f => ({ ...f, useIndividual: !f.useIndividual }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${form.useIndividual ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${form.useIndividual ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </label>
                </div>

                {!form.useIndividual ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Startzeit</label>
                      <input
                        type="time"
                        value={parseStartend(form.STARTEND0).start}
                        onChange={e => {
                          const end = parseStartend(form.STARTEND0).end;
                          setForm(f => ({ ...f, STARTEND0: formatStartend(e.target.value, end) }));
                        }}
                        className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Dauer (h)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={form.DURATION0}
                        onChange={e => setForm(f => ({ ...f, DURATION0: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Standard Startzeit</label>
                          <input
                            type="time"
                            value={parseStartend(form.STARTEND0).start}
                            onChange={e => {
                              const end = parseStartend(form.STARTEND0).end;
                              setForm(f => ({ ...f, STARTEND0: formatStartend(e.target.value, end) }));
                            }}
                            className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Standard Dauer (h)</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={form.DURATION0}
                            onChange={e => setForm(f => ({ ...f, DURATION0: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left px-2 py-1 text-gray-600">Tag</th>
                          <th className="text-left px-2 py-1 text-gray-600">Startzeit</th>
                          <th className="text-left px-2 py-1 text-gray-600">Endzeit</th>
                          <th className="text-left px-2 py-1 text-gray-600">Dauer (h)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {WEEKDAYS.map((day, i) => (
                          <tr key={day} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-2 py-1 font-semibold text-gray-700">{day}</td>
                            <td className="px-1 py-0.5">
                              <input
                                type="time"
                                value={form.weekdays[i].start}
                                onChange={e => {
                                  const wds = [...form.weekdays];
                                  wds[i] = { ...wds[i], start: e.target.value };
                                  setForm(f => ({ ...f, weekdays: wds }));
                                }}
                                className="w-full px-1 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </td>
                            <td className="px-1 py-0.5">
                              <input
                                type="time"
                                value={form.weekdays[i].end}
                                onChange={e => {
                                  const wds = [...form.weekdays];
                                  wds[i] = { ...wds[i], end: e.target.value };
                                  setForm(f => ({ ...f, weekdays: wds }));
                                }}
                                className="w-full px-1 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </td>
                            <td className="px-1 py-0.5">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={form.weekdays[i].duration || ''}
                                placeholder="—"
                                onChange={e => {
                                  const wds = [...form.weekdays];
                                  wds[i] = { ...wds[i], duration: parseFloat(e.target.value) || 0 };
                                  setForm(f => ({ ...f, weekdays: wds }));
                                }}
                                className="w-full px-1 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.HIDE}
                  onChange={e => setForm(f => ({ ...f, HIDE: e.target.checked }))}
                />
                Ausgeblendet
              </label>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">Abbrechen</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.NAME.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> : null}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
