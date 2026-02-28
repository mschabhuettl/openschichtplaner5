import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';

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

interface Employee {
  ID: number;
  NAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
  HRSDAY: number;
  HRSWEEK: number;
  HRSMONTH: number;
  HIDE: number;
  FUNCTION?: string;
  WORKDAYS_LIST?: boolean[];
}

interface Group {
  ID: number;
  NAME: string;
}

interface EditState {
  hrsDay: string;
  hrsWeek: string;
  hrsMonth: string;
}

const FULLTIME_WEEK = 40.0;

const PRESETS = [
  { label: 'Vollzeit 40h', day: 8.0, week: 40.0, month: 173.3 },
  { label: 'Vollzeit 38,5h', day: 7.7, week: 38.5, month: 166.7 },
  { label: 'Teilzeit 30h', day: 6.0, week: 30.0, month: 130.0 },
  { label: 'Teilzeit 20h', day: 4.0, week: 20.0, month: 86.7 },
  { label: 'Geringfügig 10h', day: 2.0, week: 10.0, month: 43.3 },
];

function ptPercent(hrsWeek: number): number {
  return Math.round((hrsWeek / FULLTIME_WEEK) * 100);
}

function ptColor(pct: number): string {
  if (pct >= 90) return 'bg-blue-500';
  if (pct >= 70) return 'bg-indigo-400';
  if (pct >= 50) return 'bg-violet-400';
  if (pct >= 25) return 'bg-amber-400';
  return 'bg-rose-400';
}

function ptLabel(pct: number): string {
  if (pct >= 90) return 'Vollzeit';
  if (pct >= 70) return 'Teilzeit 75%';
  if (pct >= 50) return 'Teilzeit 50%';
  if (pct >= 25) return 'Geringfügig';
  return 'Minimal';
}

function HoursBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-12 text-right">{value.toFixed(1)} h</span>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${color}`}>
      <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}

