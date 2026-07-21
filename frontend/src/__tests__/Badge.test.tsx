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
    // Rohfarbe wird normalisiert (Hue-treu auf der S/L-Schiene), nie roh gerendert
    expect(el.style.backgroundColor).toBe('rgb(147, 147, 47)'); // #ffff99 -> #93932f
    expect(el.style.color).toBe('rgb(19, 19, 21)'); // Ink dunkel auf heller Flaeche
    render(<Badge label="Nachtdienst" bgColor="#1e3a8a" />);
    const el2 = screen.getByText('Nachtdienst').parentElement!;
    expect(el2.style.color).toBe('rgb(255, 255, 255)'); // weiß auf dunkel
  });

  it('truncated lange Labels statt zu überlaufen (feste Höhe, truncate-Klasse)', () => {
    render(<Badge label={'SehrLangerSchichtName'.repeat(10)} />);
    const inner = screen.getByText(/SehrLangerSchichtName/);
    expect(inner.className).toContain('truncate');
    expect(inner.parentElement!.className).toContain('h-[19px]');
    expect(inner.parentElement!.className).toContain('max-w-full');
  });
});
