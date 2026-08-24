import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../api/client';
import type { LeaveType } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import ReorderDialog from '../components/ReorderDialog';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { shiftCellColorsMemo } from '../utils/shiftColor';

function hexToBGR(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (b << 16) | (g << 8) | r;
}

// Abwesenheit ist im System immer hohl: gestrichelte Kontur + Hohl-Textfarbe,
// keine Füllung. Farblose Arten (weißer DBF-Hintergrund) neutral gestrichelt.
function leaveChipStyle(raw: string | undefined, isDark: boolean): CSSProperties {
  if (!raw || raw.toUpperCase() === '#FFFFFF') {
    return { border: '1.5px dashed var(--kontur)', color: 'var(--schrift-2)' };
  }
  const c = shiftCellColorsMemo(raw, isDark ? 'dark' : 'light', { hollow: true });
  return { border: `1.5px dashed ${c.color}`, color: c.color };
}

// Einheitliche Input-Optik (Taktwerk): Ebene-Fläche, Kontur-Rand, Glut-Fokusring
const INPUT_KLASSE = 'border border-kontur rounded-ui text-sm bg-ebene dark:bg-ebene-2 text-schrift placeholder:text-schrift-3 focus:outline-none focus:border-glut focus:ring-2 focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]';

/** 5LEAVT-Anrechnungsfelder (Spec 5.2/5.3, Gap V-4) — noch nicht im gemeinsamen
 *  LeaveType-Typ; werden von der API als DBF-Felder durchgereicht. */
interface LeaveTypeCharge {
  /** Anzurechnende Arbeitszeit: 0 = keine, 1 = Abwesenheitszeit, 2 = feste Stundenzahl je Tag. */
  CHARGETYP?: number;
  /** Stundenzahl je Tag (nur bei CHARGETYP=2). */
  CHARGEHRS?: number;
  /** Resttage beim Jahresabschluss ins Folgejahr übertragen. */
  CARRYFWD?: boolean | number;
  /** Alle Abwesenheitstage zählen (auch arbeitsfreie Tage). */
  COUNTALL?: boolean | number;
}

interface LeaveTypeForm {
  NAME: string;
  SHORTNAME: string;
  colorHex: string;
  colorTextHex: string;
  colorBarHex: string;
  bold: boolean;
  CHARGETYP: number;
  CHARGEHRS: number;
  ENTITLED: boolean;
  STDENTIT: number;
  CARRYFWD: boolean;
  COUNTALL: boolean;
  HIDE: boolean;
}

const EMPTY_FORM: LeaveTypeForm = {
  NAME: '',
  SHORTNAME: '',
  colorHex: '#FFFFFF',
  colorTextHex: '#000000',
  colorBarHex: '#000000',
  bold: false,
  CHARGETYP: 0,
  CHARGEHRS: 0,
  ENTITLED: false,
  STDENTIT: 0,
  CARRYFWD: false,
  COUNTALL: false,
  HIDE: false,
};

const CHARGETYP_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Keine' },
  { value: 1, label: 'Abwesenheitszeit (Sollzeit des Tages)' },
  { value: 2, label: 'Feste Stundenzahl je Tag' },
];

