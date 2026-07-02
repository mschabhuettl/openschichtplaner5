/**
 * Modal-Primitive (Design-System, UX-Audit B4): ESC schließt, Backdrop-Klick
 * schließt, Panel-Klick schließt nicht.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../components/ui/Modal';

describe('Modal', () => {
  it('rendert Titel/Inhalt und schließt per ESC und Backdrop, nicht per Panel-Klick', () => {
    const onClose = vi.fn();
    render(<Modal open title="Details" onClose={onClose}><p>Inhalt</p></Modal>);
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeTruthy();

    fireEvent.mouseDown(screen.getByText('Inhalt'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('rendert nichts bei open=false', () => {
    const { container } = render(<Modal open={false} title="X" onClose={() => {}}>y</Modal>);
    expect(container.innerHTML).toBe('');
  });
});
