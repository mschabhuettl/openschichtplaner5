import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, loginDev } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Bitte Benutzername eingeben.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleDevMode = () => {
    loginDev();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🧸</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">OpenSchichtplaner5</h1>
          <p className="text-slate-400 text-sm mt-1">Bitte anmelden um fortzufahren</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Benutzername
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                disabled={loading}
                placeholder="z. B. Admin"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-700 text-white border border-slate-600
                           placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-transparent disabled:opacity-50 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                placeholder="••••••••"
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
                  Anmelden…
                </span>
              ) : 'Anmelden'}
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
            🛠️ Dev-Mode (kein Passwort)
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          OpenSchichtplaner5 — Open Source
        </p>
      </div>
    </div>
  );
}
