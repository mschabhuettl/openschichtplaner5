/**
 * Page tests for Login.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/context';

// Mock fetch for /api/dev/mode (used in useEffect)
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock AuthContext
const mockLogin = vi.fn();
const mockLoginDev = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    loginDev: mockLoginDev,
    user: null,
    isLoading: false,
    isDevMode: false,
  }),
}));

import Login from '../pages/Login';

function renderLogin() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force German locale so translations are predictable
    localStorage.setItem('sp5_language', 'de');
    mockFetch.mockResolvedValue({
      json: async () => ({ dev_mode: false }),
    });
  });

  it('renders the login form with username and password fields', async () => {
    renderLogin();
    expect(screen.getByPlaceholderText('z. B. Admin')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('renders a submit button', async () => {
    renderLogin();
    // The submit button renders t.login.loginButton = 'Anmelden'
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
  });

  it('shows error when submitting without username', async () => {
    renderLogin();
    const submitBtn = screen.getByRole('button', { name: 'Anmelden' });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/Bitte Benutzername/)).toBeTruthy();
    });
  });

  it('calls login with username and password on submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('z. B. Admin'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'secret');
    });
  });

  it('shows error message when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Ungültige Anmeldedaten'));
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('z. B. Admin'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(screen.getByText(/Ungültige Anmeldedaten/)).toBeTruthy();
    });
  });

  it('does not show dev mode button when server reports dev_mode=false', async () => {
    renderLogin();
    await waitFor(() => {
      expect(screen.queryByText(/Dev-Mode/)).toBeNull();
    });
  });

  it('shows dev mode button when server reports dev_mode=true', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ dev_mode: true }),
    });
    renderLogin();
    await waitFor(() => {
      expect(screen.getByText(/Dev-Mode/)).toBeTruthy();
    });
  });

  it('calls loginDev when dev mode button is clicked', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ dev_mode: true }),
    });
    renderLogin();
    await waitFor(() => screen.getByText(/Dev-Mode/));
    fireEvent.click(screen.getByText(/Dev-Mode/));
    expect(mockLoginDev).toHaveBeenCalled();
  });
});
