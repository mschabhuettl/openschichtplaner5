import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { NotificationSettings } from '../api/client';

const EVENT_GROUPS = [
  {
    label: 'Schichten',
    events: [
      { key: 'shift_assigned', label: 'Schicht zugewiesen' },
      { key: 'shift_changed', label: 'Schicht geändert' },
    ],
  },
  {
    label: 'Tauschbörse',
    events: [
      { key: 'swap_requested', label: 'Tausch angefragt' },
      { key: 'swap_approved', label: 'Tausch genehmigt' },
      { key: 'swap_rejected', label: 'Tausch abgelehnt' },
    ],
  },
  {
    label: 'Urlaub',
    events: [
      { key: 'vacation_approved', label: 'Urlaubsantrag genehmigt' },
      { key: 'vacation_rejected', label: 'Urlaubsantrag abgelehnt' },
    ],
  },
  {
    label: 'Kommentare',
    events: [
      { key: 'schedule_comment_added', label: 'Schichtplan-Kommentar hinzugefügt' },
    ],
  },
] as const;

type SettingKey = keyof NotificationSettings;

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    api.getNotificationSettings()
      .then((data) => setSettings(data.settings))
      .catch(() => setToast({ msg: 'Fehler beim Laden der Einstellungen', ok: false }))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggle = (key: SettingKey) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const resp = await api.updateNotificationSettings(settings);
      setSettings(resp.settings);
      showToast('Einstellungen gespeichert', true);
    } catch {
      showToast('Fehler beim Speichern', false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 text-red-700 rounded-lg p-4">Einstellungen konnten nicht geladen werden.</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            toast.ok ? 'bg-green-600' : 'bg-red-600'
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🔔 Benachrichtigungs-Einstellungen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Wähle aus, für welche Ereignisse du E-Mail-Benachrichtigungen erhalten möchtest.
        </p>
      </div>

      <div className="space-y-6">
        {EVENT_GROUPS.map((group) => (
          <div key={group.label} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">{group.label}</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {group.events.map(({ key, label }) => (
                <li key={key} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-800">{label}</span>
                  <button
                    role="switch"
                    aria-checked={settings[key as SettingKey]}
                    onClick={() => handleToggle(key as SettingKey)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      settings[key as SettingKey] ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        settings[key as SettingKey] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Speichern...' : 'Einstellungen speichern'}
        </button>
      </div>
    </div>
  );
}
