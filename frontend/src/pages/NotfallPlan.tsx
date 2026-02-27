/**
 * NotfallPlan — Emergency Coverage Tool
 * Kurzfristige Ausfallplanung: Wer kann einspringen?
 */
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../hooks/useToast';

const API = import.meta.env.VITE_API_URL ?? '';

interface Employee {
  ID: number;
  NAME: string;
  FIRSTNAME: string;
  SHORTNAME: string;
  HRSWEEK: number;
  HIDE: number;
  FUNCTION?: string;
}

interface Shift {
  ID: number;
  NAME: string;
  SHORTNAME: string;
  COLORBK_HEX: string;
  COLORTEXT_HEX: string;
  STARTEND0?: string;
  DURATION0?: number;
  HIDE?: number;
}

interface Group {
  ID: number;
  NAME: string;
  member_count?: number;
}

interface DayEntry {
  employee_id: number;
  employee_name: string;
  employee_short: string;
  shift_id: number | null;
  shift_name: string;
  shift_short: string;
  color_bk: string;
  color_text: string;
  kind: string | null;
  leave_name: string;
}

interface CoverageCandidate {
  employee: Employee;
  score: number;
  reasons: string[];
  alreadyWorking: boolean;
  onLeave: boolean;
  shiftToday: string | null;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-AT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'bg-rose-100 text-rose-700';
  let label = 'Schlecht';
  if (score >= 80) { color = 'bg-emerald-100 text-emerald-700'; label = 'Sehr gut'; }
  else if (score >= 60) { color = 'bg-green-100 text-green-700'; label = 'Gut'; }
  else if (score >= 40) { color = 'bg-amber-100 text-amber-700'; label = 'Möglich'; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score}% {label}
    </span>
  );
}

