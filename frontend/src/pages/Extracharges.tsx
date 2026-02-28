import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import type { ExtraCharge } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WEEKDAY_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const HOL_RULE_LABELS: Record<number, string> = {
  0: 'Alle Tage',
  1: 'Nur Feiertage',
  2: 'Nicht an Feiertagen',
};

// Convert minutes from midnight to HH:MM string
function minutesToTime(minutes: number): string {
  if (!minutes && minutes !== 0) return '00:00';
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Convert HH:MM string to minutes from midnight
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return h * 60 + m;
}

// Parse VALIDDAYS string (7 chars, '0'/'1', may be encoded weirdly)
function parseValidDays(validdays: string): boolean[] {
  const result: boolean[] = new Array(7).fill(false);
  if (!validdays) return result;
  const chars = Array.from(validdays);
  for (let i = 0; i < 7 && i < chars.length; i++) {
    const code = chars[i].charCodeAt(0);
    result[i] = code === 0x31 || code === 0x2031 || chars[i] === '1';
  }
  return result;
}

function validDaysToString(days: boolean[]): string {
  return days.slice(0, 7).map(v => v ? '1' : '0').join('');
}

interface ExtraChargeForm {
  NAME: string;
  startTime: string;
  endTime: string;
  validDays: boolean[];
  HOLRULE: number;
  HIDE: boolean;
}

const EMPTY_FORM: ExtraChargeForm = {
  NAME: '',
  startTime: '00:00',
  endTime: '06:00',
  validDays: [true, true, true, true, true, true, true],
  HOLRULE: 0,
  HIDE: false,
};

