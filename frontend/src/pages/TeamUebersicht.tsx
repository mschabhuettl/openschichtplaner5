/**
 * TeamUebersicht — Team-Übersicht & Organigramm
 * Zeigt alle Mitarbeiter als Cards mit Avatar, Gruppen-Zugehörigkeit,
 * Qualifikationen, heutiger Schicht und Urlaubs-Status.
 * Wechselbar zwischen Cards-Ansicht und Organigramm.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Employee, Group } from '../types';
import type { DayEntry } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initials(emp: Employee): string {
  const f = emp.FIRSTNAME?.trim() ? emp.FIRSTNAME.trim()[0] : '';
  const n = emp.NAME?.trim() ? emp.NAME.trim()[0] : '';
  return (f + n).toUpperCase() || '?';
}

/** Deterministic color from name string */
function nameColor(name: string): string {
  const colors = [
    '#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669',
    '#D97706', '#DC2626', '#DB2777', '#65A30D', '#EA580C',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return d; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AbsenceStatus {
  status: 'available' | 'soon' | 'absent';
  label: string;
}

interface EmpCard {
  emp: Employee;
  groups: Group[];
  todayShift: DayEntry | null;
  absenceStatus: AbsenceStatus;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ emp, size = 'md' }: { emp: Employee; size?: 'sm' | 'md' | 'lg' }) {
  const bg = nameColor(emp.NAME + emp.FIRSTNAME);
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-xl' : 'w-12 h-12 text-sm';
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: bg }}
    >
      {initials(emp)}
    </div>
  );
}

// ─── Absence Badge ────────────────────────────────────────────────────────────

function AbsenceDot({ status }: { status: AbsenceStatus }) {
  const color = status.status === 'absent' ? 'bg-red-500' : status.status === 'soon' ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} title={status.label} />
  );
}

// ─── Mini Profile Modal ───────────────────────────────────────────────────────

interface MiniProfileProps {
  card: EmpCard;
  upcomingShifts: DayEntry[];
  onClose: () => void;
  onGoToProfile: () => void;
}

