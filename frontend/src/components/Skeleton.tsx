import type React from 'react';

/**
 * Skeleton — animated placeholder components for loading states.
 * Usage: import { Skeleton, SkeletonText, SkeletonCard, SkeletonTable } from '../components/Skeleton';
 */

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  style?: React.CSSProperties;
}

/** Base skeleton block — animated grey rectangle */
export function Skeleton({ className = '', width, height, style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      style={{ width, height, ...style }}
    />
  );
}

/** Single line of placeholder text */
export function SkeletonText({ className = '', width = 'w-full' }: { className?: string; width?: string }) {
  return <Skeleton className={`h-3 ${width} ${className}`} />;
}

/** Card-shaped skeleton placeholder */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex flex-col gap-3 ${className}`}>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

/** Table skeleton — placeholder rows + cols */
export function SkeletonTable({ rows = 8, cols = 5, className = '' }: SkeletonTableProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-slate-700 px-4 py-2 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 bg-slate-500" style={{ width: `${80 + (i % 3) * 20}px` }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className={`flex gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-700 ${row % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-750'}`}
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton
              key={col}
              className="h-3"
              style={{ width: `${60 + ((row + col) % 4) * 15}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Grid skeleton for schedule/calendar views */
interface SkeletonGridProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonGrid({ rows = 6, cols = 7, className = '' }: SkeletonGridProps) {
  return (
    <div className={`overflow-auto ${className}`}>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `120px repeat(${cols}, minmax(36px, 1fr))` }}
      >
        {/* Header row */}
        <Skeleton className="h-8 rounded-none bg-slate-300 dark:bg-slate-600" />
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-8 rounded-none bg-slate-300 dark:bg-slate-600" />
        ))}
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, row) => (
          <>
            <Skeleton key={`label-${row}`} className="h-9 rounded-none" />
            {Array.from({ length: cols }).map((_, col) => (
              <Skeleton
                key={`cell-${row}-${col}`}
                className={`h-9 rounded-none ${(row + col) % 5 === 0 ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
              />
            ))}
          </>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