export default function NotfallPlan() {
  const today = toDateStr(new Date());
  const [date, setDate] = useState(today);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [_groups, setGroups] = useState<Group[]>([]);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [sickEmployee, setSickEmployee] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<CoverageCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [assigned, setAssigned] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const { showToast } = useToast();

  // Load shifts + employees + groups once
  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/shifts`).then(r => r.json()),
      fetch(`${API}/api/employees`).then(r => r.json()),
      fetch(`${API}/api/groups`).then(r => r.json()),
    ]).then(([s, e, g]) => {
      setShifts((s as Shift[]).filter(x => !x.HIDE));
      setEmployees((e as Employee[]).filter(x => !x.HIDE));
      setGroups(g as Group[]);
    });
  }, []);

  // Load day entries when date changes
  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetch(`${API}/api/schedule/day?date=${date}`)
      .then(r => r.json())
      .then((d: DayEntry[]) => {
        setDayEntries(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [date]);

  // Compute candidates
  const computeCandidates = useCallback(() => {
    if (!selectedShift) {
      showToast('Bitte zuerst eine Schicht auswählen', 'warning');
      return;
    }

    // Build map: employee_id → their day entry
    const entryMap = new Map<number, DayEntry>();
    for (const e of dayEntries) entryMap.set(e.employee_id, e);

    const results: CoverageCandidate[] = [];

    for (const emp of employees) {
      const entry = entryMap.get(emp.ID);
      const alreadyWorking = !!(entry && entry.shift_id !== null);
      const onLeave = !!(entry && entry.kind !== null && entry.shift_id === null);
      const shiftToday = alreadyWorking ? entry!.shift_name : null;

      let score = 100;
      const reasons: string[] = [];

      // Hard blockers
      if (alreadyWorking && emp.ID !== sickEmployee) {
        score -= 60;
        reasons.push(`Arbeitet bereits: ${shiftToday}`);
      }
      if (onLeave) {
        score -= 80;
        reasons.push(`Abwesend: ${entry!.leave_name || 'Urlaub'}`);
      }

      // Bonus: fewer hours = more available
      const targetHrs = emp.HRSWEEK || 40;
      if (targetHrs <= 20) {
        score += 5;
        reasons.push('Teilzeit — flexibler');
      }

      // Skip the sick employee themselves
      if (emp.ID === sickEmployee) continue;

      results.push({
        employee: emp,
        score: Math.max(0, Math.min(100, score)),
        reasons,
        alreadyWorking,
        onLeave,
        shiftToday,
      });
    }

    // Sort: available first, then by score desc
    results.sort((a, b) => {
      if (!a.alreadyWorking && !a.onLeave && (b.alreadyWorking || b.onLeave)) return -1;
      if ((a.alreadyWorking || a.onLeave) && !b.alreadyWorking && !b.onLeave) return 1;
      return b.score - a.score;
    });

    setCandidates(results);
    setShowAll(false);
  }, [selectedShift, dayEntries, employees, sickEmployee, showToast]);

  const assignEmployee = useCallback(async (empId: number) => {
    if (!selectedShift) return;
    setAssigning(empId);
    try {
      const resp = await fetch(`${API}/api/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: empId, date, shift_id: selectedShift }),
      });
      if (resp.ok) {
        const emp = employees.find(e => e.ID === empId);
        const shift = shifts.find(s => s.ID === selectedShift);
        showToast(`✅ ${emp?.FIRSTNAME} ${emp?.NAME} → ${shift?.NAME} am ${date}`, 'success');
        setAssigned(prev => new Set([...prev, empId]));
        // Refresh day entries
        const updated = await fetch(`${API}/api/schedule/day?date=${date}`).then(r => r.json());
        setDayEntries(updated);
      } else {
        const err = await resp.json();
        showToast(err.detail || 'Fehler beim Zuweisen', 'error');
      }
    } catch {
      showToast('Netzwerkfehler', 'error');
    } finally {
      setAssigning(null);
    }
  }, [selectedShift, date, employees, shifts, showToast]);

  const removeSickEmployee = useCallback(async () => {
    if (!sickEmployee) return;
    const emp = employees.find(e => e.ID === sickEmployee);
    if (!window.confirm(`${emp?.FIRSTNAME} ${emp?.NAME} für ${date} aus dem Dienstplan entfernen?`)) return;
    try {
      const resp = await fetch(`${API}/api/schedule/${sickEmployee}/${date}`, { method: 'DELETE' });
      if (resp.ok) {
        showToast(`Eintrag von ${emp?.FIRSTNAME} ${emp?.NAME} entfernt`, 'success');
        const updated = await fetch(`${API}/api/schedule/day?date=${date}`).then(r => r.json());
        setDayEntries(updated);
      } else {
        showToast('Fehler beim Entfernen', 'error');
      }
    } catch {
      showToast('Netzwerkfehler', 'error');
    }
  }, [sickEmployee, date, employees, showToast]);

  const selectedShiftObj = shifts.find(s => s.ID === selectedShift);
  const sickEmpObj = employees.find(e => e.ID === sickEmployee);
  const scheduled = dayEntries.filter(e => e.shift_id !== null);
  const onLeave = dayEntries.filter(e => e.kind !== null && e.shift_id === null);
  const displayCandidates = showAll ? candidates : candidates.slice(0, 8);
  const availableCandidates = candidates.filter(c => !c.alreadyWorking && !c.onLeave);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          🚨 Notfall-Plan
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Kurzfristige Ausfallplanung — wer kann einspringen?
        </p>
      </div>

      {/* Step 1: Date + Shift Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">
          Schritt 1 — Datum &amp; Schicht wählen
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setCandidates([]); setAssigned(new Set()); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Schicht zum Besetzen</label>
            <select
              value={selectedShift ?? ''}
              onChange={e => { setSelectedShift(e.target.value ? Number(e.target.value) : null); setCandidates([]); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">— Schicht wählen —</option>
              {shifts.map(s => (
                <option key={s.ID} value={s.ID}>
                  {s.NAME} ({s.SHORTNAME}){s.STARTEND0 ? ` · ${s.STARTEND0}` : ''}
                </option>
              ))}
            </select>
          </div>
          {selectedShiftObj && (
            <div
              className="px-3 py-2 rounded-lg text-sm font-bold"
              style={{ background: selectedShiftObj.COLORBK_HEX, color: selectedShiftObj.COLORTEXT_HEX }}
            >
              {selectedShiftObj.SHORTNAME}
              {selectedShiftObj.DURATION0 ? ` · ${selectedShiftObj.DURATION0}h` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Who's sick / Day overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">
          Schritt 2 — Ausfall melden (optional)
        </h2>
        {loading ? (
          <p className="text-slate-400 text-sm">Lade Dienstplan…</p>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              {date ? formatDateLong(date) : '—'} ·{' '}
              {scheduled.length > 0 ? (
                <span className="text-slate-700">{scheduled.length} Schicht(en) geplant</span>
              ) : (
                <span className="text-amber-600">Keine Einträge</span>
              )}
              {onLeave.length > 0 && <span className="text-slate-500"> · {onLeave.length} Abwesend</span>}
            </p>

            {scheduled.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">Wer fällt aus?</p>
                <div className="flex flex-wrap gap-2">
                  {scheduled.map(e => (
                    <button
                      key={e.employee_id}
                      onClick={() => setSickEmployee(sickEmployee === e.employee_id ? null : e.employee_id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        sickEmployee === e.employee_id
                          ? 'bg-rose-100 border-rose-400 text-rose-800 ring-2 ring-rose-300'
                          : 'bg-gray-50 border-gray-200 text-slate-600 hover:border-rose-300 hover:bg-rose-50'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded text-center leading-4 font-bold"
                        style={{ background: e.color_bk, color: e.color_text, fontSize: '9px' }}
                      >
                        {e.shift_short}
                      </span>
                      {e.employee_name}
                      {sickEmployee === e.employee_id && <span className="ml-1">🤒</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sickEmployee && sickEmpObj && (
              <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-lg p-3 mt-2">
                <span className="text-2xl">🤒</span>
                <div className="flex-1">
                  <p className="font-semibold text-rose-800 text-sm">
                    {sickEmpObj.FIRSTNAME} {sickEmpObj.NAME}
                  </p>
                  <p className="text-xs text-rose-500">als krank gemeldet</p>
                </div>
                <button
                  onClick={removeSickEmployee}
                  className="text-xs px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-semibold"
                >
                  Aus Plan entfernen
                </button>
              </div>
            )}

            {scheduled.length === 0 && (
              <p className="text-sm text-slate-400 italic">
                Keine Schichten an diesem Tag eingetragen — wähle trotzdem eine Schicht und suche Kandidaten.
              </p>
            )}
          </>
        )}
      </div>

      {/* Step 3: Find candidates */}
      <div className="mb-4">
        <button
          onClick={computeCandidates}
          disabled={!selectedShift}
          className="w-full py-3 rounded-xl font-bold text-base transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 shadow-sm"
        >
          🔍 Einspringer suchen
        </button>
      </div>

      {/* Results */}
      {candidates.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
              Schritt 3 — Einspringer zuweisen
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {availableCandidates.length} verfügbar · {candidates.length} gesamt
              </span>
              {selectedShiftObj && (
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{ background: selectedShiftObj.COLORBK_HEX, color: selectedShiftObj.COLORTEXT_HEX }}
                >
                  {selectedShiftObj.NAME}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {displayCandidates.map((c, idx) => {
              const isBlocked = c.alreadyWorking || c.onLeave;
              const wasAssigned = assigned.has(c.employee.ID);
              return (
                <div
                  key={c.employee.ID}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    wasAssigned
                      ? 'bg-emerald-50 border-emerald-300'
                      : isBlocked
                      ? 'bg-gray-50 border-gray-200 opacity-60'
                      : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/30'
                  }`}
                >
                  {/* Rank */}
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0 && !isBlocked ? 'bg-amber-400 text-white' :
                    idx === 1 && !isBlocked ? 'bg-gray-300 text-gray-700' :
                    idx === 2 && !isBlocked ? 'bg-orange-300 text-white' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {idx + 1}
                  </span>

                  {/* Employee info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800">
                        {c.employee.FIRSTNAME} {c.employee.NAME}
                      </span>
                      <span className="text-xs text-slate-400">({c.employee.SHORTNAME})</span>
                      {c.employee.FUNCTION && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {c.employee.FUNCTION}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.reasons.map((r, i) => (
                        <span key={i} className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {r}
                        </span>
                      ))}
                      {c.reasons.length === 0 && (
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          ✓ Verfügbar
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{c.employee.HRSWEEK}h/Woche</span>
                    </div>
                  </div>

                  {/* Score */}
                  <ScoreBadge score={c.score} />

                  {/* Action */}
                  {wasAssigned ? (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      ✅ Zugewiesen
                    </span>
                  ) : (
                    <button
                      onClick={() => assignEmployee(c.employee.ID)}
                      disabled={assigning === c.employee.ID}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${
                        isBlocked
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {assigning === c.employee.ID ? '…' : isBlocked ? 'Trotzdem' : 'Einteilen'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {candidates.length > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 w-full text-xs text-slate-500 hover:text-slate-700 py-2 border border-dashed border-gray-200 rounded-lg"
            >
              {showAll ? 'Weniger anzeigen ▲' : `Alle ${candidates.length} anzeigen ▼`}
            </button>
          )}
        </div>
      )}

      {/* Help card */}
      {candidates.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          <p className="font-semibold mb-1">So funktioniert der Notfall-Plan:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Datum auswählen (heute ist vorausgewählt)</li>
            <li>Schicht wählen, die besetzt werden muss</li>
            <li>Optional: Kranken Mitarbeiter markieren &amp; aus Plan entfernen</li>
            <li>„Einspringer suchen" klicken → Vorschläge nach Verfügbarkeit &amp; Score</li>
            <li>Mit einem Klick zuweisen</li>
          </ol>
        </div>
      )}
    </div>
  );
}
