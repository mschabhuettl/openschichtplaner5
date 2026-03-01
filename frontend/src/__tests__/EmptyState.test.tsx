/**
 * Unit tests for EmptyState, ApiErrorState, InlineError components.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState, ApiErrorState, InlineError } from '../components/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Keine Daten" />);
    expect(screen.getByText('Keine Daten')).toBeTruthy();
  });

  it('renders default icon', () => {
    render(<EmptyState title="Test" />);
    expect(screen.getByText('📭')).toBeTruthy();
  });

  it('renders custom icon', () => {
    render(<EmptyState title="Test" icon="🔍" />);
    expect(screen.getByText('🔍')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Test" description="No items found." />);
    expect(screen.getByText('No items found.')).toBeTruthy();
  });

  it('does not render description when omitted', () => {
    render(<EmptyState title="Test" />);
    expect(screen.queryByText('No items found.')).toBeNull();
  });

  it('renders action button when actionLabel and onAction provided', () => {
    const onAction = vi.fn();
    render(<EmptyState title="Test" actionLabel="Add" onAction={onAction} />);
    const btn = screen.getByText('Add');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('does not render button without onAction', () => {
    render(<EmptyState title="Test" actionLabel="Add" />);
    expect(screen.queryByText('Add')).toBeNull();
  });
});

describe('ApiErrorState', () => {
  it('renders default error message', () => {
    render(<ApiErrorState />);
    expect(screen.getByText('Daten konnten nicht geladen werden.')).toBeTruthy();
  });

  it('renders custom message', () => {
    render(<ApiErrorState message="Custom error" />);
    expect(screen.getByText('Custom error')).toBeTruthy();
  });

  it('renders retry button and calls onRetry', () => {
    const onRetry = vi.fn();
    render(<ApiErrorState onRetry={onRetry} />);
    const btn = screen.getByText('🔄 Erneut versuchen');
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not render retry button without onRetry', () => {
    render(<ApiErrorState />);
    expect(screen.queryByText('🔄 Erneut versuchen')).toBeNull();
  });
});

describe('InlineError', () => {
  it('renders message', () => {
    render(<InlineError message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('renders retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<InlineError message="Error" onRetry={onRetry} />);
    const btn = screen.getByText('Retry');
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not render retry button without onRetry', () => {
    render(<InlineError message="Error" />);
    expect(screen.queryByText('Retry')).toBeNull();
  });
});
