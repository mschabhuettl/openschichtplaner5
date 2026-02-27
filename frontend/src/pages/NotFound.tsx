import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
        <div className="text-7xl font-black text-slate-200 mb-2">404</div>
        <div className="text-5xl mb-4">🗺️</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Seite nicht gefunden</h1>
        <p className="text-slate-500 text-sm mb-8">
          Die aufgerufene Seite existiert nicht oder wurde verschoben.
        </p>
        <Link
          to="/"
          className="inline-block py-2.5 px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          📊 Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
