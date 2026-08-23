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
import { LoadingSpinner } from '../components/LoadingSpinner';
import { parseValidDays, validDaysToString } from '../utils/validDays';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WEEKDAY_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const HOL_RULE_LABELS: Record<number, string> = {
  0: 'Alle Tage',
  1: 'Nur Feiertage',
  2: 'Nicht an Feiertagen',
};

// Taktwerk-Eingabe-Optik: Kontur-Rand, Fokus = Glut-Rand + Glut-Ring
const EINGABE = 'border border-kontur rounded-ui bg-ebene-2 text-schrift placeholder:text-schrift-3 focus:outline-none focus:border-glut focus:shadow-[0_0_0_3px_rgba(201,106,20,.12)] dark:focus:shadow-[0_0_0_3px_rgba(240,163,92,.15)]';

// Taktwerk-Datentabelle: Kopfzelle UPPERCASE 9px/700 auf Fläche 2
const KOPFZELLE = 'px-4 py-[6px] text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3 border-b border-kontur whitespace-nowrap';

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

interface ExtraChargeForm {
  NAME: string;
  startTime: string;
  endTime: string;
  validDays: boolean[];
  /** 0 = Wochentage (VALIDDAYS), 1 = festes Datum (Spec 3.8.2 Nr. 5) */
  validity: number;
  fixedDate: string;
  HOLRULE: number;
  HIDE: boolean;
}

