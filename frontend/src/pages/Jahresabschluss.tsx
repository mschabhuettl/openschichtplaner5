import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { LeaveForfeitResult } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Group } from '../types';

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

interface EmployeeCloseDetail {
  employee_id: number;
  employee_name: string;
  entitlement: number;
  carry_forward_in: number;
  total: number;
  used: number;
  remaining: number;
  proposed_carry_forward: number;
  forfeited: number;
}

interface AnnualClosePreview {
  year: number;
  next_year: number;
  employee_count: number;
  total_carry_forward: number;
  total_forfeited: number;
  details: EmployeeCloseDetail[];
}

interface AnnualCloseResult {
  year: number;
  next_year: number;
  processed: number;
  total_carry_forward: number;
  total_forfeited: number;
  already_existed: boolean;
  details: { employee_id: number; employee_name: string; remaining: number; carry_forward: number; forfeited: number }[];
}

// ─── Resturlaub-Verfall zum Stichtag (Spec 5.17, Gaps V-13/APP-INT-3) ────────
function ForfeitSection({ groups }: { groups: Group[] }) {
  const thisYear = new Date().getFullYear();
  const [cutoffDate, setCutoffDate] = useState(`${thisYear}-03-31`);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [preview, setPreview] = useState<LeaveForfeitResult | null>(null);
  const [result, setResult] = useState<LeaveForfeitResult | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const fmtNum = (n: number) => n.toFixed(n % 1 === 0 ? 0 : 1);

  const loadForfeitPreview = async () => {
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.forfeitLeaveEntitlements({
        cutoff_date: cutoffDate,
        group_id: groupId ?? undefined,
        dry_run: true,
      });
      setPreview(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  };

  const runForfeit = async () => {
    setWorking(true);
    setError(null);
    setShowConfirm(false);
    try {
      const data = await api.forfeitLeaveEntitlements({
        cutoff_date: cutoffDate,
        group_id: groupId ?? undefined,
        dry_run: false,
      });
      setResult(data);
      setPreview(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  };

  const cutsTable = (cuts: LeaveForfeitResult['cuts']) => (
    <div className="bg-white rounded-lg shadow overflow-x-auto mt-3">
      <table className="text-sm w-full min-w-[600px]">
        <thead>
          <tr className="bg-slate-700 text-white text-xs">
            <th scope="col" className="px-4 py-2 text-left">Mitarbeiter</th>
            <th scope="col" className="px-3 py-2 text-left">Abwesenheitsart</th>
            <th scope="col" className="px-3 py-2 text-center">Rest alt</th>
            <th scope="col" className="px-3 py-2 text-center">Rest neu</th>
            <th scope="col" className="px-3 py-2 text-center bg-red-800">Verfall</th>
          </tr>
        </thead>
        <tbody>
          {cuts.map((c, i) => (
            <tr key={`${c.employee_id}-${c.leave_type_id}`} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <td className="px-4 py-2 font-semibold text-gray-800">{c.employee_name}</td>
              <td className="px-3 py-2 text-gray-600">{c.leave_type_name}</td>
              <td className="px-3 py-2 text-center text-gray-700">{fmtNum(c.old_rest)}</td>
              <td className="px-3 py-2 text-center font-semibold text-blue-700">{fmtNum(c.new_rest)}</td>
              <td className="px-3 py-2 text-center font-bold text-red-600 bg-red-50">{fmtNum(c.forfeited)}</td>
            </tr>
          ))}
          {cuts.length === 0 && (
            <tr><td colSpan={5} className="text-center py-6 text-gray-600">Keine Kürzungen — nichts zu verfallen.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mt-8 bg-white rounded-lg border shadow-sm p-4">
      <h2 className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">🗓️ Resturlaub verfallen lassen (Stichtag)</h2>
      <p className="text-xs text-gray-500 mb-3">
        Kürzt den Übertrag aus dem Vorjahr auf das bis zum Stichtag Verbrauchte
        (neuer Rest = min(alter Rest, bis Stichtag genommene Tage)). Nur für Administratoren.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Stichtag</label>
          <input type="date" value={cutoffDate} onChange={e => setCutoffDate(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Gruppe (optional)</label>
          <select value={groupId ?? ''} onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Alle Gruppen</option>
            {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
          </select>
        </div>
        <div>
          <button onClick={loadForfeitPreview} disabled={working || !cutoffDate}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {working ? <span className="animate-spin">⟳</span> : '🔍'} Verfall-Vorschau
          </button>
        </div>
        <div>
          <button onClick={() => setShowConfirm(true)} disabled={working || !preview || preview.cuts.length === 0}
            className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2 font-semibold">
            ❌ Verfall ausführen
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
      )}

      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="font-bold text-green-800">
            ✅ Verfall zum {new Date(result.cutoff_date).toLocaleDateString('de-AT')} ausgeführt
          </div>
          <div className="text-sm text-green-700">
            {result.employees_processed} Mitarbeiter verarbeitet · {fmtNum(result.total_forfeited)} Tage verfallen
          </div>
          {cutsTable(result.cuts)}
        </div>
      )}

      {preview && !result && (
        <div className="mt-4">
          <div className="text-sm font-semibold text-gray-800">
            Vorschau: {preview.cuts.length} Kürzungen · {fmtNum(preview.total_forfeited)} Tage verfallen
            ({preview.employees_processed} Mitarbeiter geprüft)
          </div>
          {cutsTable(preview.cuts)}
        </div>
      )}

      {/* Confirmation dialog (destruktiv) */}
      {showConfirm && preview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdropIn">
          <div className="bg-white rounded-xl shadow-2xl animate-scaleIn w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">⚠️ Verfall bestätigen</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-gray-700 text-sm">
                Zum Stichtag <strong>{new Date(cutoffDate).toLocaleDateString('de-AT')}</strong> werden{' '}
                <strong>{fmtNum(preview.total_forfeited)} Resturlaubstage</strong> bei{' '}
                <strong>{preview.cuts.length} Einträgen</strong> endgültig gekürzt.
              </p>
              <p className="text-xs text-red-600 font-semibold">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} disabled={working}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Abbrechen</button>
              <button onClick={runForfeit} disabled={working}
                className="px-5 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2 font-semibold">
                {working ? <span className="animate-spin">⟳</span> : '❌'} Verfall ausführen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Jahresabschluss() {
  const { canAdmin } = useAuth();
  const currentYear = new Date().getFullYear() - 1; // default: last year
  const [year, setYear] = useState(currentYear);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  // "Urlaubsansprüche bleiben im Folgejahr gleich" (R6.8-4, Gap V-17)
  const [keepEntitlements, setKeepEntitlements] = useState(false);
  const [preview, setPreview] = useState<AnnualClosePreview | null>(null);
  const [result, setResult] = useState<AnnualCloseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Direkter Fetch statt api.getAnnualClosePreview: der Wrapper kennt
      // keep_entitlements (noch) nicht als Query-Parameter (Gap V-17).
      const p = new URLSearchParams({ year: String(year), keep_entitlements: String(keepEntitlements) });
      if (groupId != null) p.set('group_id', String(groupId));
      const res = await fetch(`${API}/api/v1/annual-close/preview?${p}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      setPreview(await res.json() as AnnualClosePreview);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [year, groupId, keepEntitlements]);

  const runAnnualClose = async () => {
    setRunning(true);
    setError(null);
    setShowConfirm(false);
    try {
      // max_carry_forward_days ist Pflichtfeld des Wrappers, wird von der API
      // aber ignoriert (Übertrag erfolgt artspezifisch über CARRYFWD, ungedeckelt).
      const payload = {
        year,
        max_carry_forward_days: 0,
        group_id: groupId ?? undefined,
        keep_entitlements: keepEntitlements,
      };
      const data = await api.runAnnualClose(payload);
      setResult(data as AnnualCloseResult);
      setPreview(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const filtered = (preview?.details ?? []).filter(d =>
    d.employee_name.toLowerCase().includes(search.toLowerCase())
  );

  const restColor = (r: number) =>
    r > 5 ? 'text-green-700' : r > 0 ? 'text-amber-700' : 'text-red-700';

  const fmtNum = (n: number) => n.toFixed(n % 1 === 0 ? 0 : 1);

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">📅 Jahresabschluss</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Resturlaub berechnen, Überträge für das Folgejahr festlegen und verfallene Ansprüche dokumentieren.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1 flex-shrink-0"
          title="Seite drucken"
        >
          🖨️ <span className="hidden sm:inline">Drucken</span>
        </button>
      </div>

      {/* Config panel */}
      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Konfiguration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Abzuschließendes Jahr</label>
            <div className="flex items-center gap-1">
              <button aria-label="Vorheriges Jahr" onClick={() => setYear(y => y - 1)} className="px-2 py-2 border rounded hover:bg-gray-50 text-sm">‹</button>
              <span className="px-4 py-2 font-bold text-gray-800 text-sm border rounded bg-gray-50 flex-1 text-center">{year}</span>
              <button aria-label="Nächstes Jahr" onClick={() => setYear(y => y + 1)} className="px-2 py-2 border rounded hover:bg-gray-50 text-sm">›</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Gruppe (optional)</label>
            <select value={groupId ?? ''} onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Alle Gruppen</option>
              {groups.map(g => <option key={g.ID} value={g.ID}>{g.NAME}</option>)}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={keepEntitlements}
                onChange={e => setKeepEntitlements(e.target.checked)}
              />
              Urlaubsansprüche bleiben im Folgejahr gleich
            </label>
          </div>
          <div>
            <button onClick={loadPreview} disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <span className="animate-spin">⟳</span> : '🔍'} Vorschau laden
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Der Übertrag erfolgt artspezifisch: Nur Abwesenheitsarten mit „Resttage übertragen" (CARRYFWD)
          werden ins Folgejahr übernommen — ungedeckelt wie im Original; der Rest verfällt.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* Success result */}
      {result && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">✅</span>
            <div>
              <div className="font-bold text-green-800 text-lg">Jahresabschluss {result.year} erfolgreich!</div>
              <div className="text-green-700 text-sm">
                {result.processed} Mitarbeiter verarbeitet — Überträge für {result.next_year} gespeichert.
              </div>
              {result.already_existed && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                  ⚠️ Für {result.next_year} existierten bereits Einträge — diese wurden überschrieben.
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Verarbeitet', value: result.processed, icon: '👥', color: 'text-green-800' },
              { label: 'Gesamt Übertrag', value: `${fmtNum(result.total_carry_forward)} Tage`, icon: '↪️', color: 'text-blue-700' },
              { label: 'Gesamt Verfall', value: `${fmtNum(result.total_forfeited)} Tage`, icon: '❌', color: 'text-red-700' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-white rounded-lg p-3 text-center border">
                <div className="text-lg mb-0.5">{icon}</div>
                <div className={`font-bold text-lg ${color}`}>{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="max-h-48 overflow-y-auto">
            <table className="text-xs w-full">
              <thead><tr className="bg-green-100">
                <th scope="col" className="px-3 py-1.5 text-left">Mitarbeiter</th>
                <th scope="col" className="px-3 py-1.5 text-center">Rest</th>
                <th scope="col" className="px-3 py-1.5 text-center">Übertrag {result.next_year}</th>
                <th scope="col" className="px-3 py-1.5 text-center">Verfall</th>
              </tr></thead>
              <tbody>
                {result.details.map((d, i) => (
                  <tr key={d.employee_id} className={i % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                    <td className="px-3 py-1">{d.employee_name}</td>
                    <td className={`px-3 py-1 text-center font-semibold ${restColor(d.remaining)}`}>{fmtNum(d.remaining)}</td>
                    <td className="px-3 py-1 text-center text-blue-700 font-semibold">{fmtNum(d.carry_forward)}</td>
                    <td className="px-3 py-1 text-center text-red-600">{d.forfeited > 0 ? fmtNum(d.forfeited) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => setResult(null)} className="mt-3 text-xs text-green-600 hover:underline">
            Neue Vorschau laden
          </button>
        </div>
      )}

      {/* Preview table */}
      {preview && !result && (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-gray-800">
                Vorschau Jahresabschluss {preview.year} → {preview.next_year}
              </h2>
              <p className="text-xs text-gray-500">
                {preview.employee_count} Mitarbeiter · Übertrag artspezifisch (CARRYFWD)
                {keepEntitlements ? ' · Ansprüche bleiben gleich' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)}
                className="px-3 py-1.5 border rounded shadow-sm text-sm w-36" />
              {canAdmin && (
                <button onClick={() => { setShowConfirm(true); setConfirmInput(''); }}
                  className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-2 font-semibold">
                  ✅ Jahresabschluss durchführen
                </button>
              )}
              {!canAdmin && (
                <span className="px-5 py-2 bg-gray-100 text-gray-400 text-sm rounded-lg border border-gray-200 flex items-center gap-2 cursor-not-allowed" title="Nur Administratoren können den Jahresabschluss durchführen">
                  🔒 Jahresabschluss durchführen
                </span>
              )}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Mitarbeiter', value: preview.employee_count, color: 'text-gray-700', icon: '👥' },
              { label: 'Gesamter Resturlaub', value: `${fmtNum(preview.details.reduce((s, d) => s + d.remaining, 0))} T`, color: 'text-blue-700', icon: '📊' },
              { label: 'Gesamter Übertrag', value: `${fmtNum(preview.total_carry_forward)} T`, color: 'text-green-700', icon: '↪️' },
              { label: 'Gesamter Verfall', value: `${fmtNum(preview.total_forfeited)} T`, color: preview.total_forfeited > 0 ? 'text-red-700' : 'text-gray-600', icon: '❌' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="bg-white rounded-lg border p-3 shadow-sm text-center">
                <div className="text-lg">{icon}</div>
                <div className={`text-lg font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="bg-slate-700 text-white text-xs">
                  <th scope="col" className="px-4 py-3 text-left">Mitarbeiter</th>
                  <th scope="col" className="px-3 py-3 text-center">Anspruch {preview.year}</th>
                  <th scope="col" className="px-3 py-3 text-center">Übertrag rein</th>
                  <th scope="col" className="px-3 py-3 text-center">Gesamt</th>
                  <th scope="col" className="px-3 py-3 text-center">Genommen</th>
                  <th scope="col" className="px-3 py-3 text-center">Resturlaub</th>
                  <th scope="col" className="px-3 py-3 text-center bg-blue-800">Übertrag {preview.next_year}</th>
                  <th scope="col" className="px-3 py-3 text-center bg-red-800">Verfall</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d.employee_id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="px-4 py-2">
                      <div className="font-semibold text-gray-800">{d.employee_name}</div>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">{fmtNum(d.entitlement)}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{fmtNum(d.carry_forward_in)}</td>
                    <td className="px-3 py-2 text-center font-semibold text-gray-700">{fmtNum(d.total)}</td>
                    <td className="px-3 py-2 text-center text-amber-700 font-semibold">{fmtNum(d.used)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold
                        ${d.remaining > 5 ? 'bg-green-50 text-green-700' : d.remaining > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {fmtNum(d.remaining)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-blue-700 bg-blue-50">
                      {fmtNum(d.proposed_carry_forward)}
                    </td>
                    <td className="px-3 py-2 text-center font-bold bg-red-50">
                      {d.forfeited > 0
                        ? <span className="text-red-600">{fmtNum(d.forfeited)}</span>
                        : <span className="text-gray-300">–</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-600">Keine Einträge gefunden</td></tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-sm border-t-2">
                    <td className="px-4 py-2 text-gray-700">Summe</td>
                    <td className="px-3 py-2 text-center text-gray-600">{fmtNum(filtered.reduce((s, d) => s + d.entitlement, 0))}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{fmtNum(filtered.reduce((s, d) => s + d.carry_forward_in, 0))}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{fmtNum(filtered.reduce((s, d) => s + d.total, 0))}</td>
                    <td className="px-3 py-2 text-center text-amber-700">{fmtNum(filtered.reduce((s, d) => s + d.used, 0))}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{fmtNum(filtered.reduce((s, d) => s + d.remaining, 0))}</td>
                    <td className="px-3 py-2 text-center text-blue-700 bg-blue-50">{fmtNum(filtered.reduce((s, d) => s + d.proposed_carry_forward, 0))}</td>
                    <td className="px-3 py-2 text-center text-red-600 bg-red-50">{fmtNum(filtered.reduce((s, d) => s + d.forfeited, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <strong>ℹ️ Hinweis:</strong> Die blau markierten Überträge werden beim Durchführen des Jahresabschlusses
            als Übertrag {preview.next_year} gespeichert. Der rote Verfall wird dokumentiert aber nicht automatisch abgezogen.
            Übertragen wird je Abwesenheitsart — nur Arten mit „Resttage übertragen" (CARRYFWD), ohne pauschales Limit.
          </div>
        </>
      )}

      {/* Empty state */}
      {!preview && !result && !loading && (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-600">
          <div className="text-5xl mb-3">📅</div>
          <div className="font-semibold text-gray-600 mb-1">Jahresabschluss {year}</div>
          <div className="text-sm">Konfigurieren Sie Jahr und Gruppe, dann klicken Sie auf "Vorschau laden".</div>
        </div>
      )}

      {/* Stichtags-Verfall (Spec 5.17) — nur Admin */}
      {canAdmin && <ForfeitSection groups={groups} />}

      {/* Confirmation dialog */}
      {showConfirm && preview && canAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdropIn">
          <div className="bg-white rounded-xl shadow-2xl animate-scaleIn w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">⚠️ Jahresabschluss bestätigen</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-gray-700 text-sm">
                Sie sind dabei, den <strong>Jahresabschluss {preview.year}</strong> für{' '}
                <strong>{preview.employee_count} Mitarbeiter</strong> durchzuführen.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                <div className="font-semibold mb-1">Diese Aktion wird:</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Für jeden Mitarbeiter den Resturlaub berechnen</li>
                  <li>Resttage artspezifisch (nur Arten mit „Resttage übertragen") als Übertrag {preview.next_year} speichern</li>
                  {keepEntitlements && (
                    <li>Ansprüche {preview.year} unverändert nach {preview.next_year} übernehmen</li>
                  )}
                  <li><strong>{fmtNum(preview.total_forfeited)} Tage</strong> Gesamtverfall dokumentieren</li>
                  <li>Bestehende {preview.next_year}-Ansprüche werden überschrieben</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Zur Bestätigung bitte Jahr <strong>{preview.year}</strong> eingeben:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  placeholder={String(preview.year)}
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} disabled={running}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Abbrechen</button>
              <button onClick={runAnnualClose} disabled={running || confirmInput !== String(preview?.year)}
                className="px-5 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 flex items-center gap-2 font-semibold">
                {running ? <span className="animate-spin">⟳</span> : '✅'} Jahresabschluss durchführen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
