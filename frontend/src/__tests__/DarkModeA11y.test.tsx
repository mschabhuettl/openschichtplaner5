/**
 * Tests locking in the dark-mode + accessibility fixes for the shared
 * presentational components (StatCard, Badge, PageHeader, LoadingSpinner).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { PageHeader } from '../components/PageHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';

describe('StatCard dark mode', () => {
  it('renders value and label', () => {
    render(<StatCard label="Mitarbeiter" value={42} />);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Mitarbeiter')).toBeTruthy();
  });

  it('includes dark: variants on the card surface for every accent', () => {
    const accents = ['blue', 'green', 'orange', 'red', 'purple', 'gray', 'teal', 'yellow', 'indigo'] as const;
    for (const accent of accents) {
      const { container, unmount } = render(<StatCard label="x" value="1" accent={accent} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/dark:/);
      unmount();
    }
  });
});

describe('Badge dark mode', () => {
  it('includes dark: variants for each variant', () => {
    const variants = ['green', 'blue', 'red', 'yellow', 'orange', 'purple', 'gray', 'teal', 'indigo'] as const;
    for (const variant of variants) {
      const { container, unmount } = render(<Badge variant={variant}>label</Badge>);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toMatch(/dark:/);
      unmount();
    }
  });
});

describe('PageHeader dark mode', () => {
  it('title and subtitle carry dark: text colors', () => {
    render(<PageHeader title="Titel" subtitle="Untertitel" />);
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.className).toMatch(/dark:text-/);
    const subtitle = screen.getByText('Untertitel');
    expect(subtitle.className).toMatch(/dark:text-/);
  });
});

describe('LoadingSpinner accessibility', () => {
  it('exposes role=status with an accessible loading label even without a message', () => {
    render(<LoadingSpinner />);
    const status = screen.getByRole('status');
    expect(status).toBeTruthy();
    // sr-only fallback label is present
    expect(screen.getByText(/geladen/i)).toBeTruthy();
  });

  it('uses the provided message as the visible label', () => {
    render(<LoadingSpinner message="Lade Dienstplan" />);
    expect(screen.getByText('Lade Dienstplan')).toBeTruthy();
  });
});
