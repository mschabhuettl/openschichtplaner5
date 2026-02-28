import { useState, useEffect, useCallback } from 'react';

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

// ─── Types ──────────────────────────────────────────────────────────────────

interface Skill {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  category: string;
  holder_count?: number;
  expert_count?: number;
  expiring_count?: number;
  coverage_pct?: number;
}

interface Assignment {
  id: string;
  employee_id: number;
  skill_id: string;
  level: number; // 1=Basis, 2=Fortgeschritten, 3=Experte
  certified_until?: string | null;
  notes: string;
  assigned_at: string;
}

interface EmployeeRow {
  id: number;
  name: string;
  short: string;
  group: string;
  skills: Record<string, Assignment>;
  skill_count: number;
}

interface MatrixData {
  skills: Skill[];
  employees: EmployeeRow[];
  assignments: Assignment[];
  total_employees: number;
}

// ─── Level badge ────────────────────────────────────────────────────────────

const LEVEL_LABELS = ['', 'Basis', 'Fortgeschritten', 'Experte'];
const LEVEL_ICONS  = ['', '●', '◆', '★'];

// ─── Skill cell in matrix ───────────────────────────────────────────────────

function MatrixCell({
  assignment,
  skill,
  onClick,
  checkMode,
}: {
  assignment?: Assignment;
  skill: Skill;
  onClick: () => void;
  checkMode?: boolean;
}) {
  if (!assignment) {
    return (
      <td className="border border-gray-100 p-0 text-center">
        <button
          onClick={onClick}
          className={`w-full h-full min-h-[2rem] flex items-center justify-center transition-colors text-lg ${checkMode ? 'text-red-300 hover:text-red-500 hover:bg-red-50 text-base' : 'text-gray-200 hover:text-gray-600 hover:bg-gray-50'}`}
          title={`${skill.name} zuweisen`}
        >
          {checkMode ? '❌' : '+'}
        </button>
      </td>
    );
  }

  const isExpiring = assignment.certified_until &&
    new Date(assignment.certified_until) <= new Date(Date.now() + 90 * 24 * 3600 * 1000);
  const isExpired = assignment.certified_until && new Date(assignment.certified_until) < new Date();

  return (
    <td className={`border border-gray-100 p-0 text-center ${isExpired ? 'bg-red-50' : isExpiring ? 'bg-amber-50' : ''}`}>
      <button
        onClick={onClick}
        className="w-full h-full min-h-[2rem] flex items-center justify-center gap-0.5 hover:opacity-80 transition-opacity py-1 px-1"
        title={`${skill.name} (Stufe ${assignment.level}: ${LEVEL_LABELS[assignment.level]}) – klicken zum Bearbeiten`}
        style={checkMode ? undefined : { color: skill.color }}
      >
        {checkMode ? (
          <span className="text-base">✅</span>
        ) : (
          <span className="text-base">{['', '●', '◆', '★'][assignment.level]}</span>
        )}
        {isExpired && <span className="text-xs text-red-500" title="Abgelaufen">!</span>}
        {isExpiring && !isExpired && <span className="text-xs text-amber-500" title="Läuft bald ab">⚠</span>}
      </button>
    </td>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

interface ModalState {
  type: 'assign' | 'skill-edit' | 'skill-create';
  employeeId?: number;
  employeeName?: string;
  skill?: Skill;
  existingAssignment?: Assignment;
}

function AssignModal({
  state,
  onClose,
  onSave,
  onDelete,
}: {
  state: ModalState;
  onClose: () => void;
  onSave: (data: Partial<Assignment>) => void;
  onDelete?: () => void;
}) {
  const existing = state.existingAssignment;
  const [level, setLevel] = useState(existing?.level ?? 1);
  const [certUntil, setCertUntil] = useState(existing?.certified_until ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const skill = state.skill!;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">{skill.icon}</span>
          <div>
            <h2 className="text-lg font-bold text-gray-800">{skill.name}</h2>
            <p className="text-sm text-gray-500">für {state.employeeName}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kompetenzstufe</label>
            <div className="flex gap-2">
              {[1, 2, 3].map(l => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                    level === l
                      ? 'border-slate-600 bg-slate-700 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {LEVEL_ICONS[l]} {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Zertifiziert bis (optional)
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={certUntil}
              onChange={e => setCertUntil(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notiz</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional…"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => onSave({ level, certified_until: certUntil || undefined, notes })}
            className="flex-1 bg-slate-700 text-white font-semibold py-2 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Speichern
          </button>
          {existing && onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-50 text-red-600 font-semibold rounded-lg hover:bg-red-100 transition-colors"
            >
              Entfernen
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-600 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillFormModal({
  skill,
  onClose,
  onSave,
  onDelete,
}: {
  skill?: Skill;
  onClose: () => void;
  onSave: (data: Partial<Skill>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [color, setColor] = useState(skill?.color ?? '#3b82f6');
  const [icon, setIcon] = useState(skill?.icon ?? '🎯');
  const [category, setCategory] = useState(skill?.category ?? '');

  const ICON_OPTIONS = ['🎯','🩺','🌙','👑','🚜','📚','🔥','⚡','🛡️','🔧','💡','🏆','📋','⚙️','🎓'];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 mb-5">
          {skill ? 'Qualifikation bearbeiten' : 'Neue Qualifikation'}
        </h2>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Icon</label>
              <div className="grid grid-cols-5 gap-1 p-2 border border-gray-200 rounded-lg">
                {ICON_OPTIONS.map(i => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    className={`text-xl p-1 rounded hover:bg-gray-100 transition-colors ${icon === i ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Farbe</label>
              <input
                type="color"
                className="w-full h-12 rounded-lg border border-gray-200 cursor-pointer"
                value={color}
                onChange={e => setColor(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name *</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Erste Hilfe"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Kategorie</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="z.B. Sicherheit, Führung, Technisch"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Beschreibung</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional…"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => { if (name.trim()) onSave({ name: name.trim(), description, color, icon, category }); }}
            disabled={!name.trim()}
            className="flex-1 bg-slate-700 text-white font-semibold py-2 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Speichern
          </button>
          {skill && onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-50 text-red-600 font-semibold rounded-lg hover:bg-red-100 transition-colors"
            >
              Löschen
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-600 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function KompetenzMatrix() {
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'matrix' | 'skills' | 'gaps'>('matrix');
  const [sortMode, setSortMode] = useState<'name' | 'skill_count'>('name');
  const [checkMode, setCheckMode] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [skillModal, setSkillModal] = useState<{ skill?: Skill } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/skills/matrix`, { headers: getAuthHeaders() })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => { setMatrix(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const categories = matrix
    ? [...new Set(matrix.skills.map(s => s.category).filter(Boolean))]
    : [];

  const visibleSkills = matrix?.skills.filter(s =>
    (!filterCategory || s.category === filterCategory) &&
    (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) ?? [];

  const visibleEmployees = (matrix?.employees.filter(emp =>
    !searchQuery ||
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.short.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? []).slice().sort((a, b) => {
    if (sortMode === 'skill_count') return b.skill_count - a.skill_count;
    return a.name.localeCompare(b.name, 'de');
  });

  // Gap analysis: employees with 0 of critical skills
  const gapData = matrix?.skills.map(skill => {
    const holders = matrix.assignments.filter(a => a.skill_id === skill.id);
    const nonHolders = matrix.employees.filter(emp =>
      !holders.find(h => h.employee_id === emp.id)
    );
    return { skill, holders, nonHolders };
  }) ?? [];

  // Einzelkämpfer-Risiko: skills with only 1 person qualified
  const einzelkaempfer = gapData.filter(d => d.holders.length === 1);

  // ── API actions ───────────────────────────────────────────────────────────

  const handleSaveAssignment = async (data: Partial<Assignment>) => {
    if (!modal || !modal.skill || modal.employeeId === undefined) return;
    await fetch(`${API}/api/skills/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        employee_id: modal.employeeId,
        skill_id: modal.skill.id,
        level: data.level,
        certified_until: data.certified_until || null,
        notes: data.notes || '',
      }),
    });
    setModal(null);
    load();
  };

  const handleDeleteAssignment = async () => {
    if (!modal?.existingAssignment) return;
    await fetch(`${API}/api/skills/assignments/${modal.existingAssignment.id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setModal(null);
    load();
  };

  const handleSaveSkill = async (data: Partial<Skill>) => {
    if (skillModal?.skill) {
      await fetch(`${API}/api/skills/${skillModal.skill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
    } else {
      await fetch(`${API}/api/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
    }
    setSkillModal(null);
    load();
  };

  const handleDeleteSkill = async () => {
    if (!skillModal?.skill) return;
    await fetch(`${API}/api/skills/${skillModal.skill.id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setSkillModal(null);
    load();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-600">Fehler: {error}</div>
  );

  if (!matrix) return null;

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-full">
      {/* ── Header ── */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">🎓 Kompetenz-Matrix</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Qualifikationen & Skills der Mitarbeiter im Überblick
          </p>
        </div>
        <button
          onClick={() => setSkillModal({})}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-semibold whitespace-nowrap"
        >
          + Qualifikation
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-slate-700">{matrix.skills.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Qualifikationen</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-slate-700">{matrix.total_employees}</div>
          <div className="text-xs text-gray-500 mt-0.5">Mitarbeiter</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-600">{matrix.assignments.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Zuweisungen</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-amber-600">
            {matrix.assignments.filter(a => {
              if (!a.certified_until) return false;
              return new Date(a.certified_until) <= new Date(Date.now() + 90 * 24 * 3600 * 1000);
            }).length}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Ablaufend (&lt;90 Tage)</div>
        </div>
      </div>

      {/* ── Einzelkämpfer-Risiko Banner ── */}
      {einzelkaempfer.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🚨</span>
            <span className="font-bold text-red-700">Einzelkämpfer-Risiko ({einzelkaempfer.length} Qualifikation{einzelkaempfer.length > 1 ? 'en' : ''})</span>
            <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full font-semibold">KRITISCH</span>
          </div>
          <p className="text-xs text-red-600 mb-3">
            Diese Qualifikationen hat nur <strong>1 Mitarbeiter</strong>. Fällt diese Person aus, gibt es niemanden als Ersatz!
          </p>
          <div className="flex flex-wrap gap-2">
            {einzelkaempfer.map(({ skill, holders }) => {
              const holder = matrix!.employees.find(e => e.id === holders[0]?.employee_id);
              return (
                <div key={skill.id} className="flex items-center gap-1.5 bg-white border border-red-200 rounded-lg px-3 py-1.5 text-sm">
                  <span>{skill.icon}</span>
                  <span className="font-semibold" style={{ color: skill.color }}>{skill.name}</span>
                  <span className="text-gray-600">→</span>
                  <span className="text-gray-700 font-medium">{holder?.name ?? '?'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-sm flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Suchen…"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 w-40"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">Alle Kategorien</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {viewMode === 'matrix' && (
          <>
            <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50">
              <button
                onClick={() => setSortMode('name')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${sortMode === 'name' ? 'bg-white shadow text-slate-700' : 'text-gray-500 hover:text-gray-700'}`}
                title="Nach Name sortieren"
              >
                A–Z
              </button>
              <button
                onClick={() => setSortMode('skill_count')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${sortMode === 'skill_count' ? 'bg-white shadow text-slate-700' : 'text-gray-500 hover:text-gray-700'}`}
                title="Nach Qualifikationsanzahl sortieren"
              >
                #↓
              </button>
            </div>
            <button
              onClick={() => setCheckMode(c => !c)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${checkMode ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}
              title="Anzeige: ✅/❌ vs. Kompetenzstufen"
            >
              {checkMode ? '✅ ❌ Modus' : '● ◆ ★ Modus'}
            </button>
          </>
        )}

        <div className="flex gap-1 ml-auto">
          {(['matrix', 'skills', 'gaps'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                viewMode === mode
                  ? 'bg-slate-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mode === 'matrix' ? '📊 Matrix' : mode === 'skills' ? '🎯 Skills' : '⚠️ Lücken'}
              {mode === 'gaps' && einzelkaempfer.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{einzelkaempfer.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Matrix view ── */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto">
          {visibleSkills.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              Keine Qualifikationen gefunden. Klicke "+ Qualifikation" um anzufangen.
            </div>
          ) : (
            <table className="text-sm w-full min-w-max">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-600 min-w-[160px] z-10 border-r border-gray-200">
                    Mitarbeiter
                  </th>
                  {visibleSkills.map(skill => (
                    <th key={skill.id} className="px-2 py-2 text-center min-w-[80px]">
                      <button
                        onClick={() => setSkillModal({ skill })}
                        className="flex flex-col items-center gap-0.5 hover:opacity-70 transition-opacity group w-full"
                        title={`${skill.name} – klicken zum Bearbeiten`}
                      >
                        <span className="text-xl">{skill.icon}</span>
                        <span className="text-xs font-semibold text-gray-700 leading-tight text-center" style={{ color: skill.color }}>
                          {skill.name}
                        </span>
                        <span className="text-xs text-gray-600">{skill.holder_count ?? 0}/{matrix.total_employees}</span>
                      </button>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-gray-500 text-xs font-semibold min-w-[60px]">
                    Gesamt
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((emp, idx) => (
                  <tr key={emp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="sticky left-0 bg-inherit px-3 py-2 border-r border-gray-200 z-10">
                      <div className="font-semibold text-gray-800 text-sm">{emp.name}</div>
                      <div className="text-xs text-gray-600">{emp.short} {emp.group && `· ${emp.group}`}</div>
                    </td>
                    {visibleSkills.map(skill => (
                      <MatrixCell
                        key={skill.id}
                        assignment={emp.skills[skill.id]}
                        skill={skill}
                        checkMode={checkMode}
                        onClick={() => setModal({
                          type: 'assign',
                          employeeId: emp.id,
                          employeeName: emp.name,
                          skill,
                          existingAssignment: emp.skills[skill.id],
                        })}
                      />
                    ))}
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        emp.skill_count === 0 ? 'bg-gray-100 text-gray-600' :
                        emp.skill_count >= 3 ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {emp.skill_count}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* ── Coverage footer row ── */}
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="sticky left-0 bg-gray-50 px-3 py-2 border-r border-gray-200 z-10">
                    <div className="text-xs font-bold text-gray-600">Abdeckung</div>
                    <div className="text-xs text-gray-600">{matrix.total_employees} MA gesamt</div>
                  </td>
                  {visibleSkills.map(skill => {
                    const holders = matrix.assignments.filter(a => a.skill_id === skill.id).length;
                    const pct = matrix.total_employees > 0 ? Math.round(holders / matrix.total_employees * 100) : 0;
                    const isEinzelkaempfer = holders === 1;
                    return (
                      <td key={skill.id} className="px-1 py-2 text-center">
                        <div className={`text-xs font-bold ${isEinzelkaempfer ? 'text-red-600' : pct >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                          {isEinzelkaempfer ? '🚨' : ''}{holders}/{matrix.total_employees}
                        </div>
                        <div className="mx-1 mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: isEinzelkaempfer ? '#ef4444' : skill.color }}
                          />
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">{pct}%</div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center text-xs text-gray-600">–</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Skills overview ── */}
      {viewMode === 'skills' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleSkills.length === 0 && (
            <div className="col-span-3 p-8 text-center text-gray-600 bg-white rounded-xl border border-gray-200">
              Keine Qualifikationen. Klicke "+ Qualifikation" um anzufangen.
            </div>
          )}
          {visibleSkills.map(skill => {
            const assignments = matrix.assignments.filter(a => a.skill_id === skill.id);
            const experts = assignments.filter(a => a.level === 3);
            const expiring = assignments.filter(a => {
              if (!a.certified_until) return false;
              return new Date(a.certified_until) <= new Date(Date.now() + 90 * 24 * 3600 * 1000);
            });

            return (
              <div key={skill.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{skill.icon}</span>
                    <div>
                      <div className="font-bold text-gray-800" style={{ color: skill.color }}>{skill.name}</div>
                      {skill.category && (
                        <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{skill.category}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSkillModal({ skill })}
                    className="text-gray-600 hover:text-gray-600 text-sm"
                    title="Bearbeiten"
                  >
                    ✎
                  </button>
                </div>

                {skill.description && (
                  <p className="text-xs text-gray-500 mb-3">{skill.description}</p>
                )}

                {/* Coverage bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Abdeckung</span>
                    <span className="font-semibold">{skill.holder_count ?? 0}/{matrix.total_employees} MA</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${skill.coverage_pct ?? 0}%`,
                        backgroundColor: skill.color,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="font-bold text-gray-700">{skill.holder_count ?? 0}</div>
                    <div className="text-gray-600">Träger</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <div className="font-bold text-amber-700">{experts.length}</div>
                    <div className="text-amber-500">Experten</div>
                  </div>
                  <div className={`rounded-lg p-2 ${expiring.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className={`font-bold ${expiring.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {expiring.length}
                    </div>
                    <div className={expiring.length > 0 ? 'text-red-400' : 'text-gray-600'}>Ablaufend</div>
                  </div>
                </div>

                {/* MA with this skill */}
                {assignments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-600 mb-1.5">Zugewiesen an:</div>
                    <div className="flex flex-wrap gap-1">
                      {assignments.slice(0, 8).map(a => {
                        const emp = matrix.employees.find(e => e.id === a.employee_id);
                        if (!emp) return null;
                        return (
                          <span
                            key={a.id}
                            className="text-xs px-1.5 py-0.5 rounded font-mono font-semibold"
                            style={{ backgroundColor: skill.color + '22', color: skill.color }}
                            title={`${emp.name} – ${LEVEL_LABELS[a.level]}`}
                          >
                            {emp.short}
                          </span>
                        );
                      })}
                      {assignments.length > 8 && (
                        <span className="text-xs text-gray-600">+{assignments.length - 8}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Gaps view ── */}
      {viewMode === 'gaps' && (
        <div className="space-y-4">
          {gapData.length === 0 && (
            <div className="p-8 text-center text-gray-600 bg-white rounded-xl border border-gray-200">
              Keine Qualifikationen definiert.
            </div>
          )}
          {gapData.filter(d => !filterCategory || d.skill.category === filterCategory)
            .sort((a, b) => a.holders.length - b.holders.length)
            .map(({ skill, nonHolders, holders }) => {
            const isEinzelkaempfer = holders.length === 1;
            return (
            <div key={skill.id} className={`rounded-xl border shadow-sm p-4 ${isEinzelkaempfer ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{skill.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: skill.color }}>{skill.name}</span>
                    {isEinzelkaempfer && (
                      <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">🚨 EINZELKÄMPFER</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">
                    {holders.length} von {matrix.total_employees} MA qualifiziert
                    ({Math.round(holders.length / matrix.total_employees * 100)}%)
                  </div>
                </div>
                {/* mini bar */}
                <div className="w-24 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(holders.length / matrix.total_employees * 100)}%`,
                      backgroundColor: isEinzelkaempfer ? '#ef4444' : skill.color,
                    }}
                  />
                </div>
              </div>

              {isEinzelkaempfer && (
                <div className="mb-3 text-xs bg-red-100 text-red-700 rounded-lg px-3 py-2 font-medium">
                  ⚠️ Nur <strong>{matrix.employees.find(e => e.id === holders[0]?.employee_id)?.name ?? '?'}</strong> hat diese Qualifikation. Bei Ausfall gibt es keinen Ersatz!
                </div>
              )}

              {nonHolders.length > 0 ? (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">
                    {nonHolders.length} MA ohne diese Qualifikation:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {nonHolders.map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => setModal({
                          type: 'assign',
                          employeeId: emp.id,
                          employeeName: emp.name,
                          skill,
                        })}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium"
                        title={`${skill.name} für ${emp.name} zuweisen`}
                      >
                        {emp.name} +
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-green-600 font-semibold">✅ Alle Mitarbeiter qualifiziert!</div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* ── Legend ── */}
      {viewMode === 'matrix' && matrix.skills.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">Legende</div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            {[1, 2, 3].map(l => (
              <span key={l} className="flex items-center gap-1">
                <span className="font-bold">{LEVEL_ICONS[l]}</span>
                {LEVEL_LABELS[l]}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="bg-amber-50 px-1 rounded">⚠</span> Zertifikat läuft bald ab
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-red-50 px-1 rounded text-red-500">!</span> Abgelaufen
            </span>
            <span className="flex items-center gap-1">
              <span className="text-gray-200 font-bold">+</span> Klicken zum Zuweisen
            </span>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {modal && modal.type === 'assign' && modal.skill && (
        <AssignModal
          state={modal}

          onClose={() => setModal(null)}
          onSave={handleSaveAssignment}
          onDelete={modal.existingAssignment ? handleDeleteAssignment : undefined}
        />
      )}

      {skillModal !== null && (
        <SkillFormModal
          skill={skillModal.skill}
          onClose={() => setSkillModal(null)}
          onSave={handleSaveSkill}
          onDelete={skillModal.skill ? handleDeleteSkill : undefined}
        />
      )}
    </div>
  );
}
