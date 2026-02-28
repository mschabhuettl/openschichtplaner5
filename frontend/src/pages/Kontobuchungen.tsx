import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Booking } from '../api/client';
import type { Employee } from '../types';
import { useToast } from '../hooks/useToast';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const BOOKING_TYPE_LABELS: Record<number, string> = {
  0: 'Iststundenkonto',
  1: 'Sollstundenkonto',
};

function formatValue(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)} h`;
}

// ─── New Booking Modal ────────────────────────────────────────

interface BookingModalProps {
  open: boolean;
  employees: Employee[];
  defaultEmployeeId?: number;
  defaultYear: number;
  defaultMonth: number;
  onSave: (data: { employee_id: number; date: string; type: number; value: number; note: string }) => Promise<void>;
  onClose: () => void;
}

function BookingModal({
  open,
  employees,
  defaultEmployeeId,
  defaultYear,
  defaultMonth,
  onSave,
  onClose,
}: BookingModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  // Default date: first day of selected month/year (or today if in the same month)
  const defaultDate = (() => {
    const d = new Date();
    if (d.getFullYear() === defaultYear && d.getMonth() + 1 === defaultMonth) return today;
    return `${defaultYear}-${String(defaultMonth).padStart(2, '0')}-01`;
  })();

  const [empId, setEmpId] = useState<number>(defaultEmployeeId ?? 0);
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState<number>(0);
  const [value, setValue] = useState<string>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmpId(defaultEmployeeId ?? (employees[0]?.ID ?? 0));
      setDate(defaultDate);
      setType(0);
      setValue('');
      setNote('');
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numValue = parseFloat(value.replace(',', '.'));
    if (isNaN(numValue)) {
      setError('Bitte einen gültigen Stundenwert eingeben (z.B. 2.5 oder -1.0)');
      return;
    }
    if (!empId) {
      setError('Bitte einen Mitarbeiter auswählen');
      return;
    }
    if (!date) {
      setError('Bitte ein Datum auswählen');
      return;
    }
    setSaving(true);
    try {
      await onSave({ employee_id: empId, date, type, value: numValue, note });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-backdropIn">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Neue Kontobuchung</h2>
          <button aria-label="Schließen" onClick={onClose} className="text-slate-600 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mitarbeiter</label>
            <select
              value={empId}
              onChange={e => setEmpId(Number(e.target.value))}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={0}>– Bitte wählen –</option>
              {employees.map(emp => (
                <option key={emp.ID} value={emp.ID}>
                  {emp.NAME}{emp.FIRSTNAME ? `, ${emp.FIRSTNAME}` : ''}{emp.SHORTNAME ? ` (${emp.SHORTNAME})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Buchungsart</label>
            <select
              value={type}
              onChange={e => setType(Number(e.target.value))}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Buchung auf Iststundenkonto</option>
              <option value={1}>Buchung auf Sollstundenkonto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Wert (Stunden, z.B. +2.5 oder -1.0)
            </label>
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="z.B. 2.5 oder -1.0"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kommentar (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Freitext-Kommentar..."
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Speichern…' : 'Buchung speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation ──────────────────────────────────────

interface DeleteConfirmProps {
  booking: Booking | null;
  employeeName: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function DeleteConfirm({ booking, employeeName, onConfirm, onClose }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false);
  if (!booking) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-backdropIn">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Buchung löschen?</h2>
        <p className="text-sm text-slate-600 mb-1">
          <span className="font-medium">{employeeName}</span> · {booking.date}
        </p>
        <p className="text-sm text-slate-600 mb-1">
          {BOOKING_TYPE_LABELS[booking.type] ?? `Typ ${booking.type}`} · {formatValue(booking.value)}
        </p>
        {booking.note && (
          <p className="text-sm text-slate-500 italic mb-4">"{booking.note}"</p>
        )}
        <p className="text-sm text-red-600 mb-4">Diese Aktion kann nicht rückgängig gemacht werden.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Löschen…' : 'Löschen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Kontobuchungen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | undefined>(undefined);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const { showToast } = useToast();

  // Load employees once
  useEffect(() => {
    api.getEmployees().then(setEmployees).catch(console.error);
  }, []);

  // Load bookings whenever filters change
  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBookings(year, month, selectedEmployeeId);
      setBookings(data);
    } catch (_err) {
      showToast('Fehler beim Laden der Buchungen', 'error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, selectedEmployeeId]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  // Compute saldo
  const istSum = bookings.filter(b => b.type === 0).reduce((s, b) => s + b.value, 0);
  const sollSum = bookings.filter(b => b.type === 1).reduce((s, b) => s + b.value, 0);

  // Employee lookup
  const empMap = Object.fromEntries(employees.map(e => [e.ID, e]));
  const getEmpName = (id: number) => {
    const e = empMap[id];
    if (!e) return `MA #${id}`;
    return `${e.NAME}${e.FIRSTNAME ? `, ${e.FIRSTNAME}` : ''}`;
  };

  // Create booking
  const handleCreate = async (data: {
    employee_id: number;
    date: string;
    type: number;
    value: number;
    note: string;
  }) => {
    await api.createBooking(data);
    showToast('Buchung gespeichert', 'success');
    await loadBookings();
  };

  // Delete booking
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteBooking(deleteTarget.id);
    showToast('Buchung gelöscht', 'success');
    await loadBookings();
  };

  // Year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-5xl mx-auto">

      <BookingModal
        open={showModal}
        employees={employees}
        defaultEmployeeId={selectedEmployeeId}
        defaultYear={year}
        defaultMonth={month}
        onSave={handleCreate}
        onClose={() => setShowModal(false)}
      />

      <DeleteConfirm
        booking={deleteTarget}
        employeeName={deleteTarget ? getEmpName(deleteTarget.employee_id) : ''}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">💰 Kontobuchungen</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manuelle Buchungen auf Ist- und Sollstundenkonto</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="no-print px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded shadow-sm flex items-center gap-1"
            title="Seite drucken"
          >
            🖨️ <span className="hidden sm:inline">Drucken</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            + Neue Buchung
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Jahr</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Monat</label>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Mitarbeiter</label>
          <select
            value={selectedEmployeeId ?? ''}
            onChange={e => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Mitarbeiter</option>
            {employees.map(emp => (
              <option key={emp.ID} value={emp.ID}>
                {emp.NAME}{emp.FIRSTNAME ? `, ${emp.FIRSTNAME}` : ''}{emp.SHORTNAME ? ` (${emp.SHORTNAME})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Saldo Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ist-Buchungen</div>
          <div className={`text-2xl font-bold ${istSum >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatValue(istSum)}
          </div>
          <div className="text-xs text-slate-600 mt-1">{bookings.filter(b => b.type === 0).length} Buchungen</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Soll-Buchungen</div>
          <div className={`text-2xl font-bold ${sollSum >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {formatValue(sollSum)}
          </div>
          <div className="text-xs text-slate-600 mt-1">{bookings.filter(b => b.type === 1).length} Buchungen</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Gesamt (Ist + Soll)</div>
          <div className={`text-2xl font-bold ${(istSum + sollSum) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatValue(istSum + sollSum)}
          </div>
          <div className="text-xs text-slate-600 mt-1">{bookings.length} Buchungen gesamt</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">
            Buchungen — {MONTH_NAMES[month - 1]} {year}
          </h2>
          {loading && <span className="text-xs text-slate-600">Laden…</span>}
        </div>

        {!loading && bookings.length === 0 ? (
          <div className="py-16 text-center text-slate-600">
            <div className="text-4xl mb-3">📂</div>
            <p className="text-sm">Keine Buchungen für diesen Zeitraum</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Erste Buchung erstellen
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mitarbeiter</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Buchungsart</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Wert</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kommentar</th>
                  <th className="px-4 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map(booking => {
                  const isIst = booking.type === 0;
                  const isPositive = booking.value >= 0;
                  return (
                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">
                        {booking.date}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {getEmpName(booking.employee_id)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isIst
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {BOOKING_TYPE_LABELS[booking.type] ?? `Typ ${booking.type}`}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatValue(booking.value)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs max-w-xs truncate">
                        {booking.note || <span className="text-slate-300">–</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setDeleteTarget(booking)}
                          className="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none"
                          title="Buchung löschen"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
