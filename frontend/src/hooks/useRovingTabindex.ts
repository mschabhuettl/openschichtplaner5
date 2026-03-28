import { useCallback, useRef, useEffect } from 'react';

interface UseRovingTabindexOptions {
  orientation?: 'horizontal' | 'vertical';
  onActivate?: (index: number) => void;
  loop?: boolean;
  initialIndex?: number;
}

/**
 * Roving tabindex for toolbar / tablist patterns.
 * Only one item in the group is tabbable (tabIndex=0); the rest have tabIndex=-1.
 * Arrow keys move focus between items; Home/End jump to first/last.
 */
export function useRovingTabindex(
  itemCount: number,
  options: UseRovingTabindexOptions = {},
) {
  const { orientation = 'horizontal', onActivate, loop = true, initialIndex = 0 } = options;
  const activeIndexRef = useRef(initialIndex);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => { itemsRef.current = itemsRef.current.slice(0, itemCount); }, [itemCount]);

  const focusItem = useCallback((index: number) => {
    activeIndexRef.current = index;
    itemsRef.current[index]?.focus();
  }, []);

  const setActiveIndex = useCallback((index: number) => { activeIndexRef.current = index; }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    let newIndex: number | null = null;

    if (e.key === prevKey) {
      e.preventDefault();
      newIndex = index > 0 ? index - 1 : (loop ? itemCount - 1 : null);
    } else if (e.key === nextKey) {
      e.preventDefault();
      newIndex = index < itemCount - 1 ? index + 1 : (loop ? 0 : null);
    } else if (e.key === 'Home') {
      e.preventDefault(); newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault(); newIndex = itemCount - 1;
    }

    if (newIndex !== null) {
      focusItem(newIndex);
      onActivate?.(newIndex);
    }
  }, [orientation, itemCount, loop, focusItem, onActivate]);

  const getItemProps = useCallback((index: number) => ({
    ref: (el: HTMLElement | null) => { itemsRef.current[index] = el; },
    tabIndex: index === activeIndexRef.current ? 0 : -1,
    onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, index),
    onFocus: () => { activeIndexRef.current = index; },
  }), [handleKeyDown]);

  return { getItemProps, setActiveIndex, focusItem };
}
