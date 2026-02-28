/**
 * DataTable — generische Tabelle mit Sortierung, Pagination und Suche
 */
import { useState, useMemo } from 'react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  /** Custom render fn; receives the row */
  render?: (row: T) => React.ReactNode;
  /** Value extractor for sorting/filtering (default: row[key]) */
  getValue?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  /** Tailwind classes for the <td> */
  className?: string;
  /** Tailwind classes for the <th> */
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** Key extractor for row identity */
  rowKey: (row: T) => string | number;
  /** Whether to show the search input */
  searchable?: boolean;
  /** Placeholder for search input */
  searchPlaceholder?: string;
  /** Rows per page options; set to [] to disable pagination */
  pageSizes?: number[];
  defaultPageSize?: number;
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Extra classes for the table wrapper */
  className?: string;
  emptyText?: string;
}

type SortDir = 'asc' | 'desc' | null;

function normalize(v: unknown): string {
  if (v == null) return '';
  return String(v).toLowerCase();
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  searchable = true,
  searchPlaceholder = 'Suchen…',
  pageSizes = [20, 50, 100],
  defaultPageSize = 20,
  onRowClick,
  className = '',
  emptyText = 'Keine Einträge',
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const getVal = (row: T, col: Column<T>): string | number | null | undefined => {
    if (col.getValue) return col.getValue(row);
    return (row as Record<string, unknown>)[col.key as string] as string | number | null | undefined;
  };

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter(row =>
      columns.some(col => normalize(getVal(row, col)).includes(q))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, columns]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = getVal(a, col) ?? '';
      const bv = getVal(b, col) ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = normalize(av);
      const bs = normalize(bv);
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, columns]);

  // Paginate
  const paginationEnabled = pageSizes.length > 0;
  const totalPages = paginationEnabled ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const pageData = paginationEnabled
    ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
    : sorted;

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir(d => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(col.key as string);
      setSortDir('asc');
    }
    setPage(1);
  };

  const sortIcon = (col: Column<T>) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Toolbar */}
      {(searchable || paginationEnabled) && (
        <div className="flex items-center gap-2 flex-wrap">
          {searchable && (
            <input
              type="search"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder={searchPlaceholder}
              className="border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-blue-300 dark:bg-slate-700 dark:text-gray-200 dark:placeholder-gray-400"
            />
          )}
          {paginationEnabled && (
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {pageSizes.map(s => <option key={s} value={s}>{s} / Seite</option>)}
            </select>
          )}
          <span className="text-xs text-gray-600">{sorted.length} Einträge</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-700 text-white">
              {columns.map(col => (
                <th
                  key={col.key as string}
                  onClick={() => handleSort(col)}
                  className={`text-left px-3 py-2 font-semibold text-xs whitespace-nowrap ${col.sortable ? 'cursor-pointer select-none hover:bg-slate-600' : ''} ${col.headerClassName ?? ''}`}
                >
                  {col.label}{sortIcon(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center text-gray-600 italic py-8 text-sm">
                  {emptyText}
                </td>
              </tr>
            ) : pageData.map((row, i) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-gray-100 dark:border-slate-700 ${i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-750'} ${onRowClick ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700' : 'hover:bg-gray-50 dark:hover:bg-slate-700'} transition-colors`}
              >
                {columns.map(col => (
                  <td key={col.key as string} className={`px-3 py-2 ${col.className ?? ''}`}>
                    {col.render ? col.render(row) : String(getVal(row, col) ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginationEnabled && totalPages > 1 && (
        <div className="flex items-center gap-1 justify-end text-sm">
          <button
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100"
          >«</button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100"
          >‹</button>
          <span className="px-3 text-gray-600">
            Seite {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100"
          >›</button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100"
          >»</button>
        </div>
      )}
    </div>
  );
}
