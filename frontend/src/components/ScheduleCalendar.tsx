import { useMemo, memo, useState, useCallback, useRef, useEffect } from 'react';
import type { Employee, ScheduleEntry, ShiftType } from '../types';

// ── Types ─────────────────────────────────────────────────────

export interface DndAssignPayload {
  shiftId: number;
  dateStr: string;
}

export interface DndMovePayload {
  employeeId: number;
  fromDateStr: string;
  toDateStr: string;
  shiftId: number;
}

interface ScheduleCalendarProps {
  year: number;
  month: number;
  employees: Employee[];
  entryMap: Map<string, ScheduleEntry>;
  holidays: Set<string>;
  shifts: ShiftType[];
  onDayClick?: (day: number, dateStr: string) => void;
  /** Called when a shift chip is dropped from the palette onto a day */
  onShiftAssign?: (payload: DndAssignPayload) => void;
  /** Called when a shift chip is moved from one day to another */
  onShiftMove?: (payload: DndMovePayload) => void;
  /** Whether the user has write permission */
  readOnly?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────

const WEEKDAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Get the day-of-week for the 1st of the month, Mon=0 .. Sun=6 */
function getFirstDayOffset(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0
}

const pad = (n: number) => String(n).padStart(2, '0');

// ── DnD data transfer helpers ─────────────────────────────────

const DND_PALETTE_TYPE = 'application/x-sp5-palette-shift';
const DND_MOVE_TYPE = 'application/x-sp5-move-shift';

interface PaletteDragData {
  shiftId: number;
  shiftName: string;
}

interface MoveDragData {
  employeeId: number;
  fromDateStr: string;
  shiftId: number;
  shiftName: string;
}

// ── Palette Shift Chip (draggable from palette) ───────────────

const PaletteShiftChip = memo(function PaletteShiftChip({
  shift,
  readOnly,
}: {
  shift: ShiftType;
  readOnly: boolean;
}) {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const data: PaletteDragData = { shiftId: shift.ID, shiftName: shift.SHORTNAME };
    e.dataTransfer.setData(DND_PALETTE_TYPE, JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'copy';

    // Create ghost element
    const ghost = document.createElement('div');
    ghost.textContent = shift.SHORTNAME;
    ghost.style.cssText = `
      background: ${shift.COLORBK_HEX || '#e5e7eb'};
      color: ${shift.COLORTEXT_HEX || '#111'};
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      position: absolute;
      top: -1000px;
      white-space: nowrap;
    `;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  }, [shift]);

  return (
    <span
      draggable={!readOnly}
      onDragStart={handleDragStart}
      className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[11px] font-bold leading-tight whitespace-nowrap flex-shrink-0 select-none ${
        readOnly ? 'opacity-50 cursor-default' : 'cursor-grab active:cursor-grabbing hover:shadow-md hover:scale-105 transition-all'
      }`}
      style={{ backgroundColor: shift.COLORBK_HEX || '#e5e7eb', color: shift.COLORTEXT_HEX || '#111' }}
      title={readOnly ? shift.NAME : `${shift.NAME} — hierher ziehen um zuzuweisen`}
    >
      {shift.SHORTNAME}
    </span>
  );
});

// ── Shift Chip (in calendar cell, draggable for move) ─────────

const ShiftChip = memo(function ShiftChip({
  label,
  bgColor,
  textColor,
  count,
  draggable: isDraggable,
  onDragStart,
}: {
  label: string;
  bgColor: string;
  textColor: string;
  count: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  return (
    <span
      draggable={isDraggable}
      onDragStart={onDragStart}
      className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-bold leading-tight whitespace-nowrap flex-shrink-0 ${
        isDraggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={{ backgroundColor: bgColor, color: textColor }}
      title={`${label}: ${count} MA`}
    >
      {label}
      {count > 1 && (
        <span className="text-[8px] opacity-80">×{count}</span>
      )}
    </span>
  );
});

// ── Calendar Day Cell ─────────────────────────────────────────

interface DayCellProps {
  day: number;
  dateStr: string;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  shiftGroups: Array<{ label: string; bgColor: string; textColor: string; count: number; shiftId?: number; employeeIds?: number[] }>;
  totalAssigned: number;
  totalEmployees: number;
  onDayClick?: (day: number, dateStr: string) => void;
  readOnly: boolean;
  onDropPalette?: (dateStr: string, data: PaletteDragData) => void;
  onDropMove?: (toDateStr: string, data: MoveDragData) => void;
}

const DayCell = memo(function DayCell({
  day, dateStr, isToday, isWeekend, isHoliday,
  shiftGroups, totalAssigned, totalEmployees, onDayClick,
  readOnly, onDropPalette, onDropMove,
}: DayCellProps) {
  const [isOver, setIsOver] = useState(false);

  const bgClass = isOver
    ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500 ring-2 ring-blue-300 dark:ring-blue-600'
    : isHoliday
    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
    : isToday
    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700'
    : isWeekend
    ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

  const dayNumberClass = isHoliday
    ? 'text-red-600 dark:text-red-400'
    : isToday
    ? 'text-blue-600 dark:text-blue-400 font-bold'
    : isWeekend
    ? 'text-slate-500 dark:text-slate-400'
    : 'text-gray-700 dark:text-gray-300';

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    // Check if the drag data is our type
    if (e.dataTransfer.types.includes(DND_PALETTE_TYPE) || e.dataTransfer.types.includes(DND_MOVE_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DND_PALETTE_TYPE) ? 'copy' : 'move';
      setIsOver(true);
    }
  }, [readOnly]);

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    if (readOnly) return;

    const paletteData = e.dataTransfer.getData(DND_PALETTE_TYPE);
    if (paletteData) {
      try {
        const data: PaletteDragData = JSON.parse(paletteData);
        onDropPalette?.(dateStr, data);
      } catch { /* ignore */ }
      return;
    }

    const moveData = e.dataTransfer.getData(DND_MOVE_TYPE);
    if (moveData) {
      try {
        const data: MoveDragData = JSON.parse(moveData);
        if (data.fromDateStr !== dateStr) {
          onDropMove?.(dateStr, data);
        }
      } catch { /* ignore */ }
    }
  }, [readOnly, dateStr, onDropPalette, onDropMove]);

  // Create drag start handlers for existing shift chips (move operation)
  const handleShiftDragStart = useCallback((e: React.DragEvent, sg: { shiftId?: number; employeeIds?: number[]; label: string }) => {
    if (readOnly || !sg.shiftId || !sg.employeeIds?.length) {
      e.preventDefault();
      return;
    }
    // For simplicity, move the first employee's assignment
    const data: MoveDragData = {
      employeeId: sg.employeeIds[0],
      fromDateStr: dateStr,
      shiftId: sg.shiftId,
      shiftName: sg.label,
    };
    e.dataTransfer.setData(DND_MOVE_TYPE, JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
  }, [readOnly, dateStr]);

  return (
    <div
      className={`border rounded-lg p-1.5 min-h-[80px] flex flex-col cursor-pointer hover:shadow-md transition-all duration-150 ${bgClass}`}
      onClick={() => onDayClick?.(day, dateStr)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={`${dateStr} — ${totalAssigned}/${totalEmployees} MA eingeteilt · Klick für Tagesübersicht`}
    >
      {/* Day number header */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-semibold ${dayNumberClass}`}>
          {day}
          {isHoliday && <span className="ml-0.5 text-[9px]">★</span>}
        </span>
        {totalAssigned > 0 && (
          <span className="text-[9px] text-gray-400 dark:text-gray-500">
            {totalAssigned}/{totalEmployees}
          </span>
        )}
      </div>

      {/* Shift chips */}
      <div className="flex flex-wrap gap-0.5 flex-1">
        {shiftGroups.slice(0, 6).map((sg, i) => (
          <ShiftChip
            key={i}
            label={sg.label}
            bgColor={sg.bgColor}
            textColor={sg.textColor}
            count={sg.count}
            draggable={!readOnly && !!sg.shiftId}
            onDragStart={(e) => handleShiftDragStart(e, sg)}
          />
        ))}
        {shiftGroups.length > 6 && (
          <span className="text-[8px] text-gray-400 self-end">
            +{shiftGroups.length - 6}
          </span>
        )}
      </div>

      {/* Drop zone indicator when empty and dragging over */}
      {isOver && totalAssigned === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium animate-pulse">
            ⬇ Hier ablegen
          </span>
        </div>
      )}
    </div>
  );
});

