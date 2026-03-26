import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface Webhook {
  id: number;
  url: string;
  name: string;
  events: string[];
  secret: string;
  active: boolean;
  created_at: string;
  last_delivery: {
    success: boolean;
    status_code?: number;
    error?: string;
    attempt: number;
    timestamp: string;
  } | null;
}

interface WebhookForm {
  url: string;
  name: string;
  events: string[];
  active: boolean;
}

const EMPTY_FORM: WebhookForm = {
  url: '',
  name: '',
  events: [],
  active: true,
};

const AVAILABLE_EVENTS = [
  { value: 'shift.created', label: 'Schicht erstellt' },
  { value: 'shift.updated', label: 'Schicht aktualisiert' },
  { value: 'shift.deleted', label: 'Schicht gelöscht' },
  { value: 'absence.created', label: 'Abwesenheit erstellt' },
  { value: 'absence.approved', label: 'Abwesenheit genehmigt' },
];

export default function Webhooks() {
  const { canAdmin } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<WebhookForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const { showToast } = useToast();
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const loadWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getWebhooks();
      setWebhooks(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWebhooks(); }, [loadWebhooks]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (webhook: Webhook) => {
    setForm({
      url: webhook.url,
      name: webhook.name,
      events: webhook.events,
      active: webhook.active,
    });
    setEditId(webhook.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim() || form.events.length === 0) {
      showToast('Bitte Name, URL und mindestens ein Event ausfüllen', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.updateWebhook(editId, form);
        showToast('Webhook aktualisiert', 'success');
      } else {
        await api.createWebhook(form);
        showToast('Webhook erstellt', 'success');
      }
      setShowModal(false);
      loadWebhooks();
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (webhook: Webhook) => {
    const confirmed = await confirmDialog({
      title: 'Webhook löschen',
      message: `Webhook "${webhook.name}" wirklich löschen?`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteWebhook(webhook.id);
      showToast('Webhook gelöscht', 'success');
      loadWebhooks();
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Löschen', 'error');
    }
  };

  const handleTest = async (webhook: Webhook) => {
    setTesting(webhook.id);
    try {
      const result = await api.testWebhook(webhook.id);
      if (result.ok) {
        showToast('Test-Event erfolgreich gesendet ✓', 'success');
      } else {
        showToast(`Test fehlgeschlagen: ${result.delivery?.error || 'Unbekannter Fehler'}`, 'error');
      }
      loadWebhooks();
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Testen', 'error');
    } finally {
      setTesting(null);
    }
  };

  const toggleEvent = (event: string) => {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  if (!canAdmin) {
    return (
      <div className="p-6">
        <PageHeader title="Webhooks" subtitle="Keine Berechtigung" />
        <p className="text-gray-500 dark:text-gray-400 mt-4">
          Diese Seite ist nur für Administratoren verfügbar.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Webhooks"
        subtitle="Externe Integrationen verwalten"
      />

      {/* Actions */}
      <div className="flex justify-end mb-4">
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Neuer Webhook
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner />}

      {/* Webhook List */}
      {!loading && webhooks.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          <p className="text-lg">Keine Webhooks konfiguriert</p>
          <p className="text-sm mt-2">Erstelle einen Webhook, um externe Systeme über Ereignisse zu benachrichtigen.</p>
        </div>
      )}

      {!loading && webhooks.length > 0 && (
        <div className="space-y-3">
          {webhooks.map(webhook => (
            <div
              key={webhook.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {webhook.name}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        webhook.active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {webhook.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate font-mono">
                    {webhook.url}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {webhook.events.map(event => (
                      <span
                        key={event}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                  {/* Last delivery */}
                  {webhook.last_delivery && (
                    <p className={`text-xs mt-2 ${
                      webhook.last_delivery.success
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      Letzter Delivery: {webhook.last_delivery.success ? '✓ Erfolgreich' : `✗ ${webhook.last_delivery.error || 'Fehlgeschlagen'}`}
                      {' · '}
                      {new Date(webhook.last_delivery.timestamp).toLocaleString('de-AT')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => handleTest(webhook)}
                    disabled={testing === webhook.id}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                    title="Test-Event senden"
                  >
                    {testing === webhook.id ? '…' : '🧪 Test'}
                  </button>
                  <button
                    onClick={() => openEdit(webhook)}
                    className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDelete(webhook)}
                    className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editId ? 'Webhook bearbeiten' : 'Neuer Webhook'}
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. Slack Notification"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="https://example.com/webhook"
                />
              </div>

              {/* Events */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Events
                </label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map(event => (
                    <label key={event.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.events.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">{event.value}</code>
                        {' '}{event.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Active */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Aktiv</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
