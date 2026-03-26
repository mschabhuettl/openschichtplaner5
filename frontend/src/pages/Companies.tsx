import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components';

// ── Types ──────────────────────────────────────────────────
interface Company {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  employee_count: number;
  group_count: number;
}

interface CompanyForm {
  name: string;
  slug: string;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

function getDevToken(): string | null {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return null;
    const session = JSON.parse(raw) as { devMode?: boolean };
    return session.devMode ? '__dev_mode__' : null;
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const devToken = getDevToken();
  return devToken ? { 'X-Auth-Token': devToken } : {};
}

// ── Component ──────────────────────────────────────────────
export default function Companies() {
  const { canAdmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CompanyForm>({ name: '', slug: '' });
  const [saving, setSaving] = useState(false);

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/api/companies`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const data = await res.json();
      setCompanies(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editId
        ? `${BASE_URL}/api/companies/${editId}`
        : `${BASE_URL}/api/companies`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Fehler' }));
        throw new Error(data.detail || `Fehler ${res.status}`);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', slug: '' });
      await fetchCompanies();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c: Company) => {
    setEditId(c.id);
    setForm({ name: c.name, slug: c.slug });
    setShowForm(true);
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Firma wirklich deaktivieren?')) return;
    try {
      const res = await fetch(`${BASE_URL}/api/companies/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Fehler' }));
        throw new Error(data.detail || `Fehler ${res.status}`);
      }
      await fetchCompanies();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!canAdmin) {
    return (
      <div className="p-6">
        <p className="text-red-500">Kein Zugriff — Admin-Berechtigung erforderlich.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Firmenverwaltung"
        subtitle="Mandanten und Firmen verwalten"
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">×</button>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {companies.length} Firma{companies.length !== 1 ? 'en' : ''}
        </p>
        <button
          onClick={() => {
            setEditId(null);
            setForm({ name: '', slug: '' });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Neue Firma
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {editId ? 'Firma bearbeiten' : 'Neue Firma'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug (URL-Kennung)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="auto-generiert"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
                <p className="text-xs text-gray-400 mt-1">Leer lassen für automatische Generierung</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditId(null); }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? 'Speichern…' : editId ? 'Aktualisieren' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Companies Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Laden…</div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Keine Firmen vorhanden. Erstelle die erste Firma.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mitarbeiter</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Gruppen</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {companies.map((c) => (
                <tr key={c.id} className={!c.is_active ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 text-sm font-mono">{c.id}</td>
                  <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{c.slug}</td>
                  <td className="px-4 py-3 text-sm text-center">{c.employee_count}</td>
                  <td className="px-4 py-3 text-sm text-center">{c.group_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {c.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(c)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Bearbeiten
                    </button>
                    {c.id !== 1 && c.is_active && (
                      <button
                        onClick={() => handleDeactivate(c.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Deaktivieren
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
