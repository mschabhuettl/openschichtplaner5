/**
 * Unit tests for ConfirmDialog component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../components/ConfirmDialog';

const baseProps = {
  open: true,
  message: 'Soll dieser Eintrag wirklich gelöscht werden?',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(<ConfirmDialog {...baseProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open=true', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows default title', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Bestätigung')).toBeTruthy();
  });

  it('shows custom title', () => {
    render(<ConfirmDialog {...baseProps} title="Löschen?" />);
    expect(screen.getByText('Löschen?')).toBeTruthy();
  });

  it('shows message', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText(baseProps.message)).toBeTruthy();
  });

  it('shows default button labels', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Bestätigen')).toBeTruthy();
    expect(screen.getByText('Abbrechen')).toBeTruthy();
  });

  it('shows custom button labels', () => {
    render(<ConfirmDialog {...baseProps} confirmLabel="Ja" cancelLabel="Nein" />);
    expect(screen.getByText('Ja')).toBeTruthy();
    expect(screen.getByText('Nein')).toBeTruthy();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Bestätigen'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when backdrop clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    // The backdrop is the second child of the dialog div
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.querySelector('.absolute.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('applies danger styling when danger=true', () => {
    render(<ConfirmDialog {...baseProps} danger={true} />);
    const confirmBtn = screen.getByText('Bestätigen');
    expect(confirmBtn.className).toContain('red');
  });
});
