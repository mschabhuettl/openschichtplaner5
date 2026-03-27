/**
 * ResponsiveTable — wrapper for horizontal-scroll tables on mobile
 *
 * Features:
 * - overflow-x: auto with smooth touch scrolling
 * - Scroll-shadow indicators (left/right)
 * - Optional sticky first column
 * - min-width to prevent column collapse
 */
import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ResponsiveTableProps {
  children: ReactNode;
  /** Minimum width for the table content (e.g. '700px') */
  minWidth?: string;
  /** Enable sticky first column */
  stickyFirstCol?: boolean;
  /** Extra className for the outer wrapper */
  className?: string;
}

export function ResponsiveTable({
  children,
  minWidth,
  stickyFirstCol = false,
  className = '',
}: ResponsiveTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateShadows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateShadows();

    el.addEventListener('scroll', updateShadows, { passive: true });

    // ResizeObserver may not be available in test environments (jsdom)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateShadows);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', updateShadows);
      ro?.disconnect();
    };
  }, [updateShadows]);

  return (
    <div className={`responsive-table-wrapper relative ${className}`}>
      {/* Left scroll shadow */}
      <div
        className={`pointer-events-none absolute left-0 top-0 bottom-0 w-4 z-20 transition-opacity duration-200 ${
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0.08), transparent)',
        }}
      />
      {/* Right scroll shadow */}
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-0 w-4 z-20 transition-opacity duration-200 ${
          canScrollRight ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: 'linear-gradient(to left, rgba(0,0,0,0.08), transparent)',
        }}
      />

      <div
        ref={scrollRef}
        className={`overflow-x-auto ${
          stickyFirstCol ? 'responsive-table-sticky' : ''
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div style={minWidth ? { minWidth } : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}
