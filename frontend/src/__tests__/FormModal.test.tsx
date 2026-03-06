/**
 * Unit tests for FormModal component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormModal } from '../components/FormModal';

const baseProps = {
  open: true,
  title: 'Test Modal',
  onClose: vi.fn(),
};

describe('FormModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <FormModal {...baseProps} open={false}><p>content</p></FormModal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when open=true', () => {
    render(<FormModal {...baseProps}><p>content</p></FormModal>);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows title', () => {
    render(<FormModal {...baseProps}><p>body</p></FormModal>);
    expect(screen.getByText('Test Modal')).toBeTruthy();
  });

  it('renders children', () => {
    render(<FormModal {...baseProps}><p>my content</p></FormModal>);
    expect(screen.getByText('my content')).toBeTruthy();
  });

  it('calls onClose when × button clicked', () => {
    const onClose = vi.fn();
    render(<FormModal {...baseProps} onClose={onClose}><p>x</p></FormModal>);
    fireEvent.click(screen.getByLabelText('Schließen'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(<FormModal {...baseProps} onClose={onClose}><p>x</p></FormModal>);
    // The backdrop is the outermost fixed div
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<FormModal {...baseProps} onClose={onClose}><p>x</p></FormModal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows submit button when onSubmit provided', () => {
    render(
      <FormModal {...baseProps} onSubmit={vi.fn()}><input /></FormModal>
    );
    expect(screen.getByText('Speichern')).toBeTruthy();
  });

  it('shows custom submitLabel', () => {
    render(
      <FormModal {...baseProps} onSubmit={vi.fn()} submitLabel="Erstellen"><input /></FormModal>
    );
    expect(screen.getByText('Erstellen')).toBeTruthy();
  });

  it('shows error message', () => {
    render(
      <FormModal {...baseProps} error="Fehler aufgetreten"><p>x</p></FormModal>
    );
    expect(screen.getByText('Fehler aufgetreten')).toBeTruthy();
  });

  it('disables submit button when submitting=true', () => {
    render(
      <FormModal {...baseProps} onSubmit={vi.fn()} submitting={true}><input /></FormModal>
    );
    const btn = screen.getByText('Speichern').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls onSubmit when form is submitted', () => {
    const onSubmit = vi.fn(e => e.preventDefault());
    render(
      <FormModal {...baseProps} onSubmit={onSubmit}><input name="test" /></FormModal>
    );
    fireEvent.submit(document.querySelector('form')!);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
