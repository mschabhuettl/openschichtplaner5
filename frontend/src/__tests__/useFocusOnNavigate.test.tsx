/**
 * Tests for useFocusOnNavigate — the a11y hook that moves focus to the main
 * content region after each route change (skipping the initial render) so
 * keyboard/screen-reader users land on fresh content.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useFocusOnNavigate } from '../hooks/useFocusOnNavigate';

function Harness({ id, renderTarget = true }: { id?: string; renderTarget?: boolean }) {
  useFocusOnNavigate(id);
  const navigate = useNavigate();
  const targetId = id ?? 'main-content';
  return (
    <>
      <button onClick={() => navigate('/next')}>go</button>
      {renderTarget ? <div id={targetId}>content</div> : <div>no target</div>}
    </>
  );
}

function mount(props: { id?: string; renderTarget?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Harness {...props} />
    </MemoryRouter>,
  );
}

// Trigger a route change from within an event handler (no render-time side effects).
function navigate() {
  act(() => {
    fireEvent.click(screen.getByText('go'));
  });
}

describe('useFocusOnNavigate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('does not move focus on the initial render', () => {
    mount();
    act(() => vi.advanceTimersByTime(200));
    expect(document.getElementById('main-content')).not.toBe(document.activeElement);
  });

  it('focuses the main content after a route change', () => {
    mount();
    navigate();
    act(() => vi.advanceTimersByTime(100));
    const el = document.getElementById('main-content')!;
    expect(document.activeElement).toBe(el);
  });

  it('adds tabindex=-1 only when the target lacks one', () => {
    mount();
    navigate();
    act(() => vi.advanceTimersByTime(100));
    expect(document.getElementById('main-content')!.getAttribute('tabindex')).toBe('-1');
  });

  it('honours a custom content id', () => {
    mount({ id: 'app-root' });
    navigate();
    act(() => vi.advanceTimersByTime(100));
    expect(document.activeElement).toBe(document.getElementById('app-root'));
  });

  it('does not focus before the 100 ms debounce elapses', () => {
    mount();
    navigate();
    act(() => vi.advanceTimersByTime(50));
    expect(document.activeElement).not.toBe(document.getElementById('main-content'));
  });

  it('is a no-op when the target element is absent', () => {
    mount({ renderTarget: false });
    navigate();
    expect(() => act(() => vi.advanceTimersByTime(100))).not.toThrow();
  });
});
