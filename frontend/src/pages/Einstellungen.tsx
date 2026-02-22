import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { UsettSettings } from '../api/client';

// ─── Color conversion helpers ──────────────────────────────
// DBF stores colors as BGR integer: B + G*256 + R*65536
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
  value: number;    // BGR integer
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

// ─── Main page ─────────────────────────────────────────────
export default function Einstellungen() {
  const [settings, setSettings] = useState<UsettSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Local edit state
  const [anoaname, setAnoaname] = useState('Abwesend');
  const [anoashort, setAnoashort] = useState('X');
  const [anoacrtxt, setAnoacrtxt] = useState(0);
  const [anoacrbar, setAnoacrbar] = useState(16711680);
  const [anoacrbk, setAnoacrbk] = useState(16777215);
  const [anoabold, setAnoabold] = useState(false);
  const [backupfr, setBackupfr] = useState(0);
  const [anonymEnabled, setAnonymEnabled] = useState(true);

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
    setSuccess(null);
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
      setSuccess('Einstellungen erfolgreich gespeichert.');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  // Preview: how an anonymized absence would look
  const previewBg = bgrToHex(anoacrbk);
  const previewBar = bgrToHex(anoacrbar);
  const previewTxt = bgrToHex(anoacrtxt);

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">⚙️ Einstellungen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Globale Programmeinstellungen (5USETT.DBF)
        </p>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400">⟳ Lade Einstellungen...</div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          ✅ {success}
        </div>
      )}

      {!loading && settings && (
        <div className="space-y-6">

          {/* Section: Datenschutz / Anonymisierung */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-base font-bold text-gray-800 mb-1">
              🔒 Datenschutz: Anonyme Abwesenheiten
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Wenn aktiviert, werden Abwesenheiten anderer Mitarbeiter anonymisiert angezeigt.
              Statt des echten Abwesenheitsgrunds (z.B. "Krankheit") erscheint der unten
              konfigurierte anonyme Name.
            </p>

            {/* Toggle */}
            <label className="flex items-center gap-3 mb-5 cursor-pointer group">
              <div
                onClick={() => setAnonymEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${anonymEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${anonymEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Abwesenheiten anderer Mitarbeiter anonym anzeigen
              </span>
            </label>

            {anonymEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anonymisierter Name
                </label>
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

              {/* Kurzbezeichnung */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kurzbezeichnung
                </label>
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

              {/* Textfarbe */}
              <ColorPicker
                label="Textfarbe"
                value={anoacrtxt}
                onChange={setAnoacrtxt}
                hint="Schriftfarbe (ANOACRTXT)"
              />

              {/* Balkenfarbe */}
              <ColorPicker
                label="Balkenfarbe"
                value={anoacrbar}
                onChange={setAnoacrbar}
                hint="Farbe des Eintragsbalkens (ANOACRBAR)"
              />

              {/* Hintergrundfarbe */}
              <ColorPicker
                label="Hintergrundfarbe"
                value={anoacrbk}
                onChange={setAnoacrbk}
                hint="Hintergrundfläche (ANOACRBK)"
              />

              {/* Fettdruck */}
              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={anoabold}
                    onChange={e => setAnoabold(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Fettdruck</span>
                    <p className="text-xs text-gray-400">Anonymisierter Text fett anzeigen (ANOABOLD)</p>
                  </div>
                </label>
              </div>
            </div>
            )} {/* end anonymEnabled */}

            {/* Preview */}
            {anonymEnabled && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Vorschau</p>
              <div className="flex items-center gap-3">
                <div
                  className="px-3 py-1.5 rounded text-sm leading-5 border border-gray-200"
                  style={{
                    backgroundColor: previewBg,
                    borderLeftColor: previewBar,
                    borderLeftWidth: '4px',
                    color: previewTxt,
                    fontWeight: anoabold ? 'bold' : 'normal',
                  }}
                >
                  {anoashort || 'X'}
                </div>
                <div
                  className="px-3 py-1.5 rounded text-sm leading-5 border border-gray-200 flex-1 max-w-xs"
                  style={{
                    backgroundColor: previewBg,
                    color: previewTxt,
                    fontWeight: anoabold ? 'bold' : 'normal',
                  }}
                >
                  {anoaname || 'Abwesend'}
                </div>
                <span className="text-xs text-gray-400">← So erscheint eine anonyme Abwesenheit</span>
              </div>
            </div>
            )} {/* end anonymEnabled preview */}
          </div>

          {/* Section: Allgemein */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-base font-bold text-gray-800 mb-1">🔧 Allgemein</h2>
            <p className="text-sm text-gray-500 mb-4">Allgemeine Programmeinstellungen.</p>

            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Backup-Häufigkeit (BACKUPFR)
              </label>
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
              <p className="text-xs text-gray-400 mt-1">
                Wie oft soll automatisch ein Backup erstellt werden?
              </p>
            </div>

            {/* Info about other settings */}
            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div>
                <span className="font-semibold">LOGIN:</span>{' '}
                <span>{settings.LOGIN}</span>
              </div>
              <div>
                <span className="font-semibold">SPSHCAT:</span>{' '}
                <span>{settings.SPSHCAT}</span>
              </div>
              <div>
                <span className="font-semibold">OVERTCAT:</span>{' '}
                <span>{settings.OVERTCAT}</span>
              </div>
              <div>
                <span className="font-semibold">ID:</span>{' '}
                <span>{settings.ID}</span>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow"
            >
              {saving ? '⟳ Speichern…' : '💾 Einstellungen speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
