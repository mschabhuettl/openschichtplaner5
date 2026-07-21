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

  it('Kartenfläche ist in beiden Modi abgedeckt (Token-Paar oder dark:-Variante)', () => {
    const accents = ['blue', 'green', 'orange', 'red', 'purple', 'gray', 'teal', 'yellow', 'indigo'] as const;
    for (const accent of accents) {
      const { container, unmount } = render(<StatCard label="x" value="1" accent={accent} />);
      const card = container.firstChild as HTMLElement;
      // Taktwerk-Token (bg-ebene/border-kontur) tragen Light UND Dark;
      // explizite dark:-Varianten sind nur für Nicht-Token-Farben nötig.
      expect(card.className).toMatch(/bg-ebene/);
      expect(card.className).toMatch(/border-kontur/);
      unmount();
    }
  });
});

describe('Badge dark mode', () => {
  it('jede Variante ist in beiden Modi abgedeckt (Token-Paar oder dark:-Variante)', () => {
    const variants = ['green', 'blue', 'red', 'yellow', 'orange', 'purple', 'gray', 'teal', 'indigo'] as const;
    for (const variant of variants) {
      const { container, unmount } = render(<Badge variant={variant}>label</Badge>);
      const span = container.firstChild as HTMLElement;
      // Farbige Pillen brauchen dark:-Paare; die neutrale graue Pille läuft
      // vollständig über Taktwerk-Token (schrift-2/kontur = Light+Dark).
      if (variant === 'gray') {
        expect(span.className).toMatch(/text-schrift-2/);
        expect(span.className).toMatch(/border-kontur/);
      } else {
        expect(span.className).toMatch(/dark:/);
      }
      unmount();
    }
  });
});

describe('PageHeader dark mode', () => {
  it('title and subtitle carry dark: text colors', () => {
    render(<PageHeader title="Titel" subtitle="Untertitel" />);
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.className).toMatch(/text-schrift/);
    const subtitle = screen.getByText('Untertitel');
    expect(subtitle.className).toMatch(/text-schrift-2/);
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
