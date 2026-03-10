/**
 * TwoFactorSetup — Component for enabling/disabling TOTP 2FA
 * Used in MeinProfil page. Matches light theme.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

type Step = 'loading' | 'disabled' | 'scan-qr' | 'verify' | 'backup-codes' | 'enabled' | 'disable-confirm';

export default function TwoFactorSetup() {
  const [step, setStep] = useState<Step>('loading');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const data = await api.get2FAStatus();
      setStep(data.enabled ? 'enabled' : 'disabled');
    } catch {
      setStep('disabled');
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const startSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.setup2FA();
      setQrCode(data.qr_code);
      setSecret(data.secret);
      setStep('scan-qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Setup');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!verifyCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.enable2FA(verifyCode.trim());
      setBackupCodes(data.backup_codes);
      setStep('backup-codes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code ungültig');
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!disablePassword.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.disable2FA(disablePassword.trim());
      setDisablePassword('');
      setStep('disabled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500">Lade 2FA-Status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🔐</span>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Zwei-Faktor-Authentifizierung</h2>
            <p className="text-xs text-slate-500">Zusätzlicher Schutz mit Authenticator-App</p>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 mb-4">
            ⚠️ {error}
          </div>
        )}

        {/* ── Disabled: show enable button ── */}
        {step === 'disabled' && (
          <div>
            <div className="flex items-center gap-2 text-slate-500 mb-4">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-sm">2FA ist <strong className="text-slate-700">deaktiviert</strong></span>
            </div>
            <button
              onClick={startSetup}
              disabled={loading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                         rounded-lg transition disabled:opacity-50 min-h-[44px]"
            >
              {loading ? 'Wird vorbereitet...' : '🔐 2FA aktivieren'}
            </button>
          </div>
        )}

        {/* ── Step 1: Scan QR code ── */}
        {step === 'scan-qr' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Scanne diesen QR-Code mit deiner Authenticator-App (z.B. Google Authenticator, Authy):
            </p>
            <div className="flex justify-center">
              <div className="bg-white border border-gray-200 p-3 rounded-lg inline-block shadow-sm">
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="2FA QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Manueller Schlüssel:</p>
              <code className="text-sm text-blue-600 font-mono break-all select-all">{secret}</code>
            </div>
            <button
              onClick={() => { setStep('verify'); setVerifyCode(''); }}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                         rounded-lg transition min-h-[44px]"
            >
              Weiter → Code bestätigen
            </button>
            <button
              onClick={() => setStep('disabled')}
              className="w-full px-4 py-2 text-slate-500 hover:text-slate-700 text-sm rounded-lg transition min-h-[44px]"
            >
              Abbrechen
            </button>
          </div>
        )}

        {/* ── Step 2: Verify code ── */}
        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Gib den 6-stelligen Code aus deiner Authenticator-App ein:
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-slate-50 text-slate-800 text-base border border-gray-300
                         placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                         text-center text-2xl tracking-[0.5em] font-mono min-h-[44px]"
            />
            <button
              onClick={verifyAndEnable}
              disabled={loading || verifyCode.length < 6}
              className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold
                         rounded-lg transition disabled:opacity-50 min-h-[44px]"
            >
              {loading ? 'Prüfe...' : '✅ 2FA aktivieren'}
            </button>
            <button
              onClick={() => setStep('scan-qr')}
              className="w-full px-4 py-2 text-slate-500 hover:text-slate-700 text-sm rounded-lg transition min-h-[44px]"
            >
              ← Zurück zum QR-Code
            </button>
          </div>
        )}

        {/* ── Step 3: Backup codes ── */}
        {step === 'backup-codes' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5">
              ✅ 2FA wurde erfolgreich aktiviert!
            </div>
            <p className="text-sm text-slate-600">
              <strong>Sichere diese Backup-Codes!</strong> Du kannst sie verwenden, falls du keinen Zugang
              zu deiner Authenticator-App hast. Jeder Code kann nur einmal verwendet werden.
            </p>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 gap-2 border border-slate-200">
              {backupCodes.map((code, i) => (
                <code key={i} className="text-sm text-slate-700 font-mono text-center py-1.5 bg-white rounded border border-slate-200">
                  {code}
                </code>
              ))}
            </div>
            <button
              onClick={() => {
                const text = backupCodes.join('\n');
                navigator.clipboard.writeText(text).catch(() => {});
              }}
              className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold
                         rounded-lg transition border border-slate-300 min-h-[44px]"
            >
              📋 Codes kopieren
            </button>
            <button
              onClick={() => { setBackupCodes([]); setStep('enabled'); }}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                         rounded-lg transition min-h-[44px]"
            >
              Fertig
            </button>
          </div>
        )}

        {/* ── Enabled: show status and disable option ── */}
        {step === 'enabled' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">2FA ist aktiv</span>
            </div>
            <button
              onClick={() => { setStep('disable-confirm'); setDisablePassword(''); setError(''); }}
              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold
                         rounded-lg border border-red-200 transition min-h-[44px]"
            >
              2FA deaktivieren
            </button>
          </div>
        )}

        {/* ── Disable confirmation ── */}
        {step === 'disable-confirm' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Bestätige mit deinem Passwort, um 2FA zu deaktivieren:
            </p>
            <input
              type="password"
              value={disablePassword}
              onChange={e => setDisablePassword(e.target.value)}
              placeholder="Passwort"
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-slate-50 text-slate-800 text-base border border-gray-300
                         placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[44px]"
            />
            <button
              onClick={disable2FA}
              disabled={loading || !disablePassword.trim()}
              className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold
                         rounded-lg transition disabled:opacity-50 min-h-[44px]"
            >
              {loading ? 'Wird deaktiviert...' : '2FA deaktivieren'}
            </button>
            <button
              onClick={() => setStep('enabled')}
              className="w-full px-4 py-2 text-slate-500 hover:text-slate-700 text-sm rounded-lg transition min-h-[44px]"
            >
              Abbrechen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