export default function Extracharges() {
  const { canAdmin } = useAuth();
  const [charges, setCharges] = useState<ExtraCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ExtraChargeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();

  const load = () => {
    setLoading(true);
    api.getExtraCharges().then(data => {
      setCharges(data);
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

  const openEdit = (c: ExtraCharge) => {
    setEditId(c.ID);
    setForm({
      NAME: c.NAME || '',
      startTime: minutesToTime(c.START || 0),
      endTime: minutesToTime(c.END || 0),
      validDays: parseValidDays(c.VALIDDAYS || ''),
      HOLRULE: c.HOLRULE || 0,
      HIDE: c.HIDE === 1,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      NAME: form.NAME,
      START: timeToMinutes(form.startTime),
      END: timeToMinutes(form.endTime),
      VALIDDAYS: validDaysToString(form.validDays),
      HOLRULE: form.HOLRULE,
      HIDE: form.HIDE ? 1 : 0,
    };
    try {
      if (editId !== null) {
        await api.updateExtraCharge(editId, payload);
        showToast('Zeitzuschlag gespeichert ✓', 'success');
      } else {
        await api.createExtraCharge(payload);
        showToast('Zeitzuschlag erstellt ✓', 'success');
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

  const handleDelete = async (c: ExtraCharge) => {
    if (!await confirmDialog({ message: `Zeitzuschlag "${c.NAME}" wirklich löschen?`, danger: true })) return;
    try {
      await api.deleteExtraCharge(c.ID);
      showToast('Zeitzuschlag gelöscht', 'success');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  const toggleDay = (i: number) => {
    setForm(f => ({
      ...f,
      validDays: f.validDays.map((v, idx) => idx === i ? !v : v),
    }));
  };

  const activeDaysSummary = (validdays: string) => {
    const days = parseValidDays(validdays);
    const active = WEEKDAYS.filter((_, i) => days[i]);
    if (active.length === 7) return 'Alle Tage';
    if (active.length === 0) return '–';
    return active.join(', ');
  };

  // Filtered list
  const filtered = useMemo(() => {
    let list = charges;
    if (!showHidden) list = list.filter(c => c.HIDE !== 1);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.NAME?.toLowerCase().includes(q));
    }
    return list;
  }, [charges, search, showHidden]);

  const hiddenCount = charges.filter(c => c.HIDE === 1).length;

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <PageHeader
        title="⏱️ Zeitzuschläge"
        subtitle="Zuschlagspflichtige Arbeitszeiten (z.B. Nacht-, Sonn- und Feiertagszuschläge)"
        actions={
          <>
            <button
              onClick={() => window.print()}
              className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
              title="Seite drucken"
            >
              🖨️ <span className="hidden sm:inline">Drucken</span>
            </button>
            {canAdmin && (
              <button
                onClick={openCreate}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                + Neu
              </button>
            )}
          </>
        }
      />

      {/* Search & filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suche nach Name…"
            className="w-full pl-8 pr-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {search && (
            <button aria-label="Schließen"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >✕</button>
          )}
        </div>
        {hiddenCount > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => setShowHidden(e.target.checked)}
              className="rounded"
            />
            Ausgeblendete anzeigen ({hiddenCount})
          </label>
        )}
        {charges.length > 0 && (
          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} von {charges.length} Einträgen
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : charges.length === 0 ? (
        <EmptyState
          icon="⏱️"
          title="Keine Zeitzuschläge definiert"
          description="Erstelle Zeitzuschläge für Nacht-, Sonn- und Feiertagsarbeit."
          actionLabel={canAdmin ? '+ Zeitzuschlag erstellen' : undefined}
          onAction={canAdmin ? openCreate : undefined}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700 text-white text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-center">Von</th>
                <th className="px-4 py-2 text-center">Bis</th>
                <th className="px-4 py-2 text-left">Gültige Tage</th>
                <th className="px-4 py-2 text-left">Feiertagsregel</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-center">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.ID} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors ${c.HIDE === 1 ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2 font-semibold">{c.NAME}</td>
                  <td className="px-4 py-2 text-center font-mono text-gray-700">
                    {c.START === 0 && c.END === 0 ? '—' : minutesToTime(c.START)}
                  </td>
                  <td className="px-4 py-2 text-center font-mono text-gray-700">
                    {c.START === 0 && c.END === 0 ? '—' : minutesToTime(c.END)}
                  </td>
                  <td className="px-4 py-2 text-gray-600 text-xs">
                    {activeDaysSummary(c.VALIDDAYS || '')}
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={c.HOLRULE === 1 ? 'green' : c.HOLRULE === 2 ? 'orange' : 'gray'}
                      shape="square"
                    >
                      {HOL_RULE_LABELS[c.HOLRULE] || 'Alle Tage'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {c.HIDE === 1 ? (
                      <Badge variant="gray" shape="square">Ausgeblendet</Badge>
                    ) : (
                      <Badge variant="green" shape="square">Aktiv</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      {canAdmin && <button onClick={() => openEdit(c)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">Bearbeiten</button>}
                      {canAdmin && <button onClick={() => handleDelete(c)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Löschen</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && charges.length > 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <EmptyState
                      icon="🔍"
                      title="Keine Treffer"
                      description={`Keine Zuschläge für "${search}" gefunden.`}
                      actionLabel="Filter zurücksetzen"
                      onAction={() => { setSearch(''); setShowHidden(false); }}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editId !== null ? '✏️ Zeitzuschlag bearbeiten' : '➕ Neuer Zeitzuschlag'}
            </h2>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input
                  type="text"
                  autoFocus value={form.NAME}
                  onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                  placeholder="z.B. Nachtzuschlag"
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Von (Uhrzeit)</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Bis (Uhrzeit)</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Gilt für Wochentage</label>
                <div className="flex gap-1 flex-wrap">
                  {WEEKDAY_FULL.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${form.validDays[i] ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}
                      title={d}
                    >
                      {WEEKDAYS[i]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Feiertagsregel</label>
                <select
                  value={form.HOLRULE}
                  onChange={e => setForm(f => ({ ...f, HOLRULE: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Alle Tage (inkl. Feiertage)</option>
                  <option value={1}>Nur Feiertage</option>
                  <option value={2}>Nicht an Feiertagen</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.HIDE}
                  onChange={e => setForm(f => ({ ...f, HIDE: e.target.checked }))}
                />
                Ausgeblendet (nicht im Bericht anzeigen)
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

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