// ── Empty Day Cell (outside current month) ────────────────────

function EmptyDayCell() {
  return <div className="min-h-[80px]" />;
}

// ── Shift Palette ─────────────────────────────────────────────

const ShiftPalette = memo(function ShiftPalette({
  shifts,
  readOnly,
  collapsed,
  onToggle,
}: {
  shifts: ShiftType[];
  readOnly: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const visibleShifts = shifts.filter(s => !s.HIDE);
  if (visibleShifts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-2 mb-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
          title={collapsed ? 'Palette aufklappen' : 'Palette zuklappen'}
        >
          <span className={`transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
          <span className="font-semibold text-xs text-gray-700 dark:text-gray-300">
            🎯 Schicht-Palette
          </span>
        </button>
        {!collapsed && !readOnly && (
          <span className="text-[9px] text-gray-400 ml-auto">
            Schichten auf Kalendertage ziehen zum Zuweisen
          </span>
        )}
      </div>
      {!collapsed && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {visibleShifts.map(shift => (
            <PaletteShiftChip key={shift.ID} shift={shift} readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  );
});

// ── Touch DnD Polyfill Hook ───────────────────────────────────

function useTouchDndPolyfill(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const container = containerRef.current as HTMLDivElement | null;
    if (!container) return;
    const el: HTMLDivElement = container;

    let dragElement: HTMLElement | null = null;
    let ghostEl: HTMLElement | null = null;
    let dragData: string | null = null;
    let dragType: string | null = null;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;

    const LONG_PRESS_MS = 300;

    function handleTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement;
      const draggable = target.closest('[draggable="true"]') as HTMLElement | null;
      if (!draggable) return;

      longPressTimer = setTimeout(() => {
        dragElement = draggable;
        const touch = e.touches[0];

        // Determine data type
        const text = draggable.textContent || '';
        // Check if it's a palette chip or a cell chip based on class/context
        const isPalette = draggable.closest('[data-palette]') !== null;

        if (isPalette) {
          const shiftIdAttr = draggable.getAttribute('data-shift-id');
          if (shiftIdAttr) {
            dragType = DND_PALETTE_TYPE;
            dragData = JSON.stringify({ shiftId: Number(shiftIdAttr), shiftName: text.trim() });
          }
        }

        // Create ghost
        ghostEl = draggable.cloneNode(true) as HTMLElement;
        ghostEl.style.cssText = `
          position: fixed;
          pointer-events: none;
          z-index: 9999;
          opacity: 0.8;
          transform: scale(1.1);
          left: ${touch.clientX - 20}px;
          top: ${touch.clientY - 10}px;
        `;
        document.body.appendChild(ghostEl);

        // Add dragging class to body
        document.body.classList.add('sp5-touch-dragging');

        // Vibrate for haptic feedback
        if (navigator.vibrate) navigator.vibrate(50);
      }, LONG_PRESS_MS);
    }

    function handleTouchMove(e: TouchEvent) {
      if (!dragElement || !ghostEl) {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        return;
      }

      e.preventDefault();
      const touch = e.touches[0];
      ghostEl.style.left = `${touch.clientX - 20}px`;
      ghostEl.style.top = `${touch.clientY - 10}px`;

      // Highlight drop target
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZone = target?.closest('[data-drop-date]') as HTMLElement | null;

      // Remove previous highlights
      el.querySelectorAll('.sp5-touch-drop-highlight').forEach(node => {
        node.classList.remove('sp5-touch-drop-highlight', 'ring-2', 'ring-blue-300', 'bg-blue-100');
      });

      if (dropZone) {
        dropZone.classList.add('sp5-touch-drop-highlight', 'ring-2', 'ring-blue-300', 'bg-blue-100');
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (!dragElement || !dragData || !dragType) {
        cleanup();
        return;
      }

      const touch = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZone = target?.closest('[data-drop-date]') as HTMLElement | null;

      if (dropZone) {
        const dateStr = dropZone.getAttribute('data-drop-date');
        if (dateStr) {
          // Dispatch a custom event since we can't use native DnD API
          const detail = { type: dragType, data: dragData, dateStr };
          el.dispatchEvent(new CustomEvent('sp5-touch-drop', { detail, bubbles: true }));
        }
      }

      cleanup();
    }

    function cleanup() {
      if (ghostEl) {
        document.body.removeChild(ghostEl);
        ghostEl = null;
      }
      dragElement = null;
      dragData = null;
      dragType = null;
      document.body.classList.remove('sp5-touch-dragging');
      el.querySelectorAll('.sp5-touch-drop-highlight').forEach(node => {
        node.classList.remove('sp5-touch-drop-highlight', 'ring-2', 'ring-blue-300', 'bg-blue-100');
      });
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      cleanup();
    };
  }, [containerRef]);
}

// ── Main Calendar Component ───────────────────────────────────

const ScheduleCalendar = memo(function ScheduleCalendar({
  year,
  month,
  employees,
  entryMap,
  holidays,
  shifts,
  onDayClick,
  onShiftAssign,
  onShiftMove,
  readOnly = false,
}: ScheduleCalendarProps) {
  const now = new Date();
  const todayDay = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : -1;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOffset(year, month);
  const totalEmployees = employees.length;
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch DnD polyfill
  useTouchDndPolyfill(containerRef);

  // Handle touch drop events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: Event) => {
      const { type, data, dateStr } = (e as CustomEvent).detail;
      if (type === DND_PALETTE_TYPE) {
        try {
          const parsed: PaletteDragData = JSON.parse(data);
          onShiftAssign?.({ shiftId: parsed.shiftId, dateStr });
        } catch { /* ignore */ }
      }
    };

    el.addEventListener('sp5-touch-drop', handler);
    return () => el.removeEventListener('sp5-touch-drop', handler);
  }, [onShiftAssign]);

  // DnD handlers for day cells
  const handleDropPalette = useCallback((dateStr: string, data: PaletteDragData) => {
    onShiftAssign?.({ shiftId: data.shiftId, dateStr });
  }, [onShiftAssign]);

  const handleDropMove = useCallback((toDateStr: string, data: MoveDragData) => {
    onShiftMove?.({
      employeeId: data.employeeId,
      fromDateStr: data.fromDateStr,
      toDateStr,
      shiftId: data.shiftId,
    });
  }, [onShiftMove]);

  // Precompute per-day data
  const dayData = useMemo(() => {
    const result: Array<{
      day: number;
      dateStr: string;
      isWeekend: boolean;
      isHoliday: boolean;
      shiftGroups: Array<{ label: string; bgColor: string; textColor: string; count: number; shiftId?: number; employeeIds?: number[] }>;
      totalAssigned: number;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      const jsWd = new Date(year, month - 1, d).getDay();
      const isWeekend = jsWd === 0 || jsWd === 6;
      const isHoliday = holidays.has(dateStr);

      // Gather all entries for this day, grouped by display_name
      const groupMap = new Map<string, { label: string; bgColor: string; textColor: string; count: number; shiftId?: number; employeeIds: number[] }>();
      let totalAssigned = 0;

      for (const emp of employees) {
        const entry = entryMap.get(`${emp.ID}-${d}`);
        if (!entry) continue;
        totalAssigned++;
        const key = entry.display_name || '?';
        const existing = groupMap.get(key);
        if (existing) {
          existing.count++;
          existing.employeeIds.push(emp.ID);
        } else {
          groupMap.set(key, {
            label: entry.display_name || '?',
            bgColor: entry.color_bk || '#e5e7eb',
            textColor: entry.color_text || '#111',
            count: 1,
            shiftId: entry.shift_id,
            employeeIds: [emp.ID],
          });
        }
      }

      // Sort shift groups by count descending
      const shiftGroups = Array.from(groupMap.values())
        .sort((a, b) => b.count - a.count);

      result.push({ day: d, dateStr, isWeekend, isHoliday, shiftGroups, totalAssigned });
    }

    return result;
  }, [year, month, daysInMonth, employees, entryMap, holidays]);

  // Build grid cells: leading empties + day cells + trailing empties
  const totalCells = firstDayOffset + daysInMonth;
  const trailingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  return (
    <div ref={containerRef}>
      {/* Shift Palette */}
      <ShiftPalette
        shifts={shifts}
        readOnly={readOnly}
        collapsed={paletteCollapsed}
        onToggle={() => setPaletteCollapsed(c => !c)}
      />

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_HEADERS.map((wd, i) => (
            <div
              key={wd}
              className={`text-center text-xs font-semibold py-1 rounded ${
                i >= 5
                  ? 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Leading empty cells */}
          {Array.from({ length: firstDayOffset }, (_, i) => (
            <EmptyDayCell key={`pre-${i}`} />
          ))}

          {/* Day cells */}
          {dayData.map(dd => (
            <div key={dd.day} data-drop-date={dd.dateStr}>
              <DayCell
                day={dd.day}
                dateStr={dd.dateStr}
                isToday={dd.day === todayDay}
                isWeekend={dd.isWeekend}
                isHoliday={dd.isHoliday}
                shiftGroups={dd.shiftGroups}
                totalAssigned={dd.totalAssigned}
                totalEmployees={totalEmployees}
                onDayClick={onDayClick}
                readOnly={readOnly}
                onDropPalette={handleDropPalette}
                onDropMove={handleDropMove}
              />
            </div>
          ))}

          {/* Trailing empty cells */}
          {Array.from({ length: trailingCells }, (_, i) => (
            <EmptyDayCell key={`post-${i}`} />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-gray-100 dark:border-gray-700 pt-2">
          {!readOnly && (
            <span className="text-[10px] text-gray-400">
              🖱️ Schichten aus der Palette auf Tage ziehen · Klick für Tagesübersicht
            </span>
          )}
          {readOnly && (
            <span className="text-[10px] text-gray-400">
              Klicke auf einen Tag für die Tagesübersicht
            </span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">
            {MONTH_NAMES[month]} {year} · {employees.length} Mitarbeiter
          </span>
        </div>
      </div>
    </div>
  );
});

export default ScheduleCalendar;
