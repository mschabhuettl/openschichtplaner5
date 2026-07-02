/**
 * Maintainer-Befund: „Kalender nur im Dev-Mode sichtbar." Wurzel: der
 * Nav-Eintrag „Mein Kalender" trug eine roles-Whitelist ['Leser'] — im
 * Normalbetrieb (echte Rollen) fiel er damit für Admin/Planer aus dem Menü;
 * nur der Dev-Modus-Admin-Bypass zeigte ihn. Self-Service-Ansichten
 * (Mein Profil, Mein Kalender, Schichtwünsche, Tauschbörse) sind rollenfrei.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../api/client', () => ({ api: new Proxy({}, { get: () => vi.fn() }) }));

import { navItems } from '../App';

describe('Navigation — Mein Kalender für alle Rollen', () => {
  it('mein-kalender hat keine roles-Whitelist (sichtbar für Admin/Planer/Leser)', () => {
    const item = navItems.find(i => i.id === 'mein-kalender');
    expect(item).toBeTruthy();
    expect(item!.roles).toBeUndefined();
  });

  it('auch die übrigen Self-Service-Einträge sind rollenfrei', () => {
    for (const id of ['mein-profil', 'schichtwuensche', 'tauschboerse']) {
      const item = navItems.find(i => i.id === id);
      expect(item, id).toBeTruthy();
      expect(item!.roles, id).toBeUndefined();
    }
  });
});