function MiniProfile({ card, upcomingShifts, onClose, onGoToProfile }: MiniProfileProps) {
  const { emp, groups, todayShift, absenceStatus } = card;
  const fullName = [emp.FIRSTNAME, emp.NAME].filter(Boolean).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Avatar emp={emp} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 dark:text-gray-100 truncate text-lg">{fullName}</div>
            {emp.FUNCTION && <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{emp.FUNCTION}</div>}
            <div className="flex items-center gap-1.5 mt-1">
              <AbsenceDot status={absenceStatus} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{absenceStatus.label}</span>
            </div>
          </div>
          <button aria-label="Schließen" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">✕</button>
        </div>

        {/* Groups */}
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {groups.map(g => (
              <span key={g.ID} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {g.NAME}
              </span>
            ))}
          </div>
        )}

        {/* Heutige Schicht */}
        {todayShift && (
          <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: todayShift.color_bk + '22', borderLeft: `3px solid ${todayShift.color_bk}` }}>
            <div className="font-medium" style={{ color: todayShift.color_bk }}>📅 Heute: {todayShift.shift_name || todayShift.leave_name}</div>
            {todayShift.workplace_name && <div className="text-gray-500 dark:text-gray-400 text-xs">{todayShift.workplace_name}</div>}
          </div>
        )}

        {/* Nächste Schichten */}
        {upcomingShifts.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Nächste Schichten</div>
            <div className="flex flex-col gap-1.5">
              {upcomingShifts.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 text-xs w-20 shrink-0">{formatDate(s.employee_name)}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: s.color_bk + '33', color: s.color_bk }}
                  >
                    {s.shift_short || s.shift_name}
                  </span>
                  {s.workplace_name && <span className="text-xs text-gray-400 truncate">{s.workplace_name}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kontakt */}
        {(emp.PHONE || emp.EMAIL) && (
          <div className="text-sm flex flex-col gap-1">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Kontakt</div>
            {emp.PHONE && (
              <a href={`tel:${emp.PHONE}`} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline">
                <span>📞</span><span>{emp.PHONE}</span>
              </a>
            )}
            {emp.EMAIL && (
              <a href={`mailto:${emp.EMAIL}`} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline">
                <span>✉️</span><span className="truncate">{emp.EMAIL}</span>
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <button
          onClick={onGoToProfile}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-sm font-medium transition-colors"
        >
          Volles Profil anzeigen →
        </button>
      </div>
    </div>
  );
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function EmployeeCard({ card, onClick }: { card: EmpCard; onClick: () => void }) {
  const { emp, groups, todayShift, absenceStatus } = card;
  const fullName = [emp.FIRSTNAME, emp.NAME].filter(Boolean).join(' ');
  const qualifications = [emp.FUNCTION, emp.ARBITR1, emp.ARBITR2, emp.ARBITR3].filter(Boolean) as string[];

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-4 flex flex-col gap-3 group"
      onClick={onClick}
    >
      {/* Top row: avatar + name + absence dot */}
      <div className="flex items-center gap-3">
        <Avatar emp={emp} size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {fullName}
          </div>
          {emp.FUNCTION && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{emp.FUNCTION}</div>
          )}
        </div>
        <AbsenceDot status={absenceStatus} />
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {groups.map(g => (
            <span key={g.ID} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
              {g.SHORTNAME || g.NAME}
            </span>
          ))}
        </div>
      )}

      {/* Qualifications */}
      {qualifications.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {qualifications.map((q, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
              {q}
            </span>
          ))}
        </div>
      )}

      {/* Today's shift */}
      {todayShift && (
        <div
          className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
          style={{ backgroundColor: todayShift.color_bk + '22', color: todayShift.color_bk }}
        >
          📅 {todayShift.shift_name || todayShift.leave_name}
        </div>
      )}

      {/* No shift today */}
      {!todayShift && absenceStatus.status === 'available' && (
        <div className="text-xs text-gray-400 dark:text-gray-500">Kein Dienst heute</div>
      )}
    </div>
  );
}

// ─── Organigramm ──────────────────────────────────────────────────────────────

interface OrgChartProps {
  groups: Group[];
  empCards: EmpCard[];
  groupAssignments: { employee_id: number; group_id: number }[];
  onCardClick: (card: EmpCard) => void;
}