function DistributionChart({ employees }: { employees: Employee[] }) {
  const buckets = [
    { label: '0–24%', min: 0, max: 25, color: 'bg-rose-400' },
    { label: '25–49%', min: 25, max: 50, color: 'bg-amber-400' },
    { label: '50–69%', min: 50, max: 70, color: 'bg-violet-400' },
    { label: '70–89%', min: 70, max: 90, color: 'bg-indigo-400' },
    { label: '90–100%', min: 90, max: 101, color: 'bg-blue-500' },
  ];
  const counts = buckets.map(b =>
    employees.filter(e => { const p = ptPercent(e.HRSWEEK); return p >= b.min && p < b.max; }).length
  );
  const maxCount = Math.max(...counts, 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="text-sm font-semibold text-gray-700 mb-3">📊 Verteilung Beschäftigungsgrad</div>
      <div className="flex items-end gap-2 h-20">
        {buckets.map((b, i) => (
          <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-semibold text-gray-600">{counts[i]}</span>
            <div
              className={`w-full rounded-t-md transition-all duration-500 ${b.color}`}
              style={{ height: `${(counts[i] / maxCount) * 56}px`, minHeight: counts[i] > 0 ? '4px' : '0' }}
            />
            <span className="text-[9px] text-gray-600 text-center leading-tight">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeeRowCells({
  emp,
  onSave,
}: {
  emp: Employee;
  onSave: (id: number, data: { HRSDAY: number; HRSWEEK: number; HRSMONTH: number }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<EditState>({
    hrsDay: emp.HRSDAY.toFixed(1),
    hrsWeek: emp.HRSWEEK.toFixed(1),
    hrsMonth: emp.HRSMONTH.toFixed(1),
  });

  const pct = ptPercent(emp.HRSWEEK);
  const barColor = ptColor(pct);

  const handleWeekChange = (val: string) => {
    const wk = parseFloat(val) || 0;
    const mo = Math.round((wk / 5) * 4.333 * 10) / 10;
    const day = Math.round((wk / 5) * 10) / 10;
    setEdit({ hrsDay: day.toFixed(1), hrsWeek: val, hrsMonth: mo.toFixed(1) });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(emp.ID, {
        HRSDAY: parseFloat(edit.hrsDay) || 0,
        HRSWEEK: parseFloat(edit.hrsWeek) || 0,
        HRSMONTH: parseFloat(edit.hrsMonth) || 0,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEdit({ hrsDay: emp.HRSDAY.toFixed(1), hrsWeek: emp.HRSWEEK.toFixed(1), hrsMonth: emp.HRSMONTH.toFixed(1) });
    setEditing(false);
  };

  return (
    <>
      <td className="px-3 py-3 min-w-[140px]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${barColor}`}>{pct}%</span>
            <span className="text-[10px] text-gray-600">{ptLabel(pct)}</span>
          </div>
          <HoursBar value={emp.HRSWEEK} max={FULLTIME_WEEK} color={barColor} />
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        {editing ? (
          <input type="number" step="0.5" min="0" max="24" value={edit.hrsDay}
            onChange={e => setEdit(prev => ({ ...prev, hrsDay: e.target.value }))}
            className="w-16 text-center border border-blue-300 rounded px-1 py-0.5 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
        ) : (
          <span className="text-sm font-mono text-gray-700">{emp.HRSDAY.toFixed(1)}</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        {editing ? (
          <input type="number" step="0.5" min="0" max="60" value={edit.hrsWeek}
            onChange={e => handleWeekChange(e.target.value)}
            className="w-16 text-center border border-blue-400 rounded px-1 py-0.5 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none font-semibold"
            autoFocus />
        ) : (
          <span className="text-sm font-semibold font-mono text-gray-800">{emp.HRSWEEK.toFixed(1)}</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        {editing ? (
          <input type="number" step="0.5" min="0" max="260" value={edit.hrsMonth}
            onChange={e => setEdit(prev => ({ ...prev, hrsMonth: e.target.value }))}
            className="w-20 text-center border border-blue-300 rounded px-1 py-0.5 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
        ) : (
          <span className="text-sm font-mono text-gray-700">{emp.HRSMONTH.toFixed(1)}</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-0.5">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => {
            const active = emp.WORKDAYS_LIST?.[i] ?? false;
            return (
              <span key={d} className={`text-[9px] font-semibold px-1 py-0.5 rounded ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-300'}`}>{d}</span>
            );
          })}
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-semibold disabled:opacity-50 transition-colors">
              {saving ? '⏳' : '✓ Speichern'}
            </button>
            <button aria-label="Schließen" onClick={cancelEdit}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded font-semibold transition-colors">✕</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded font-semibold transition-all">
            ✏️ Bearbeiten
          </button>
        )}
      </td>
    </>
  );
}

export default function SchichtKalibrator() {
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<Record<number, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState<number | ''>('');
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'week'>('name');
  const [showHidden, setShowHidden] = useState(false);
  const [bulkPreset, setBulkPreset] = useState<number>(-1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, grpRes] = await Promise.all([
        fetch(`${API}/api/employees`, { headers: getAuthHeaders() }),
        fetch(`${API}/api/groups`, { headers: getAuthHeaders() }),
      ]);
      const emps: Employee[] = await empRes.json();
      const grps: Group[] = await grpRes.json();
      setEmployees(emps);
      setGroups(grps);
    } catch (e: unknown) {
      showToast('Fehler beim Laden: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  useEffect(() => {
    if (groups.length === 0) return;
    Promise.all(
      groups.map(g =>
        fetch(`${API}/api/groups/${g.ID}/members`, { headers: getAuthHeaders() })
          .then(r => r.json())
          .then((members: { employee_id: number }[]) => ({ gid: g.ID, eids: members.map((m: { employee_id: number }) => m.employee_id) }))
          .catch(() => ({ gid: g.ID, eids: [] }))
      )
    ).then(results => {
      const map: Record<number, number[]> = {};
      results.forEach(r => { map[r.gid] = r.eids; });
      setGroupMemberships(map);
    });
  }, [groups]);

  const saveEmployee = async (id: number, data: { HRSDAY: number; HRSWEEK: number; HRSMONTH: number }) => {
    const res = await fetch(`${API}/api/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Speichern fehlgeschlagen');
    showToast('Stunden gespeichert ✓', 'success');
    setEmployees(prev => prev.map(e => e.ID === id ? { ...e, ...data } : e));
  };

  // Filter & sort
  let filtered = employees.filter(e => {
    if (!showHidden && e.HIDE) return false;
    if (filterText) {
      const q = filterText.toLowerCase();
      if (!`${e.FIRSTNAME} ${e.NAME} ${e.SHORTNAME}`.toLowerCase().includes(q)) return false;
    }
    if (filterGroup !== '') {
      if (!(groupMemberships[filterGroup] ?? []).includes(e.ID)) return false;
    }
    return true;
  });
  filtered = [...filtered].sort((a, b) =>
    sortBy === 'week' ? b.HRSWEEK - a.HRSWEEK : `${a.NAME}${a.FIRSTNAME}`.localeCompare(`${b.NAME}${b.FIRSTNAME}`)
  );

  const active = employees.filter(e => !e.HIDE);
  const totalWeekHours = active.reduce((s, e) => s + e.HRSWEEK, 0);
  const avgWeekHours = active.length ? totalWeekHours / active.length : 0;
  const fulltimers = active.filter(e => ptPercent(e.HRSWEEK) >= 90).length;
  const parttimers = active.filter(e => ptPercent(e.HRSWEEK) < 90 && e.HRSWEEK > 0).length;

  const applyBulkPreset = async () => {
    if (bulkPreset < 0 || selectedIds.size === 0) return;
    const preset = PRESETS[bulkPreset];
    if (!await confirmDialog({ message: `„${preset.label}" auf ${selectedIds.size} Mitarbeiter anwenden?`, danger: true })) return;
    for (const id of selectedIds) {
      await saveEmployee(id, { HRSDAY: preset.day, HRSWEEK: preset.week, HRSMONTH: preset.month });
    }
    setSelectedIds(new Set());
    showToast(`${selectedIds.size} Mitarbeiter aktualisiert ✓`, 'success');
  };

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">⚖️ Schicht-Kalibrator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Soll-Stunden pro Mitarbeiter individuell konfigurieren</p>
        </div>
        <button onClick={loadEmployees}
          className="ml-auto px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-lg shadow-sm flex items-center gap-1.5 transition-colors">
          🔄 <span className="hidden sm:inline">Aktualisieren</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Aktive Mitarbeiter" value={String(active.length)} sub={`${employees.length} gesamt`} color="bg-blue-50 border-blue-200" />
        <SummaryCard label="Ø Wochenstunden" value={avgWeekHours.toFixed(1) + ' h'} sub={`Σ ${totalWeekHours.toFixed(0)} h/Woche`} color="bg-indigo-50 border-indigo-200" />
        <SummaryCard label="Vollzeit (≥90%)" value={String(fulltimers)} sub={`${Math.round((fulltimers / (active.length || 1)) * 100)}% der Belegschaft`} color="bg-green-50 border-green-200" />
        <SummaryCard label="Teilzeit (<90%)" value={String(parttimers)} sub={`${Math.round((parttimers / (active.length || 1)) * 100)}% der Belegschaft`} color="bg-amber-50 border-amber-200" />
      </div>

      {/* Distribution + Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DistributionChart employees={active} />

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">📋 Stunden-Vorlagen (Bulk-Bearbeitung)</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button key={p.label} onClick={() => setBulkPreset(bulkPreset === i ? -1 : i)}
                className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${
                  bulkPreset === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          {bulkPreset >= 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-xs text-blue-700 font-semibold mb-1">Vorlage: {PRESETS[bulkPreset].label}</div>
              <div className="text-xs text-blue-600 grid grid-cols-3 gap-2 mb-2">
                <div>Tag: <b>{PRESETS[bulkPreset].day} h</b></div>
                <div>Woche: <b>{PRESETS[bulkPreset].week} h</b></div>
                <div>Monat: <b>{PRESETS[bulkPreset].month} h</b></div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-blue-600">
                  {selectedIds.size > 0 ? `${selectedIds.size} ausgewählt` : '← Mitarbeiter in Tabelle auswählen'}
                </span>
                {selectedIds.size > 0 && (
                  <>
                    <button onClick={applyBulkPreset}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors">
                      ✓ Anwenden ({selectedIds.size})
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="text-xs text-blue-500 hover:text-blue-700">
                      Auswahl löschen
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
        <input type="text" placeholder="🔍 Name suchen…" value={filterText} onChange={e => setFilterText(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 w-48" />
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value === '' ? '' : Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">Alle Gruppen</option>
          {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'week')}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="name">A–Z Name</option>
          <option value="week">↓ Wochenstunden</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} className="accent-blue-500" />
          Ausgeblendete zeigen
        </label>
        <span className="text-sm text-gray-600 ml-auto">{filtered.length} Mitarbeiter</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <div className="text-center">
            <div className="text-4xl mb-2 animate-spin">⚙️</div>
            <div>Lade Mitarbeiterdaten…</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-white rounded-xl shadow border border-gray-200">
          <table className="w-full text-sm border-collapse min-w-[800px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-gray-200">
              <tr>
                {bulkPreset >= 0 && <th className="px-3 py-2 w-8">
                  <input type="checkbox" className="accent-blue-500"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(emp => emp.ID)) : new Set())} />
                </th>}
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600 text-xs">Mitarbeiter</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 text-xs min-w-[140px]">Beschäftigungsgrad</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600 text-xs">Std/Tag</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600 text-xs">Std/Woche</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600 text-xs">Std/Monat</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 text-xs">Arbeitstage</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 text-xs w-32">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={bulkPreset >= 0 ? 9 : 8} className="text-center py-16 text-gray-600">
                    <div className="text-4xl mb-2">👥</div>
                    <div>Keine Mitarbeiter gefunden</div>
                  </td>
                </tr>
              ) : filtered.map(emp => (
                <tr key={emp.ID} className="hover:bg-gray-50 transition-colors group border-b border-gray-100">
                  {bulkPreset >= 0 && (
                    <td className="px-3 py-3">
                      <input type="checkbox" className="accent-blue-500"
                        checked={selectedIds.has(emp.ID)}
                        onChange={e => setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(emp.ID); else next.delete(emp.ID);
                          return next;
                        })} />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: `hsl(${(emp.ID * 47) % 360}, 55%, 50%)` }}>
                        {emp.SHORTNAME?.slice(0, 2) ?? '?'}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">{emp.FIRSTNAME} {emp.NAME}</div>
                        {emp.FUNCTION && <div className="text-xs text-gray-600">{emp.FUNCTION}</div>}
                      </div>
                    </div>
                  </td>
                  <EmployeeRowCells emp={emp} onSave={saveEmployee} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-600">
        💡 Hover über Zeile → „Bearbeiten" klicken. Wochenstunden-Änderung berechnet Tag & Monat automatisch.
        Mit Vorlagen können mehrere Mitarbeiter gleichzeitig angepasst werden.
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
