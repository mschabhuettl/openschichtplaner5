import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Group, Employee } from '../types';
import { useToast } from '../hooks/useToast';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface GroupForm {
  NAME: string;
  SHORTNAME: string;
  SUPERID: number;
  HIDE: boolean;
  BOLD: number;
  DAILYDEM: number;
  ARBITR: string;
  CFGLABEL_HEX: string;
  CBKLABEL_HEX: string;
  CBKSCHED_HEX: string;
}

const EMPTY_FORM: GroupForm = {
  NAME: '',
  SHORTNAME: '',
  SUPERID: 0,
  HIDE: false,
  BOLD: 0,
  DAILYDEM: 0,
  ARBITR: '',
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

export default function Groups() {
  const { canAdmin } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [groupMembers, setGroupMembers] = useState<Record<number, Employee[]>>({});
  const [membersLoading, setMembersLoading] = useState<Set<number>>(new Set());
  const [memberSearch, setMemberSearch] = useState<Record<number, string>>({});
  const [showModal, setShowModal] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSort, setGroupSort] = useState<'default' | 'name-asc' | 'name-desc' | 'short-asc'>('default');

  const sortGroups = (list: Group[]): Group[] => {
    if (groupSort === 'default') return list;
    return [...list].sort((a, b) => {
      switch (groupSort) {
        case 'name-asc':  return (a.NAME || '').localeCompare(b.NAME || '', 'de');
        case 'name-desc': return (b.NAME || '').localeCompare(a.NAME || '', 'de');
        case 'short-asc': return (a.SHORTNAME || '').localeCompare(b.SHORTNAME || '', 'de');
        default: return 0;
      }
    });
  };

  const load = () => {
    setLoading(true);
    api.getGroups().then(data => {
      setGroups(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.getEmployees().then(setAllEmployees).catch(() => {});
  }, []);

  const toggleMembers = useCallback(async (groupId: number) => {
    if (expandedGroups.has(groupId)) {
      setExpandedGroups(prev => { const s = new Set(prev); s.delete(groupId); return s; });
      return;
    }
    setExpandedGroups(prev => new Set([...prev, groupId]));
    if (groupMembers[groupId]) return;
    setMembersLoading(prev => new Set([...prev, groupId]));
    try {
      const members = await api.getGroupMembers(groupId);
      setGroupMembers(prev => ({ ...prev, [groupId]: members }));
    } catch {
      setGroupMembers(prev => ({ ...prev, [groupId]: [] }));
    } finally {
      setMembersLoading(prev => { const s = new Set(prev); s.delete(groupId); return s; });
    }
  }, [expandedGroups, groupMembers]);

  const handleAddMember = async (groupId: number, empId: number) => {
    try {
      await api.addGroupMember(groupId, empId);
      const members = await api.getGroupMembers(groupId);
      setGroupMembers(prev => ({ ...prev, [groupId]: members }));
      setGroups(prev => prev.map(g => g.ID === groupId ? { ...g, member_count: (g.member_count ?? 0) + 1 } : g));
      showToast('Mitarbeiter hinzugefügt ✓', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    }
  };

  const handleRemoveMember = async (groupId: number, empId: number) => {
    try {
      await api.removeGroupMember(groupId, empId);
      setGroupMembers(prev => ({ ...prev, [groupId]: (prev[groupId] ?? []).filter(e => e.ID !== empId) }));
      setGroups(prev => prev.map(g => g.ID === groupId ? { ...g, member_count: Math.max(0, (g.member_count ?? 1) - 1) } : g));
      showToast('Mitarbeiter entfernt', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', 'error');
    }
  };

  const searchLower = groupSearch.toLowerCase();
  const matchesGroupSearch = (g: Group): boolean => {
    if (!searchLower) return true;
    return (g.NAME || '').toLowerCase().includes(searchLower) ||
           (g.SHORTNAME || '').toLowerCase().includes(searchLower);
  };
  const topLevel = sortGroups(
    groups.filter(g => (!g.SUPERID || !groups.find(p => p.ID === g.SUPERID)) && matchesGroupSearch(g))
  );
  const childrenOf = (id: number) => sortGroups(groups.filter(g => g.SUPERID === id && matchesGroupSearch(g)));

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (g: Group) => {
    setEditId(g.ID);
    setForm({
      NAME: g.NAME || '',
      SHORTNAME: g.SHORTNAME || '',
      SUPERID: g.SUPERID || 0,
      HIDE: g.HIDE || false,
      BOLD: g.BOLD || 0,
      DAILYDEM: g.DAILYDEM || 0,
      ARBITR: g.ARBITR || '',
      CFGLABEL_HEX: bgrToHex(g.CFGLABEL),
      CBKLABEL_HEX: bgrToHex(g.CBKLABEL),
      CBKSCHED_HEX: bgrToHex(g.CBKSCHED),
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { CFGLABEL_HEX, CBKLABEL_HEX, CBKSCHED_HEX, ...rest } = form;
    const payload = {
      ...rest,
      CFGLABEL: hexToBgr(CFGLABEL_HEX),
      CBKLABEL: hexToBgr(CBKLABEL_HEX),
      CBKSCHED: hexToBgr(CBKSCHED_HEX),
    };
    try {
      if (editId !== null) {
        await api.updateGroup(editId, payload);
        showToast('Gruppe gespeichert ✓', 'success');
      } else {
        await api.createGroup(payload);
        showToast('Gruppe erstellt ✓', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: Group) => {
    if (!await confirmDialog({ title: 'Gruppe ausblenden', message: `Gruppe "${g.NAME}" wirklich ausblenden?`, confirmLabel: 'Ausblenden', danger: true })) return;
    try {
      await api.deleteGroup(g.ID);
      showToast("Gruppe ausgeblendet", "success");
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Fehler beim Löschen', 'error');
    }
  };

  const renderGroup = (g: Group, depth = 0) => {
    const children = childrenOf(g.ID);
    return (
      <div key={g.ID}>
        <div
          className="flex items-center gap-2 sm:gap-3 py-2.5 border-b border-gray-100 hover:bg-blue-50 transition-colors pr-3"
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          <span className="text-gray-400 flex-shrink-0">{depth > 0 ? '└' : '●'}</span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-gray-800 truncate">{g.NAME}</span>
            {g.SHORTNAME && g.SHORTNAME !== g.NAME && (
              <span className="ml-2 text-xs text-gray-400 hidden sm:inline">({g.SHORTNAME})</span>
            )}
          </div>
          <button
            onClick={() => toggleMembers(g.ID)}
            className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 transition-colors ${expandedGroups.has(g.ID) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-blue-100'}`}
            title="Mitglieder anzeigen"
          >
            {g.member_count ?? 0} MA {expandedGroups.has(g.ID) ? '▲' : '▼'}
          </button>
          {canAdmin && <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => openEdit(g)}
              className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 hidden sm:block"
            >Bearbeiten</button>
            <button
              onClick={() => openEdit(g)}
              className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-base leading-none sm:hidden"
              title="Bearbeiten"
            >✏️</button>
            <button
              onClick={() => handleDelete(g)}
              className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 hidden sm:block"
            >Ausblenden</button>
            <button
              onClick={() => handleDelete(g)}
              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-base leading-none sm:hidden"
              title="Ausblenden"
            >🗑️</button>
          </div>}
        </div>
        {expandedGroups.has(g.ID) && (
          <div className="border-b border-gray-100 bg-blue-50/50" style={{ paddingLeft: `${32 + depth * 24}px`, paddingRight: '16px', paddingTop: '8px', paddingBottom: '8px' }}>
            {membersLoading.has(g.ID) ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Lade Mitglieder...
              </div>
            ) : (
              <>
                {(groupMembers[g.ID] ?? []).length === 0 ? (
                  <div className="text-xs text-gray-400 italic py-1">Keine Mitglieder in dieser Gruppe.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(groupMembers[g.ID] ?? []).map(emp => (
                      <span key={emp.ID} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-700 shadow-sm">
                        <button onClick={() => navigate(`/mitarbeiter/${emp.ID}`)} className="font-medium hover:text-blue-600 transition-colors">
                          {emp.FIRSTNAME} {emp.NAME}
                        </button>
                        {canAdmin && (
                          <button aria-label="Schließen"
                            onClick={() => handleRemoveMember(g.ID, emp.ID)}
                            className="ml-0.5 text-gray-300 hover:text-red-500 transition-colors font-bold text-xs leading-none"
                            title="Aus Gruppe entfernen"
                          >×</button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {canAdmin && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="🔍 Mitarbeiter hinzufügen..."
                      value={memberSearch[g.ID] ?? ''}
                      onChange={e => setMemberSearch(prev => ({ ...prev, [g.ID]: e.target.value }))}
                      className="px-2 py-1 border rounded text-xs w-48 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {memberSearch[g.ID] && (
                      <div className="absolute z-20 bg-white border rounded shadow-lg mt-6 max-h-32 overflow-y-auto w-48" style={{ marginTop: '28px', position: 'absolute' }}>
                        {allEmployees
                          .filter(e => !e.HIDE && !((groupMembers[g.ID] ?? []).find(m => m.ID === e.ID)) &&
                            `${e.NAME} ${e.FIRSTNAME} ${e.SHORTNAME}`.toLowerCase().includes((memberSearch[g.ID] ?? '').toLowerCase()))
                          .slice(0, 8)
                          .map(emp => (
                            <button
                              key={emp.ID}
                              onClick={() => { handleAddMember(g.ID, emp.ID); setMemberSearch(prev => ({ ...prev, [g.ID]: '' })); }}
                              className="block w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors"
                            >
                              {emp.FIRSTNAME} {emp.NAME} <span className="text-gray-400">({emp.SHORTNAME})</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {children.map(c => renderGroup(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={`🏢 Gruppen (${groups.length})`}
        actions={
          <>
            <input
              type="text"
              placeholder="🔍 Suchen..."
              value={groupSearch}
              onChange={e => setGroupSearch(e.target.value)}
              className="px-3 py-1.5 border rounded shadow-sm text-sm w-44"
            />
            <select
              value={groupSort}
              onChange={e => setGroupSort(e.target.value as typeof groupSort)}
              className="px-3 py-1.5 border rounded shadow-sm text-sm bg-white"
              title="Sortierung"
            >
              <option value="default">Reihenfolge ↕</option>
              <option value="name-asc">Name A → Z ↑</option>
              <option value="name-desc">Name Z → A ↓</option>
              <option value="short-asc">Kürzel A → Z ↑</option>
            </select>
            {canAdmin && <button
              onClick={openCreate}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              + Neu
            </button>}
            <button
              onClick={() => window.print()}
              className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
              title="Seite drucken"
            >
              🖨️ <span className="hidden sm:inline">Drucken</span>
            </button>
          </>
        }
      />
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          {topLevel.length === 0 && <div className="text-center py-8 text-gray-400">Keine Gruppen</div>}
          {topLevel.map(g => renderGroup(g))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editId !== null ? 'Gruppe bearbeiten' : 'Neue Gruppe'}
            </h2>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                  <input type="text" autoFocus value={form.NAME} onChange={e => setForm(f => ({ ...f, NAME: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Kürzel</label>
                  <input type="text" value={form.SHORTNAME} onChange={e => setForm(f => ({ ...f, SHORTNAME: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Übergeordnete Gruppe</label>
                <select value={form.SUPERID} onChange={e => setForm(f => ({ ...f, SUPERID: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value={0}>— keine —</option>
                  {groups.filter(g => g.ID !== editId).map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tagesbedarf</label>
                  <input type="number" min="0" value={form.DAILYDEM} onChange={e => setForm(f => ({ ...f, DAILYDEM: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Freies Feld</label>
                  <input type="text" value={form.ARBITR} onChange={e => setForm(f => ({ ...f, ARBITR: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.HIDE} onChange={e => setForm(f => ({ ...f, HIDE: e.target.checked }))} />
                  Ausgeblendet
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.BOLD === 1} onChange={e => setForm(f => ({ ...f, BOLD: e.target.checked ? 1 : 0 }))} />
                  Fettschrift
                </label>
              </div>
              {/* Color settings */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">🎨 Gruppenfarben</p>
                {[
                  { key: 'CFGLABEL_HEX' as const, label: 'Textfarbe' },
                  { key: 'CBKLABEL_HEX' as const, label: 'Hintergrundfarbe (Label)' },
                  { key: 'CBKSCHED_HEX' as const, label: 'Hintergrundfarbe (Plan)' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 mb-2">
                    <label className="text-xs text-gray-600 w-40 flex-shrink-0">{label}</label>
                    <input type="color" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                    <div className="w-20 h-6 rounded border text-center" style={{ backgroundColor: form[key] }}>
                      <span className="text-xs font-mono" style={{ color: key === 'CFGLABEL_HEX' ? form['CBKLABEL_HEX'] : form['CFGLABEL_HEX'] }}>{form.SHORTNAME || form.NAME}</span>
                    </div>
                  </div>
                ))}
              </div>
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
