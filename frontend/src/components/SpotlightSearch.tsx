import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { SearchResult } from '../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  employee:   'Mitarbeiter',
  shift:      'Schichtart',
  leave_type: 'Abwesenheitsart',
  group:      'Gruppe',
};

export default function SpotlightSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.search(q);
        setResults(data.results);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  };

  const openResult = useCallback((result: SearchResult) => {
    navigate(result.path);
    onClose();
  }, [navigate, onClose]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      openResult(results[selectedIndex]);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div
        className="w-full max-w-xl rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--sp-search-bg, #1e293b)', border: '1px solid rgba(255,255,255,0.1)' }}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <span className="text-slate-400 text-lg flex-shrink-0">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            placeholder="Suchen… Mitarbeiter, Schichten, Abwesenheiten"
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-base"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-slate-500 border-t-white rounded-full animate-spin flex-shrink-0" />
          )}
          <kbd
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-slate-600 flex-shrink-0"
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 && query.trim() && !loading && (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">
              Keine Ergebnisse für „{query}"
            </div>
          )}

          {results.length === 0 && !query.trim() && (
            <div className="px-5 py-6 text-center text-slate-600 text-sm">
              <div className="text-3xl mb-2">🔍</div>
              Tippe um zu suchen…
              <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-slate-700">
                <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-400">👤 Mitarbeiter</span>
                <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-400">🕐 Schichtarten</span>
                <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-400">📋 Abwesenheiten</span>
                <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-400">🏢 Gruppen</span>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-1">
              {results.map((result, idx) => (
                <button
                  key={`${result.type}-${result.id}`}
                  data-idx={idx}
                  onClick={() => openResult(result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    idx === selectedIndex
                      ? 'bg-blue-600/40 text-white'
                      : 'text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <span className="text-lg flex-shrink-0 w-7 text-center">{result.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-xs text-slate-400 truncate">{result.subtitle}</div>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded uppercase tracking-wide">
                    {TYPE_LABELS[result.type] ?? result.type}
                  </span>
                  {idx === selectedIndex && (
                    <kbd className="flex-shrink-0 text-[10px] text-slate-400 border border-slate-600 px-1 py-0.5 rounded">
                      ↵
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-[10px] text-slate-600">
          <span>↑↓ navigieren · ↵ öffnen · ESC schließen</span>
          <span>Ctrl+K · /</span>
        </div>
      </div>
    </div>
  );
}
