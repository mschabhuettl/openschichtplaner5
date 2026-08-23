import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { WorkplaceEmployee } from '../api/client';
import type { Workplace, Employee } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import ReorderDialog from '../components/ReorderDialog';

// Das Original kennt für Arbeitsplätze nur Name, Kürzel und „Ausblenden" — keine
// Farbe (Handbuch „Arbeitsplätze erfassen"; ein zugeordneter Arbeitsplatz erscheint
// im Einsatzplan als Text, nicht eingefärbt). Daher hier bewusst keine Farb-Option.
interface WorkplaceForm {
  NAME: string;
  SHORTNAME: string;
  HIDE: boolean;
}

const EMPTY_FORM: WorkplaceForm = {
  NAME: '',
  SHORTNAME: '',
  HIDE: false,
};

export default function Workplaces() {
  const { canAdmin } = useAuth();
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [showReorder, setShowReorder] = useState(false);
  const [search, setSearch] = useState('');
  // Ausgeblendete Arbeitsplätze: standardmäßig verborgen, per Schalter wieder
  // einblendbar und damit reaktivierbar (sonst Sackgasse, kein Weg zurück).
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
  const [form, setForm] = useState<WorkplaceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  // Detail / assignment panel
  const [selectedWp, setSelectedWp] = useState<Workplace | null>(null);
  const [wpEmployees, setWpEmployees] = useState<WorkplaceEmployee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assignBusy, setAssignBusy] = useState<number | null>(null);
  const [showAssignPanel, setShowAssignPanel] = useState(false);

  const load = () => {
    setLoading(true);
    // inkl. ausgeblendeter Arbeitsplätze laden, damit sie wieder einblendbar sind
    api.getWorkplaces(true).then(data => {
      setWorkplaces(data);
      setLoading(false);
    }).catch((err) => { setLoading(false); showToast('Arbeitsplätze konnten nicht geladen werden. ' + String(err), 'error'); });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []); // nur beim Mount ausführen

  // Alle MA einmal laden (für das Zuordnungs-Panel)
  useEffect(() => {
    api.getEmployees().then(setAllEmployees).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (w: Workplace) => {
    setEditId(w.ID);
    setForm({
      NAME: w.NAME || '',
      SHORTNAME: w.SHORTNAME || '',
      HIDE: false,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setError(null);
    if (!form.NAME.trim()) { setError('Bezeichnung ist ein Pflichtfeld.'); return; }
    if (!form.SHORTNAME.trim()) { setError('Kürzel ist ein Pflichtfeld.'); return; }
    setSaving(true);
    const payload = {
      NAME: form.NAME,
      SHORTNAME: form.SHORTNAME,
      HIDE: form.HIDE,
    };
    try {
      if (editId !== null) {
        await api.updateWorkplace(editId, payload);
        showToast('Arbeitsplatz gespeichert ✓', 'success');
      } else {
        await api.createWorkplace(payload);
        showToast('Arbeitsplatz erstellt ✓', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (w: Workplace) => {
    if (!await confirmDialog({ message: `Arbeitsplatz "${w.NAME}" wirklich ausblenden?`, danger: true })) return;
    try {
      await api.deleteWorkplace(w.ID);
      showToast("Arbeitsplatz ausgeblendet", "success");
      if (selectedWp?.ID === w.ID) setSelectedWp(null);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  const openDetail = async (w: Workplace) => {
    setSelectedWp(w);
    setShowAssignPanel(false);
    setDetailLoading(true);
    try {
      const emps = await api.getWorkplaceEmployees(w.ID);
      setWpEmployees(emps);
    } catch {
      setWpEmployees([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (wpId: number) => {
    try {
      const emps = await api.getWorkplaceEmployees(wpId);
      setWpEmployees(emps);
    } catch {
      setWpEmployees([]);
    }
  };

  const handleAssign = async (employee_id: number) => {
    if (!selectedWp) return;
    setAssignBusy(employee_id);
    try {
      await api.assignEmployeeToWorkplace(selectedWp.ID, employee_id);
      showToast('Mitarbeiter zugeordnet ✓', 'success');
      await refreshDetail(selectedWp.ID);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setAssignBusy(null);
    }
  };

  const handleRemove = async (employee_id: number) => {
    if (!selectedWp) return;
    setAssignBusy(employee_id);
    try {
      await api.removeEmployeeFromWorkplace(selectedWp.ID, employee_id);
      showToast('Zuordnung entfernt', 'success');
      await refreshDetail(selectedWp.ID);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setAssignBusy(null);
    }
  };

  const assignedIds = new Set(wpEmployees.map(e => e.ID));

  return (
    <div className="p-2 sm:p-4 lg:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Left: Workplaces list */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-extrabold tracking-[-0.02em] text-schrift">🏭 Arbeitsplätze ({workplaces.length})</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="no-print px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur hover:bg-wash text-schrift text-sm rounded-ui flex items-center gap-1"
              title="Seite drucken"
            >
              🖨️ <span className="hidden sm:inline">Drucken</span>
            </button>
            {canAdmin && workplaces.length > 1 && <button
              onClick={() => setShowReorder(true)}
              className="no-print px-3 py-1.5 bg-ebene dark:bg-ebene-2 border border-kontur hover:bg-wash text-schrift text-sm rounded-ui"
              title="Reihenfolge der Arbeitsplätze manuell festlegen"
            >
              ↕ <span className="hidden sm:inline">Reihenfolge</span>
            </button>}
            {canAdmin && <button
              onClick={openCreate}
              className="px-3 py-1.5 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui text-sm font-semibold hover:opacity-90 transition-opacity"
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
              placeholder="🔍 Arbeitsplatz suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-72 px-3 py-1.5 border border-kontur rounded-ui text-sm bg-ebene dark:bg-ebene-2 text-schrift placeholder:text-schrift-3 focus:outline-none focus:border-glut focus:ring-[3px] focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
            />
            {workplaces.some(w => w.HIDE) && (
              <label className="flex items-center gap-1.5 text-sm text-schrift cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={e => setShowHidden(e.target.checked)}
                />
                Ausgeblendete anzeigen ({workplaces.filter(w => w.HIDE).length})
              </label>
            )}
          </div>
          <div className="bg-ebene rounded-panel border border-kontur overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-[#fafbfc] dark:bg-[#0e1522]">
                <tr>
                  <th scope="col" className="px-4 py-[6px] text-left text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3 border-b border-kontur">Name</th>
                  <th scope="col" className="px-4 py-[6px] text-left text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3 border-b border-kontur">Kürzel</th>
                  <th scope="col" className="px-4 py-[6px] text-center text-[9px] font-bold uppercase tracking-[.08em] text-schrift-3 border-b border-kontur">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {workplaces.filter(w => showHidden || !w.HIDE).filter(w => !search || w.NAME.toLowerCase().includes(search.toLowerCase()) || (w.SHORTNAME || '').toLowerCase().includes(search.toLowerCase())).map(w => (
                  <tr
                    key={w.ID}
                    className={`h-[28px] border-b border-kontur-soft cursor-pointer ${
                      selectedWp?.ID === w.ID
                        ? 'bg-[rgba(201,106,20,.07)] dark:bg-[rgba(240,163,92,.10)] shadow-[inset_2px_0_0_var(--glut)]'
                        : 'hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)]'
                    } transition-colors ${w.HIDE ? 'opacity-60' : ''}`}
                    onClick={() => openDetail(w)}
                  >
                    <td className="px-4 py-0 font-semibold text-schrift">
                      {w.NAME}
                      {w.HIDE && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-cell bg-wash text-schrift-2 border border-kontur align-middle">
                          Ausgeblendet
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-0 text-xs font-mono text-schrift-2">{w.SHORTNAME}</td>
                    <td className="px-4 py-0 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => openEdit(w)}
                          className="px-2 py-0.5 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui text-xs hover:bg-wash"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDelete(w)}
                          className="px-2 py-0.5 text-signal rounded-ui text-xs hover:bg-signal-flaeche"
                        >
                          Ausblenden
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {workplaces.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-8 text-schrift-2">Keine Arbeitsplätze</td></tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Right: Detail / Assignment panel */}
      {selectedWp && (
        <div className="w-80 flex-shrink-0">
          <div className="bg-ebene rounded-panel border border-kontur p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-ui flex items-center justify-center text-xs font-bold border border-kontur bg-wash text-schrift-2">
                {selectedWp.SHORTNAME?.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-schrift truncate">{selectedWp.NAME}</div>
                <div className="text-xs font-mono tabular-nums text-schrift-3">ID: {selectedWp.ID}</div>
              </div>
              <button
                onClick={() => setSelectedWp(null)}
                className="text-schrift-3 hover:text-schrift text-lg leading-none"
                title="Schließen"
              >
                ×
              </button>
            </div>

            {/* Assigned employees */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-schrift">
                  👥 Zugeordnete Mitarbeiter ({wpEmployees.length})
                </h3>
                <button
                  onClick={() => setShowAssignPanel(v => !v)}
                  className="text-xs px-2 py-0.5 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui hover:bg-wash"
                >
                  {showAssignPanel ? 'Schließen' : '+ Zuordnen'}
                </button>
              </div>
              {detailLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-kontur border-t-glut rounded-full animate-spin" />
                </div>
              ) : wpEmployees.length === 0 ? (
                <div className="text-xs text-schrift-2 py-2 text-center">Keine Mitarbeiter zugeordnet</div>
              ) : (
                <ul className="space-y-1">
                  {wpEmployees.map(e => (
                    <li key={e.ID} className="flex items-center justify-between bg-wash rounded-ui px-2 py-1">
                      <span className="text-sm text-schrift">
                        {e.FIRSTNAME} {e.NAME}
                        {e.SHORTNAME && <span className="text-schrift-2 ml-1">({e.SHORTNAME})</span>}
                      </span>
                      <button
                        onClick={() => handleRemove(e.ID)}
                        disabled={assignBusy === e.ID}
                        className="ml-2 text-xs text-signal hover:opacity-75 disabled:opacity-40"
                        title="Zuordnung entfernen"
                      >
                        {assignBusy === e.ID ? '…' : '✕'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Assignment picker */}
            {showAssignPanel && (
              <div className="border-t border-kontur pt-3">
                <div className="text-[10px] font-bold uppercase tracking-[.08em] text-schrift-3 mb-2">Mitarbeiter zuordnen:</div>
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {allEmployees
                    .filter(e => !assignedIds.has(e.ID))
                    .map(e => (
                      <div
                        key={e.ID}
                        className="flex items-center justify-between hover:bg-[rgba(21,23,28,.025)] dark:hover:bg-[rgba(233,236,242,.035)] rounded-ui px-2 py-1 cursor-pointer"
                        onClick={() => handleAssign(e.ID)}
                      >
                        <span className="text-sm text-schrift">
                          {e.FIRSTNAME} {e.NAME}
                          {e.SHORTNAME && <span className="text-schrift-2 ml-1">({e.SHORTNAME})</span>}
                        </span>
                        <span className="text-xs text-schrift-2 font-bold">
                          {assignBusy === e.ID ? '…' : '+'}
                        </span>
                      </div>
                    ))}
                  {allEmployees.filter(e => !assignedIds.has(e.ID)).length === 0 && (
                    <div className="text-xs text-schrift-2 py-2 text-center">Alle Mitarbeiter zugeordnet</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdropIn" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-ebene rounded-[10px] shadow-dialog dark:shadow-dialog-dark dark:border dark:border-kontur animate-scaleIn w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-[13px] font-bold text-schrift px-4 py-3 border-b border-kontur">
              {editId !== null ? 'Arbeitsplatz bearbeiten' : 'Neuer Arbeitsplatz'}
            </h2>
            {error && <div className="mx-4 mt-3 p-2 bg-signal-flaeche text-signal rounded-ui text-sm">{error}</div>}
            <div className="space-y-3 px-4 py-3.5">
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Name *</label>
                <input
                  type="text"
                  autoFocus value={form.NAME}
                  onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                  className="w-full px-3 py-2 border border-kontur rounded-ui text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-[3px] focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-schrift-3 mb-1">Kürzel</label>
                <input
                  type="text"
                  value={form.SHORTNAME}
                  onChange={e => setForm(f => ({ ...f, SHORTNAME: e.target.value }))}
                  className="w-full px-3 py-2 border border-kontur rounded-ui text-sm bg-ebene dark:bg-ebene-2 text-schrift focus:outline-none focus:border-glut focus:ring-[3px] focus:ring-[rgba(201,106,20,.12)] dark:focus:ring-[rgba(240,163,92,.15)]"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-schrift cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.HIDE}
                  onChange={e => setForm(f => ({ ...f, HIDE: e.target.checked }))}
                />
                Ausgeblendet
              </label>
            </div>
            <div className="flex gap-2 justify-end px-4 py-3 border-t border-kontur bg-[#fafbfc] dark:bg-[#0e1522]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-ebene dark:bg-ebene-2 border border-kontur text-schrift rounded-ui text-sm hover:bg-wash"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.NAME.trim()}
                className="px-4 py-2 bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] rounded-ui text-sm font-semibold hover:opacity-90 disabled:opacity-50"
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
          entity="workplaces"
          title="Arbeitsplätze-Reihenfolge"
          items={workplaces.map(w => ({ id: w.ID, label: w.NAME }))}
          onClose={() => setShowReorder(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