export default function LeaveTypes() {
  const { canAdmin } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showReorder, setShowReorder] = useState(false);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LeaveTypeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.getLeaveTypes(true).then(data => { // inkl. ausgeblendete, damit sie wieder einblendbar sind
      setLeaveTypes(data);
      setLoading(false);
    }).catch((err) => { setLoading(false); showToast('Abwesenheitsarten konnten nicht geladen werden. ' + String(err), 'error'); });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []); // nur beim Mount ausführen

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (lt: LeaveType) => {
    const ltc = lt as LeaveType & LeaveTypeCharge;
    setEditId(lt.ID);
    setForm({
      NAME: lt.NAME || '',
      SHORTNAME: lt.SHORTNAME || '',
      colorHex: lt.COLORBK_HEX || '#FFFFFF',
      colorTextHex: lt.COLORTEXT_HEX || '#000000',
      colorBarHex: lt.COLORBAR_HEX || '#000000',
      bold: Boolean(lt.BOLD),
      CHARGETYP: ltc.CHARGETYP || 0,
      CHARGEHRS: ltc.CHARGEHRS || 0,
      ENTITLED: lt.ENTITLED || false,
      STDENTIT: lt.STDENTIT || 0,
      CARRYFWD: !!ltc.CARRYFWD,
      COUNTALL: !!ltc.COUNTALL,
      HIDE: lt.HIDE || false,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setError(null);
    if (!form.NAME.trim()) { setError('Bezeichnung ist ein Pflichtfeld.'); return; }
    if (!form.SHORTNAME.trim()) { setError('Kürzel ist ein Pflichtfeld.'); return; }
    if (form.CHARGETYP === 2 && form.CHARGEHRS <= 0) { setError('Bitte eine Stundenzahl je Tag angeben.'); return; }
    setSaving(true);
    const payload = {
      NAME: form.NAME,
      SHORTNAME: form.SHORTNAME,
      COLORBK: hexToBGR(form.colorHex),
      COLORTEXT: hexToBGR(form.colorTextHex),
      COLORBAR: hexToBGR(form.colorBarHex),
      BOLD: form.bold ? 1 : 0,
      CHARGETYP: form.CHARGETYP,
      CHARGEHRS: form.CHARGETYP === 2 ? form.CHARGEHRS : 0,
      ENTITLED: form.ENTITLED,
      STDENTIT: form.STDENTIT,
      CARRYFWD: form.ENTITLED ? form.CARRYFWD : false,
      COUNTALL: form.COUNTALL,
      HIDE: form.HIDE,
    };
    try {
      if (editId !== null) {
        await api.updateLeaveType(editId, payload);
        showToast('Abwesenheitsart gespeichert ✓', 'success');
      } else {
        await api.createLeaveType(payload);
        showToast('Abwesenheitsart erstellt ✓', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lt: LeaveType) => {
    if (!await confirmDialog({ message: `Abwesenheitsart "${lt.NAME}" wirklich ausblenden?`, danger: true })) return;
    try {
      await api.deleteLeaveType(lt.ID);
      showToast("Abwesenheitsart ausgeblendet", "success");
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  // Theme provider-frei ermitteln (html.dark-Klasse) — nur für die Chip-Normalisierung
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold tracking-[-0.02em] text-schrift">🏖️ Abwesenheitsarten ({leaveTypes.length})</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="no-print px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift text-sm hover:bg-wash flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          {canAdmin && leaveTypes.length > 1 && <button
            onClick={() => setShowReorder(true)}
            className="no-print px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift text-sm hover:bg-wash"
            title="Reihenfolge der Abwesenheitsarten manuell festlegen"
          >
            ↕ <span className="hidden sm:inline">Reihenfolge</span>
          </button>}
          {canAdmin && <button
            onClick={openCreate}
            className="px-3 py-1.5 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui text-sm font-semibold"
          >
            + Neu
          </button>}
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
        <div className="mb-3 flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="🔍 Abwesenheitsart suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full sm:w-72 px-3 py-1.5 ${INPUT_KLASSE}`}
          />
          {leaveTypes.some(lt => lt.HIDE) && (
            <label className="flex items-center gap-1.5 text-sm text-schrift cursor-pointer select-none whitespace-nowrap">
              <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
              Ausgeblendete anzeigen ({leaveTypes.filter(lt => lt.HIDE).length})
            </label>
          )}
        </div>
        <div className="bg-ebene border border-kontur rounded-panel overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-[#fafbfc] dark:bg-[#0e1522] text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">
              <tr className="border-b border-kontur">
                <th scope="col" className="px-4 py-2 text-left">Farbe</th>
                <th scope="col" className="px-4 py-2 text-left">Name</th>
                <th scope="col" className="px-4 py-2 text-left">Kürzel</th>
                <th scope="col" className="px-4 py-2 text-center">Urlaubsanspruch</th>
                <th scope="col" className="px-4 py-2 text-right">Standard</th>
                <th scope="col" className="px-4 py-2 text-center">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.filter(lt => showHidden || !lt.HIDE).filter(lt => !search || lt.NAME.toLowerCase().includes(search.toLowerCase()) || (lt.SHORTNAME || '').toLowerCase().includes(search.toLowerCase())).map(lt => (
                <tr key={lt.ID} className={`h-[28px] border-b border-kontur-soft hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)] ${lt.HIDE ? 'opacity-60' : ''}`}>
                  <td className="px-4">
                    <div
                      className="inline-block min-w-[32px] max-w-[76px] px-1.5 text-center text-[9.5px] font-bold leading-[16px] rounded-cell whitespace-nowrap overflow-hidden text-ellipsis box-border align-middle"
                      style={leaveChipStyle(lt.COLORBK_HEX, isDark)}
                    >
                      {lt.SHORTNAME}
                    </div>
                  </td>
                  <td className="px-4 font-semibold text-schrift">
                    {lt.NAME}
                    {!!lt.HIDE && (<Badge variant="gray" className="ml-2 align-middle">Ausgeblendet</Badge>)}
                  </td>
                  <td className="px-4 text-schrift-2">{lt.SHORTNAME}</td>
                  <td className="px-4 text-center">
                    {lt.ENTITLED
                      ? <Badge variant="green">Ja</Badge>
                      : <span className="text-xs text-schrift-3">Nein</span>
                    }
                  </td>
                  <td className="px-4 text-right font-mono tabular-nums text-schrift-2">
                    {lt.ENTITLED && lt.STDENTIT ? `${lt.STDENTIT} Tage` : '—'}
                  </td>
                  <td className="px-4 text-center">
                    <div className="flex gap-1 justify-center">
                      {canAdmin && <button onClick={() => openEdit(lt)} className="px-2 py-0.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-xs text-schrift hover:bg-wash">Bearbeiten</button>}
                      {canAdmin && <button onClick={() => handleDelete(lt)} className="px-2 py-0.5 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-xs text-signal hover:bg-wash">Ausblenden</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {leaveTypes.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState
                    icon="🏖️"
                    title="Keine Abwesenheiten"
                    description="Legen Sie Abwesenheitsarten wie Urlaub, Krankenstand oder Zeitausgleich an."
                    actionLabel="Abwesenheitsart anlegen"
                    onAction={() => { setEditId(null); setShowModal(true); }}
                  />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdropIn" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-[13px] font-bold text-schrift px-6 py-3 border-b border-kontur">
              {editId !== null ? 'Abwesenheitsart bearbeiten' : 'Neue Abwesenheitsart'}
            </h2>
            {error && <div className="mx-6 mt-3 p-2 bg-signal-flaeche text-signal rounded-ui text-sm">{error}</div>}
            <div className="space-y-3 px-6 py-4">
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Name *</label>
                <input
                  type="text"
                  autoFocus value={form.NAME}
                  onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                  className={`w-full px-3 py-2 ${INPUT_KLASSE}`}
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Kürzel</label>
                <input
                  type="text"
                  value={form.SHORTNAME}
                  onChange={e => setForm(f => ({ ...f, SHORTNAME: e.target.value }))}
                  className={`w-full px-3 py-2 ${INPUT_KLASSE}`}
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Farben</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-schrift-2">
                    <input
                      type="color"
                      aria-label="Hintergrundfarbe"
                      value={form.colorHex}
                      onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))}
                      className="w-10 h-9 rounded-ui border border-kontur cursor-pointer"
                    />
                    Hintergrund
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-schrift-2">
                    <input
                      type="color"
                      aria-label="Textfarbe"
                      value={form.colorTextHex}
                      onChange={e => setForm(f => ({ ...f, colorTextHex: e.target.value }))}
                      className="w-10 h-9 rounded-ui border border-kontur cursor-pointer"
                    />
                    Text
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-schrift-2">
                    <input
                      type="color"
                      aria-label="Balkenfarbe"
                      value={form.colorBarHex}
                      onChange={e => setForm(f => ({ ...f, colorBarHex: e.target.value }))}
                      className="w-10 h-9 rounded-ui border border-kontur cursor-pointer"
                    />
                    Balken
                  </label>
                  <div
                    className="flex-1 min-w-[5rem] h-9 rounded-ui border border-kontur flex items-center justify-center text-sm"
                    style={{ backgroundColor: form.colorHex, color: form.colorTextHex, borderLeft: `5px solid ${form.colorBarHex}`, fontWeight: form.bold ? 'bold' : 'normal' }}
                  >
                    {form.SHORTNAME || form.NAME}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-schrift-2 mt-2">
                  <input
                    type="checkbox"
                    aria-label="Fette Schrift"
                    checked={form.bold}
                    onChange={e => setForm(f => ({ ...f, bold: e.target.checked }))}
                  />
                  Fette Schrift im Plan
                </label>
              </div>
              <fieldset className="border border-kontur rounded-ui p-2">
                <legend className="text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 px-1">Anzurechnende Arbeitszeit</legend>
                <div className="space-y-1">
                  {CHARGETYP_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm text-schrift cursor-pointer">
                      <input
                        type="radio"
                        name="chargetyp"
                        checked={form.CHARGETYP === opt.value}
                        onChange={() => setForm(f => ({ ...f, CHARGETYP: opt.value }))}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                {form.CHARGETYP === 2 && (
                  <div className="mt-2">
                    <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Stundenzahl je Tag</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={form.CHARGEHRS}
                      onChange={e => setForm(f => ({ ...f, CHARGEHRS: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3 py-2 ${INPUT_KLASSE}`}
                    />
                  </div>
                )}
              </fieldset>
              <label className="flex items-center gap-2 text-sm text-schrift cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ENTITLED}
                  onChange={e => setForm(f => ({ ...f, ENTITLED: e.target.checked }))}
                />
                Mit Anspruch verbunden (verbraucht Urlaubsanspruch)
              </label>
              {!!form.ENTITLED && (
                <div className="pl-6 space-y-3">
                  <div>
                    <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Standardanspruch (Tage)</label>
                    <input
                      type="number"
                      step="1"
                      value={form.STDENTIT}
                      onChange={e => setForm(f => ({ ...f, STDENTIT: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3 py-2 ${INPUT_KLASSE}`}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-schrift cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.CARRYFWD}
                      onChange={e => setForm(f => ({ ...f, CARRYFWD: e.target.checked }))}
                    />
                    Resttage beim Jahresabschluss ins Folgejahr übertragen
                  </label>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-schrift cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.COUNTALL}
                  onChange={e => setForm(f => ({ ...f, COUNTALL: e.target.checked }))}
                />
                Alle Abwesenheitstage zählen (auch arbeitsfreie Tage)
              </label>
              <label className="flex items-center gap-2 text-sm text-schrift cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.HIDE}
                  onChange={e => setForm(f => ({ ...f, HIDE: e.target.checked }))}
                />
                Ausgeblendet
              </label>
            </div>
            <div className="flex gap-2 justify-end px-6 py-3 bg-[#fafbfc] dark:bg-[#0e1522] border-t border-kontur">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-sm text-schrift hover:bg-wash">Abbrechen</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.NAME.trim()}
                className="px-4 py-2 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui text-sm font-semibold disabled:opacity-50"
              >
                {saving ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" /> : null}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />
      {showReorder && (
        <ReorderDialog
          entity="leave_types"
          title="Abwesenheitsarten-Reihenfolge"
          items={leaveTypes.map(lt => ({ id: lt.ID, label: `${lt.NAME} (${lt.SHORTNAME})` }))}
          onClose={() => setShowReorder(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
