import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Restriction } from '../api/client';
import type { Employee, ShiftType } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useT } from '../i18n';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Format an ISO date string (YYYY-MM-DD) to German short format (DD.MM.YYYY). */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}.${m}.${y}`;
  } catch {
    return iso;
  }
}

// ── Print helper ───────────────────────────────────────────────
function printEmployeeList(employees: Employee[]) {
  const now = new Date().toLocaleString('de-AT');
  const thStyle = 'border:1px solid #aaa;padding:5px 10px;background:#334155;color:#fff;font-size:12px;text-align:left;white-space:nowrap;';
  const thRStyle = thStyle.replace('text-align:left', 'text-align:right');
  const tdStyle = 'border:1px solid #ddd;padding:4px 10px;font-size:12px;';
  const tdRStyle = tdStyle + 'text-align:right;';
  const tdCStyle = tdStyle + 'text-align:center;';

  let rows = '';
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const workdays = (emp.WORKDAYS_LIST || []).slice(0, 7)
      .map((active, idx) => active
        ? `<span style="background:#3b82f6;color:#fff;border-radius:3px;padding:0 4px;font-size:9px;margin:0 1px">${WEEKDAYS[idx]}</span>`
        : `<span style="background:#e5e7eb;color:#9ca3af;border-radius:3px;padding:0 4px;font-size:9px;margin:0 1px">${WEEKDAYS[idx]}</span>`)
      .join('');
    rows += `<tr>
      <td style="${tdStyle}background:${bg};color:#6b7280">${emp.NUMBER || '—'}</td>
      <td style="${tdStyle}background:${bg};font-weight:600">${emp.NAME}</td>
      <td style="${tdStyle}background:${bg}">${emp.FIRSTNAME}</td>
      <td style="${tdStyle}background:${bg};color:#374151">${emp.SHORTNAME || '—'}</td>
      <td style="${tdRStyle}background:${bg};color:#374151">${emp.HRSDAY?.toFixed(1) ?? '—'}h</td>
      <td style="${tdRStyle}background:${bg};color:#374151">${emp.HRSWEEK?.toFixed(1) ?? '—'}h</td>
      <td style="${tdCStyle}background:${bg}">${workdays}</td>
      <td style="${tdCStyle}background:${bg};color:#6b7280;font-size:11px">${fmtDate(emp.EMPSTART)}</td>
    </tr>`;
  }

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Mitarbeiterliste</title>
<style>
  body { font-family: Arial, sans-serif; margin: 12px; }
  h1 { font-size: 15px; margin-bottom: 2px; }
  .subtitle { font-size: 11px; color: #555; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; }
  @media print {
    @page { size: landscape; margin: 8mm; }
    body { margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
<h1>👥 Mitarbeiterliste</h1>
<div class="subtitle">${employees.length} Mitarbeiter &nbsp;|&nbsp; Erstellt: ${now}</div>
<table>
  <thead>
    <tr>
      <th style="${thStyle}">Nr.</th>
      <th style="${thStyle}">Nachname</th>
      <th style="${thStyle}">Vorname</th>
      <th style="${thStyle}">Kürzel</th>
      <th style="${thRStyle}">Std/Tag</th>
      <th style="${thRStyle}">Std/Woche</th>
      <th style="${thStyle}text-align:center">Arbeitstage</th>
      <th style="${thStyle}text-align:center">Eintritt</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1300,height=800');
  if (!w) { alert('Popup-Fenster blockiert! Bitte den Popup-Blocker für diese Seite deaktivieren.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

interface EmployeeForm {
  NAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
  NUMBER: string;
  HRSDAY: number;
  HRSWEEK: number;
  HRSMONTH: number;
  HRSTOTAL: number;
  WORKDAYS: string;
  HIDE: boolean;
  BOLD: number;
  SEX: number;
  // Personal
  SALUTATION: string;
  STREET: string;
  ZIP: string;
  TOWN: string;
  PHONE: string;
  EMAIL: string;
  FUNCTION: string;
  BIRTHDAY: string;
  EMPSTART: string;
  EMPEND: string;
  // Calc
  CALCBASE: number;
  DEDUCTHOL: number;
  // Notes
  NOTE1: string;
  NOTE2: string;
  NOTE3: string;
  NOTE4: string;
  ARBITR1: string;
  ARBITR2: string;
  ARBITR3: string;
  // Colors (hex string for picker, converted to int on save)
  CFGLABEL_HEX: string;
  CBKLABEL_HEX: string;
  CBKSCHED_HEX: string;
}

const EMPTY_FORM: EmployeeForm = {
  NAME: '',
  FIRSTNAME: '',
  SHORTNAME: '',
  NUMBER: '',
  HRSDAY: 8,
  HRSWEEK: 40,
  HRSMONTH: 0,
  HRSTOTAL: 0,
  WORKDAYS: '1 1 1 1 1 0 0 0',
  HIDE: false,
  BOLD: 0,
  SEX: 0,
  SALUTATION: '',
  STREET: '',
  ZIP: '',
  TOWN: '',
  PHONE: '',
  EMAIL: '',
  FUNCTION: '',
  BIRTHDAY: '',
  EMPSTART: '',
  EMPEND: '',
  CALCBASE: 0,
  DEDUCTHOL: 0,
  NOTE1: '',
  NOTE2: '',
  NOTE3: '',
  NOTE4: '',
  ARBITR1: '',
  ARBITR2: '',
  ARBITR3: '',
  CFGLABEL_HEX: '#000000',
  CBKLABEL_HEX: '#ffffff',
  CBKSCHED_HEX: '#ffffff',
};

/** Convert #RRGGBB hex to BGR integer */
function hexToBgr(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return b + g * 256 + r * 65536;
}

/** Convert BGR integer to #RRGGBB hex */
function bgrToHex(bgr: number | undefined): string {
  if (bgr == null) return '#ffffff';
  const b = bgr & 0xFF;
  const g = (bgr >> 8) & 0xFF;
  const r = (bgr >> 16) & 0xFF;
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function listToWorkdays(list: boolean[]): string {
  return list.map(v => (v ? '1' : '0')).join(' ') + ' 0';
}

export default function Employees() {
  const t = useT();
  const { canAdmin } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState(() => sessionStorage.getItem('emp-search') ?? '');
  const [filterGroupId, setFilterGroupId] = useState<number | ''>(() => {
    const v = sessionStorage.getItem('emp-filterGroupId');
    return v ? Number(v) : '';
  });
  const [filterHide, setFilterHide] = useState<'all' | 'active' | 'hidden'>(
    () => (sessionStorage.getItem('emp-filterHide') as 'all' | 'active' | 'hidden') ?? 'active'
  );
  const debouncedSearch = useDebounce(search, 300);

  // Persist filters to sessionStorage
  useEffect(() => { sessionStorage.setItem('emp-search', search); }, [search]);
  useEffect(() => { sessionStorage.setItem('emp-filterGroupId', filterGroupId === '' ? '' : String(filterGroupId)); }, [filterGroupId]);
  useEffect(() => { sessionStorage.setItem('emp-filterHide', filterHide); }, [filterHide]);
  const [groups, setGroups] = useState<{ ID: number; NAME: string; SHORTNAME?: string }[]>([]);
  const [groupAssignments, setGroupAssignments] = useState<{ employee_id: number; group_id: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ NAME: boolean; SHORTNAME: boolean }>({ NAME: false, SHORTNAME: false });
  const [workdaysList, setWorkdaysList] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [activeTab, setActiveTab] = useState<'basic' | 'personal' | 'colors' | 'notes' | 'groups'>('basic');

  // ── Group assignments for modal ──────────────────────────────
  const [empGroupIds_modal, setEmpGroupIds_modal] = useState<number[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();

  // ── Bulk selection state ─────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkGroupId, setBulkGroupId] = useState<number | ''>('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [showBulkGroupModal, setShowBulkGroupModal] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e.ID)));
    }
  };

  const handleBulkHide = async (hide: boolean) => {
    if (selectedIds.size === 0) return;
    const label = hide ? 'ausblenden' : 'einblenden';
    const confirmed = await confirmDialog({
      message: `${selectedIds.size} Mitarbeiter wirklich ${label}?`,
      danger: hide,
    });
    if (!confirmed) return;
    setBulkWorking(true);
    try {
      const res = await api.bulkEmployeeAction({ employee_ids: Array.from(selectedIds), action: hide ? 'hide' : 'show' });
      showToast(`${res.affected} Mitarbeiter ${label} ✓`, 'success');
      setSelectedIds(new Set());
      load();
      api.getGroupAssignments().then(setGroupAssignments).catch(() => {});
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setBulkWorking(false);
    }
  };

  const handleBulkAssignGroup = async () => {
    if (selectedIds.size === 0 || bulkGroupId === '') return;
    setBulkWorking(true);
    try {
      const res = await api.bulkEmployeeAction({ employee_ids: Array.from(selectedIds), action: 'assign_group', group_id: Number(bulkGroupId) });
      showToast(`${res.affected} Mitarbeiter Gruppe zugewiesen ✓`, 'success');
      setSelectedIds(new Set());
      setShowBulkGroupModal(false);
      setBulkGroupId('');
      api.getGroupAssignments().then(setGroupAssignments).catch(() => {});
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    } finally {
      setBulkWorking(false);
    }
  };

  // ── Restrictions state ──────────────────────────────────────
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [newRestrShiftId, setNewRestrShiftId] = useState<number | ''>('');
  const [newRestrReason, setNewRestrReason] = useState('');
  const [restrSaving, setRestrSaving] = useState(false);
  const [restrError, setRestrError] = useState<string | null>(null);

  // ── Photo state ─────────────────────────────────────────────
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.getEmployees().then(data => {
      setEmployees(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Load groups and group assignments for filter
  useEffect(() => {
    api.getGroups().then(g => setGroups(g.filter(gr => !gr.HIDE))).catch(() => {});
    api.getGroupAssignments().then(setGroupAssignments).catch(() => {});
  }, []);

  // Load shifts once (for restriction dropdown)
  useEffect(() => {
    api.getShifts().then(setShifts).catch(() => {});
  }, []);

  // Reset photo when modal opens/closes
  useEffect(() => {
    if (showModal && editId !== null) {
      // Try to load photo (will fail with 404 if none — that's fine)
      const url = api.getEmployeePhotoUrl(editId);
      setPhotoUrl(url + '?t=' + Date.now());
    } else {
      setPhotoUrl(null);
    }
  }, [showModal, editId]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || editId === null) return;
    setPhotoUploading(true);
    try {
      await api.uploadEmployeePhoto(editId, file);
      const url = api.getEmployeePhotoUrl(editId);
      setPhotoUrl(url + '?t=' + Date.now());
      showToast('Foto hochgeladen ✓', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload fehlgeschlagen', 'error');
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  type EmpSortKey = 'number' | 'name' | 'firstname' | 'shortname';
  type EmpSortDir = 'asc' | 'desc';
  const [empSortKey, setEmpSortKey] = useState<EmpSortKey>('number');
  const [empSortDir, setEmpSortDir] = useState<EmpSortDir>('asc');

  const handleEmpSort = (key: EmpSortKey) => {
    if (empSortKey === key) setEmpSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setEmpSortKey(key); setEmpSortDir('asc'); }
  };
  const sortIcon = (key: EmpSortKey) => empSortKey === key ? (empSortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  const empGroupIds = (empId: number) => groupAssignments.filter(a => a.employee_id === empId).map(a => a.group_id);

  const filtered = employees
    .filter(e => {
      if (!`${e.NAME} ${e.FIRSTNAME} ${e.SHORTNAME} ${e.NUMBER}`.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (filterGroupId !== '' && !empGroupIds(e.ID).includes(Number(filterGroupId))) return false;
      if (filterHide === 'active' && e.HIDE) return false;
      if (filterHide === 'hidden' && !e.HIDE) return false;
      return true;
    })
    .sort((a, b) => {
      let av = '', bv = '';
      switch (empSortKey) {
        case 'number':    av = String(Number(a.NUMBER) || 0).padStart(6, '0'); bv = String(Number(b.NUMBER) || 0).padStart(6, '0'); break;
        case 'name':      av = a.NAME || ''; bv = b.NAME || ''; break;
        case 'firstname': av = a.FIRSTNAME || ''; bv = b.FIRSTNAME || ''; break;
        case 'shortname': av = a.SHORTNAME || ''; bv = b.SHORTNAME || ''; break;
      }
      const cmp = av.localeCompare(bv, 'de');
      return empSortDir === 'asc' ? cmp : -cmp;
    });

  const loadRestrictions = (empId: number) => {
    api.getRestrictions(empId)
      .then(setRestrictions)
      .catch(() => setRestrictions([]));
  };

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setWorkdaysList([true, true, true, true, true, false, false]);
    setError(null);
    setTouched({ NAME: false, SHORTNAME: false });
    setRestrictions([]);
    setNewRestrShiftId('');
    setNewRestrReason('');
    setRestrError(null);
    setEmpGroupIds_modal([]);
    setActiveTab('basic');
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditId(emp.ID);
    setWorkdaysList(emp.WORKDAYS_LIST?.slice(0, 7) ?? [true, true, true, true, true, false, false]);
    setForm({
      NAME: emp.NAME || '',
      FIRSTNAME: emp.FIRSTNAME || '',
      SHORTNAME: emp.SHORTNAME_GENERATED ? '' : (emp.SHORTNAME || ''),
      NUMBER: emp.NUMBER || '',
      HRSDAY: emp.HRSDAY || 8,
      HRSWEEK: emp.HRSWEEK || 40,
      HRSMONTH: emp.HRSMONTH || 0,
      HRSTOTAL: emp.HRSTOTAL || 0,
      WORKDAYS: listToWorkdays(emp.WORKDAYS_LIST?.slice(0, 7) ?? [true, true, true, true, true, false, false]),
      HIDE: emp.HIDE || false,
      BOLD: emp.BOLD || 0,
      SEX: emp.SEX || 0,
      SALUTATION: emp.SALUTATION || '',
      STREET: emp.STREET || '',
      ZIP: emp.ZIP || '',
      TOWN: emp.TOWN || '',
      PHONE: emp.PHONE || '',
      EMAIL: emp.EMAIL || '',
      FUNCTION: emp.FUNCTION || '',
      BIRTHDAY: emp.BIRTHDAY || '',
      EMPSTART: emp.EMPSTART || '',
      EMPEND: emp.EMPEND || '',
      CALCBASE: emp.CALCBASE || 0,
      DEDUCTHOL: emp.DEDUCTHOL || 0,
      NOTE1: emp.NOTE1 || '',
      NOTE2: emp.NOTE2 || '',
      NOTE3: emp.NOTE3 || '',
      NOTE4: emp.NOTE4 || '',
      ARBITR1: emp.ARBITR1 || '',
      ARBITR2: emp.ARBITR2 || '',
      ARBITR3: emp.ARBITR3 || '',
      CFGLABEL_HEX: bgrToHex(emp.CFGLABEL),
      CBKLABEL_HEX: bgrToHex(emp.CBKLABEL),
      CBKSCHED_HEX: bgrToHex(emp.CBKSCHED),
    });
    setError(null);
    setTouched({ NAME: false, SHORTNAME: false });
    setNewRestrShiftId('');
    setNewRestrReason('');
    setRestrError(null);
    setEmpGroupIds_modal(groupAssignments.filter(a => a.employee_id === emp.ID).map(a => a.group_id));
    loadRestrictions(emp.ID);
    setShowModal(true);
  };

  const handleSave = async () => {
    // Pflichtfeld-Validierung
    if (!form.NAME.trim()) {
      setError('Nachname ist ein Pflichtfeld.');
      return;
    }
    if (!form.SHORTNAME.trim()) {
      setError('Kürzel ist ein Pflichtfeld.');
      return;
    }
    setSaving(true);
    setError(null);
    const { CFGLABEL_HEX, CBKLABEL_HEX, CBKSCHED_HEX, ...rest } = form;
    const payload = {
      ...rest,
      WORKDAYS: listToWorkdays(workdaysList),
      CFGLABEL: hexToBgr(CFGLABEL_HEX),
      CBKLABEL: hexToBgr(CBKLABEL_HEX),
      CBKSCHED: hexToBgr(CBKSCHED_HEX),
    };
    try {
      if (editId !== null) {
        await api.updateEmployee(editId, payload);
        showToast('Mitarbeiter aktualisiert ✓', 'success');
      } else {
        await api.createEmployee(payload);
        showToast('Mitarbeiter erstellt ✓', 'success');
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

  const handleDelete = async (emp: Employee) => {
    if (!await confirmDialog({ message: `Mitarbeiter "${emp.NAME} ${emp.FIRSTNAME}" wirklich ausblenden?`, danger: true })) return;
    try {
      await api.deleteEmployee(emp.ID);
      showToast('Mitarbeiter ausgeblendet', 'success');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  const toggleWorkday = (i: number) => {
    setWorkdaysList(prev => prev.map((v, idx) => idx === i ? !v : v));
  };

  // ── Restriction handlers ────────────────────────────────────
  const handleAddRestriction = async () => {
    if (!editId || newRestrShiftId === '') return;
    setRestrSaving(true);
    setRestrError(null);
    try {
      await api.addRestriction({
        employee_id: editId,
        shift_id: Number(newRestrShiftId),
        reason: newRestrReason,
        weekday: 0,
      });
      setNewRestrShiftId('');
      setNewRestrReason('');
      loadRestrictions(editId);
    } catch (e: unknown) {
      setRestrError(e instanceof Error ? e.message : 'Fehler beim Hinzufügen');
    } finally {
      setRestrSaving(false);
    }
  };

  const handleRemoveRestriction = async (r: Restriction) => {
    if (!editId) return;
    try {
      await api.removeRestriction(editId, r.shift_id, r.weekday);
      loadRestrictions(editId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Fehler beim Entfernen');
    }
  };

  // Shifts not yet restricted (to show in dropdown)
  const restrictedShiftIds = new Set(restrictions.map(r => r.shift_id));
  const availableShifts = shifts.filter(s => !restrictedShiftIds.has(s.ID));

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">
          👥 Mitarbeiter ({filtered.length}{filtered.length !== employees.length ? ` / ${employees.length}` : ''})
        </h1>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder={t.employees.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 border rounded shadow-sm text-sm w-48"
          />
          <select
            value={filterGroupId}
            onChange={e => setFilterGroupId(e.target.value === '' ? '' : Number(e.target.value))}
            className="px-2 py-1.5 border rounded shadow-sm text-sm bg-white"
            title="Nach Gruppe filtern"
          >
            <option value="">{t.employees.allGroups}</option>
            {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
          </select>
          <select
            value={filterHide}
            onChange={e => setFilterHide(e.target.value as 'all' | 'active' | 'hidden')}
            className="px-2 py-1.5 border rounded shadow-sm text-sm bg-white"
            title="Aktiv/Inaktiv"
          >
            <option value="active">{t.employees.filterActive}</option>
            <option value="all">{t.employees.filterAll}</option>
            <option value="hidden">{t.employees.filterHidden}</option>
          </select>
          {(search || filterGroupId !== '' || filterHide !== 'active' || debouncedSearch) && (
            <button
              onClick={() => { setSearch(''); setFilterGroupId(''); setFilterHide('active'); }}
              className="px-2 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded border border-red-200"
              title="Filter zurücksetzen"
            >{t.employees.resetFilter}</button>
          )}
          <button
            onClick={() => printEmployeeList(filtered)}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white rounded text-sm font-semibold transition-colors flex items-center gap-1.5"
            title="Mitarbeiterliste drucken (Landscape)"
          >
            {t.employees.printButton}
          </button>
          {canAdmin && <button
            onClick={openCreate}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            {t.employees.addButton}
          </button>}
        </div>
      </div>
      {/* ── Bulk Action Bar ────────────────────────────────────── */}
      {canAdmin && selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm font-semibold text-blue-700">{selectedIds.size} {t.employees.selected}</span>
          <button
            onClick={() => setShowBulkGroupModal(true)}
            disabled={bulkWorking}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >{t.employees.assignGroup}</button>
          <button
            onClick={() => handleBulkHide(false)}
            disabled={bulkWorking}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
          >{t.employees.showAll}</button>
          <button
            onClick={() => handleBulkHide(true)}
            disabled={bulkWorking}
            className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-50"
          >{t.employees.hideSelected}</button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 ml-auto"
          >{t.employees.clearSelection}</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop: Table layout */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-700 text-white text-xs uppercase tracking-wide">
                <tr>
                  {canAdmin && <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length; }}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                      title="Alle auswählen"
                    />
                  </th>}
                  <th className="px-4 py-2 text-left cursor-pointer hover:bg-slate-600 select-none whitespace-nowrap" onClick={() => handleEmpSort('number')}>{t.employees.columns.number}{sortIcon('number')}</th>
                  <th className="px-4 py-2 text-left cursor-pointer hover:bg-slate-600 select-none whitespace-nowrap" onClick={() => handleEmpSort('name')}>{t.employees.columns.name}{sortIcon('name')}</th>
                  <th className="px-4 py-2 text-left cursor-pointer hover:bg-slate-600 select-none whitespace-nowrap" onClick={() => handleEmpSort('firstname')}>{t.employees.columns.firstname}{sortIcon('firstname')}</th>
                  <th className="px-4 py-2 text-left cursor-pointer hover:bg-slate-600 select-none whitespace-nowrap" onClick={() => handleEmpSort('shortname')}>{t.employees.columns.shortname}{sortIcon('shortname')}</th>
                  <th className="px-4 py-2 text-right">{t.employees.columns.hrsDay}</th>
                  <th className="px-4 py-2 text-center">{t.employees.columns.workdays}</th>
                  <th className="px-4 py-2 text-center">{t.employees.columns.entry}</th>
                  <th className="px-4 py-2 text-center">{t.employees.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, i) => (
                  <tr key={emp.ID} className={`border-b ${selectedIds.has(emp.ID) ? 'bg-blue-50 dark:bg-blue-900/20' : i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'} hover:bg-blue-50 transition-colors`}>
                    {canAdmin && <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.ID)}
                        onChange={() => toggleSelect(emp.ID)}
                        className="cursor-pointer"
                      />
                    </td>}
                    <td className="px-4 py-2 text-gray-500">{emp.NUMBER}</td>
                    <td className="px-4 py-2 font-semibold">{emp.NAME}</td>
                    <td className="px-4 py-2">{emp.FIRSTNAME}</td>
                    <td className="px-4 py-2 text-gray-500">{emp.SHORTNAME}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{emp.HRSDAY?.toFixed(1)}h</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex gap-0.5 justify-center">
                        {(emp.WORKDAYS_LIST || []).slice(0, 7).map((active, idx) => (
                          <span key={idx} className={`text-[10px] px-1 rounded ${active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            {WEEKDAYS[idx]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500 text-xs">{fmtDate(emp.EMPSTART)}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => navigate(`/mitarbeiter/${emp.ID}`)} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">{t.employees.actions.profile}</button>
                        {canAdmin && <button onClick={() => openEdit(emp)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">{t.employees.actions.edit}</button>}
                        {canAdmin && <button onClick={() => handleDelete(emp)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">{t.employees.actions.hide}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={canAdmin ? 9 : 8} className="text-center py-8 text-gray-400">{t.employees.noResults}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card layout */}
          <div className="block md:hidden space-y-3">
            {filtered.map(emp => (
              <div key={emp.ID} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-gray-900 truncate">
                        {emp.NAME} {emp.FIRSTNAME}
                      </span>
                      {emp.SHORTNAME && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-slate-700 text-white text-xs font-bold rounded">
                          {emp.SHORTNAME}
                        </span>
                      )}
                    </div>
                    {emp.NUMBER && (
                      <div className="text-xs text-gray-400 mt-0.5">Nr. {emp.NUMBER}</div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(emp)}
                      className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-base leading-none"
                      title="Bearbeiten"
                    >✏️</button>
                    <button
                      onClick={() => handleDelete(emp)}
                      className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-base leading-none"
                      title="Ausblenden"
                    >🗑️</button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                  <span>{emp.HRSDAY?.toFixed(1)}h/Tag</span>
                  {emp.HRSWEEK ? <span>{emp.HRSWEEK?.toFixed(1)}h/Woche</span> : null}
                  {emp.EMPSTART && <span className="text-xs text-gray-400">Eintritt: {fmtDate(emp.EMPSTART)}</span>}
                </div>
                <div className="mt-2 flex gap-0.5 flex-wrap">
                  {(emp.WORKDAYS_LIST || []).slice(0, 7).map((active, idx) => (
                    <span
                      key={idx}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}
                    >
                      {WEEKDAYS[idx]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-400">Keine Mitarbeiter gefunden</div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editId !== null ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
            </h2>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

            {/* Tabs */}
            <div className="flex border-b mb-4 gap-1">
              {(['basic', 'personal', 'colors', 'notes', ...(editId !== null ? ['groups' as const] : [])] as const).map(tab => {
                const labels: Record<string, string> = { basic: '📋 Grunddaten', personal: '👤 Person', colors: '🎨 Farben', notes: '📝 Notizen', groups: '🏢 Gruppen' };
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-t border-b-2 transition-colors ${activeTab === tab ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* Tab: Grunddaten */}
            {activeTab === 'basic' && (
              <div>
                {/* Photo Avatar (only when editing) */}
                {editId !== null && (
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => photoInputRef.current?.click()}
                      title="Foto hochladen"
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt="Mitarbeiter Foto"
                          className="w-full h-full object-cover"
                          onError={() => setPhotoUrl(null)}
                        />
                      ) : (
                        <span className="text-xl font-bold text-gray-400">
                          {(form.NAME.charAt(0) || '?').toUpperCase()}{(form.FIRSTNAME.charAt(0) || '').toUpperCase()}
                        </span>
                      )}
                      {photoUploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-0.5">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      <p className="font-semibold text-gray-700">Foto</p>
                      <p>JPG, PNG oder GIF</p>
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="mt-1 text-blue-600 hover:underline"
                      >
                        {photoUrl ? 'Foto ändern' : 'Foto hochladen'}
                      </button>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nachname *</label>
                    <input type="text" value={form.NAME}
                      onChange={e => { setForm(f => ({ ...f, NAME: e.target.value })); if (error?.includes('Nachname')) setError(null); }}
                      onBlur={() => setTouched(t => ({ ...t, NAME: true }))}
                      className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${!form.NAME.trim() && (touched.NAME || error?.includes('Nachname')) ? 'border-red-400 focus:ring-red-400' : 'focus:ring-blue-500'}`} />
                    {!form.NAME.trim() && (touched.NAME || error?.includes('Nachname')) && <p className="text-red-500 text-xs mt-0.5">Pflichtfeld</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Vorname</label>
                    <input type="text" value={form.FIRSTNAME} onChange={e => setForm(f => ({ ...f, FIRSTNAME: e.target.value }))}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Kürzel *</label>
                    <input type="text" value={form.SHORTNAME}
                      onChange={e => { setForm(f => ({ ...f, SHORTNAME: e.target.value })); if (error?.includes('Kürzel')) setError(null); }}
                      onBlur={() => setTouched(t => ({ ...t, SHORTNAME: true }))}
                      placeholder={
                        (() => {
                          const fn = (form.FIRSTNAME || '').trim();
                          const ln = (form.NAME || '').trim();
                          if (fn && ln) return (fn[0] + ln.slice(0, 2)).toUpperCase();
                          if (ln) return ln.slice(0, 3).toUpperCase();
                          if (fn) return fn.slice(0, 3).toUpperCase();
                          return 'z.B. HMU';
                        })()
                      }
                      className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${!form.SHORTNAME.trim() && (touched.SHORTNAME || error?.includes('Kürzel')) ? 'border-red-400 focus:ring-red-400' : 'focus:ring-blue-500'}`} />
                    {!form.SHORTNAME.trim() && (touched.SHORTNAME || error?.includes('Kürzel')) && <p className="text-red-500 text-xs mt-0.5">Pflichtfeld</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Personalnr.</label>
                    <input type="text" value={form.NUMBER} onChange={e => setForm(f => ({ ...f, NUMBER: e.target.value }))}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Std/Tag</label>
                    <input type="number" step="0.5" value={form.HRSDAY} onChange={e => setForm(f => ({ ...f, HRSDAY: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Std/Woche</label>
                    <input type="number" step="0.5" value={form.HRSWEEK} onChange={e => setForm(f => ({ ...f, HRSWEEK: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Std/Monat</label>
                    <input type="number" step="0.5" value={form.HRSMONTH} onChange={e => setForm(f => ({ ...f, HRSMONTH: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Gesamtstunden</label>
                    <input type="number" step="0.5" value={form.HRSTOTAL} onChange={e => setForm(f => ({ ...f, HRSTOTAL: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Arbeitstage</label>
                  <div className="flex gap-1">
                    {WEEKDAYS.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleWorkday(i)}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${workdaysList[i] ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.HIDE} onChange={e => setForm(f => ({ ...f, HIDE: e.target.checked }))} className="rounded" />
                    Ausgeblendet
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.BOLD === 1} onChange={e => setForm(f => ({ ...f, BOLD: e.target.checked ? 1 : 0 }))} className="rounded" />
                    Fettschrift
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Berechnungsbasis</label>
                    <select value={form.CALCBASE} onChange={e => setForm(f => ({ ...f, CALCBASE: parseInt(e.target.value) }))}
                      className="w-full px-2 py-2 border dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-100">
                      <option value="0">{t.employees.worktimeUnit.perDay}</option>
                      <option value="1">{t.employees.worktimeUnit.perWeek}</option>
                      <option value="2">{t.employees.worktimeUnit.perMonth}</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-5">
                      <input type="checkbox" checked={form.DEDUCTHOL === 1} onChange={e => setForm(f => ({ ...f, DEDUCTHOL: e.target.checked ? 1 : 0 }))} className="rounded" />
                      Feiertage abziehen
                    </label>
                  </div>
                </div>

                {/* Restrictions section (only when editing) */}
                {editId !== null && (
                  <div className="mt-5 border-t pt-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      🚫 Einschränkungen
                      <span className="text-xs font-normal text-gray-500">(Schichten, die diesem Mitarbeiter nicht zugewiesen werden dürfen)</span>
                    </h3>
                    {restrError && <div className="mb-2 p-2 bg-red-50 text-red-700 rounded text-xs">{restrError}</div>}
                    {restrictions.length > 0 ? (
                      <div className="mb-3 space-y-1">
                        {restrictions.map(r => (
                          <div key={r.id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded px-3 py-1.5 text-sm">
                            <span className="font-semibold text-orange-800 text-xs px-1.5 py-0.5 bg-orange-200 rounded">{r.shift_short || r.shift_name}</span>
                            <span className="text-orange-700 flex-1 text-xs">{r.shift_name}</span>
                            {r.reason && <span className="text-gray-500 text-xs italic">„{r.reason}"</span>}
                            <button aria-label="Schließen" onClick={() => handleRemoveRestriction(r)} className="ml-auto text-red-500 hover:text-red-700 text-xs px-1.5 py-0.5 hover:bg-red-100 rounded transition-colors" title="Einschränkung entfernen">✕</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-3">Keine Einschränkungen gesetzt.</p>
                    )}
                    <div className="flex gap-2 items-end flex-wrap">
                      <div className="flex-1 min-w-[140px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Schicht</label>
                        <select value={newRestrShiftId} onChange={e => setNewRestrShiftId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full px-2 py-1.5 border dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-700 dark:text-gray-100">
                          <option value="">Schicht wählen…</option>
                          {availableShifts.map(s => <option key={s.ID} value={s.ID}>{s.SHORTNAME} – {s.NAME}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Grund (optional)</label>
                        <input type="text" maxLength={20} placeholder="z.B. Gesundheit" value={newRestrReason} onChange={e => setNewRestrReason(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      </div>
                      <button onClick={handleAddRestriction} disabled={newRestrShiftId === '' || restrSaving}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded text-sm font-semibold hover:bg-orange-600 disabled:opacity-40 transition-colors whitespace-nowrap">
                        {restrSaving ? '…' : '+ Hinzufügen'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Persönliche Daten */}
            {activeTab === 'personal' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Anrede</label>
                  <select value={form.SALUTATION} onChange={e => setForm(f => ({ ...f, SALUTATION: e.target.value }))}
                    className="w-full px-2 py-2 border dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-100">
                    <option value="">—</option>
                    <option value="Herr">{t.employees.salutation.mr}</option>
                    <option value="Frau">{t.employees.salutation.ms}</option>
                    <option value="Divers">{t.employees.salutation.diverse}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Funktion/Stelle</label>
                  <input type="text" value={form.FUNCTION} onChange={e => setForm(f => ({ ...f, FUNCTION: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Geburtstag</label>
                  <input type="date" value={form.BIRTHDAY} onChange={e => setForm(f => ({ ...f, BIRTHDAY: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Eintrittsdatum</label>
                  <input type="date" value={form.EMPSTART} onChange={e => setForm(f => ({ ...f, EMPSTART: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Austrittsdatum</label>
                  <input type="date" value={form.EMPEND} onChange={e => setForm(f => ({ ...f, EMPEND: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Straße</label>
                  <input type="text" value={form.STREET} onChange={e => setForm(f => ({ ...f, STREET: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">PLZ</label>
                  <input type="text" value={form.ZIP} onChange={e => setForm(f => ({ ...f, ZIP: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ort</label>
                  <input type="text" value={form.TOWN} onChange={e => setForm(f => ({ ...f, TOWN: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Telefon</label>
                  <input type="tel" value={form.PHONE} onChange={e => setForm(f => ({ ...f, PHONE: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">E-Mail</label>
                  <input type="email" value={form.EMAIL} onChange={e => setForm(f => ({ ...f, EMAIL: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Freies Feld 1</label>
                  <input type="text" value={form.ARBITR1} onChange={e => setForm(f => ({ ...f, ARBITR1: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Freies Feld 2</label>
                  <input type="text" value={form.ARBITR2} onChange={e => setForm(f => ({ ...f, ARBITR2: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Freies Feld 3</label>
                  <input type="text" value={form.ARBITR3} onChange={e => setForm(f => ({ ...f, ARBITR3: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {/* Tab: Farben */}
            {activeTab === 'colors' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Individuelle Farben für die Darstellung im Dienstplan. Leer = Standardfarben des Programms.</p>
                {[
                  { key: 'CFGLABEL_HEX' as const, label: 'Textfarbe (Label)', desc: 'Schriftfarbe im Namenslabel' },
                  { key: 'CBKLABEL_HEX' as const, label: 'Hintergrundfarbe (Label)', desc: 'Hintergrund des Namenslabels' },
                  { key: 'CBKSCHED_HEX' as const, label: 'Hintergrundfarbe (Dienstplan)', desc: 'Zeilenhintergrund im Dienstplan' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer border-2 border-gray-200" />
                      <span className="text-xs font-mono text-gray-500">{form[key]}</span>
                    </div>
                    <div className="w-16 h-8 rounded border" style={{ backgroundColor: form[key] }} />
                  </div>
                ))}
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Vorschau:</p>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded text-sm font-semibold"
                      style={{ backgroundColor: form.CBKLABEL_HEX, color: form.CFGLABEL_HEX }}>
                      {form.SHORTNAME || form.NAME || 'Vorname'}
                    </span>
                    <span className="px-6 py-1 rounded text-sm border" style={{ backgroundColor: form.CBKSCHED_HEX }}>
                      <span className="text-gray-400 text-xs">← Dienstplanzeile</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Notizen */}
            {activeTab === 'notes' && (
              <div className="space-y-3">
                {[
                  { key: 'NOTE1' as const, label: 'Notiz 1' },
                  { key: 'NOTE2' as const, label: 'Notiz 2' },
                  { key: 'NOTE3' as const, label: 'Notiz 3' },
                  { key: 'NOTE4' as const, label: 'Notiz 4' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                    <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} rows={2}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Gruppen */}
            {activeTab === 'groups' && editId !== null && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Gruppen-Zugehörigkeiten dieses Mitarbeiters verwalten.</p>
                {groups.length === 0 ? (
                  <div className="text-sm text-gray-400 italic">Keine Gruppen vorhanden.</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {groups.map(g => {
                      const isMember = empGroupIds_modal.includes(g.ID);
                      return (
                        <label key={g.ID} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${isMember ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                          <input
                            type="checkbox"
                            checked={isMember}
                            disabled={groupSaving}
                            onChange={async () => {
                              setGroupSaving(true);
                              try {
                                if (isMember) {
                                  await api.removeGroupMember(g.ID, editId);
                                  setEmpGroupIds_modal(prev => prev.filter(id => id !== g.ID));
                                  setGroupAssignments(prev => prev.filter(a => !(a.employee_id === editId && a.group_id === g.ID)));
                                } else {
                                  await api.addGroupMember(g.ID, editId);
                                  setEmpGroupIds_modal(prev => [...prev, g.ID]);
                                  setGroupAssignments(prev => [...prev, { employee_id: editId, group_id: g.ID }]);
                                }
                                showToast(isMember ? `Aus "${g.NAME}" entfernt` : `Zu "${g.NAME}" hinzugefügt`, 'success');
                              } catch (e) {
                                showToast(e instanceof Error ? e.message : 'Fehler', 'error');
                              } finally {
                                setGroupSaving(false);
                              }
                            }}
                            className="rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800">{g.NAME}</div>
                            {g.SHORTNAME && <div className="text-xs text-gray-500">{g.SHORTNAME}</div>}
                          </div>
                          {isMember && <span className="text-xs text-blue-600 font-semibold">✓ Mitglied</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-5 justify-end border-t pt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">Abbrechen</button>
              {activeTab !== 'groups' && (
              <button
                onClick={handleSave}
                disabled={saving || !form.NAME.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> : null}
                Speichern
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />

      {/* ── Bulk Group Assign Modal ────────────────────────────── */}
      {showBulkGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBulkGroupModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Gruppe zuweisen</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedIds.size} Mitarbeiter werden der gewählten Gruppe hinzugefügt.</p>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Zielgruppe</label>
            <select
              value={bulkGroupId}
              onChange={e => setBulkGroupId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 border rounded text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Gruppe auswählen —</option>
              {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}{g.SHORTNAME ? ` (${g.SHORTNAME})` : ''}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBulkGroupModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">Abbrechen</button>
              <button
                onClick={handleBulkAssignGroup}
                disabled={bulkGroupId === '' || bulkWorking}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
              >{bulkWorking ? 'Wird gespeichert...' : 'Zuweisen'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
