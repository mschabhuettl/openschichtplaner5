/**
 * P-B Admin-Impersonation: das persistente „Als Benutzer ansehen"-Banner zeigt
 * den Ziel-Benutzer und ruft bei „Zurück zu mir" stopImpersonation auf; ohne
 * aktive Impersonation rendert es nichts.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../contexts/AuthContext';
import { ImpersonationBanner } from '../components/ImpersonationBanner';

const authMock = vi.mocked(useAuth);

function setAuth(impersonation: unknown, stopImpersonation = vi.fn()) {
  authMock.mockReturnValue({
    impersonation,
    stopImpersonation,
  } as unknown as ReturnType<typeof useAuth>);
}

describe('ImpersonationBanner', () => {
  it('rendert nichts ohne aktive Impersonation', () => {
    setAuth(null);
    const { container } = render(<ImpersonationBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('zeigt den Ziel-Benutzer und beendet per „Zurück zu mir"', async () => {
    const stop = vi.fn();
    setAuth({ targetName: 'Erika Leserin', adminName: 'Chefin' }, stop);
    render(<ImpersonationBanner />);
    expect(screen.getByText(/Erika Leserin/)).toBeTruthy();
    expect(screen.getByText(/nur lesend/)).toBeTruthy();
    screen.getByRole('button', { name: /Zurück zu mir/ }).click();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
