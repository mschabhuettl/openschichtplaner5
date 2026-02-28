import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Employee, Group } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}

// ── Types ─────────────────────────────────────────────────────────────────

interface SP5User {
  ID: number;
  NAME: string;
  DESCRIP: string;
  ADMIN: boolean;
  RIGHTS: number;
  HIDE: boolean;
  role: string;  // 'Admin' | 'Planer' | 'Leser'
  POSITION?: number;
  WDUTIES?: boolean;
  WABSENCES?: boolean;
  BACKUP?: boolean;
}

type Role = 'Admin' | 'Planer' | 'Leser';

interface UserForm {
  NAME: string;
  DESCRIP: string;
  PASSWORD: string;
  role: Role;
}

const EMPTY_FORM: UserForm = {
  NAME: '',
  DESCRIP: '',
  PASSWORD: '',
  role: 'Leser',
};

type EmployeeAccessRecord = { id: number; user_id: number; employee_id: number; rights: number };
type GroupAccessRecord = { id: number; user_id: number; group_id: number; rights: number };

// ── Role Badge ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    Admin:  'bg-red-100 text-red-700 border border-red-200',
    Planer: 'bg-blue-100 text-blue-700 border border-blue-200',
    Leser:  'bg-gray-100 text-gray-600 border border-gray-200',
  };
  const icons: Record<string, string> = {
    Admin: '🔑',
    Planer: '✏️',
    Leser: '👁️',
  };
  const cls = styles[role] ?? styles.Leser;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span>{icons[role] ?? '👤'}</span>
      {role}
    </span>
  );
}

// ── Rights Label ──────────────────────────────────────────────────────────

