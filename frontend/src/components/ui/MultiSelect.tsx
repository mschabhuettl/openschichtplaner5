import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * MultiSelect — Mehrfachauswahl-Filter als Taktwerk-Baum-Select
 * (docs/design-system.md §6, docs/design-multiselect.md).
 *
 * Verhalten (bewährtes Dienstplan-Muster, kein Semantik-Bruch):
 * - Leere Auswahl bedeutet „Alle" (kein Filter).
 * - „Alle"-Zeile oben leert die Auswahl; Checkboxen sind unabhängig
 *   (keine Eltern-Kind-Kaskade — die Einrückung ist reine Baumdarstellung).
 * - Button-Label: allLabel | Einzelname | „N ausgewählt".
 * - ESC/Außenklick schließt; ↑↓ wählt Zeile, Space toggelt, ⏎ schließt.
 * - Suchfeld ab 15 Optionen.
 */
export interface MultiSelectOption<T extends number | string> {
  value: T;
  label: string;
  /** Baum-Einrückung (z. B. aus utils/groupTree.groupTreeOptions) */
  depth?: number;
  /** Optionaler Zähler rechts (Monospace) */
  count?: number;
}

interface MultiSelectProps<T extends number | string> {
  options: MultiSelectOption<T>[];
  /** [] = „Alle" (kein Filter) */
  selected: T[];
  onChange: (values: T[]) => void;
  /** z. B. „Alle Gruppen" */
  allLabel: string;
  disabled?: boolean;
  className?: string;
}

const CHECKBOX_BASE = 'w-[13px] h-[13px] rounded-[3px] flex items-center justify-center text-[9px] font-extrabold flex-shrink-0';

function CheckGlyph({ state }: { state: 'on' | 'mixed' | 'off' }) {
  if (state === 'off') {
    return <span className={`${CHECKBOX_BASE} border-[1.5px] border-[#c9cdd6] dark:border-[#3a465c]`} aria-hidden="true" />;
  }
  return (
    <span className={`${CHECKBOX_BASE} bg-glut text-glut-ink`} aria-hidden="true">
      {state === 'on' ? '✓' : '–'}
    </span>
  );
}

export function MultiSelect<T extends number | string>({
  options,
  selected,
  onChange,
  allLabel,
  disabled = false,
  className = '',
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusIdx, setFocusIdx] = useState(0); // 0 = „Alle"-Zeile
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const withSearch = options.length >= 15;
  const visible = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Außenklick schließt
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) { setQuery(''); setFocusIdx(0); }
  }, [open]);

  const toggle = (value: T) => {
    onChange(selectedSet.has(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  const rowCount = visible.length + 1; // + „Alle"-Zeile
  const activate = (idx: number) => {
    if (idx === 0) onChange([]);
    else toggle(visible[idx - 1].value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(rowCount - 1, i + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(i => Math.max(0, i - 1)); return; }
    if (e.key === ' ') { e.preventDefault(); activate(focusIdx); return; }
    if (e.key === 'Enter') { e.preventDefault(); setOpen(false); return; }
  };

  // Fokuszeile beim Blättern sichtbar halten
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${focusIdx}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [focusIdx]);

  const buttonLabel = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label.trim().replace(/^└\s*/, '') ?? allLabel)
      : `${selected.length} ausgewählt`;

  const allState: 'on' | 'mixed' = selected.length === 0 ? 'on' : 'mixed';

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`} onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 border rounded-ui px-2.5 py-[5px] text-[11.5px] text-schrift bg-ebene dark:bg-ebene-2 disabled:opacity-50 ${
          open ? 'border-glut shadow-[0_0_0_3px_rgba(201,106,20,.12)] dark:shadow-[0_0_0_3px_rgba(240,163,92,.15)]' : 'border-kontur hover:bg-wash'
        }`}
      >
        <span className="truncate max-w-[180px]">{buttonLabel}</span>
        <span className="text-[9px] text-schrift-2" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 min-w-[220px] bg-ebene dark:bg-ebene-2 border border-kontur rounded-panel shadow-overlay dark:shadow-overlay-dark overflow-hidden">
          {withSearch && (
            <div className="px-2.5 py-[7px] border-b border-kontur">
              <input
                autoFocus
                value={query}
                onChange={e => { setQuery(e.target.value); setFocusIdx(1); }}
                placeholder="Suchen…"
                className="w-full bg-transparent text-[11px] text-schrift placeholder:text-schrift-3 outline-none"
              />
            </div>
          )}
          <div ref={listRef} role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-0.5">
            {/* „Alle"-Zeile: leert die Auswahl */}
            <div
              data-idx={0}
              role="option"
              aria-selected={selected.length === 0}
              onMouseDown={e => { e.preventDefault(); onChange([]); }}
              onMouseEnter={() => setFocusIdx(0)}
              className={`flex items-center gap-[7px] h-[27px] pl-2.5 pr-2.5 text-[11.5px] font-semibold text-schrift cursor-pointer ${
                focusIdx === 0 ? 'bg-[rgba(201,106,20,.08)] dark:bg-[rgba(240,163,92,.12)] shadow-[inset_2px_0_0_var(--glut)]' : ''
              }`}
            >
              <CheckGlyph state={allState} />
              <span className="flex-1 truncate">{allLabel}</span>
              {options.length > 0 && (
                <span className="font-mono text-[9px] text-schrift-2">{options.length}</span>
              )}
            </div>
            {visible.map((o, i) => {
              const idx = i + 1;
              const on = selectedSet.has(o.value);
              return (
                <div
                  key={String(o.value)}
                  data-idx={idx}
                  role="option"
                  aria-selected={on}
                  onMouseDown={e => { e.preventDefault(); toggle(o.value); }}
                  onMouseEnter={() => setFocusIdx(idx)}
                  className={`flex items-center gap-[7px] h-[27px] pr-2.5 text-[11.5px] text-schrift cursor-pointer ${
                    focusIdx === idx ? 'bg-[rgba(201,106,20,.08)] dark:bg-[rgba(240,163,92,.12)] shadow-[inset_2px_0_0_var(--glut)]' : ''
                  }`}
                  style={{ paddingLeft: 10 + (o.depth ?? 0) * 18 }}
                >
                  <CheckGlyph state={on ? 'on' : 'off'} />
                  <span className={`flex-1 truncate ${(o.depth ?? 0) === 0 ? 'font-semibold' : ''}`}>{o.label.trim()}</span>
                  {o.count != null && <span className="font-mono text-[9px] text-schrift-2">{o.count}</span>}
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="px-2.5 py-2 text-[11px] text-schrift-3">Keine Treffer</div>
            )}
          </div>
          <div className="flex gap-2.5 px-2.5 py-1.5 border-t border-kontur font-mono text-[9.5px] text-schrift-3">
            <span>↑↓ wählen</span>
            <span>Space Haken</span>
            <span>⏎ fertig</span>
          </div>
        </div>
      )}
    </div>
  );
}
