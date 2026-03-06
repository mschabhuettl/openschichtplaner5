/**
 * Unit tests for Login page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock AuthContext
const mockLogin = vi.fn();
const mockLoginDev = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    loginDev: mockLoginDev,
    user: null,
    isLoading: false,
    token: null,
  }),
}));

// Mock i18n
vi.mock('../i18n/context', () => ({
  useLanguage: () => ({ language: 'de', setLanguage: vi.fn() }),
  useT: () => ({
    login: {
      title: 'OpenSchichtplaner5',
      subtitle: 'Bitte anmelden um fortzufahren',
      usernameLabel: 'Benutzername',
      usernamePlaceholder: 'z. B. Admin',
      passwordLabel: 'Passwort',
      passwordPlaceholder: '••••••••',
      loginButton: 'Anmelden',
      loggingIn: 'Anmelden…',
      devModeButton: 'Dev-Mode',
      devModeHint: 'Kein Account? Einfach Dev-Mode nutzen.',
      errorRequired: 'Bitte Benutzername eingeben.',
      errorFailed: 'Login fehlgeschlagen',
      footerText: 'OpenSchichtplaner5 · Open-Source Dienstplanung',
    },
  }),
}));

// Mock fetch for dev mode check
global.fetch = vi.fn(() =>
  Promise.resolve({ json: () => Promise.resolve({ dev_mode: false }) } as Response)
);

import Login from '../pages/Login';

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ dev_mode: false }) } as Response)
    );
  });

  it('renders login form', () => {
    render(<Login />);
    expect(screen.getByText('OpenSchichtplaner5')).toBeTruthy();
    expect(screen.getByText('Benutzername')).toBeTruthy();
    expect(screen.getByText('Passwort')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
  });

  it('shows error when submitting empty username', async () => {
    render(<Login />);
    const submitBtn = screen.getByRole('button', { name: 'Anmelden' });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/Bitte Benutzername eingeben/)).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with username and password on submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<Login />);

    const usernameInput = screen.getByPlaceholderText('z. B. Admin');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'secret');
    });
  });

  it('shows error when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Ungültige Zugangsdaten'));
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('z. B. Admin'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(screen.getByText(/Ungültige Zugangsdaten/)).toBeTruthy();
    });
  });

  it('does not show dev mode button when server is not in dev mode', async () => {
    render(<Login />);
    await waitFor(() => {
      expect(screen.queryByText(/Dev-Mode/)).toBeNull();
    });
  });

  it('shows dev mode button when server is in dev mode', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ dev_mode: true }) } as Response)
    );
    render(<Login />);
    await waitFor(() => {
      expect(screen.getByText(/Dev-Mode/)).toBeTruthy();
    });
  });

  it('calls loginDev when dev mode button clicked', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ dev_mode: true }) } as Response)
    );
    render(<Login />);
    await waitFor(() => {
      expect(screen.getByText(/Dev-Mode/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/Dev-Mode/));
    expect(mockLoginDev).toHaveBeenCalled();
  });
});
