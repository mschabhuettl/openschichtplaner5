/**
 * Tests for useConfirm — a promise-based confirmation-dialog hook.
 * `confirm()` opens the dialog and returns a promise that resolves to the
 * user's choice once onConfirm/onCancel fires.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfirm } from '../hooks/useConfirm';

describe('useConfirm', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useConfirm());
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('opens with a string message and resolves true on confirm', async () => {
    const { result } = renderHook(() => useConfirm());

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.confirm('Wirklich löschen?');
    });
    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.message).toBe('Wirklich löschen?');

    act(() => result.current.dialogProps.onConfirm());
    await expect(pending).resolves.toBe(true);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('resolves false on cancel', async () => {
    const { result } = renderHook(() => useConfirm());

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.confirm('Verwerfen?');
    });
    act(() => result.current.dialogProps.onCancel());
    await expect(pending).resolves.toBe(false);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('passes through the full options object', () => {
    const { result } = renderHook(() => useConfirm());
    act(() => {
      void result.current.confirm({
        title: 'Achtung',
        message: 'Datensatz endgültig entfernen?',
        confirmLabel: 'Entfernen',
        cancelLabel: 'Abbrechen',
        danger: true,
      });
    });
    const p = result.current.dialogProps;
    expect(p).toMatchObject({
      open: true,
      title: 'Achtung',
      message: 'Datensatz endgültig entfernen?',
      confirmLabel: 'Entfernen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
  });
});
