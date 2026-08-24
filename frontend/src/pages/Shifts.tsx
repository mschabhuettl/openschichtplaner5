import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { api } from '../api/client';
import type { ShiftType } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { HelpTooltip } from '../components/HelpTooltip';
import { LoadingSpinner } from '../components/LoadingSpinner';
import ReorderDialog from '../components/ReorderDialog';
import { Badge as StatusPille } from '../components/Badge';
import { Badge as DienstChip } from '../components/ui/Badge';
import {
  DAY_TYPES,
  validateStartend,
  computeStartendHours,
  buildShiftTimeFields,
  type DayTimeRow,
} from '../utils/startend';

// Convert HTML #RRGGBB to BGR integer (Windows color storage)
function hexToBGR(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (b << 16) | (g << 8) | r;
}

/** NOEXTRA (R5.5-15) ist noch nicht Teil des zentralen ShiftType. */
type ShiftWithNoextra = ShiftType & { NOEXTRA?: number | boolean };

interface ShiftForm {
  NAME: string;
  SHORTNAME: string;
  colorHex: string;
  colorTextHex: string;
  colorBarHex: string;
  bold: boolean;
  HIDE: boolean;
  NOEXTRA: boolean;
  /** Index 0..7 = Mo..So + Ft (Spec D-34). */
  days: DayTimeRow[];
}

const emptyDays = (): DayTimeRow[] => Array.from({ length: 8 }, () => ({ startend: '', duration: 0 }));

// Taktwerk-Basisklassen (docs/design-system.md §1/§3/§6)
const EINGABE = 'bg-ebene-2 border border-kontur rounded-ui text-schrift placeholder:text-schrift-3 focus:outline-none focus:border-glut focus:shadow-[0_0_0_3px_rgba(201,106,20,.12)] dark:focus:shadow-[0_0_0_3px_rgba(240,163,92,.15)]';
const EINGABE_FEHLER = 'bg-ebene-2 border border-signal rounded-ui text-schrift placeholder:text-schrift-3 focus:outline-none focus:shadow-[0_0_0_3px_rgba(190,59,59,.15)]';
const BTN_PRIMAER = 'bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] font-semibold rounded-ui hover:opacity-90 transition-opacity';
const BTN_SEKUNDAER = 'bg-ebene dark:bg-ebene-2 border border-kontur rounded-ui text-schrift hover:bg-wash transition-colors';
const ZEILEN_HOVER = 'hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)]';

const EMPTY_FORM: ShiftForm = {
  NAME: '',
  SHORTNAME: '',
  colorHex: '#FFFFFF',
  colorTextHex: '#000000',
  colorBarHex: '#000000',
  bold: false,
  HIDE: false,
  NOEXTRA: false,
  days: emptyDays(),
};

