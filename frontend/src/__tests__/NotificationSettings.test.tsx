import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NotificationSettings from '../pages/NotificationSettings';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    getNotificationSettings: vi.fn(),
    updateNotificationSettings: vi.fn(),
  },
}));

const defaultSettings = {
  shift_assigned: true,
  shift_changed: true,
  swap_requested: true,
  swap_approved: true,
  swap_rejected: true,
  vacation_approved: true,
  vacation_rejected: true,
  schedule_comment_added: true,
};

const mockGet = (settings = defaultSettings) =>
  vi.mocked(api.getNotificationSettings).mockResolvedValue({ user_id: 1, settings });

const mockUpdate = (settings = defaultSettings) =>
  vi.mocked(api.updateNotificationSettings).mockResolvedValue({
    user_id: 1,
    settings,
    updated: true,
  });

const renderPage = () =>
  render(
    <MemoryRouter>
      <NotificationSettings />
    </MemoryRouter>
  );

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    mockGet();
    renderPage();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders page title after loading', async () => {
    mockGet();
    renderPage();
    await waitFor(() => screen.getByText('🔔 Benachrichtigungs-Einstellungen'));
    expect(screen.getByText('🔔 Benachrichtigungs-Einstellungen')).toBeTruthy();
  });

  it('renders all event groups', async () => {
    mockGet();
    renderPage();
    await waitFor(() => screen.getByText('Schichten'));
    expect(screen.getByText('Schichten')).toBeTruthy();
    expect(screen.getByText('Tauschbörse')).toBeTruthy();
    expect(screen.getByText('Urlaub')).toBeTruthy();
    expect(screen.getByText('Kommentare')).toBeTruthy();
  });

  it('renders toggle switches for each event', async () => {
    mockGet();
    renderPage();
    await waitFor(() => screen.getByText('Schicht zugewiesen'));
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(8);
  });

  it('shows enabled toggles as checked', async () => {
    mockGet();
    renderPage();
    await waitFor(() => screen.getAllByRole('switch'));
    const switches = screen.getAllByRole('switch');
    switches.forEach((sw) => {
      expect(sw.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('shows disabled toggles as unchecked when setting is false', async () => {
    mockGet({ ...defaultSettings, shift_assigned: false });
    renderPage();
    await waitFor(() => screen.getAllByRole('switch'));
    const switches = screen.getAllByRole('switch');
    // First switch is shift_assigned
    expect(switches[0].getAttribute('aria-checked')).toBe('false');
  });

  it('toggles a switch on click', async () => {
    mockGet();
    renderPage();
    await waitFor(() => screen.getAllByRole('switch'));
    const firstSwitch = screen.getAllByRole('switch')[0];
    expect(firstSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(firstSwitch);
    expect(firstSwitch.getAttribute('aria-checked')).toBe('false');
  });

  it('shows save button', async () => {
    mockGet();
    renderPage();
    await waitFor(() => screen.getByText('Einstellungen speichern'));
    expect(screen.getByText('Einstellungen speichern')).toBeTruthy();
  });

  it('calls update API on save', async () => {
    mockGet();
    mockUpdate();
    renderPage();
    await waitFor(() => screen.getByText('Einstellungen speichern'));
    fireEvent.click(screen.getByText('Einstellungen speichern'));
    await waitFor(() => expect(api.updateNotificationSettings).toHaveBeenCalledTimes(1));
  });

  it('shows success toast after save', async () => {
    mockGet();
    mockUpdate();
    renderPage();
    await waitFor(() => screen.getByText('Einstellungen speichern'));
    fireEvent.click(screen.getByText('Einstellungen speichern'));
    await waitFor(() => screen.getByText('Einstellungen gespeichert'));
    expect(screen.getByText('Einstellungen gespeichert')).toBeTruthy();
  });

  it('shows error message when API fails', async () => {
    vi.mocked(api.getNotificationSettings).mockRejectedValue(new Error('Network error'));
    renderPage();
    // After load fails, either an error message or fallback text is shown
    await waitFor(() => {
      const el = document.body.textContent;
      expect(el).toMatch(/Fehler|geladen werden/);
    });
  });
});
