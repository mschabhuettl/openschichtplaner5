import { useState, useCallback } from 'react';

type FieldValue = string | number | boolean | null | undefined;

interface UseFormOptions<T> {
  /** Called on submit after validation passes */
  onSubmit: (values: T) => Promise<void> | void;
  /** Optional validation; return error string or null */
  validate?: (values: T) => string | null;
}

interface UseFormResult<T> {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  /** Update a single field by name */
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Convenience onChange for <input> / <select> / <textarea> elements */
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  /** Submit handler — runs validate then onSubmit */
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  /** Reset form to initial values */
  reset: (newValues?: T) => void;
  submitting: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
}

/**
 * useForm — generischer Form-State-Hook
 *
 * Usage:
 *   const { values, handleChange, handleSubmit, submitting, error } = useForm({
 *     initialValues: { name: '', age: 0 },
 *     onSubmit: async (v) => { await api.save(v); },
 *     validate: (v) => v.name ? null : 'Name ist Pflichtfeld',
 *   });
 */
export function useForm<T extends Record<string, FieldValue>>({
  initialValues,
  onSubmit,
  validate,
}: {
  initialValues: T;
} & UseFormOptions<T>): UseFormResult<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, type } = e.target;
      const value =
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : type === 'number'
          ? Number(e.target.value)
          : e.target.value;
      setValues(prev => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setError(null);
      if (validate) {
        const validationError = validate(values);
        if (validationError) {
          setError(validationError);
          return;
        }
      }
      setSubmitting(true);
      try {
        await onSubmit(values);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        setSubmitting(false);
      }
    },
    [values, validate, onSubmit],
  );

  const reset = useCallback(
    (newValues?: T) => {
      setValues(newValues ?? initialValues);
      setError(null);
    },
    [initialValues],
  );

  return { values, setValues, setField, handleChange, handleSubmit, reset, submitting, error, setError };
}
