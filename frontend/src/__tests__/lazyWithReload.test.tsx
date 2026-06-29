/**
 * Regression (P2-2 / Punkt 12): „Personalbedarf" (und andere lazy-geladene Seiten)
 * zeigten gelegentlich „Seite nicht ladbar", und erst STRG+R lud sie — die klassische
 * Signatur eines fehlgeschlagenen Lazy-Chunk-Imports (veraltete Chunk-Referenz nach
 * Deploy / transienter Netz-Aussetzer). `lazyWithReload` erholt sich automatisch:
 * bei einem Chunk-Ladefehler EINMAL neu laden (loop-sicher per sessionStorage-Guard),
 * bei Erfolg den Guard zurücksetzen.
 */

import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Component, Suspense, type ReactNode } from 'react';
import { lazyWithReload } from '../utils/lazyWithReload';

// Minimal boundary so a rethrown import error is caught instead of crashing the test.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div>boundary-fallback</div> : this.props.children;
  }
}

const RELOAD_GUARD_KEY = 'sp5-chunk-reloaded';

let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  reloadSpy = vi.fn();
  // window.location.reload is not implemented in jsdom — stub it.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadSpy },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function chunkError(): Error {
  const e = new Error('Failed to fetch dynamically imported module: /assets/Page-abc.js');
  e.name = 'ChunkLoadError';
  return e;
}

it('reloads once when the dynamic import fails with a chunk error', async () => {
  const Comp = lazyWithReload(() => Promise.reject(chunkError()));
  render(<Suspense fallback={<div>lädt</div>}><Comp /></Suspense>);

  await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
  expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBe('1');
});

it('does NOT reload a second time once the guard is set (loop-safe)', async () => {
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1'); // simulate „already reloaded once"
  const Comp = lazyWithReload(() => Promise.reject(chunkError()));
  render(
    <Boundary>
      <Suspense fallback={<div>lädt</div>}>
        <Comp />
      </Suspense>
    </Boundary>,
  );

  // It should rethrow (no reload) → boundary fallback appears.
  expect(await screen.findByText('boundary-fallback')).toBeTruthy();
  expect(reloadSpy).not.toHaveBeenCalled();
});

it('clears the guard on a successful import (re-arms for a future deploy)', async () => {
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1'); // a prior episode left it set
  const Ok = () => <div>geladen</div>;
  const Comp = lazyWithReload(() => Promise.resolve({ default: Ok }));
  render(<Suspense fallback={<div>lädt</div>}><Comp /></Suspense>);

  expect(await screen.findByText('geladen')).toBeTruthy();
  expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull();
  expect(reloadSpy).not.toHaveBeenCalled();
});

it('does not reload on a non-chunk error (real render/import bug surfaces)', async () => {
  const Comp = lazyWithReload(() => Promise.reject(new Error('boom: some other failure')));
  render(
    <Boundary>
      <Suspense fallback={<div>lädt</div>}>
        <Comp />
      </Suspense>
    </Boundary>,
  );

  expect(await screen.findByText('boundary-fallback')).toBeTruthy();
  expect(reloadSpy).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull();
});
