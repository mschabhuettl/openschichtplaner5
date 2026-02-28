/**
 * MeinProfil — Self-Service Portal für Mitarbeiter (Leser-Rolle)
 * Zeigt eigene Schichten, Abwesenheiten, Resturlaub, Qualifikationen
 * und ermöglicht das Einreichen von Schichtwünschen und Urlaubsanträgen.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { ShiftType, LeaveType, ScheduleEntry } from '../types';
import type { Wish } from '../api/client';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';

// ── Helpers ───────────────────────────────────────────────────
const TODAY = new Date();
function pad(n: number) { return String(n).padStart(2, '0'); }
function toYMD(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function monthLabel(y: number, m: number) {
  return new Date(y, m - 1, 1).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });
}
function hexColor(hex?: string | null, fallback = '#6b7280') {
  if (!hex) return fallback;
  return hex.startsWith('#') ? hex : `#${hex}`;
}

type AbsenceRecord = {
  id: number;
  employee_id: number;
  date: string;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_short: string;
};

type Entitlement = {
  id: number;
  employee_id: number;
  year: number;
  leave_type_id: number;
  leave_type_name: string;
  entitlement: number;
  carry_forward: number;
  in_days: boolean;
};

interface MonthData {
  year: number;
  month: number;
  entries: ScheduleEntry[];
}

// ── Sub-components ─────────────────────────────────────────────
function ShiftCard({ entry, shifts }: { entry: ScheduleEntry; shifts: ShiftType[] }) {
  if (entry.kind === 'absence') {
    const bg = hexColor(entry.color_bk, '#fbbf24');
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: bg + '22', borderLeft: `3px solid ${bg}` }}>
        <span className="font-semibold text-gray-700">{entry.date}</span>
        <span className="px-1.5 py-0.5 rounded text-white text-xs font-medium" style={{ background: bg }}>
          AB
        </span>
        <span className="text-gray-600">{entry.leave_name ?? 'Abwesenheit'}</span>
      </div>
    );
  }
  const shift = shifts.find(s => s.ID === entry.shift_id);
  const bg = hexColor(shift?.COLORBK_HEX ?? entry.color_bk, '#3b82f6');
  const textColor = (shift?.COLORBK_LIGHT) ? '#1f2937' : '#ffffff';
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: bg + '22', borderLeft: `3px solid ${bg}` }}>
      <span className="font-semibold text-gray-700">{entry.date}</span>
      <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: bg, color: textColor }}>
        {shift?.SHORTNAME ?? entry.display_name ?? '?'}
      </span>
      <span className="text-gray-600">{shift?.NAME ?? entry.shift_name ?? 'Schicht'}</span>
    </div>
  );
}

function WishRow({ wish, onDelete }: { wish: Wish; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-xs border border-gray-200">
      <span className="font-semibold text-gray-700">{wish.date}</span>
      <Badge variant={wish.wish_type === 'WUNSCH' ? 'green' : 'red'} shape="square">
        {wish.wish_type === 'WUNSCH' ? '💚 Wunsch' : '🔴 Sperrung'}
      </Badge>
      {wish.note && <span className="text-gray-500 flex-1 truncate">{wish.note}</span>}
      <button
        onClick={() => onDelete(wish.id)}
        className="ml-auto text-red-400 hover:text-red-600 transition-colors px-1"
        title="Wunsch löschen"
      >✕</button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function MeinProfil() {
  const { user } = useAuth();

  const [empId, setEmpId] = useState<number | null>(null);
  const [empName, setEmpName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [mySkills, setMySkills] = useState<{ id: string; name: string }[]>([]);

  // Wish form
  const [wishDate, setWishDate] = useState('');
  const [wishType, setWishType] = useState<'WUNSCH' | 'SPERRUNG'>('WUNSCH');
  const [wishNote, setWishNote] = useState('');
  const [wishSubmitting, setWishSubmitting] = useState(false);
  const [wishMsg, setWishMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Absence form
  const [absDate, setAbsDate] = useState('');
  const [absLeaveTypeId, setAbsLeaveTypeId] = useState<number | ''>('');
  const [absSubmitting, setAbsSubmitting] = useState(false);
  const [absMsg, setAbsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, shiftsRes, ltRes] = await Promise.all([
        api.getMyEmployee(),
        api.getShifts(),
        api.getLeaveTypes(),
      ]);

      setShifts(shiftsRes);
      setLeaveTypes(ltRes);

      if (!meRes.employee) {
        setError('Kein Mitarbeiter-Datensatz für deinen Benutzer gefunden. Bitte wende dich an den Administrator.');
        setLoading(false);
        return;
      }

      const emp = meRes.employee as Record<string, unknown>;
      const eid = emp.ID as number;
      setEmpId(eid);
      setEmpName(`${(emp.FIRSTNAME as string) ?? ''} ${(emp.NAME as string) ?? ''}`.trim());

      // Schedule: current + next month
      const months: MonthData[] = [];
      for (let offset = 0; offset < 2; offset++) {
        const d = new Date(TODAY.getFullYear(), TODAY.getMonth() + offset, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        try {
          const sched = (await api.getSchedule(y, m)) as unknown as ScheduleEntry[];
          const entries = sched.filter((e: ScheduleEntry) => e.employee_id === eid);
          months.push({ year: y, month: m, entries });
        } catch {
          months.push({ year: y, month: m, entries: [] });
        }
      }
      setMonthsData(months);

      // Absences current year
      const absData = await api.getAbsences({ employee_id: eid, year: TODAY.getFullYear() });
      setAbsences(absData as AbsenceRecord[]);

      // Leave entitlements
      try {
        const ents = await api.getLeaveEntitlements({ employee_id: eid, year: TODAY.getFullYear() });
        setEntitlements(ents as Entitlement[]);
      } catch { /* optional */ }

      // Wishes
      const wRes = await api.getWishes({ employee_id: eid, year: TODAY.getFullYear() });
      setWishes(wRes);

      // Skills — direct fetch (not in api client)
      try {
        const BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? '';
        const token = localStorage.getItem('sp5_session') ? JSON.parse(localStorage.getItem('sp5_session')!).token : '';
        const headers: Record<string, string> = token ? { 'X-Auth-Token': token } : {};

        const [skRes, asRes] = await Promise.all([
          fetch(`${BASE}/api/skills`, { headers }),
          fetch(`${BASE}/api/skills/assignments`, { headers }),
        ]);
        if (skRes.ok && asRes.ok) {
          const skillList = await skRes.json() as { id: string; name: string }[];
          const assignList = await asRes.json() as { employee_id: number; skill_id: string }[];
          const mySkillIds = new Set(assignList.filter(a => a.employee_id === eid).map(a => a.skill_id));
          setMySkills(skillList.filter(s => mySkillIds.has(s.id)));
        }
      } catch { /* skills optional */ }

    } catch (err) {
      setError('Fehler beim Laden der Daten.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishDate) return;
    setWishSubmitting(true);
    setWishMsg(null);
    try {
      await api.createSelfWish({ date: wishDate, wish_type: wishType, note: wishNote });
      setWishDate('');
      setWishNote('');
      setWishMsg({ type: 'ok', text: '✓ Wunsch eingereicht!' });
      if (empId) {
        const wRes = await api.getWishes({ employee_id: empId, year: TODAY.getFullYear() });
        setWishes(wRes);
      }
    } catch (err: unknown) {
      setWishMsg({ type: 'err', text: err instanceof Error ? err.message : 'Fehler beim Einreichen' });
    } finally {
      setWishSubmitting(false);
    }
  };

  const handleDeleteWish = async (wishId: number) => {
    try {
      await api.deleteSelfWish(wishId);
      setWishes(prev => prev.filter(w => w.id !== wishId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  const handleAbsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absDate || absLeaveTypeId === '') return;
    setAbsSubmitting(true);
    setAbsMsg(null);
    try {
      await api.createSelfAbsence({ date: absDate, leave_type_id: absLeaveTypeId as number });
      setAbsDate('');
      setAbsLeaveTypeId('');
      setAbsMsg({ type: 'ok', text: '✓ Antrag eingereicht!' });
      if (empId) {
        const absData = await api.getAbsences({ employee_id: empId, year: TODAY.getFullYear() });
        setAbsences(absData as AbsenceRecord[]);
        try {
          const ents = await api.getLeaveEntitlements({ employee_id: empId, year: TODAY.getFullYear() });
          setEntitlements(ents as Entitlement[]);
        } catch { /* optional */ }
      }
    } catch (err: unknown) {
      setAbsMsg({ type: 'err', text: err instanceof Error ? err.message : 'Fehler beim Beantragen' });
    } finally {
      setAbsSubmitting(false);
    }
  };

  // ── Compute leave balance from entitlements + absences ──────
  const leaveBalance = entitlements.map(ent => {
    const used = absences.filter(a => a.leave_type_id === ent.leave_type_id).length;
    const total = ent.entitlement + (ent.carry_forward || 0);
    return { name: ent.leave_type_name, entitled: total, used, remaining: total - used };
  }).filter(b => b.entitled > 0);

  const futureWishes = wishes.filter(w => w.date >= toYMD(TODAY)).sort((a, b) => a.date.localeCompare(b.date));
  const urlaubTypes = leaveTypes.filter(lt => lt.ENTITLED && !lt.HIDE);
  const otherTypes = leaveTypes.filter(lt => !lt.ENTITLED && !lt.HIDE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Dein Profil wird geladen…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-amber-800 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold select-none">
            {empName ? empName[0]?.toUpperCase() : '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{empName || user?.NAME || 'Mein Profil'}</h1>
            <p className="text-blue-100 text-sm mt-0.5">Mitarbeiter Self-Service Portal</p>
          </div>
        </div>
      </div>

      {/* Upcoming shifts */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xl">📅</span>
          <h2 className="font-semibold text-gray-800">Meine Schichten</h2>
        </div>
        <div className="p-5 space-y-5">
          {monthsData.map(md => (
            <div key={`${md.year}-${md.month}`}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {monthLabel(md.year, md.month)}
              </h3>
              {md.entries.length === 0 ? (
                <p className="text-sm text-gray-400 italic pl-2">Keine Einträge in diesem Monat</p>
              ) : (
                <div className="space-y-1.5">
                  {md.entries.map((e, i) => (
                    <ShiftCard key={i} entry={e} shifts={shifts} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Urlaub & Abwesenheiten */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Leave Balance */}
        {leaveBalance.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="text-xl">🏖️</span>
              <h2 className="font-semibold text-gray-800">Resturlaub {TODAY.getFullYear()}</h2>
            </div>
            <div className="p-5 space-y-4">
              {leaveBalance.map((b, i) => {
                const pct = b.entitled > 0 ? Math.min(100, (b.used / b.entitled) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-700 font-medium">{b.name}</span>
                      <span className="text-gray-500 text-xs">{b.remaining} von {b.entitled} übrig</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Absences list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="font-semibold text-gray-800">Abwesenheiten {TODAY.getFullYear()}</h2>
          </div>
          <div className="p-5">
            {absences.length === 0 ? (
              <EmptyState icon="📋" title="Keine Abwesenheiten" description="Für dieses Jahr sind keine Abwesenheiten eingetragen." className="py-8" />
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {[...absences].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs p-1.5 rounded-lg bg-gray-50">
                    <span className="font-semibold text-gray-700 w-24 shrink-0">{a.date}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium shrink-0">{a.leave_type_short}</span>
                    <span className="text-gray-500 truncate">{a.leave_type_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Qualifications / Skills */}
      {mySkills.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <h2 className="font-semibold text-gray-800">Meine Qualifikationen</h2>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {mySkills.map(s => (
                <Badge key={s.id} variant="indigo" shape="pill" className="text-sm py-1 px-3">
                  🎓 {s.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schichtwunsch / Sperrtag */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xl">💬</span>
          <h2 className="font-semibold text-gray-800">Schichtwunsch / Sperrtag einreichen</h2>
        </div>
        <div className="p-5 space-y-4">
          <form onSubmit={handleWishSubmit} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Datum</label>
              <input
                type="date"
                value={wishDate}
                min={toYMD(TODAY)}
                onChange={e => setWishDate(e.target.value)}
                required
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
              <select
                value={wishType}
                onChange={e => setWishType(e.target.value as 'WUNSCH' | 'SPERRUNG')}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                <option value="WUNSCH">💚 Schichtwunsch</option>
                <option value="SPERRUNG">🔴 Sperrtag</option>
              </select>
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notiz (optional)</label>
              <input
                type="text"
                value={wishNote}
                onChange={e => setWishNote(e.target.value)}
                placeholder="z.B. Arzttermin, Hochzeit…"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={wishSubmitting || !wishDate}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {wishSubmitting ? '…' : 'Einreichen'}
            </button>
          </form>

          {wishMsg && (
            <p className={`text-xs rounded-lg px-3 py-2 ${wishMsg.type === 'ok' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>
              {wishMsg.text}
            </p>
          )}

          {futureWishes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Meine offenen Wünsche</p>
              <div className="space-y-1.5">
                {futureWishes.map(w => (
                  <WishRow key={w.id} wish={w} onDelete={handleDeleteWish} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Urlaub beantragen */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xl">🌴</span>
          <h2 className="font-semibold text-gray-800">Urlaub / Abwesenheit beantragen</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            ℹ️ Dein Antrag wird direkt im System eingetragen und ist für den Planer sofort sichtbar.
          </p>
          <form onSubmit={handleAbsSubmit} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Datum</label>
              <input
                type="date"
                value={absDate}
                min={toYMD(TODAY)}
                onChange={e => setAbsDate(e.target.value)}
                required
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Abwesenheitsart</label>
              <select
                value={absLeaveTypeId}
                onChange={e => setAbsLeaveTypeId(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
              >
                <option value="">Bitte wählen…</option>
                {urlaubTypes.length > 0 && (
                  <optgroup label="Urlaub">
                    {urlaubTypes.map(lt => <option key={lt.ID} value={lt.ID}>{lt.NAME}</option>)}
                  </optgroup>
                )}
                {otherTypes.length > 0 && (
                  <optgroup label="Sonstige">
                    {otherTypes.map(lt => <option key={lt.ID} value={lt.ID}>{lt.NAME}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
            <button
              type="submit"
              disabled={absSubmitting || !absDate || absLeaveTypeId === ''}
              className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {absSubmitting ? '…' : 'Beantragen'}
            </button>
          </form>

          {absMsg && (
            <p className={`text-xs rounded-lg px-3 py-2 ${absMsg.type === 'ok' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>
              {absMsg.text}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