function OrgChart({ groups, empCards, groupAssignments, onCardClick }: OrgChartProps) {
  // Build group → employees map
  const groupEmps: Record<number, EmpCard[]> = {};
  for (const { employee_id, group_id } of groupAssignments) {
    if (!groupEmps[group_id]) groupEmps[group_id] = [];
    const card = empCards.find(c => c.emp.ID === employee_id);
    if (card) groupEmps[group_id].push(card);
  }

  // Sort groups by position
  const sortedGroups = [...groups].sort((a, b) => a.POSITION - b.POSITION);

  return (
    <div className="flex flex-col gap-6">
      {sortedGroups.map(group => {
        const members = groupEmps[group.ID] || [];
        const groupColor = group.CBKLABEL_HEX || group.CFGLABEL_HEX || '#6366F1';
        return (
          <div key={group.ID} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Group header */}
            <div
              className="px-5 py-3 flex items-center gap-3"
              style={{ borderLeft: `4px solid ${groupColor}`, backgroundColor: groupColor + '15' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: groupColor }}
              >
                {(group.SHORTNAME || group.NAME).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{group.NAME}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{members.length} Mitarbeiter</div>
              </div>
            </div>

            {/* Members */}
            {members.length > 0 ? (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {members.map(card => {
                  const fullName = [card.emp.FIRSTNAME, card.emp.NAME].filter(Boolean).join(' ');
                  return (
                    <div
                      key={card.emp.ID}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group text-center"
                      onClick={() => onCardClick(card)}
                    >
                      <div className="relative">
                        <Avatar emp={card.emp} size="sm" />
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800"
                          style={{ backgroundColor: card.absenceStatus.status === 'absent' ? '#EF4444' : card.absenceStatus.status === 'soon' ? '#EAB308' : '#22C55E' }}
                        />
                      </div>
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate w-full group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {card.emp.SHORTNAME || fullName.split(' ')[0]}
                      </span>
                      {card.todayShift && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-tight" style={{ backgroundColor: card.todayShift.color_bk + '33', color: card.todayShift.color_bk }}>
                          {card.todayShift.shift_short || card.todayShift.shift_name?.slice(0, 4)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500 italic">Keine Mitglieder</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamUebersicht() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [todayEntries, setTodayEntries] = useState<DayEntry[]>([]);
  const [absences, setAbsences] = useState<{ employee_id: number; date: string }[]>([]);
  const [groupAssignments, setGroupAssignments] = useState<{ employee_id: number; group_id: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'cards' | 'org'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<number | 'all'>('all');
  const [selectedCard, setSelectedCard] = useState<EmpCard | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<DayEntry[]>([]);

  // Load data
  useEffect(() => {
    const today = todayStr();
    const year = new Date().getFullYear();

    Promise.all([
      api.getEmployees(),
      api.getGroups(),
      api.getScheduleDay(today),
      api.getAbsences({ year }),
      api.getGroupAssignments(),
    ]).then(([emps, grps, dayEntries, abs, assignments]) => {
      setEmployees(emps.filter(e => !e.HIDE));
      setGroups(grps.filter(g => !g.HIDE));
      setTodayEntries(dayEntries);
      setAbsences(abs.map(a => ({ employee_id: a.employee_id, date: a.date })));
      setGroupAssignments(assignments);
    }).catch((e: unknown) => {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    }).finally(() => setLoading(false));
  }, []);

  // Compute absence status per employee
  const absenceStatusMap = useMemo(() => {
    const today = todayStr();
    const soon = new Date();
    soon.setDate(soon.getDate() + 14);
    const soonStr = soon.toISOString().slice(0, 10);

    const map: Record<number, AbsenceStatus> = {};
    // group by employee
    const byEmp: Record<number, string[]> = {};
    for (const a of absences) {
      if (!byEmp[a.employee_id]) byEmp[a.employee_id] = [];
      byEmp[a.employee_id].push(a.date);
    }
    for (const [empIdStr, dates] of Object.entries(byEmp)) {
      const empId = Number(empIdStr);
      if (dates.includes(today)) {
        map[empId] = { status: 'absent', label: 'Aktuell abwesend' };
      } else {
        const upcoming = dates.filter(d => d > today && d <= soonStr);
        if (upcoming.length > 0) {
          map[empId] = { status: 'soon', label: 'Bald abwesend' };
        }
      }
    }
    return map;
  }, [absences]);

  // Build employee → groups map
  const empGroupsMap = useMemo(() => {
    const map: Record<number, Group[]> = {};
    for (const { employee_id, group_id } of groupAssignments) {
      const group = groups.find(g => g.ID === group_id);
      if (group) {
        if (!map[employee_id]) map[employee_id] = [];
        map[employee_id].push(group);
      }
    }
    return map;
  }, [groupAssignments, groups]);

  // Build employee → today shift map
  const todayShiftMap = useMemo(() => {
    const map: Record<number, DayEntry> = {};
    for (const entry of todayEntries) {
      map[entry.employee_id] = entry;
    }
    return map;
  }, [todayEntries]);

  // Build cards
  const allCards: EmpCard[] = useMemo(() => {
    return employees.map(emp => ({
      emp,
      groups: empGroupsMap[emp.ID] || [],
      todayShift: todayShiftMap[emp.ID] || null,
      absenceStatus: absenceStatusMap[emp.ID] || { status: 'available', label: 'Verfügbar' },
    }));
  }, [employees, empGroupsMap, todayShiftMap, absenceStatusMap]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    let cards = allCards;
    if (filterGroup !== 'all') {
      cards = cards.filter(c => c.groups.some(g => g.ID === filterGroup));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      cards = cards.filter(c => {
        const fullName = [c.emp.FIRSTNAME, c.emp.NAME].filter(Boolean).join(' ').toLowerCase();
        return fullName.includes(q) || c.emp.SHORTNAME?.toLowerCase().includes(q) || c.emp.FUNCTION?.toLowerCase().includes(q);
      });
    }
    return cards;
  }, [allCards, filterGroup, searchQuery]);

  // On card click: load upcoming shifts
  const handleCardClick = useCallback(async (card: EmpCard) => {
    setSelectedCard(card);
    setUpcomingShifts([]);
    try {
      // Load next 14 days
      const today = new Date();
      const upcoming: DayEntry[] = [];
      for (let i = 1; i <= 14 && upcoming.length < 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const entries = await api.getScheduleDay(dateStr);
        const empEntry = entries.find(e => e.employee_id === card.emp.ID && e.kind === 'shift');
        if (empEntry) upcoming.push({ ...empEntry, employee_name: dateStr });
      }
      setUpcomingShifts(upcoming);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = allCards.length;
    const onDuty = allCards.filter(c => c.todayShift && c.todayShift.kind === 'shift').length;
    const absent = allCards.filter(c => c.absenceStatus.status === 'absent').length;
    const available = total - absent;
    return { total, onDuty, absent, available };
  }, [allCards]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Team-Übersicht</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {stats.total} Mitarbeiter · {stats.onDuty} heute im Dienst · {stats.absent} abwesend
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            {/* View toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setView('cards')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'cards' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                🗂️ Karten
              </button>
              <button
                onClick={() => setView('org')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'org' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                🏢 Organigramm
              </button>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Gesamt', value: stats.total, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300', icon: '👥' },
            { label: 'Im Dienst', value: stats.onDuty, color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300', icon: '✅' },
            { label: 'Abwesend', value: stats.absent, color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300', icon: '🏖️' },
            { label: 'Bald frei', value: allCards.filter(c => c.absenceStatus.status === 'soon').length, color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300', icon: '⏳' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-3 ${s.color} flex items-center gap-2`}>
              <span className="text-xl">{s.icon}</span>
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-xs opacity-80 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            placeholder="Mitarbeiter suchen…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <select
            value={filterGroup === 'all' ? 'all' : String(filterGroup)}
            onChange={e => setFilterGroup(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="all">Alle Gruppen</option>
            {groups.map(g => (
              <option key={g.ID} value={g.ID}>{g.NAME}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
        {loading ? (
          <LoadingSpinner message="Lade Team-Daten…" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500 dark:text-red-400">
            <span className="text-3xl">⚠️</span>
            <span className="text-sm font-medium">Fehler beim Laden: {error}</span>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 text-xs bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Erneut versuchen
            </button>
          </div>
        ) : view === 'cards' ? (
          filteredCards.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
              Keine Mitarbeiter gefunden.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredCards.map(card => (
                <EmployeeCard key={card.emp.ID} card={card} onClick={() => handleCardClick(card)} />
              ))}
            </div>
          )
        ) : (
          <OrgChart
            groups={filterGroup === 'all' ? groups : groups.filter(g => g.ID === filterGroup)}
            empCards={filteredCards}
            groupAssignments={groupAssignments.filter(a => filteredCards.some(c => c.emp.ID === a.employee_id))}
            onCardClick={handleCardClick}
          />
        )}
      </div>

      {/* Mini Profile Modal */}
      {selectedCard && (
        <MiniProfile
          card={selectedCard}
          upcomingShifts={upcomingShifts}
          onClose={() => setSelectedCard(null)}
          onGoToProfile={() => {
            navigate(`/mitarbeiter/${selectedCard.emp.ID}`);
            setSelectedCard(null);
          }}
        />
      )}
    </div>
  );
}
