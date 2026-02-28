import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage, useT } from '../i18n/context';

export default function Login() {
  const { login, loginDev } = useAuth();
  const { language, setLanguage } = useLanguage();
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <main className="w-full max-w-sm" aria-label="Login">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🧸</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t.login.title}</h1>
          <p className="text-slate-600 text-sm mt-1">{t.login.subtitle}</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
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
                className="w-full px-4 py-2.5 rounded-lg bg-slate-700 text-white border border-slate-600
                           placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-transparent disabled:opacity-50 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {t.login.passwordLabel}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                placeholder={t.login.passwordPlaceholder}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-700 text-white border border-slate-600
                           placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-transparent disabled:opacity-50 transition"
              />
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
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                         text-white font-semibold rounded-lg transition disabled:opacity-50
                         focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t.login.loggingIn}
                </span>
              ) : t.login.loginButton}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 border-t border-slate-700" />

          {/* Dev Mode button */}
          <button
            type="button"
            onClick={handleDevMode}
            className="w-full py-2 px-4 bg-slate-600 hover:bg-slate-500 active:bg-slate-700
                       text-slate-300 text-sm rounded-lg transition
                       focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            🛠️ {t.login.devModeButton}
          </button>
        </div>

        {/* Language toggle */}
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setLanguage(language === 'de' ? 'en' : 'de')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-200 text-sm transition"
            aria-label={language === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
          >
            {language === 'de' ? '🇬🇧 English' : '🇩🇪 Deutsch'}
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          {t.login.footerText}
        </p>
      </main>
    </div>
  );
}
