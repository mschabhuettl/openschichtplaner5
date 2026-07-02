/**
 * Badge-Primitive (Design-System): läuft nie über (truncate, feste Höhe),
 * Textfarbe automatisch lesbar zur Hintergrundfarbe.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/ui/Badge';

describe('Badge', () => {
  it('setzt lesbare Textfarbe zur Hintergrundfarbe', () => {
    render(<Badge label="Frühdienst" bgColor="#FFFF99" />);
    const el = screen.getByText('Frühdienst').parentElement!;
    expect(el.style.backgroundColor).toBe('rgb(255, 255, 153)');
    expect(el.style.color).toBe('rgb(17, 24, 39)'); // dunkel auf hell
    render(<Badge label="Nachtdienst" bgColor="#1e3a8a" />);
    const el2 = screen.getByText('Nachtdienst').parentElement!;
    expect(el2.style.color).toBe('rgb(255, 255, 255)'); // weiß auf dunkel
  });

  it('truncated lange Labels statt zu überlaufen (feste Höhe, truncate-Klasse)', () => {
    render(<Badge label={'SehrLangerSchichtName'.repeat(10)} />);
    const inner = screen.getByText(/SehrLangerSchichtName/);
    expect(inner.className).toContain('truncate');
    expect(inner.parentElement!.className).toContain('h-5');
    expect(inner.parentElement!.className).toContain('max-w-full');
  });
});