const EMPTY_FORM: ExtraChargeForm = {
  NAME: '',
  startTime: '00:00',
  endTime: '06:00',
  validDays: [true, true, true, true, true, true, true],
  validity: 0,
  fixedDate: '',
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
    api.getExtraCharges(true).then(data => { // inkl. ausgeblendete, damit das Toggle sie zeigen kann
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
      validity: c.VALIDITY || 0,
      fixedDate: c.DATE || '',
      HOLRULE: c.HOLRULE || 0,
      HIDE: c.HIDE === 1,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setError(null);
    if (!form.NAME.trim()) { setError('Bezeichnung ist ein Pflichtfeld.'); return; }
    if (form.validity === 1 && !form.fixedDate) { setError('Der Modus „festes Datum" braucht ein Datum.'); return; }
    setSaving(true);
    const payload = {
      NAME: form.NAME,
      START: timeToMinutes(form.startTime),
      END: timeToMinutes(form.endTime),
      VALIDDAYS: validDaysToString(form.validDays),
      VALIDITY: form.validity,
      DATE: form.validity === 1 ? form.fixedDate : '',
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
              className="no-print px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift text-sm rounded-ui hover:bg-wash transition-colors flex items-center gap-1"
              title="Seite drucken"
            >
              🖨️ <span className="hidden sm:inline">Drucken</span>
            </button>
            {canAdmin && (
              <button
                onClick={openCreate}
                className="px-3 py-1.5 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui text-sm font-semibold hover:opacity-90 transition-opacity"
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
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-schrift-3 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suche nach Name…"
            className={`w-full pl-8 pr-3 py-1.5 text-sm ${EINGABE}`}
          />
          {search && (
            <button aria-label="Schließen"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-schrift-3 hover:text-schrift text-xs"
            >✕</button>
          )}
        </div>
        {hiddenCount > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-schrift-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => setShowHidden(e.target.checked)}
              className="rounded accent-glut"
            />
            Ausgeblendete anzeigen ({hiddenCount})
          </label>
        )}
        {charges.length > 0 && (
          <span className="text-xs text-schrift-3 ml-auto">
            {filtered.length} von {charges.length} Einträgen
          </span>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : charges.length === 0 ? (
        <EmptyState
          icon="⏱️"
          title="Keine Zeitzuschläge definiert"
          description="Erstelle Zeitzuschläge für Nacht-, Sonn- und Feiertagsarbeit."
          actionLabel={canAdmin ? '+ Zeitzuschlag erstellen' : undefined}
          onAction={canAdmin ? openCreate : undefined}
        />
      ) : (
        <div className="bg-ebene border border-kontur rounded-panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#fafbfc] dark:bg-[#0e1522]">
              <tr>
                <th scope="col" className={`${KOPFZELLE} text-left`}>Name</th>
                <th scope="col" className={`${KOPFZELLE} text-right`}>Von</th>
                <th scope="col" className={`${KOPFZELLE} text-right`}>Bis</th>
                <th scope="col" className={`${KOPFZELLE} text-left`}>Gültige Tage</th>
                <th scope="col" className={`${KOPFZELLE} text-left`}>Feiertagsregel</th>
                <th scope="col" className={`${KOPFZELLE} text-center`}>Status</th>
                <th scope="col" className={`${KOPFZELLE} text-center`}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.ID} className={`h-[28px] border-b border-kontur-soft hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)] ${c.HIDE === 1 ? 'opacity-60' : ''}`}>
                  <td className="px-4 font-semibold text-schrift">{c.NAME}</td>
                  <td className="px-4 text-right font-mono tabular-nums text-schrift">
                    {c.START === 0 && c.END === 0 ? '—' : minutesToTime(c.START)}
                  </td>
                  <td className="px-4 text-right font-mono tabular-nums text-schrift">
                    {c.START === 0 && c.END === 0 ? '—' : minutesToTime(c.END)}
                  </td>
                  <td className="px-4 text-schrift-2 text-xs font-mono tabular-nums">
                    {c.VALIDITY === 1 ? `am ${c.DATE || '?'}` : activeDaysSummary(c.VALIDDAYS || '')}
                  </td>
                  <td className="px-4">
                    <Badge
                      variant={c.HOLRULE === 1 ? 'green' : c.HOLRULE === 2 ? 'orange' : 'gray'}
                      shape="square"
                    >
                      {HOL_RULE_LABELS[c.HOLRULE] || 'Alle Tage'}
                    </Badge>
                  </td>
                  <td className="px-4 text-center">
                    {c.HIDE === 1 ? (
                      <Badge variant="gray" shape="square">Ausgeblendet</Badge>
                    ) : (
                      <Badge variant="green" shape="square">Aktiv</Badge>
                    )}
                  </td>
                  <td className="px-4 text-center">
                    <div className="flex gap-1 justify-center">
                      {canAdmin && <button onClick={() => openEdit(c)} className="px-2 py-0.5 text-xs rounded-ui border border-kontur text-schrift hover:bg-wash">Bearbeiten</button>}
                      {canAdmin && <button onClick={() => handleDelete(c)} className="px-2 py-0.5 text-xs rounded-ui text-signal hover:bg-signal-flaeche">Löschen</button>}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdropIn" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur overflow-hidden animate-scaleIn w-full max-w-md mx-4">
            <h2 className="text-[13px] font-bold text-schrift px-4 py-3 border-b border-kontur">
              {editId !== null ? '✏️ Zeitzuschlag bearbeiten' : '➕ Neuer Zeitzuschlag'}
            </h2>
            {error && <div className="mx-4 mt-3 p-2 bg-signal-flaeche border border-[#eecfcf] dark:border-[#5a2626] text-signal rounded-ui text-sm">{error}</div>}
            <div className="space-y-3 px-4 py-3.5">
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Name *</label>
                <input
                  type="text"
                  autoFocus value={form.NAME}
                  onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                  placeholder="z.B. Nachtzuschlag"
                  className={`w-full px-3 py-2 text-sm ${EINGABE}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Von (Uhrzeit)</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm font-mono tabular-nums ${EINGABE}`}
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Bis (Uhrzeit)</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm font-mono tabular-nums ${EINGABE}`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Gültigkeit</label>
                <div className="flex gap-3 mb-2">
                  <label className="flex items-center gap-1.5 text-sm text-schrift cursor-pointer">
                    <input type="radio" className="accent-glut" checked={form.validity === 0}
                      onChange={() => setForm(f => ({ ...f, validity: 0 }))} />
                    Wochentage
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-schrift cursor-pointer">
                    <input type="radio" className="accent-glut" checked={form.validity === 1}
                      onChange={() => setForm(f => ({ ...f, validity: 1 }))} />
                    Festes Datum
                  </label>
                </div>
                {form.validity === 0 ? (
                  <div className="flex gap-1 flex-wrap">
                    {WEEKDAY_FULL.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`px-2 py-1 rounded-ui text-xs font-mono font-semibold border transition-colors ${form.validDays[i] ? 'bg-glut border-glut text-glut-ink' : 'bg-ebene-2 border-kontur text-schrift-2 hover:bg-wash'}`}
                        title={d}
                      >
                        {WEEKDAYS[i]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="date"
                    value={form.fixedDate}
                    onChange={e => setForm(f => ({ ...f, fixedDate: e.target.value }))}
                    className={`px-2 py-1 text-sm font-mono tabular-nums ${EINGABE}`}
                  />
                )}
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Feiertagsregel</label>
                <select
                  value={form.HOLRULE}
                  onChange={e => setForm(f => ({ ...f, HOLRULE: parseInt(e.target.value) }))}
                  className={`w-full px-3 py-2 text-sm ${EINGABE}`}
                >
                  <option value={0}>Alle Tage (inkl. Feiertage)</option>
                  <option value={1}>Nur Feiertage</option>
                  <option value={2}>Nicht an Feiertagen</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-schrift-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-glut"
                  checked={form.HIDE}
                  onChange={e => setForm(f => ({ ...f, HIDE: e.target.checked }))}
                />
                Ausgeblendet (nicht im Bericht anzeigen)
              </label>
            </div>
            <div className="flex gap-2 justify-end px-4 py-[11px] bg-[#fafbfc] dark:bg-[#0e1522] border-t border-kontur">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui text-sm hover:bg-wash transition-colors">Abbrechen</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.NAME.trim()}
                className="px-4 py-2 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" /> : null}
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
