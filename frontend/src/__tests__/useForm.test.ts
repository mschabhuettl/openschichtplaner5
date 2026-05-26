/**
 * Tests for the generic useForm hook (form state + validation + submit).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useForm } from '../hooks/useForm';

type Vals = { name: string; age: number; flag: boolean };
const initial: Vals = { name: '', age: 0, flag: false };

function setup(opts: Partial<Parameters<typeof useForm<Vals>>[0]> = {}) {
  const onSubmit = opts.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  return {
    onSubmit,
    ...renderHook(() => useForm<Vals>({ initialValues: initial, onSubmit, validate: opts.validate })),
  };
}

function changeEvent(name: string, type: string, value: string, checked = false) {
  return { target: { name, type, value, checked } } as unknown as React.ChangeEvent<HTMLInputElement>;
}

describe('useForm', () => {
  it('exposes initial values', () => {
    const { result } = setup();
    expect(result.current.values).toEqual(initial);
    expect(result.current.error).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it('setField updates a single field', () => {
    const { result } = setup();
    act(() => result.current.setField('name', 'Max'));
    expect(result.current.values.name).toBe('Max');
    expect(result.current.values.age).toBe(0);
  });

  it('handleChange coerces text, number and checkbox inputs', () => {
    const { result } = setup();
    act(() => result.current.handleChange(changeEvent('name', 'text', 'Anna')));
    act(() => result.current.handleChange(changeEvent('age', 'number', '42')));
    act(() => result.current.handleChange(changeEvent('flag', 'checkbox', '', true)));
    expect(result.current.values).toEqual({ name: 'Anna', age: 42, flag: true });
  });

  it('handleSubmit runs onSubmit with values when valid + prevents default', async () => {
    const { result, onSubmit } = setup();
    act(() => result.current.setField('name', 'Max'));
    const preventDefault = vi.fn();
    await act(async () => {
      await result.current.handleSubmit({ preventDefault } as unknown as React.FormEvent);
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Max' }));
    expect(result.current.error).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it('handleSubmit blocks on validation error and skips onSubmit', async () => {
    const { result, onSubmit } = setup({ validate: (v) => (v.name ? null : 'Name fehlt') });
    await act(async () => { await result.current.handleSubmit(); });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Name fehlt');
  });

  it('handleSubmit surfaces onSubmit errors', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('save failed'));
    const { result } = renderHook(() => useForm<Vals>({ initialValues: initial, onSubmit }));
    await act(async () => { await result.current.handleSubmit(); });
    expect(result.current.error).toBe('save failed');
    expect(result.current.submitting).toBe(false);
  });

  it('reset restores initial values (or provided values) and clears error', async () => {
    const { result } = setup({ validate: () => 'always-bad' });
    await act(async () => { await result.current.handleSubmit(); });
    expect(result.current.error).toBe('always-bad');
    act(() => result.current.setField('name', 'X'));
    act(() => result.current.reset());
    expect(result.current.values).toEqual(initial);
    expect(result.current.error).toBeNull();
    act(() => result.current.reset({ name: 'Y', age: 1, flag: true }));
    expect(result.current.values).toEqual({ name: 'Y', age: 1, flag: true });
  });
});
