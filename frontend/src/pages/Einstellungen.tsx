import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import type { UsettSettings } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useT } from '../i18n/context';
import { useAppSettings } from '../hooks/useAppSettings';

// ─── Color conversion helpers ──────────────────────────────
function bgrToHex(bgr: number): string {
  const b = (bgr >> 16) & 0xFF;
  const g = (bgr >> 8) & 0xFF;
  const r = bgr & 0xFF;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexToBgr(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return b * 65536 + g * 256 + r;
}

// ─── Color picker with preview ─────────────────────────────
interface ColorPickerProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  hint?: string;
}

function ColorPicker({ label, value, onChange, hint }: ColorPickerProps) {
  const hex = bgrToHex(value);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={hex}
          onChange={e => onChange(hexToBgr(e.target.value))}
          className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
        />
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 font-mono">{hex.toUpperCase()}</span>
          <span className="text-xs text-gray-400">BGR: {value}</span>
        </div>
        <div
          className="w-12 h-8 rounded border border-gray-200 flex items-center justify-center text-xs font-bold"
          style={{ background: hex }}
        >
          <span style={{ color: value > 8000000 ? '#000' : '#fff' }}>A</span>
        </div>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Toggle helper ─────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );
}

// ─── Section wrapper ───────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-base font-bold text-gray-800 mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────
export default function Einstellungen() {
  const t = useT();
  const { showToast } = useToast();
  const { settings: appSettings, update: updateApp, reset: resetApp, exportJSON, importJSON } = useAppSettings();

  // ── DBF / Backend settings state ──────────────────────────
  const [settings, setSettings] = useState<UsettSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [anoaname, setAnoaname] = useState('Abwesend');
  const [anoashort, setAnoashort] = useState('X');
  const [anoacrtxt, setAnoacrtxt] = useState(0);
  const [anoacrbar, setAnoacrbar] = useState(16711680);
  const [anoacrbk, setAnoacrbk] = useState(16777215);
  const [anoabold, setAnoabold] = useState(false);
  const [backupfr, setBackupfr] = useState(0);
  const [anonymEnabled, setAnonymEnabled] = useState(true);

  // ── Import/Export UI state ─────────────────────────────────
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getSettings()
      .then(s => {
        setSettings(s);
        setAnoaname(s.ANOANAME || 'Abwesend');
        setAnoashort(s.ANOASHORT || 'X');
        setAnoacrtxt(s.ANOACRTXT ?? 0);
        setAnoacrbar(s.ANOACRBAR ?? 16711680);
        setAnoacrbk(s.ANOACRBK ?? 16777215);
        setAnoabold(!!s.ANOABOLD);
        setBackupfr(s.BACKUPFR ?? 0);
        setAnonymEnabled(!!(s.ANOANAME && s.ANOANAME.trim()));
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateSettings({
        ANOANAME: anonymEnabled ? anoaname : '',
        ANOASHORT: anonymEnabled ? anoashort : '',
        ANOACRTXT: anoacrtxt,
        ANOACRBAR: anoacrbar,
        ANOACRBK: anoacrbk,
        ANOABOLD: anoabold ? 1 : 0,
        BACKUPFR: backupfr,
      });
      showToast(t.settings.saveSuccess + ' ✓', 'success');
    } catch (e) {
      setError(String(e));
      showToast(t.settings.saveError, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Export / Import handlers ───────────────────────────────
  const handleExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sp5-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Einstellungen exportiert ✓', 'success');
  };

  const handleImportText = () => {
    const err = importJSON(importText);
    if (err) {
      setImportError(err);
    } else {
      setImportError(null);
      setImportText('');
      setShowImport(false);
      showToast('Einstellungen importiert ✓', 'success');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const err = importJSON(text);
      if (err) {
        showToast('Import fehlgeschlagen: ' + err, 'error');
      } else {
        showToast('Einstellungen importiert ✓', 'success');
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleReset = () => {
    if (confirm('Alle lokalen Einstellungen auf Standard zurücksetzen?')) {
      resetApp();
      showToast('Einstellungen zurückgesetzt', 'success');
    }
  };

  const previewBg = bgrToHex(anoacrbk);
  const previewBar = bgrToHex(anoacrbar);
  const previewTxt = bgrToHex(anoacrtxt);

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">⚙️ {t.settings.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t.settings.subtitle}</p>
      </div>

      {loading && <div className="text-center py-20 text-gray-400">⟳ Lade Einstellungen...</div>}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {!loading && (
        <div className="space-y-6">

          {/* ── 1. Arbeitszeit-Konfiguration ──────────────────────── */}
          <Section
            title="⏱️ Arbeitszeit-Konfiguration"
            subtitle="Soll-Stunden, Überstunden-Schwellenwert und Konflikte-Konfiguration. Gespeichert lokal im Browser."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Soll-Stunden pro Woche
                </label>
                <input
                  type="number"
                  min={0}
                  max={80}
                  step={0.5}
                  value={appSettings.worktime.sollStundenProWoche}
                  onChange={e => updateApp('worktime', { sollStundenProWoche: parseFloat(e.target.value) || 40 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Wochenstunden-Ziel für Berechnungen</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Überstunden-Schwellenwert (Stunden)
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={appSettings.worktime.ueberstundenSchwellenwert}
                  onChange={e => updateApp('worktime', { ueberstundenSchwellenwert: parseFloat(e.target.value) || 2 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Ab dieser Differenz → Überstunden-Warnung</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Konflikte kritisch ab
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={appSettings.display.konflikteSchwellenwert}
                  onChange={e => updateApp('display', { konflikteSchwellenwert: parseInt(e.target.value) || 3 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Ab wie vielen Konflikten = kritisch (rot)</p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
              💡 <strong>Aktuelle Werte:</strong> {appSettings.worktime.sollStundenProWoche}h/Woche Soll ·{' '}
              Überstunden ab +{appSettings.worktime.ueberstundenSchwellenwert}h ·{' '}
              Kritisch ab {appSettings.display.konflikteSchwellenwert} Konflikte
            </div>
          </Section>

          {/* ── 2. Anzeige-Einstellungen ──────────────────────────── */}
          <Section
            title="🗓️ Anzeige-Einstellungen"
            subtitle="Wochenbeginn, Datumsformat und bevorzugte Darstellung."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wochenbeginn</label>
                <select
                  value={appSettings.display.wochenbeginn}
                  onChange={e => updateApp('display', { wochenbeginn: e.target.value as 'montag' | 'sonntag' })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="montag">Montag (ISO 8601)</option>
                  <option value="sonntag">Sonntag (US-Standard)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datumsformat</label>
                <select
                  value={appSettings.display.datumsformat}
                  onChange={e => updateApp('display', { datumsformat: e.target.value as 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DD.MM.YYYY">DD.MM.YYYY (Deutsch)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bevorzugte Ansicht</label>
                <div className="flex gap-3">
                  {(['liste', 'karte'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => updateApp('preferences', { bevorzugteAnsicht: v })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        appSettings.preferences.bevorzugteAnsicht === v
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {v === 'liste' ? '☰ Liste' : '⊞ Karte'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── 3. Benachrichtigungs-Einstellungen ──────────────────── */}
          <Section
            title="🔔 Benachrichtigungs-Einstellungen"
            subtitle="Welche Warnungen und Hinweise sollen angezeigt werden?"
          >
            <div className="space-y-3">
              <Toggle
                checked={appSettings.notifications.zeigeKonflikte}
                onChange={v => updateApp('notifications', { zeigeKonflikte: v })}
                label="Planungskonflikte anzeigen"
              />
              <Toggle
                checked={appSettings.notifications.zeigeUeberstunden}
                onChange={v => updateApp('notifications', { zeigeUeberstunden: v })}
                label="Überstunden-Warnungen anzeigen"
              />
              <Toggle
                checked={appSettings.notifications.zeigeFehlendePlanung}
                onChange={v => updateApp('notifications', { zeigeFehlendePlanung: v })}
                label="Fehlende Planung anzeigen"
              />
              <Toggle
                checked={appSettings.notifications.zeigeGeburtstage}
                onChange={v => updateApp('notifications', { zeigeGeburtstage: v })}
                label="Geburtstags-Hinweise anzeigen"
              />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Änderungen werden sofort übernommen und lokal gespeichert.
            </p>
          </Section>

          {/* ── 4. Konfigurations-Export / Import ───────────────────── */}
          <Section
            title="📦 Konfigurations-Export / Import"
            subtitle="Einstellungen als JSON sichern oder auf einem anderen Gerät wiederherstellen."
          >
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
              >
                ⬇️ Exportieren
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                📂 Datei importieren
              </button>
              <button
                onClick={() => setShowImport(v => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                📋 JSON einfügen
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
              >
                🔄 Zurücksetzen
              </button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />

            {/* JSON paste area */}
            {showImport && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={importText}
                  onChange={e => { setImportText(e.target.value); setImportError(null); }}
                  rows={6}
                  placeholder='{"worktime": {...}, "notifications": {...}, ...}'
                  className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
                {importError && (
                  <p className="text-xs text-red-600">⚠️ {importError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleImportText}
                    disabled={!importText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    Importieren
                  </button>
                  <button
                    onClick={() => { setShowImport(false); setImportText(''); setImportError(null); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Current settings preview */}
            <details className="mt-4">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                Aktuelle Einstellungen anzeigen (JSON)
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs font-mono overflow-auto max-h-48 text-gray-600 border">
                {exportJSON()}
              </pre>
            </details>
          </Section>

          {/* ── 5. DBF: Datenschutz / Anonymisierung ─────────────── */}
          {settings && (
          <Section
            title="🔒 Datenschutz: Anonyme Abwesenheiten"
            subtitle="Wenn aktiviert, werden Abwesenheiten anderer Mitarbeiter anonymisiert angezeigt. Gespeichert in 5USETT.DBF."
          >
            <Toggle
              checked={anonymEnabled}
              onChange={setAnonymEnabled}
              label="Abwesenheiten anderer Mitarbeiter anonym anzeigen"
            />

            {anonymEnabled && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anonymisierter Name</label>
                  <input
                    type="text"
                    value={anoaname}
                    onChange={e => setAnoaname(e.target.value)}
                    maxLength={50}
                    placeholder="z.B. Abwesend"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Voller Name (ANOANAME)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kurzbezeichnung</label>
                  <input
                    type="text"
                    value={anoashort}
                    onChange={e => setAnoashort(e.target.value)}
                    maxLength={5}
                    placeholder="z.B. X"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Kürzel im Dienstplan (ANOASHORT)</p>
                </div>
                <ColorPicker label="Textfarbe" value={anoacrtxt} onChange={setAnoacrtxt} hint="Schriftfarbe (ANOACRTXT)" />
                <ColorPicker label="Balkenfarbe" value={anoacrbar} onChange={setAnoacrbar} hint="Farbe des Eintragsbalkens (ANOACRBAR)" />
                <ColorPicker label="Hintergrundfarbe" value={anoacrbk} onChange={setAnoacrbk} hint="Hintergrundfläche (ANOACRBK)" />
                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={anoabold}
                      onChange={e => setAnoabold(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Fettdruck</span>
                      <p className="text-xs text-gray-400">Anonymisierter Text fett anzeigen (ANOABOLD)</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {anonymEnabled && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Vorschau</p>
                <div className="flex items-center gap-3">
                  <div
                    className="px-3 py-1.5 rounded text-sm"
                    style={{ backgroundColor: previewBg, borderLeft: `4px solid ${previewBar}`, color: previewTxt, fontWeight: anoabold ? 'bold' : 'normal' }}
                  >
                    {anoashort || 'X'}
                  </div>
                  <div
                    className="px-3 py-1.5 rounded text-sm flex-1 max-w-xs"
                    style={{ backgroundColor: previewBg, color: previewTxt, fontWeight: anoabold ? 'bold' : 'normal' }}
                  >
                    {anoaname || 'Abwesend'}
                  </div>
                  <span className="text-xs text-gray-400">← So erscheint eine anonyme Abwesenheit</span>
                </div>
              </div>
            )}
          </Section>
          )}

          {/* ── 6. DBF: Allgemein ─────────────────────────────────── */}
          {settings && (
          <Section title="🔧 Allgemein" subtitle="Allgemeine Programmeinstellungen (5USETT.DBF).">
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">Backup-Häufigkeit (BACKUPFR)</label>
              <select
                value={backupfr}
                onChange={e => setBackupfr(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Kein automatisches Backup</option>
                <option value={1}>Täglich</option>
                <option value={7}>Wöchentlich</option>
                <option value={30}>Monatlich</option>
              </select>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div><span className="font-semibold">LOGIN:</span> {settings.LOGIN}</div>
              <div><span className="font-semibold">SPSHCAT:</span> {settings.SPSHCAT}</div>
              <div><span className="font-semibold">OVERTCAT:</span> {settings.OVERTCAT}</div>
              <div><span className="font-semibold">ID:</span> {settings.ID}</div>
            </div>
          </Section>
          )}

          {/* ── Save DBF settings ─────────────────────────────────── */}
          {settings && (
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-400">
              💾 Lokale Einstellungen werden automatisch gespeichert. Nur DBF-Einstellungen brauchen den Speichern-Button.
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow"
            >
              {saving ? `⟳ ${t.settings.saving}` : `💾 ${t.settings.saveButton}`}
            </button>
          </div>
          )}

          {/* ── Rollenübersicht ───────────────────────────────────── */}
          <Section title="🔐 Benutzerrollen & Berechtigungen" subtitle="Übersicht der Rollen und ihrer Zugriffsrechte (nicht editierbar).">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="px-3 py-2 text-left font-semibold">Bereich</th>
                    <th className="px-3 py-2 text-center font-semibold">Admin</th>
                    <th className="px-3 py-2 text-center font-semibold">Planer</th>
                    <th className="px-3 py-2 text-center font-semibold">Leser</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { area: 'Dienstplan anzeigen',             admin: true,  planer: true,  leser: true  },
                    { area: 'Dienstplan bearbeiten',           admin: true,  planer: true,  leser: false },
                    { area: 'Abwesenheiten eintragen',         admin: true,  planer: true,  leser: false },
                    { area: 'Mitarbeiterstammdaten anzeigen',  admin: true,  planer: true,  leser: true  },
                    { area: 'Mitarbeiterstammdaten editieren', admin: true,  planer: false, leser: false },
                    { area: 'Schichten / Gruppen / Arbeitsorte', admin: true, planer: false, leser: true },
                    { area: 'Benutzer verwalten',              admin: true,  planer: false, leser: false },
                    { area: 'Einstellungen ändern',            admin: true,  planer: false, leser: false },
                    { area: 'Backup herunterladen',            admin: true,  planer: false, leser: false },
                    { area: 'Statistiken & Berichte',          admin: true,  planer: true,  leser: true  },
                    { area: 'Audit-Log einsehen',              admin: true,  planer: false, leser: false },
                  ].map((row, i) => (
                    <tr key={row.area} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-2 text-slate-700 font-medium">{row.area}</td>
                      <td className="px-3 py-2 text-center">{row.admin  ? '✅' : '—'}</td>
                      <td className="px-3 py-2 text-center">{row.planer ? '✅' : '—'}</td>
                      <td className="px-3 py-2 text-center">{row.leser  ? '✅' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

        </div>
      )}
    </div>
  );
}
