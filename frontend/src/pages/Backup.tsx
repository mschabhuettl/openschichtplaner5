import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../api/client';

// ── Backup Section ────────────────────────────────────────────────────────

function BackupSection() {
  const [lastDownload, setLastDownload] = useState<string | null>(
    localStorage.getItem('sp5_last_backup')
  );

  const handleDownload = () => {
    const url = api.getBackupUrl();
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const ts = new Date().toLocaleString('de-AT');
    localStorage.setItem('sp5_last_backup', ts);
    setLastDownload(ts);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-base font-bold text-slate-700 flex items-center gap-2 mb-1">
        <span className="text-xl">💾</span>
        Backup erstellen
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Erstellt eine ZIP-Datei mit allen Datenbankdateien (.DBF, .FPT, .CDX) aus dem
        aktuellen Datenbankverzeichnis. Das Backup kann jederzeit wiederhergestellt werden.
      </p>

      <button
        onClick={handleDownload}
        className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
      >
        <span>⬇️</span>
        Backup erstellen &amp; herunterladen
      </button>

      {lastDownload && (
        <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
          <span>🕐</span>
          Letzter Download: <span className="font-medium text-gray-500 ml-1">{lastDownload}</span>
        </p>
      )}
    </div>
  );
}

// ── Restore Section ───────────────────────────────────────────────────────

interface RestoreResult {
  restored: number;
  files: string[];
}

function RestoreSection() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRestore = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await api.restoreBackup(file);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-base font-bold text-slate-700 flex items-center gap-2 mb-1">
        <span className="text-xl">📤</span>
        Backup wiederherstellen
      </h2>

      {/* Warning */}
      <div className="mt-2 mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <span className="text-lg leading-none mt-0.5">⚠️</span>
        <span>
          <strong>Achtung:</strong> Restore überschreibt alle aktuellen Daten!
          Erstelle zuerst ein aktuelles Backup, bevor du eine alte Version wiederherstellst.
        </span>
      </div>

      {/* File picker */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-gray-50 rounded-lg p-5 text-center cursor-pointer transition-colors"
      >
        <div className="text-3xl mb-1">🗜️</div>
        <div className="text-sm text-gray-600">
          ZIP-Backup hierher klicken oder{' '}
          <span className="text-blue-600 font-medium">Datei auswählen</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">Nur .zip Dateien</div>
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
          <span>📁</span>
          <span className="font-medium">{file.name}</span>
          <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      {/* Restore button */}
      <div className="mt-4">
        <button
          onClick={handleRestore}
          disabled={!file || loading}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            !file || loading
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm'
          }`}
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Wird wiederhergestellt…
            </>
          ) : (
            <>
              <span>♻️</span>
              Wiederherstellen
            </>
          )}
        </button>
      </div>

      {/* Success */}
      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-green-800 mb-2">
            <span>✅</span>
            {result.restored} Dateien erfolgreich wiederhergestellt
          </div>
          {result.files.length > 0 && (
            <ul className="text-xs text-green-700 space-y-0.5 max-h-40 overflow-y-auto">
              {result.files.map(f => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="text-green-500">•</span>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ❌ Fehler: {error}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function Backup() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span>💾</span> Backup &amp; Restore
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Sichere alle Datenbankdateien als ZIP-Archiv und stelle sie bei Bedarf wieder her.
        </p>
      </div>

      <div className="space-y-6">
        <BackupSection />
        <RestoreSection />
      </div>
    </div>
  );
}
