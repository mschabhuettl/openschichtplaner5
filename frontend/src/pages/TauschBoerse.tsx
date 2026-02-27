import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { SwapRequest } from '../api/client';
import type { Employee, ShiftType } from '../types';

// ─── Status helpers ────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending:   'Ausstehend',
  approved:  'Genehmigt',
  rejected:  'Abgelehnt',
  cancelled: 'Storniert',
};
const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800 border border-yellow-300',
  approved:  'bg-green-100 text-green-800 border border-green-300',
  rejected:  'bg-red-100 text-red-800 border border-red-300',
  cancelled: 'bg-gray-100 text-gray-500 border border-gray-300',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ShiftBadge({ shift }: { shift?: { id: number; name: string; color: string } | null }) {
  if (!shift) return <span className="text-gray-400 text-xs italic">Frei / unbekannt</span>;
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-bold text-white"
      style={{ background: shift.color || '#6b7280' }}
    >
      {shift.name}
    </span>
  );
}

function formatDate(d: string) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDT(s: string | null) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
}

// ─── New Request Modal ─────────────────────────────────────
function NewRequestModal({
  employees,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [requesterId, setRequesterId] = useState('');
  const [requesterDate, setRequesterDate] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [partnerDate, setPartnerDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!requesterId || !requesterDate || !partnerId || !partnerDate) {
      setError('Alle Pflichtfelder ausfüllen.');
      return;
    }
    if (requesterId === partnerId) {
      setError('Antragsteller und Partner müssen verschieden sein.');
      return;
    }
    setSaving(true);
    try {
      await api.createSwapRequest({
        requester_id: parseInt(requesterId),
        requester_date: requesterDate,
        partner_id: parseInt(partnerId),
        partner_date: partnerDate,
        note,
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-800">🔄 Neue Tausch-Anfrage</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}

          {/* Requester */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Antragsteller *</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                value={requesterId}
                onChange={e => setRequesterId(e.target.value)}
              >
                <option value="">— Mitarbeiter wählen —</option>
                {employees.map(e => (
                  <option key={e.ID} value={e.ID}>{e.SHORTNAME} – {e.NAME}, {e.FIRSTNAME}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Datum (Antragsteller) *</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                value={requesterDate}
                onChange={e => setRequesterDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold">
            <div className="flex-1 border-t" />
            ↕ tauscht mit
            <div className="flex-1 border-t" />
          </div>

          {/* Partner */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tauschpartner *</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                value={partnerId}
                onChange={e => setPartnerId(e.target.value)}
              >
                <option value="">— Mitarbeiter wählen —</option>
                {employees.map(e => (
                  <option key={e.ID} value={e.ID}>{e.SHORTNAME} – {e.NAME}, {e.FIRSTNAME}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Datum (Partner) *</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                value={partnerDate}
                onChange={e => setPartnerDate(e.target.value)}
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Begründung / Notiz</label>
            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
              placeholder="z.B. privater Termin, Arztbesuch…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Speichern…' : '📩 Anfrage stellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reject Dialog ─────────────────────────────────────────
function RejectDialog({
  swapId,
  onClose,
  onRejected,
}: {
  swapId: number;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    setSaving(true);
    try {
      await api.resolveSwapRequest(swapId, { action: 'reject', reject_reason: reason });
      onRejected();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
        <h3 className="font-bold text-gray-800 mb-3">❌ Anfrage ablehnen</h3>
        <textarea
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none mb-4 focus:ring-2 focus:ring-red-400 focus:outline-none"
          placeholder="Ablehnungsgrund (optional)…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
            Abbrechen
          </button>
          <button
            onClick={handleReject}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Ablehnen…' : 'Ablehnen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function TauschBoerse() {
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [_shifts, setShifts] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNew, setShowNew] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reqs, emps, shts] = await Promise.all([
        api.getSwapRequests(statusFilter !== 'all' ? { status: statusFilter } : {}),
        api.getEmployees(),
        api.getShifts(),
      ]);
      setRequests(reqs);
      setEmployees(emps);
      setShifts(shts);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ladefehler');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 4000);
  };

  const handleApprove = async (id: number) => {
    try {
      await api.resolveSwapRequest(id, { action: 'approve' });
      flash('✅ Tausch genehmigt und ausgeführt!');
      load();
    } catch (e: unknown) {
      flash('❌ Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Anfrage löschen?')) return;
    try {
      await api.deleteSwapRequest(id);
      flash('🗑️ Anfrage gelöscht');
      load();
    } catch (e: unknown) {
      flash('❌ Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'));
    }
  };

  // ── Stats ──
  const total = requests.length;
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              🔄 Schicht-Tauschbörse
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Mitarbeiter beantragen Schichttausch — Planer genehmigt oder lehnt ab
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm"
          >
            + Neue Anfrage
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Flash message */}
        {actionMsg && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm font-medium">
            {actionMsg}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Gesamt', value: total, color: 'text-gray-800' },
            { label: 'Ausstehend', value: pendingCount, color: 'text-yellow-700' },
            { label: 'Genehmigt', value: approvedCount, color: 'text-green-700' },
            { label: 'Abgelehnt', value: rejectedCount, color: 'text-red-700' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'approved', 'rejected', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'Alle' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">⏳</div>
            Lade Anfragen…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
            <div className="text-5xl mb-4">🤝</div>
            <div className="font-semibold text-gray-600">Keine Tausch-Anfragen</div>
            <div className="text-sm mt-1">
              {statusFilter !== 'all'
                ? 'Für diesen Filter gibt es keine Einträge.'
                : 'Noch keine Anfragen gestellt. Klick auf "+ Neue Anfrage" um eine zu erstellen.'}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Antragsteller</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum & Schicht</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">↕</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Partner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum & Schicht</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Erstellt</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{req.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{req.requester_short ?? req.requester_id}</div>
                        <div className="text-xs text-gray-400">{req.requester_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{formatDate(req.requester_date)}</div>
                        <div className="mt-0.5"><ShiftBadge shift={req.requester_shift} /></div>
                      </td>
                      <td className="px-4 py-3 text-center text-lg text-gray-400">⇄</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{req.partner_short ?? req.partner_id}</div>
                        <div className="text-xs text-gray-400">{req.partner_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{formatDate(req.partner_date)}</div>
                        <div className="mt-0.5"><ShiftBadge shift={req.partner_shift} /></div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                        {req.reject_reason && (
                          <div className="text-xs text-red-500 mt-1 max-w-[160px] truncate" title={req.reject_reason}>
                            {req.reject_reason}
                          </div>
                        )}
                        {req.resolved_by && req.status === 'approved' && (
                          <div className="text-xs text-gray-400 mt-1">{formatDT(req.resolved_at)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {formatDT(req.created_at)}
                        {req.note && (
                          <div className="text-gray-500 italic mt-1 max-w-[140px] truncate" title={req.note}>
                            „{req.note}"
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'pending' ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleApprove(req.id)}
                              className="px-2.5 py-1 rounded bg-green-500 text-white text-xs font-semibold hover:bg-green-600"
                              title="Genehmigen & ausführen"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setRejectId(req.id)}
                              className="px-2.5 py-1 rounded bg-red-500 text-white text-xs font-semibold hover:bg-red-600"
                              title="Ablehnen"
                            >
                              ✕
                            </button>
                            <button
                              onClick={() => handleDelete(req.id)}
                              className="px-2.5 py-1 rounded bg-gray-200 text-gray-600 text-xs hover:bg-gray-300"
                              title="Löschen"
                            >
                              🗑
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDelete(req.id)}
                            className="px-2.5 py-1 rounded bg-gray-100 text-gray-500 text-xs hover:bg-gray-200"
                            title="Löschen"
                          >
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNew && (
        <NewRequestModal
          employees={employees}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); flash('📩 Tausch-Anfrage gestellt!'); }}
        />
      )}
      {rejectId !== null && (
        <RejectDialog
          swapId={rejectId}
          onClose={() => setRejectId(null)}
          onRejected={() => { setRejectId(null); load(); flash('❌ Anfrage abgelehnt'); }}
        />
      )}
    </div>
  );
}
