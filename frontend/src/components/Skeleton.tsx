import React from 'react';

/**
 * Skeleton — Ladeplatzhalter nach Taktwerk (docs/design-system.md §6):
 * 11px-Balken, Radius 3px, Kontur-Farbe, Shimmer 1,2 s — gestaffelt je Zeile
 * (+0,12 s), IM ZEILENRHYTHMUS des Ziel-Layouts.
 * Usage: import { Skeleton, SkeletonText, SkeletonCard, SkeletonTable } from '../components/Skeleton';
 */

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  style?: React.CSSProperties;
}

/** Basis-Balken — schimmernde Kontur-Fläche */
export function Skeleton({ className = '', width, height, style }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer bg-kontur rounded-[3px] ${className}`}
      style={{ width, height, ...style }}
    />
  );
}

/** Einzelne Platzhalter-Textzeile */
export function SkeletonText({ className = '', width = 'w-full' }: { className?: string; width?: string }) {
  return <Skeleton className={`h-[11px] ${width} ${className}`} />;
}

/** Karten-Platzhalter */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-ebene rounded-panel border border-kontur p-5 flex flex-col gap-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Lädt …</span>
      {[0, 1, 2, 3].map(i => (
        <Skeleton
          key={i}
          className={`h-[11px] ${['w-36', 'w-full', 'w-4/5', 'w-3/5'][i]}`}
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

/** Tabellen-Platzhalter im 28px-Zeilenrhythmus */
export function SkeletonTable({ rows = 8, cols = 5, className = '' }: SkeletonTableProps) {
  return (
    <div
      className={`bg-ebene rounded-panel border border-kontur overflow-hidden ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Lädt …</span>
      {/* Kopf auf Fläche 2 */}
      <div className="bg-[#fafbfc] dark:bg-[#0e1522] border-b border-kontur px-3 py-2 flex gap-4 items-center">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-[9px]" style={{ width: `${80 + (i % 3) * 20}px` }} />
        ))}
      </div>
      {/* Zeilen (28px) */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex gap-4 px-3 items-center h-[28px] border-b border-kontur-soft"
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton
              key={col}
              className="h-[11px]"
              style={{
                width: `${60 + ((row + col) % 4) * 15}px`,
                animationDelay: `${row * 0.12 + col * 0.04}s`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Raster-Platzhalter für Dienstplan-/Kalenderansichten */
interface SkeletonGridProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonGrid({ rows = 6, cols = 7, className = '' }: SkeletonGridProps) {
  return (
    <div className={`overflow-auto ${className}`} role="status" aria-live="polite">
      <span className="sr-only">Lädt …</span>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `120px repeat(${cols}, minmax(36px, 1fr))` }}
      >
        {/* Kopfzeile */}
        <Skeleton className="h-8 rounded-none bg-wash" />
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-8 rounded-none bg-wash" style={{ animationDelay: `${i * 0.04}s` }} />
        ))}
        {/* Datenzeilen (25px-Rhythmus des Grids) */}
        {Array.from({ length: rows }).map((_, row) => (
          <React.Fragment key={`row-${row}`}>
            <Skeleton className="h-[25px] rounded-none" style={{ animationDelay: `${row * 0.12}s` }} />
            {Array.from({ length: cols }).map((_, col) => (
              <Skeleton
                key={`cell-${row}-${col}`}
                className="h-[25px] rounded-none bg-kontur-soft"
                style={{ animationDelay: `${row * 0.12 + col * 0.04}s` }}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