export default function Shifts() {
  const { canAdmin } = useAuth();
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [showReorder, setShowReorder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ShiftForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();

  // 'order' = Original-Reihenfolge (POSITION, wie die API liefert) — Initialzustand
  // wie die Verwaltungsliste des Originals.
  type ShiftSortKey = 'order' | 'name' | 'shortname' | 'duration';
  type ShiftSortDir = 'asc' | 'desc';
  const [shiftSortKey, setShiftSortKey] = useState<ShiftSortKey>('order');
  const [shiftSortDir, setShiftSortDir] = useState<ShiftSortDir>('asc');
  const [shiftSearch, setShiftSearch] = useState('');
  const debouncedShiftSearch = useDebounce(shiftSearch, 300);
  // Ausgeblendete (archivierte) Schichtarten: standardmäßig verborgen, per Schalter
  // wieder einblendbar und damit über „Bearbeiten" reaktivierbar (sonst Sackgasse).
  const [showHidden, setShowHidden] = useState(false);

  const handleShiftSort = (key: ShiftSortKey) => {
    if (shiftSortKey === key) setShiftSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setShiftSortKey(key); setShiftSortDir('asc'); }
  };
  // Taktwerk-Sortpfeil: aktive Spalte Glut, inaktiv gedämpftes ↕
  const shiftSortIcon = (key: ShiftSortKey) => shiftSortKey === key
    ? <span className="ml-1 text-glut">{shiftSortDir === 'asc' ? '▴' : '▾'}</span>
    : <span className="ml-1 text-schrift-3 opacity-50">↕</span>;

  const sortedShifts = useMemo(() => {
    const q = debouncedShiftSearch.toLowerCase();
    return [...shifts]
      .filter(s => showHidden || !s.HIDE)
      .filter(s => !q || (s.NAME || '').toLowerCase().includes(q) || (s.SHORTNAME || '').toLowerCase().includes(q))
      .sort((a, b) => {
        let av = '', bv = '';
        switch (shiftSortKey) {
          case 'order':     return shiftSortDir === 'asc' ? (a.POSITION ?? 0) - (b.POSITION ?? 0) : (b.POSITION ?? 0) - (a.POSITION ?? 0);
          case 'name':      av = a.NAME || ''; bv = b.NAME || ''; break;
          case 'shortname': av = a.SHORTNAME || ''; bv = b.SHORTNAME || ''; break;
          case 'duration':  return shiftSortDir === 'asc' ? (a.DURATION0 || 0) - (b.DURATION0 || 0) : (b.DURATION0 || 0) - (a.DURATION0 || 0);
        }
        const cmp = av.localeCompare(bv, 'de');
        return shiftSortDir === 'asc' ? cmp : -cmp;
      });
  }, [shifts, debouncedShiftSearch, shiftSortKey, shiftSortDir, showHidden]);

  const hiddenShiftCount = useMemo(() => shifts.filter(s => s.HIDE).length, [shifts]);

  const load = () => {
    setLoading(true);
    // inkl. ausgeblendeter Schichtarten laden, damit sie wieder einblendbar sind
    api.getShifts(true).then(data => {
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
    // Zeiten-Tabelle aus STARTEND0..7/DURATION0..7 (0=Mo..6=So, 7=Ft)
    const days: DayTimeRow[] = Array.from({ length: 8 }, (_, i) => {
      const se = s[`STARTEND${i}` as keyof ShiftType] as string | undefined;
      const dur = s[`DURATION${i}` as keyof ShiftType] as number | undefined;
      return { startend: (se || '').trim(), duration: dur ?? 0 };
    });
    setForm({
      NAME: s.NAME || '',
      SHORTNAME: s.SHORTNAME || '',
      colorHex: s.COLORBK_HEX || '#FFFFFF',
      colorTextHex: s.COLORTEXT_HEX || '#000000',
      colorBarHex: s.COLORBAR_HEX || '#000000',
      bold: Boolean(s.BOLD),
      HIDE: s.HIDE || false,
      NOEXTRA: Boolean((s as ShiftWithNoextra).NOEXTRA),
      days,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    // Pflichtfeld-Validierung
    if (!form.NAME.trim()) {
      setError('Bezeichnung ist ein Pflichtfeld.');
      return;
    }
    if (!form.SHORTNAME.trim()) {
      setError('Kürzel ist ein Pflichtfeld.');
      return;
    }
    // Zeiten-Validierung (bis zu 3 Zeiträume je Tagestyp, Format HH:MM-HH:MM)
    for (let i = 0; i < 8; i++) {
      const err = validateStartend(form.days[i].startend);
      if (err) {
        setError(`${DAY_TYPES[i]}: ${err}`);
        return;
      }
    }
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      NAME: form.NAME,
      SHORTNAME: form.SHORTNAME,
      COLORBK: hexToBGR(form.colorHex),
      COLORTEXT: hexToBGR(form.colorTextHex),
      COLORBAR: hexToBGR(form.colorBarHex),
      BOLD: form.bold ? 1 : 0,
      HIDE: form.HIDE,
      NOEXTRA: form.NOEXTRA,
      ...buildShiftTimeFields(form.days),
    };

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
    if (!await confirmDialog({ message: `Schichtart "${s.NAME}" wirklich ausblenden?`, danger: true })) return;
    try {
      await api.deleteShift(s.ID);
      showToast('Schichtart ausgeblendet', 'success');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  // Mo–Fr individuell, wenn die Zeiten der Tagestypen 0..4 nicht identisch sind
  const hasIndividualTimes = (s: ShiftType) => {
    const times = s.TIMES_BY_WEEKDAY || {};
    const key = (i: number) => {
      const t = times[String(i)];
      return t ? `${t.start}-${t.end}` : '';
    };
    const mon = key(0);
    return [1, 2, 3, 4].some(i => key(i) !== mon);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-extrabold tracking-[-0.02em] text-schrift">
          🕐 Schichtarten ({sortedShifts.length}{sortedShifts.length !== shifts.length ? ` / ${shifts.length}` : ''})
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="🔍 Suchen..."
            value={shiftSearch}
            onChange={e => setShiftSearch(e.target.value)}
            className={`px-3 py-1.5 text-sm w-40 ${EINGABE}`}
          />
          {shiftSearch && (
            <button
              onClick={() => setShiftSearch('')}
              className={`px-2 py-1.5 text-xs ${BTN_SEKUNDAER}`}
              title="Suche zurücksetzen" aria-label="Suche zurücksetzen"
            >✕</button>
          )}
          {hiddenShiftCount > 0 && (
            <label className="flex items-center gap-1.5 text-sm text-schrift-2 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={e => setShowHidden(e.target.checked)}
              />
              Ausgeblendete anzeigen ({hiddenShiftCount})
            </label>
          )}
          <button
            onClick={() => window.print()}
            className={`no-print px-3 py-1.5 text-sm flex items-center gap-1 ${BTN_SEKUNDAER}`}
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          {canAdmin && shifts.length > 1 && <button
            onClick={() => setShowReorder(true)}
            className={`no-print px-3 py-1.5 text-sm ${BTN_SEKUNDAER}`}
            title="Reihenfolge der Schichtarten manuell festlegen"
          >
            ↕ <span className="hidden sm:inline">Reihenfolge</span>
          </button>}
          {canAdmin && <button
            onClick={openCreate}
            className={`px-3 py-1.5 text-sm ${BTN_PRIMAER}`}
          >
            + Neu
          </button>}
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Desktop: Table layout (Taktwerk-Datentabelle: Kopf Fläche 2, Zeilen 28px, kein Zebra) */}
          <div className="bg-ebene border border-kontur rounded-panel overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-[#fafbfc] dark:bg-[#0e1522] text-[9px] font-bold uppercase tracking-[.08em]">
                <tr className="border-b border-kontur">
                  <th scope="col" className={`px-4 py-2 text-left cursor-pointer select-none whitespace-nowrap ${ZEILEN_HOVER} ${shiftSortKey === 'order' ? 'text-schrift' : 'text-schrift-3'}`} onClick={() => handleShiftSort('order')} title="Original-Reihenfolge (Position)">Reihenfolge{shiftSortIcon('order')}</th>
                  <th scope="col" className={`px-4 py-2 text-left cursor-pointer select-none whitespace-nowrap ${ZEILEN_HOVER} ${shiftSortKey === 'name' ? 'text-schrift' : 'text-schrift-3'}`} onClick={() => handleShiftSort('name')}>Name{shiftSortIcon('name')}</th>
                  <th scope="col" className={`px-4 py-2 text-left cursor-pointer select-none whitespace-nowrap ${ZEILEN_HOVER} ${shiftSortKey === 'shortname' ? 'text-schrift' : 'text-schrift-3'}`} onClick={() => handleShiftSort('shortname')}>Kürzel{shiftSortIcon('shortname')}</th>
                  <th scope="col" className="px-4 py-2 text-center text-schrift-3">Mo–Fr</th>
                  <th scope="col" className="px-4 py-2 text-center text-schrift-3">Sa</th>
                  <th scope="col" className="px-4 py-2 text-center text-schrift-3">So</th>
                  <th scope="col" className={`px-4 py-2 text-right cursor-pointer select-none whitespace-nowrap ${ZEILEN_HOVER} ${shiftSortKey === 'duration' ? 'text-schrift' : 'text-schrift-3'}`} onClick={() => handleShiftSort('duration')}>Dauer (Mo){shiftSortIcon('duration')}</th>
                  <th scope="col" className="px-4 py-2 text-center text-schrift-3">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {sortedShifts.map((s) => {
                  const times = s.TIMES_BY_WEEKDAY || {};
                  const weekdayTime = times['0'] || null;
                  const satTime = times['5'] || null;
                  const sunTime = times['6'] || null;
                  const indiv = hasIndividualTimes(s);
                  return (
                    <tr key={s.ID} className={`h-[28px] border-b border-kontur-soft ${ZEILEN_HOVER} transition-colors ${s.HIDE ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-1">
                        {/* Normalisierter 19px-Dienst-Chip (Rohfarbe wird nie direkt gerendert) */}
                        <DienstChip label={s.SHORTNAME || ''} bgColor={s.COLORBK_HEX} />
                      </td>
                      <td className="px-4 py-1 font-semibold text-schrift">
                        {s.NAME}
                        {!!s.HIDE && (
                          <StatusPille variant="gray" className="ml-2 align-middle">Ausgeblendet</StatusPille>
                        )}
                      </td>
                      <td className="px-4 py-1 text-schrift-2">{s.SHORTNAME}</td>
                      <td className="px-4 py-1 text-center text-schrift-2 font-mono tabular-nums text-xs">
                        {indiv
                          ? <span className="font-sans font-semibold text-schrift-2">Individuell</span>
                          : weekdayTime ? `${weekdayTime.start}–${weekdayTime.end}` : '—'}
                      </td>
                      <td className="px-4 py-1 text-center text-schrift-2 font-mono tabular-nums text-xs">
                        {indiv ? '' : satTime ? `${satTime.start}–${satTime.end}` : '—'}
                      </td>
                      <td className="px-4 py-1 text-center text-schrift-2 font-mono tabular-nums text-xs">
                        {indiv ? '' : sunTime ? `${sunTime.start}–${sunTime.end}` : '—'}
                      </td>
                      <td className="px-4 py-1 text-right text-schrift font-mono tabular-nums">
                        {s.DURATION0 ? `${s.DURATION0}h` : '—'}
                      </td>
                      <td className="px-4 py-1 text-center">
                        <div className="flex gap-1 justify-center">
                          {canAdmin && <button onClick={() => openEdit(s)} className={`px-2 py-0.5 text-xs ${BTN_SEKUNDAER}`}>Bearbeiten</button>}
                          {canAdmin && <button onClick={() => handleDelete(s)} className="px-2 py-0.5 text-xs border border-kontur rounded-ui text-signal hover:bg-signal-flaeche transition-colors">Ausblenden</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shifts.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-schrift-2">Keine Schichtarten</td></tr>
                )}
              </tbody>
            </table>
          </div>

          
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdropIn">
          <div className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="px-5 py-3 text-[13px] font-bold text-schrift border-b border-kontur">
              {editId !== null ? 'Schichtart bearbeiten' : 'Neue Schichtart'}
            </h2>
            {error && <div className="mx-5 mt-3 p-2 bg-signal-flaeche border border-[#eecfcf] dark:border-[#5a2626] text-signal rounded-ui text-sm">{error}</div>}
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Name *</label>
                <input
                  type="text"
                  autoFocus value={form.NAME}
                  aria-label="Name"
                  required aria-required="true"
                  onChange={e => { setForm(f => ({ ...f, NAME: e.target.value })); if (error?.includes('Bezeichnung')) setError(null); }}
                  className={`w-full px-3 py-2 text-sm ${!form.NAME.trim() && error?.includes('Bezeichnung') ? EINGABE_FEHLER : EINGABE}`}
                />
                {!form.NAME.trim() && error?.includes('Bezeichnung') && <p className="text-signal text-xs mt-0.5">Pflichtfeld</p>}
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1 flex items-center gap-1">
                  Kürzel *
                  <HelpTooltip text={"Kurzes Kürzel für die Schicht (1–4 Zeichen), das im Dienstplan angezeigt wird.\nBeispiel: F = Frühschicht, S = Spätschicht, N = Nachtschicht"} position="right" />
                </label>
                <input
                  type="text"
                  value={form.SHORTNAME}
                  aria-label="Kürzel"
                  required aria-required="true"
                  onChange={e => { setForm(f => ({ ...f, SHORTNAME: e.target.value })); if (error?.includes('Kürzel')) setError(null); }}
                  className={`w-full px-3 py-2 text-sm ${!form.SHORTNAME.trim() && error?.includes('Kürzel') ? EINGABE_FEHLER : EINGABE}`}
                />
                {!form.SHORTNAME.trim() && error?.includes('Kürzel') && <p className="text-signal text-xs mt-0.5">Pflichtfeld</p>}
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
                  {/* Rohfarben-Vorschau: zeigt bewusst den DBF-Wert, den der Nutzer bearbeitet */}
                  <div
                    className="flex-1 min-w-[5rem] h-9 rounded-ui border border-kontur flex items-center justify-center text-sm"
                    title="Rohfarbe (DBF-Wert)"
                    style={{ backgroundColor: form.colorHex, color: form.colorTextHex, borderLeft: `5px solid ${form.colorBarHex}`, fontWeight: form.bold ? 'bold' : 'normal' }}
                  >
                    {form.SHORTNAME || form.NAME}
                  </div>
                  {/* Daneben die normalisierte Darstellung, wie sie im Plan erscheint */}
                  <DienstChip label={form.SHORTNAME || form.NAME || '—'} bgColor={form.colorHex} title="Darstellung im Plan (normalisiert)" />
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

              {/* Zeiten-Tabelle: 8 Tagestypen Mo..So + Ft (R5.5-4..R5.5-13) */}
              <div className="border border-kontur rounded-panel p-3 bg-ebene">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[.08em] text-schrift-3 flex items-center gap-1">
                    ⏱️ Zeiten je Tagestyp
                    <HelpTooltip text={'Bis zu drei Zeiträume je Tagestyp, leerzeichengetrennt:\n06:00-10:00 14:00-18:00\nLeer = Schichtart an diesem Tag nicht gültig.\n"Ft" = Feiertag (eigener 8. Tagestyp).'} position="right" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm(f => {
                      const mo = f.days[0];
                      const days = f.days.map((d, i) => (i >= 1 && i <= 6 ? { ...mo } : d));
                      return { ...f, days };
                    })}
                    className="text-xs text-schrift-2 hover:text-schrift hover:underline"
                    title="Zeiten und Arbeitszeit von Mo auf Di–So übertragen"
                  >
                    Mo → Di–So übernehmen
                  </button>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#fafbfc] dark:bg-[#0e1522] border-b border-kontur">
                      <th scope="col" className="text-left px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3 w-10">Tag</th>
                      <th scope="col" className="text-left px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3">Zeiträume (max. 3)</th>
                      <th scope="col" className="text-left px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3 w-24">Arbeitszeit (h)</th>
                      <th scope="col" className="px-1 py-1 w-8"><span className="sr-only">Berechnen</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAY_TYPES.map((day, i) => {
                      const rowErr = validateStartend(form.days[i].startend);
                      return (
                        <tr key={day} className="border-b border-kontur-soft">
                          <td className={`px-2 py-1 font-semibold ${i === 7 ? 'text-signal' : 'text-schrift-2'}`} title={i === 7 ? 'Feiertag' : undefined}>{day}</td>
                          <td className="px-1 py-0.5">
                            <input
                              type="text"
                              value={form.days[i].startend}
                              placeholder="z. B. 06:00-14:00 oder leer"
                              aria-label={`Zeiträume ${day}`}
                              onChange={e => {
                                const days = [...form.days];
                                days[i] = { ...days[i], startend: e.target.value };
                                setForm(f => ({ ...f, days }));
                              }}
                              className={`w-full px-1 py-1 text-xs font-mono tabular-nums ${rowErr ? EINGABE_FEHLER : EINGABE}`}
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.days[i].duration || ''}
                              placeholder="—"
                              aria-label={`Arbeitszeit ${day}`}
                              onChange={e => {
                                const days = [...form.days];
                                days[i] = { ...days[i], duration: parseFloat(e.target.value) || 0 };
                                setForm(f => ({ ...f, days }));
                              }}
                              className={`w-full px-1 py-1 text-xs font-mono tabular-nums ${EINGABE}`}
                            />
                          </td>
                          <td className="px-1 py-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const days = [...form.days];
                                days[i] = { ...days[i], duration: computeStartendHours(days[i].startend) };
                                setForm(f => ({ ...f, days }));
                              }}
                              disabled={!!rowErr || !form.days[i].startend.trim()}
                              className={`px-1.5 py-1 text-xs ${BTN_SEKUNDAER} disabled:opacity-40`}
                              title={`Arbeitszeit ${day} aus den Zeiträumen berechnen`}
                              aria-label={`Arbeitszeit ${day} berechnen`}
                            >
                              🧮
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-schrift-3 leading-snug">
                  Ende ≤ Beginn bedeutet Tageswechsel (z. B. 22:00-06:00 endet am Folgetag).
                  Leere Zeile = Schichtart an diesem Tag nicht gültig. Die Arbeitszeit ist frei
                  setzbar (z. B. für Pausenabzug) — 🧮 berechnet die Summe der Zeiträume.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-schrift-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.NOEXTRA}
                  onChange={e => setForm(f => ({ ...f, NOEXTRA: e.target.checked }))}
                />
                Keine Arbeitszeitzuschläge berechnen
              </label>

              <label className="flex items-center gap-2 text-sm text-schrift-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.HIDE}
                  onChange={e => setForm(f => ({ ...f, HIDE: e.target.checked }))}
                />
                Ausgeblendet
              </label>
            </div>
            {/* Dialog-Fußzeile auf Fläche 2 (Taktwerk §7) */}
            <div className="flex gap-2 justify-end px-5 py-3 bg-[#fafbfc] dark:bg-[#0e1522] border-t border-kontur">
              <button onClick={() => setShowModal(false)} className={`px-4 py-2 text-sm ${BTN_SEKUNDAER}`}>Abbrechen</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.NAME.trim()}
                className={`px-4 py-2 text-sm ${BTN_PRIMAER} disabled:opacity-50`}
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
          entity="shifts"
          title="Schichtarten-Reihenfolge"
          items={shifts.map(s => ({ id: s.ID, label: `${s.NAME} (${s.SHORTNAME})` }))}
          onClose={() => setShowReorder(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
