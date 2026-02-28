import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../api/client';
import type { BackupEntry } from '../api/client';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { ConfirmDialog } from '../components/ConfirmDialog';

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateDE(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ── Backup History Section ────────────────────────────────────────────────

interface BackupHistoryProps {
  onRestoreFromServer: (filename: string) => void;
  refreshKey: number;
}

function BackupHistorySection({ onRestoreFromServer, refreshKey }: BackupHistoryProps) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const { confirm: confirmDialog, dialogProps } = useConfirm();
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listBackups();
      setBackups(data.backups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleDownload = (filename: string) => {
    // Must include auth token as query param or use anchor trick with headers
    // Since we can't set headers on anchor, we'll fetch and create blob URL
    const headers = getAuthHeaders();
    fetch(`${API}/api/admin/backups/${encodeURIComponent(filename)}/download`, { headers })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        showToast(`Backup heruntergeladen ✓`, 'success');
      })
      .catch(err => {
        showToast(err instanceof Error ? err.message : 'Download fehlgeschlagen', 'error');
      });
  };

  const handleDelete = async (filename: string) => {
    if (!await confirmDialog({ message: `Backup "${filename}" löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`, danger: true })) return;
    setDeletingFile(filename);
    try {
      await api.deleteBackup(filename);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fehler beim Löschen', 'error');
    } finally {
      setDeletingFile(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-base font-bold text-slate-700 flex items-center gap-2 mb-1">
        <span className="text-xl">📋</span>
        Backup-Verlauf (Server)
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Automatisch gespeicherte Backups auf dem Server. Maximal 7 Backups werden aufbewahrt.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
          <span className="animate-spin">⏳</span> Lade Backup-Liste…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {!loading && !error && backups.length === 0 && (
        <div className="text-sm text-gray-600 py-4 text-center">
          Noch keine Backups vorhanden. Erstelle das erste Backup oben.
        </div>
      )}

      {!loading && backups.length > 0 && (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {backups.map((b, idx) => (
            <div key={b.filename} className={`flex items-center gap-3 p-3 ${idx === 0 ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'} transition-colors`}>
              {/* Icon + Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {idx === 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">Aktuell</span>}
                  <span className="text-sm font-mono text-slate-700 truncate">{b.filename}</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5 flex gap-3">
                  <span>📅 {formatDateDE(b.created_at)}</span>
                  <span>💾 {formatBytes(b.size_bytes)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDownload(b.filename)}
                  title="Herunterladen"
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  ⬇️
                </button>
                <button
                  onClick={() => onRestoreFromServer(b.filename)}
                  title="Wiederherstellen"
                  className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-100 transition-colors"
                >
                  ♻️
                </button>
                <button
                  onClick={() => handleDelete(b.filename)}
                  disabled={deletingFile === b.filename}
                  title="Löschen"
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-100 transition-colors disabled:opacity-40"
                >
                  {deletingFile === b.filename ? '⏳' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={load}
        disabled={loading}
        className="mt-3 text-xs text-gray-600 hover:text-gray-600 flex items-center gap-1 transition-colors"
      >
        🔄 Aktualisieren
      </button>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

// ── Backup Section ────────────────────────────────────────────────────────

interface BackupSectionProps {
  onBackupCreated: () => void;
}

function BackupSection({ onBackupCreated }: BackupSectionProps) {
  const [lastDownload, setLastDownload] = useState<string | null>(
    localStorage.getItem('sp5_last_backup')
  );
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleDownload = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API}/api/backup/download`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const fnMatch = cd.match(/filename="([^"]+)"/);
      const filename = fnMatch?.[1] ?? `sp5_backup_${Date.now()}.zip`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      const ts = new Date().toLocaleString('de-AT');
      localStorage.setItem('sp5_last_backup', ts);
      setLastDownload(ts);
      onBackupCreated();
      showToast('Backup erstellt & heruntergeladen ✓', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Backup fehlgeschlagen', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-base font-bold text-slate-700 flex items-center gap-2 mb-1">
        <span className="text-xl">💾</span>
        Backup erstellen
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Erstellt eine ZIP-Datei mit allen Datenbankdateien (.DBF, .FPT, .CDX) aus dem
        aktuellen Datenbankverzeichnis. Das Backup wird auch auf dem Server gespeichert.
      </p>

      <button
        onClick={handleDownload}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-colors shadow-sm ${loading ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'}`}
      >
        {loading ? <><span className="animate-spin">⏳</span> Erstelle Backup…</> : <><span>⬇️</span> Backup erstellen &amp; herunterladen</>}
      </button>

      {lastDownload && (
        <p className="mt-3 text-xs text-gray-600 flex items-center gap-1">
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

interface RestoreSectionProps {
  serverRestoreFile?: string | null;
  onServerRestoreConsumed: () => void;
  onRestoreDone: () => void;
}

function RestoreSection({ serverRestoreFile, onServerRestoreConsumed, onRestoreDone }: RestoreSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm: confirmDialog, dialogProps } = useConfirm();

  // If a server backup was selected, trigger restore
  useEffect(() => {
    if (serverRestoreFile) {
      doServerRestore(serverRestoreFile);
      onServerRestoreConsumed();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRestoreFile]);

  const doServerRestore = async (filename: string) => {
    const ok = await confirmDialog({
      message: `⚠️ Achtung: Restore aus Server-Backup!\n\n"${filename}"\n\nAlle aktuellen Daten werden überschrieben. Diese Aktion kann nicht rückgängig gemacht werden!\n\nFortfahren?`,
      danger: true,
    });
    if (!ok) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const headers = getAuthHeaders();
      // Download the backup then re-upload as restore
      const dlRes = await fetch(`${API}/api/admin/backups/${encodeURIComponent(filename)}/download`, { headers });
      if (!dlRes.ok) throw new Error(`Download fehlgeschlagen: HTTP ${dlRes.status}`);
      const blob = await dlRes.blob();
      const f = new File([blob], filename, { type: 'application/zip' });
      const data = await api.restoreBackup(f);
      setResult(data);
      onRestoreDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleRestore = async () => {
    if (!file) return;
    const ok = await confirmDialog({
      message: `⚠️ Achtung: Restore aus Upload!\n\n"${file.name}"\n\nAlle aktuellen Daten werden überschrieben. Diese Aktion kann nicht rückgängig gemacht werden!\n\nFortfahren?`,
      danger: true,
    });
    if (!ok) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await api.restoreBackup(file);
      setResult(data);
      onRestoreDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-base font-bold text-slate-700 flex items-center gap-2 mb-1">
        <span className="text-xl">📤</span>
        Backup wiederherstellen (Upload)
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
        <div className="text-xs text-gray-600 mt-1">Nur .zip Dateien</div>
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
          <span className="text-gray-600">({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      {/* Restore button */}
      <div className="mt-4">
        <button
          onClick={handleRestore}
          disabled={!file || loading}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            !file || loading
              ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm'
          }`}
        >
          {loading ? (
            <><span className="animate-spin">⏳</span> Wird wiederhergestellt…</>
          ) : (
            <><span>♻️</span> Wiederherstellen</>
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

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

// ── Compact Section ───────────────────────────────────────────────────────────

interface CompactDetail {
  file: string;
  removed?: number;
  active?: number;
  error?: string;
}

interface CompactResult {
  ok: boolean;
  files_processed: number;
  total_records_removed: number;
  details: CompactDetail[];
}

function CompactSection() {
  const { confirm: confirmDialog, dialogProps: confirmDialogProps } = useConfirm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompactResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompact = async () => {
    if (!await confirmDialog({ message: 'Datenbank komprimieren?\n\nGelöschte Datensätze werden dauerhaft entfernt. Erstelle vorher ein Backup!', danger: true })) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/compact`, { method: 'POST', headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-base font-bold text-slate-700 flex items-center gap-2 mb-1">
        <span className="text-xl">🗜️</span>
        Datenbank komprimieren
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Entfernt dauerhaft als gelöscht markierte Datensätze aus allen .DBF-Dateien und gibt Speicherplatz frei.
        Nach dem Komprimieren sind gelöschte Einträge nicht mehr wiederherstellbar.
      </p>

      <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <span className="text-lg leading-none mt-0.5">⚠️</span>
        <span>
          <strong>Achtung:</strong> Diese Aktion ist nicht umkehrbar. Erstelle zuerst ein Backup!
        </span>
      </div>

      <button
        onClick={handleCompact}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-colors shadow-sm ${
          loading
            ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
            : 'bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800'
        }`}
      >
        {loading ? (
          <><span className="animate-spin">⏳</span> Komprimiere...</>
        ) : (
          <><span>🗜️</span> Datenbank komprimieren</>
        )}
      </button>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ❌ Fehler: {error}
        </div>
      )}

      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-green-800 mb-2">
            <span>✅</span>
            {result.files_processed} Dateien verarbeitet · {result.total_records_removed} gelöschte Datensätze entfernt
          </div>
          {result.details.filter(d => d.removed && d.removed > 0).length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold text-green-700 mb-1">Komprimierte Dateien:</div>
              <ul className="text-xs text-green-700 space-y-0.5 max-h-40 overflow-y-auto">
                {result.details.filter(d => d.removed && d.removed > 0).map(d => (
                  <li key={d.file} className="flex items-center gap-2">
                    <span className="text-green-500">•</span>
                    <span className="font-mono">{d.file}</span>
                    <span className="text-green-600">– {d.removed} entfernt, {d.active} aktiv</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.details.filter(d => d.error).length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold text-red-700 mb-1">Fehler:</div>
              <ul className="text-xs text-red-700 space-y-0.5">
                {result.details.filter(d => d.error).map(d => (
                  <li key={d.file}>{d.file}: {d.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function Backup() {
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [serverRestoreFile, setServerRestoreFile] = useState<string | null>(null);

  const refreshHistory = () => setHistoryRefreshKey(k => k + 1);

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span>💾</span> Backup &amp; Restore
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Sichere alle Datenbankdateien als ZIP-Archiv und stelle sie bei Bedarf wieder her.
        </p>
      </div>

      <div className="space-y-6">
        <BackupSection onBackupCreated={refreshHistory} />
        <BackupHistorySection
          refreshKey={historyRefreshKey}
          onRestoreFromServer={(filename) => setServerRestoreFile(filename)}
        />
        <RestoreSection
          serverRestoreFile={serverRestoreFile}
          onServerRestoreConsumed={() => setServerRestoreFile(null)}
          onRestoreDone={refreshHistory}
        />
        <CompactSection />
      </div>
    </div>
  );
}
