/**
 * Tests for useRovingTabindex — arrow/Home/End keyboard navigation logic.
 * focusItem() is a no-op here (no real DOM), so navigation is asserted via the
 * onActivate callback and the tabIndex from getItemProps.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRovingTabindex } from '../hooks/useRovingTabindex';

function keydown(key: string) {
  const preventDefault = vi.fn();
  return { event: { key, preventDefault } as unknown as React.KeyboardEvent, preventDefault };
}

describe('useRovingTabindex', () => {
  it('initial item is tabbable (tabIndex 0), others -1', () => {
    const { result } = renderHook(() => useRovingTabindex(3, { initialIndex: 1 }));
    expect(result.current.getItemProps(1).tabIndex).toBe(0);
    expect(result.current.getItemProps(0).tabIndex).toBe(-1);
    expect(result.current.getItemProps(2).tabIndex).toBe(-1);
  });

  it('horizontal: ArrowRight/ArrowLeft move and loop, and preventDefault is called', () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useRovingTabindex(3, { onActivate }));

    const right = keydown('ArrowRight');
    result.current.getItemProps(0).onKeyDown(right.event);
    expect(onActivate).toHaveBeenLastCalledWith(1);
    expect(right.preventDefault).toHaveBeenCalled();

    // ArrowLeft from 0 loops to last (itemCount-1 = 2)
    result.current.getItemProps(0).onKeyDown(keydown('ArrowLeft').event);
    expect(onActivate).toHaveBeenLastCalledWith(2);

    // ArrowRight from last loops to 0
    result.current.getItemProps(2).onKeyDown(keydown('ArrowRight').event);
    expect(onActivate).toHaveBeenLastCalledWith(0);
  });

  it('Home/End jump to first/last', () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useRovingTabindex(4, { onActivate }));
    result.current.getItemProps(2).onKeyDown(keydown('Home').event);
    expect(onActivate).toHaveBeenLastCalledWith(0);
    result.current.getItemProps(1).onKeyDown(keydown('End').event);
    expect(onActivate).toHaveBeenLastCalledWith(3);
  });

  it('loop=false does not wrap at the edges', () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useRovingTabindex(3, { onActivate, loop: false }));
    result.current.getItemProps(0).onKeyDown(keydown('ArrowLeft').event); // at start
    result.current.getItemProps(2).onKeyDown(keydown('ArrowRight').event); // at end
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('vertical orientation uses ArrowUp/ArrowDown', () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabindex(3, { onActivate, orientation: 'vertical' }),
    );
    result.current.getItemProps(0).onKeyDown(keydown('ArrowDown').event);
    expect(onActivate).toHaveBeenLastCalledWith(1);
    // horizontal arrows are ignored in vertical mode
    onActivate.mockClear();
    result.current.getItemProps(0).onKeyDown(keydown('ArrowRight').event);
    expect(onActivate).not.toHaveBeenCalled();
  });
});