function RightsLabel({ rights }: { rights: number }) {
  if (rights === 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">🚫 Kein Zugriff</span>;
  if (rights === 1) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">👁️ Lesen</span>;
  if (rights === 2) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✏️ Lesen + Schreiben</span>;
  return <span className="text-gray-400 text-xs">{rights}</span>;
}

// ── Add Employee Access Modal ─────────────────────────────────────────────

interface AddEmployeeAccessModalProps {
  userId: number;
  employees: Employee[];
  existingAccess: EmployeeAccessRecord[];
  onSaved: () => void;
  onClose: () => void;
}

function AddEmployeeAccessModal({ userId, employees, existingAccess, onSaved, onClose }: AddEmployeeAccessModalProps) {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [rights, setRights] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingIds = new Set(existingAccess.map(a => a.employee_id));
  const availableEmployees = employees.filter(e => !existingIds.has(e.ID));

  const handleSave = async () => {
    if (!employeeId) { setError('Bitte einen Mitarbeiter auswählen.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.setEmployeeAccess({ user_id: userId, employee_id: employeeId, rights });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Mitarbeiter-Zugriff hinzufügen</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mitarbeiter</label>
            <select
              value={employeeId ?? ''}
              onChange={e => setEmployeeId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">– Mitarbeiter auswählen –</option>
              {availableEmployees.map(emp => (
                <option key={emp.ID} value={emp.ID}>{emp.NAME}, {emp.FIRSTNAME}</option>
              ))}
            </select>
            {availableEmployees.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Alle Mitarbeiter haben bereits Zugriffsrechte.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Rechte-Level</label>
            <div className="flex gap-2">
              {[
                { value: 0, label: '🚫 Kein Zugriff' },
                { value: 1, label: '👁️ Lesen' },
                { value: 2, label: '✏️ Schreiben' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRights(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    rights === opt.value
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={saving || !employeeId}
            className="px-4 py-2 text-sm rounded-lg bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <span className="inline-block animate-spin">⟳</span>}
            Zugriff speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Group Access Modal ────────────────────────────────────────────────

interface AddGroupAccessModalProps {
  userId: number;
  groups: Group[];
  existingAccess: GroupAccessRecord[];
  onSaved: () => void;
  onClose: () => void;
}

function AddGroupAccessModal({ userId, groups, existingAccess, onSaved, onClose }: AddGroupAccessModalProps) {
  const [groupId, setGroupId] = useState<number | null>(null);
  const [rights, setRights] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingIds = new Set(existingAccess.map(a => a.group_id));
  const availableGroups = groups.filter(g => !existingIds.has(g.ID));

  const handleSave = async () => {
    if (!groupId) { setError('Bitte eine Gruppe auswählen.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.setGroupAccess({ user_id: userId, group_id: groupId, rights });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Gruppen-Zugriff hinzufügen</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gruppe</label>
            <select
              value={groupId ?? ''}
              onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">– Gruppe auswählen –</option>
              {availableGroups.map(g => (
                <option key={g.ID} value={g.ID}>{g.NAME}</option>
              ))}
            </select>
            {availableGroups.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Alle Gruppen haben bereits Zugriffsrechte.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Rechte-Level</label>
            <div className="flex gap-2">
              {[
                { value: 0, label: '🚫 Kein Zugriff' },
                { value: 1, label: '👁️ Lesen' },
                { value: 2, label: '✏️ Schreiben' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRights(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    rights === opt.value
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={saving || !groupId}
            className="px-4 py-2 text-sm rounded-lg bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <span className="inline-block animate-spin">⟳</span>}
            Zugriff speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Access Management Panel ───────────────────────────────────────────────

interface AccessPanelProps {
  user: SP5User;
  employees: Employee[];
  groups: Group[];
  onClose: () => void;
}

function AccessPanel({ user, employees, groups, onClose }: AccessPanelProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'groups'>('employees');
  const [employeeAccess, setEmployeeAccess] = useState<EmployeeAccessRecord[]>([]);
  const [groupAccess, setGroupAccess] = useState<GroupAccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();

  const loadAccess = useCallback(async () => {
    setLoading(true);
    try {
      const [empAccess, grpAccess] = await Promise.all([
        api.getEmployeeAccess(user.ID),
        api.getGroupAccess(user.ID),
      ]);
      setEmployeeAccess(empAccess as EmployeeAccessRecord[]);
      setGroupAccess(grpAccess as GroupAccessRecord[]);
    } catch (e) {
      console.error('Fehler beim Laden der Zugriffsrechte:', e);
    } finally {
      setLoading(false);
    }
  }, [user.ID]);

  useEffect(() => { loadAccess(); }, [loadAccess]);

  const getEmployeeName = (employeeId: number): string => {
    const emp = employees.find(e => e.ID === employeeId);
    if (!emp) return `MA #${employeeId}`;
    return `${emp.NAME}, ${emp.FIRSTNAME}`;
  };

  const getGroupName = (groupId: number): string => {
    const g = groups.find(g => g.ID === groupId);
    return g ? g.NAME : `Gruppe #${groupId}`;
  };

  const handleDeleteEmployeeAccess = async (record: EmployeeAccessRecord) => {
    if (!await confirmDialog({ message: `Mitarbeiter-Zugriff für "${getEmployeeName(record.employee_id)}" entfernen?`, danger: true })) return;
    try {
      await api.deleteEmployeeAccess(record.id);
      setEmployeeAccess(prev => prev.filter(a => a.id !== record.id));
      showToast('Zugriff entfernt', 'success');
    } catch (e) {
      showToast('Fehler: ' + String(e), 'error');
    }
  };

  const handleDeleteGroupAccess = async (record: GroupAccessRecord) => {
    if (!await confirmDialog({ message: `Gruppen-Zugriff für "${getGroupName(record.group_id)}" entfernen?`, danger: true })) return;
    try {
      await api.deleteGroupAccess(record.id);
      setGroupAccess(prev => prev.filter(a => a.id !== record.id));
      showToast('Zugriff entfernt', 'success');
    } catch (e) {
      showToast('Fehler: ' + String(e), 'error');
    }
  };

  return (
    <div className="mt-6 bg-white rounded-xl shadow border border-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔒</span>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Zugriffsrechte für <span className="text-blue-700">{user.NAME}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Steuere, auf welche Mitarbeiter und Gruppen dieser Benutzer zugreifen kann.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-xl leading-none px-2"
          title="Schließen" aria-label="Schließen"
        >
          ✕
        </button>
      </div>

      {/* Admin notice */}
      {user.ADMIN && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <p className="text-sm text-amber-800">
            <strong>{user.NAME}</strong> ist ein Administrator — Admins haben vollständigen Zugriff auf alle Mitarbeiter und Gruppen. Einschränkungen sind nicht nötig.
          </p>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 px-6 pt-4 border-b border-slate-100">
        {[
          { key: 'employees' as const, label: `👤 Mitarbeiter-Zugriff${employeeAccess.length > 0 ? ` (${employeeAccess.length})` : ''}` },
          { key: 'groups' as const, label: `👥 Gruppen-Zugriff${groupAccess.length > 0 ? ` (${groupAccess.length})` : ''}` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-700 border-slate-200 -mb-px z-10'
                : 'bg-slate-50 text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">⟳ Lade Zugriffsrechte...</div>
        ) : (
          <>
            {/* ── Mitarbeiter-Zugriff Tab ── */}
            {activeTab === 'employees' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-600">
                    Definiert, welche Mitarbeiter-Daten dieser Benutzer sehen oder bearbeiten darf.
                  </p>
                  <button
                    onClick={() => setShowAddEmployeeModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors font-medium"
                  >
                    + Zugriff hinzufügen
                  </button>
                </div>

                {employeeAccess.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 text-sm">
                    Keine Mitarbeiter-Zugriffsrechte konfiguriert.
                    <br />
                    <span className="text-xs">Ohne Einschränkungen gilt die Rollen-Berechtigung.</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left">Mitarbeiter</th>
                          <th className="px-4 py-2 text-center">Rechte</th>
                          <th className="px-4 py-2 text-center">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeAccess.map((acc, i) => (
                          <tr
                            key={acc.id}
                            className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}
                          >
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {getEmployeeName(acc.employee_id)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <RightsLabel rights={acc.rights} />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => handleDeleteEmployeeAccess(acc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                              >
                                🗑️ Entfernen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Gruppen-Zugriff Tab ── */}
            {activeTab === 'groups' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-600">
                    Definiert, auf welche Gruppen dieser Benutzer zugreifen darf.
                  </p>
                  <button
                    onClick={() => setShowAddGroupModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors font-medium"
                  >
                    + Zugriff hinzufügen
                  </button>
                </div>

                {groupAccess.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 text-sm">
                    Keine Gruppen-Zugriffsrechte konfiguriert.
                    <br />
                    <span className="text-xs">Ohne Einschränkungen gilt die Rollen-Berechtigung.</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left">Gruppe</th>
                          <th className="px-4 py-2 text-center">Rechte</th>
                          <th className="px-4 py-2 text-center">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupAccess.map((acc, i) => (
                          <tr
                            key={acc.id}
                            className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}
                          >
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {getGroupName(acc.group_id)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <RightsLabel rights={acc.rights} />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => handleDeleteGroupAccess(acc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                              >
                                🗑️ Entfernen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddEmployeeModal && (
        <AddEmployeeAccessModal
          userId={user.ID}
          employees={employees}
          existingAccess={employeeAccess}
          onSaved={() => {
            setShowAddEmployeeModal(false);
            loadAccess();
            showToast('Mitarbeiter-Zugriff gespeichert ✓', 'success');
          }}
          onClose={() => setShowAddEmployeeModal(false)}
        />
      )}

      {showAddGroupModal && (
        <AddGroupAccessModal
          userId={user.ID}
          groups={groups}
          existingAccess={groupAccess}
          onSaved={() => {
            setShowAddGroupModal(false);
            loadAccess();
            showToast('Gruppen-Zugriff gespeichert ✓', 'success');
          }}
          onClose={() => setShowAddGroupModal(false)}
        />
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function Benutzerverwaltung() {
  const { canAdmin } = useAuth();
  const [users, setUsers] = useState<SP5User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { dialogProps: confirmDialogProps } = useConfirm();

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<SP5User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search
  const [search, setSearch] = useState('');

  // ── Selected user for access management ────────────────────
  const [selectedUserForAccess, setSelectedUserForAccess] = useState<SP5User | null>(null);

  // ── Password change modal ──────────────────────────────────
  const [pwChangeUser, setPwChangeUser] = useState<SP5User | null>(null);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  // ── Data loading ────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, empsData, grpsData] = await Promise.all([
        fetch(`${API_BASE}/api/users`, { headers: getAuthHeaders() }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<SP5User[]>; }),
        api.getEmployees(),
        api.getGroups(),
      ]);
      setUsers(usersData);
      setEmployees(empsData);
      setGroups(grpsData);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Filtering ───────────────────────────────────────────────

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.NAME.toLowerCase().includes(q) ||
      u.DESCRIP.toLowerCase().includes(q) ||
      (u.role ?? '').toLowerCase().includes(q)
    );
  });

  // ── Open modal ──────────────────────────────────────────────

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (u: SP5User) => {
    setEditId(u.ID);
    setForm({
      NAME: u.NAME,
      DESCRIP: u.DESCRIP,
      PASSWORD: '',
      role: (u.role as Role) ?? 'Leser',
    });
    setFormError(null);
    setShowModal(true);
  };

  // ── Save ────────────────────────────────────────────────────

  const handleSave = async () => {
    setFormError(null);
    if (!form.NAME.trim()) { setFormError('Benutzername ist erforderlich.'); return; }
    if (editId === null && !form.PASSWORD.trim()) { setFormError('Passwort ist erforderlich.'); return; }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        NAME: form.NAME.trim(),
        DESCRIP: form.DESCRIP.trim(),
        role: form.role,
      };
      if (form.PASSWORD.trim()) {
        payload.PASSWORD = form.PASSWORD;
      }

      const url = editId !== null ? `${API_BASE}/api/users/${editId}` : `${API_BASE}/api/users`;
      const method = editId !== null ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }

      showToast(editId !== null ? 'Benutzer gespeichert ✓' : 'Benutzer erstellt ✓', 'success');
      setShowModal(false);
      load();
    } catch (e) {
      setFormError(String(e));
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/${deleteTarget.ID}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      showToast('Benutzer gelöscht', 'success');
      setDeleteTarget(null);
      // Clear access panel if the deleted user was selected
      if (selectedUserForAccess?.ID === deleteTarget.ID) {
        setSelectedUserForAccess(null);
      }
      load();
    } catch (e) {
      showToast(`Fehler: ${e}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Password Change ─────────────────────────────────────────

  const openPwChange = (u: SP5User) => {
    setPwChangeUser(u);
    setNewPw('');
    setConfirmPw('');
    setPwError(null);
  };

  const handlePwChange = async () => {
    if (!pwChangeUser) return;
    if (!newPw.trim()) { setPwError('Bitte ein Passwort eingeben.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwörter stimmen nicht überein.'); return; }
    setPwSaving(true);
    setPwError(null);
    try {
      await api.changePassword(pwChangeUser.ID, newPw);
      showToast(`Passwort für ${pwChangeUser.NAME} geändert ✓`, 'success');
      setPwChangeUser(null);
    } catch (e) {
      setPwError(String(e));
    } finally {
      setPwSaving(false);
    }
  };

  // ── Permission Summary ──────────────────────────────────────

  const permSummary = (u: SP5User): string => {
    const perms = [];
    if (u.WDUTIES) perms.push('Dienste');
    if (u.WABSENCES) perms.push('Abwesenheiten');
    if (u.BACKUP) perms.push('Backup');
    return perms.length > 0 ? perms.join(', ') : '—';
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">👤 Benutzerverwaltung</h1>
          <p className="text-sm text-slate-500 mt-0.5">SP5-Benutzer verwalten, Rollen und Berechtigungen</p>
        </div>
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors shadow"
          >
            <span>＋</span> Neuer Benutzer
          </button>
          )}
        </div>
      </div>

      {/* Role Legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        {(['Admin', 'Planer', 'Leser'] as Role[]).map(r => (
          <div key={r} className="flex items-center gap-2 text-xs text-slate-600">
            <RoleBadge role={r} />
            <span>
              {r === 'Admin' && '— Vollzugriff, alle Schreibrechte, Backup'}
              {r === 'Planer' && '— Dienstplan bearbeiten, Abwesenheiten eintragen'}
              {r === 'Leser' && '— Nur Lesen, keine Bearbeitungsrechte'}
            </span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Suche nach Name, Beschreibung oder Rolle…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-slate-500 text-sm py-12 text-center">Lade Benutzer…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Fehler beim Laden: {error}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto border border-slate-200">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="bg-slate-800 text-white text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Benutzername</th>
                <th className="text-left px-4 py-3">Beschreibung</th>
                <th className="text-center px-4 py-3">Rolle</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Berechtigungen</th>
                <th className="text-right px-4 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 text-sm">
                    {search ? 'Keine Benutzer gefunden.' : 'Keine Benutzer vorhanden.'}
                  </td>
                </tr>
              ) : (
                filtered.map((u, idx) => (
                  <tr
                    key={u.ID}
                    className={`border-t border-slate-100 transition-colors ${
                      selectedUserForAccess?.ID === u.ID
                        ? 'bg-blue-50'
                        : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    } hover:bg-slate-100`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">#{u.ID}</span>
                        {u.NAME}
                        {selectedUserForAccess?.ID === u.ID && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">🔒 Ausgewählt</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.DESCRIP || <span className="text-slate-300 italic">—</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <RoleBadge role={u.role ?? (u.ADMIN ? 'Admin' : 'Leser')} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
                      {permSummary(u)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canAdmin && (
                        <button
                          onClick={() => setSelectedUserForAccess(selectedUserForAccess?.ID === u.ID ? null : u)}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                            selectedUserForAccess?.ID === u.ID
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                          }`}
                          title="Zugriffsrechte verwalten"
                        >
                          🔒 Rechte
                        </button>
                        )}
                        {canAdmin && (
                        <button
                          onClick={() => openPwChange(u)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium transition-colors"
                          title="Passwort ändern"
                        >
                          🔑 Passwort
                        </button>
                        )}
                        {canAdmin && (
                        <button
                          onClick={() => openEdit(u)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                        >
                          ✏️ Bearbeiten
                        </button>
                        )}
                        {canAdmin && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-colors"
                        >
                          🗑️ Löschen
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100 bg-slate-50">
            {filtered.length} Benutzer {search ? `(gefiltert aus ${users.length})` : ''}
            {selectedUserForAccess && (
              <span className="ml-2 text-blue-600">
                · Zugriffsrechte: {selectedUserForAccess.NAME}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Access Management Panel ──────────────────────────── */}
      {selectedUserForAccess ? (
        <AccessPanel
          user={selectedUserForAccess}
          employees={employees}
          groups={groups}
          onClose={() => setSelectedUserForAccess(null)}
        />
      ) : (
        !loading && !error && (
          <div className="mt-6 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
            🔒 Benutzer auswählen — klicke auf <strong>"🔒 Rechte"</strong> bei einem Benutzer, um die Zugriffsrechte zu verwalten.
          </div>
        )
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                {editId !== null ? '✏️ Benutzer bearbeiten' : '＋ Neuer Benutzer'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >×</button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {formError}
                </div>
              )}

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                  Benutzername *
                </label>
                <input
                  type="text"
                  value={form.NAME}
                  onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                  placeholder="z.B. schmidt"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                  Beschreibung / Funktion
                </label>
                <input
                  type="text"
                  value={form.DESCRIP}
                  onChange={e => setForm(f => ({ ...f, DESCRIP: e.target.value }))}
                  placeholder="z.B. Personalabteilung"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                  Passwort {editId !== null ? '(leer lassen = unverändert)' : '*'}
                </label>
                <input
                  type="password"
                  value={form.PASSWORD}
                  onChange={e => setForm(f => ({ ...f, PASSWORD: e.target.value }))}
                  placeholder={editId !== null ? '••••••••  (unverändert)' : 'Neues Passwort'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                  Rolle *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Admin', 'Planer', 'Leser'] as Role[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={`py-2 px-3 rounded-lg border text-sm font-semibold transition-colors ${
                        form.role === r
                          ? r === 'Admin'
                            ? 'bg-red-600 text-white border-red-600'
                            : r === 'Planer'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-600 text-white border-slate-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {r === 'Admin' && '🔑 '}
                      {r === 'Planer' && '✏️ '}
                      {r === 'Leser' && '👁️ '}
                      {r}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {form.role === 'Admin' && 'Vollzugriff auf alle Funktionen, inkl. Benutzerverwaltung und Backup.'}
                  {form.role === 'Planer' && 'Kann Dienstpläne bearbeiten und Abwesenheiten eintragen.'}
                  {form.role === 'Leser' && 'Nur Lesezugriff auf Dienstpläne und Stammdaten.'}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow"
              >
                {saving ? 'Speichere…' : editId !== null ? 'Speichern' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Dialog ───────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5">
              <div className="text-4xl text-center mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                Benutzer löschen?
              </h3>
              <p className="text-sm text-slate-600 text-center">
                Möchten Sie den Benutzer <strong>{deleteTarget.NAME}</strong> wirklich löschen?
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-center gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow"
              >
                {deleting ? 'Lösche…' : '🗑️ Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Change Modal ───────────────────────────────── */}
      {pwChangeUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">🔑 Passwort ändern</h2>
              <button onClick={() => setPwChangeUser(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Neues Passwort für <strong>{pwChangeUser.NAME}</strong> festlegen.
              </p>
              {pwError && (
                <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{pwError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Neues Passwort *</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Neues Passwort"
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Bestätigung *</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Passwort wiederholen"
                  onKeyDown={e => e.key === 'Enter' && handlePwChange()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setPwChangeUser(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handlePwChange}
                disabled={pwSaving}
                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow"
              >
                {pwSaving ? 'Speichere…' : '🔑 Passwort ändern'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
