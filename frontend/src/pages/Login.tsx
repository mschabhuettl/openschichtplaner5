import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage, useT } from '../i18n/context';

export default function Login() {
  const { login, loginDev } = useAuth();
  const { language, setLanguage } = useLanguage();
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverDevMode, setServerDevMode] = useState<boolean | null>(null);

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL ?? '';
    fetch(`${BASE}/api/dev/mode`)
      .then(r => r.json())
      .then(d => setServerDevMode(d.dev_mode === true))
      .catch(() => setServerDevMode(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError(t.login.errorRequired);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.login.errorFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDevMode = () => {
    loginDev();
  };

  return (
    <div className="min-h-screen bg-slate-900 overflow-y-auto">
      {/* Language switcher — top right, always visible */}
      <div className="flex justify-end px-4 pt-4">
        <button
          onClick={() => setLanguage(language === 'de' ? 'en' : 'de')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600
                     text-slate-300 hover:text-white hover:border-slate-400 text-sm transition
                     min-h-[44px]"
          aria-label={language === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
        >
          {language === 'de' ? '🇬🇧 English' : '🇩🇪 Deutsch'}
          <span className="text-slate-500 text-xs">›</span>
        </button>
      </div>

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-8" aria-label="Login">
        <div className="w-full max-w-sm">
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🧸</div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{t.login.title}</h1>
            <p className="text-slate-300 text-sm mt-1">{t.login.subtitle}</p>
          </div>

          {/* Card */}
          <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-600">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {t.login.usernameLabel}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  disabled={loading}
                  placeholder={t.login.usernamePlaceholder}
                  className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white text-base border border-slate-600
                             placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500
                             focus:border-transparent disabled:opacity-50 transition min-h-[44px]"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {t.login.passwordLabel}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    placeholder={t.login.passwordPlaceholder}
                    className="w-full px-4 py-3 pr-12 rounded-lg bg-slate-700 text-white text-base border border-slate-600
                               placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500
                               focus:border-transparent disabled:opacity-50 transition min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    className="absolute right-0 top-0 h-full px-3 flex items-center justify-center
                               text-slate-400 hover:text-slate-200 transition min-w-[44px]"
                  >
                    {showPassword ? (
                      /* Eye-off icon */
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      /* Eye icon */
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2.5">
                  ⚠️ {error}
                </div>
              )}

              {/* Login button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                           text-white font-semibold rounded-lg transition disabled:opacity-50
                           focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t.login.loggingIn}
                  </span>
                ) : t.login.loginButton}
              </button>
            </form>

            {/* Divider + Dev Mode button — only when server reports dev mode active */}
            {serverDevMode === true && (
              <>
                <div className="my-5 border-t border-slate-700" />
                <button
                  type="button"
                  onClick={handleDevMode}
                  className="w-full py-3 px-4 bg-amber-900/40 hover:bg-amber-800/60 active:bg-amber-900/70
                             text-amber-300 text-sm rounded-lg border border-amber-700/50 transition
                             focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                >
                  🛠️ {t.login.devModeButton}
                </button>
              </>
            )}
          </div>

          <p className="text-center text-slate-500 text-xs mt-4">
            {t.login.footerText}
          </p>
        </div>
      </main>
    </div>
  );
}
