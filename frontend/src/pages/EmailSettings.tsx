import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../hooks/useToast';
import { LoadingSpinner } from '../components/LoadingSpinner';

// Direct fetch helpers (email endpoints aren't in the main api object yet)
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const raw = localStorage.getItem('sp5_session');
  const token = raw ? (JSON.parse(raw) as { token?: string }).token : null;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
async function emailFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: authHeaders(opts?.headers as Record<string,string> ?? {}) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: string };
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface EmailConfigResponse {
  host: string;
  port: number;
  user: string;
  from_addr: string;
  tls_mode: string;
  enabled: boolean;
  is_configured: boolean;
  app_url: string;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
        ok ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-gray-400'}`} />
      {label}
    </span>
  );
}

export default function EmailSettings() {
  const [config, setConfig] = useState<EmailConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const loadConfig = useCallback(async () => {
    try {
      const resp = await emailFetch<EmailConfigResponse>('/api/email/config');
      setConfig(resp);
    } catch {
      toast.showToast('E-Mail-Konfiguration konnte nicht geladen werden.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return;
    setSending(true);
    try {
      await emailFetch<{ ok: boolean; message: string }>('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' } as Record<string, string>,
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      toast.showToast(`Test-E-Mail an ${testEmail} gesendet!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Senden';
      toast.showToast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="E-Mail-Einstellungen laden…" />;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📧 E-Mail-Einstellungen</h1>
        <p className="mt-1 text-sm text-gray-500">
          SMTP-Konfiguration für automatische E-Mail-Benachrichtigungen.
          Änderungen erfolgen über Umgebungsvariablen in der <code className="bg-gray-100 px-1 rounded">.env</code>-Datei.
        </p>
      </div>

      {/* Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Status</h2>
          <div className="flex gap-2">
            <StatusBadge ok={config?.is_configured ?? false} label={config?.is_configured ? 'Konfiguriert' : 'Nicht konfiguriert'} />
            <StatusBadge ok={config?.enabled ?? false} label={config?.enabled ? 'Aktiviert' : 'Deaktiviert'} />
          </div>
        </div>

        {!config?.is_configured && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Nicht konfiguriert:</strong> Um E-Mail-Benachrichtigungen zu aktivieren,
            setze mindestens <code className="bg-amber-100 px-1 rounded">SP5_SMTP_HOST</code> und{' '}
            <code className="bg-amber-100 px-1 rounded">SP5_SMTP_USER</code> in der <code>.env</code>-Datei
            und starte den Server neu.
          </div>
        )}
      </div>

      {/* Configuration Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Konfiguration</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <ConfigRow label="SMTP-Server" value={config?.host || '—'} />
          <ConfigRow label="Port" value={config?.port?.toString() || '—'} />
          <ConfigRow label="Benutzer" value={config?.user || '—'} />
          <ConfigRow label="Absender" value={config?.from_addr || '—'} />
          <ConfigRow label="TLS-Modus" value={config?.tls_mode === 'ssl' ? 'SSL/TLS' : config?.tls_mode === 'true' ? 'STARTTLS' : (config?.tls_mode || '—')} />
          <ConfigRow label="App-URL" value={config?.app_url || '—'} />
        </div>
      </div>

      {/* Test Email */}
      {config?.is_configured && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Test-E-Mail senden</h2>
          <form onSubmit={handleTestEmail} className="flex gap-3 items-end">
            <div className="flex-1">
              <label htmlFor="test-email" className="block text-sm font-medium text-gray-700 mb-1">
                Empfänger-Adresse
              </label>
              <input
                id="test-email"
                type="email"
                required
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {sending ? 'Sende…' : '📤 Senden'}
            </button>
          </form>
        </div>
      )}

      {/* Info about notification types */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Benachrichtigungstypen</h2>
        <p className="text-sm text-gray-600">
          Folgende Ereignisse lösen automatisch E-Mail-Benachrichtigungen aus
          (sofern der Mitarbeiter eine E-Mail-Adresse hinterlegt hat):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <NotifType emoji="📋" label="Schichtänderungen" />
          <NotifType emoji="🔄" label="Tauschanfragen" />
          <NotifType emoji="✅" label="Tausch genehmigt/abgelehnt" />
          <NotifType emoji="🏖️" label="Urlaubsanträge" />
          <NotifType emoji="📅" label="Urlaub genehmigt/abgelehnt" />
          <NotifType emoji="ℹ️" label="Allgemeine Hinweise" />
        </div>
      </div>

      {/* Environment variables reference */}
      <details className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">
          📖 Umgebungsvariablen-Referenz
        </summary>
        <div className="mt-3 space-y-2 text-sm text-gray-600">
          <EnvVar name="SP5_SMTP_HOST" desc="SMTP-Server (z.B. smtp.gmail.com)" />
          <EnvVar name="SP5_SMTP_PORT" desc="Port (587 für STARTTLS, 465 für SSL)" />
          <EnvVar name="SP5_SMTP_USER" desc="SMTP-Benutzername / E-Mail" />
          <EnvVar name="SP5_SMTP_PASSWORD" desc="SMTP-Passwort / App-Passwort" />
          <EnvVar name="SP5_SMTP_FROM" desc="Absender-Adresse (Standard: SP5_SMTP_USER)" />
          <EnvVar name="SP5_SMTP_TLS" desc="TLS-Modus: true (STARTTLS) oder ssl" />
          <EnvVar name="SP5_SMTP_ENABLED" desc="Explizit ein/aus (auto wenn Host gesetzt)" />
          <EnvVar name="SP5_APP_URL" desc="Basis-URL für Links in E-Mails" />
        </div>
      </details>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-gray-900">{value}</span>
    </>
  );
}

function NotifType({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
      <span>{emoji}</span>
      <span>{label}</span>
    </div>
  );
}

function EnvVar({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex gap-2">
      <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-xs font-mono whitespace-nowrap">{name}</code>
      <span>{desc}</span>
    </div>
  );
}
