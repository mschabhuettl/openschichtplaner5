/**
 * HelpTooltip — kleines "?" Icon mit erklärendem Tooltip.
 * Kein externe Library, nur CSS + State.
 */
import { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  text: string;
  /** Tooltip position relative to the icon */
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function HelpTooltip({ text, position = 'top', className = '' }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  const posClasses: Record<string, string> = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<string, string> = {
    top:    'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800',
    left:   'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800',
    right:  'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800',
  };

  return (
    <div ref={ref} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        aria-label="Hilfe anzeigen"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full
                   bg-gray-200 hover:bg-blue-100 text-gray-500 hover:text-blue-600
                   text-[10px] font-bold leading-none transition-colors cursor-help
                   border border-gray-300 hover:border-blue-400 flex-shrink-0"
      >
        ?
      </button>

      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 w-56 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg
                      whitespace-pre-line pointer-events-none ${posClasses[position]}`}
        >
          {text}
          {/* Arrow */}
          <span
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
