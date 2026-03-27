import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { SearchResult } from '../api/client';

/**
 * GlobalSearchBar — always-visible search input for the sidebar/header.
 * Debounced API search (300ms), grouped dropdown results, keyboard navigation.
 */
export default function GlobalSearchBar() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.search(q);
        setResults(data.results);
        setOpen(true);
        setSelectedIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  };

  const handleFocus = () => {
    if (query.trim() && results.length > 0) {
      setOpen(true);
    }
  };

  const selectItem = useCallback((item: SearchResult) => {
    if (item.path) navigate(item.path);
    setOpen(false);
    setQuery('');
    setResults([]);
    inputRef.current?.blur();
  }, [navigate]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault();
      selectItem(results[selectedIndex]);
    }
  };

  // Scroll selected into view
  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    const key = r.type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const TYPE_LABELS: Record<string, string> = {
    employee: 'Mitarbeiter',
    shift: 'Schichten',
    group: 'Gruppen',
    leave_type: 'Abwesenheitsarten',
  };

  // Compute global index for each result
  let globalIdx = 0;
  const indexedGroups: { type: string; label: string; items: { result: SearchResult; idx: number }[] }[] = [];
  for (const [type, items] of Object.entries(grouped)) {
    const group = { type, label: TYPE_LABELS[type] ?? type, items: [] as { result: SearchResult; idx: number }[] };
    for (const result of items) {
      group.items.push({ result, idx: globalIdx++ });
    }
    indexedGroups.push(group);
  }

  return (
    <div ref={containerRef} className="relative px-3 py-2" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-owns="global-search-results">
      {/* Search input */}
      <div className="flex items-center gap-2 rounded-lg bg-slate-700/60 px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={handleInput}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Suche…"
          className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 outline-none min-w-0"
          autoComplete="off"
          spellCheck={false}
          aria-label="Globale Suche"
          aria-autocomplete="list"
          aria-controls="global-search-results"
          aria-activedescendant={selectedIndex >= 0 ? `gsb-item-${selectedIndex}` : undefined}
        />
        {loading && (
          <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-white rounded-full animate-spin flex-shrink-0" aria-label="Laden…" />
        )}
      </div>

      {/* Dropdown results */}
      {open && (
        <div
          ref={listRef}
          id="global-search-results"
          role="listbox"
          aria-label="Suchergebnisse"
          className="absolute left-2 right-2 mt-1 max-h-80 overflow-y-auto rounded-lg bg-slate-800 border border-slate-600 shadow-xl z-50"
        >
          {results.length === 0 && !loading && query.trim() && (
            <div className="px-4 py-6 text-center text-slate-400 text-sm">
              Keine Ergebnisse für „{query}"
            </div>
          )}

          {indexedGroups.map(group => (
            <div key={group.type}>
              <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                {group.label}
              </div>
              {group.items.map(({ result, idx }) => (
                <button
                  key={`${result.type}-${result.id}`}
                  id={`gsb-item-${idx}`}
                  data-idx={idx}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  onClick={() => selectItem(result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    idx === selectedIndex
                      ? 'bg-blue-600/40 text-white'
                      : 'text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <span className="text-base flex-shrink-0 w-6 text-center">{result.icon ?? '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-xs text-slate-400 truncate">{result.subtitle}</div>
                    )}
                  </div>
                  {idx === selectedIndex && (
                    <kbd className="flex-shrink-0 text-[10px] text-slate-400 border border-slate-600 px-1 py-0.5 rounded">↵</kbd>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
