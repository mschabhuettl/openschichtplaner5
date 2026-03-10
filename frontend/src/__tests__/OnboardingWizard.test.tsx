/**
 * Unit tests for FirstTimeSetupWizard component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FirstTimeSetupWizard } from '../components/OnboardingWizard';

// Mock the api module
vi.mock('../api/client', () => ({
  api: {
    getEmployees: vi.fn().mockResolvedValue([]),
    getGroups: vi.fn().mockResolvedValue([]),
    createShift: vi.fn().mockResolvedValue({ ok: true, record: {} }),
    createEmployee: vi.fn().mockResolvedValue({ ok: true, record: { ID: 1, NAME: 'Test', FIRSTNAME: 'User' } }),
    getSettings: vi.fn().mockResolvedValue({}),
    updateSettings: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

describe('FirstTimeSetupWizard', () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    onComplete.mockClear();
    localStorage.clear();
  });

  it('renders the wizard dialog', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows welcome step initially', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    expect(screen.getByText(/Willkommen bei OpenSchichtplaner5/)).toBeTruthy();
  });

  it('shows step indicator 1/5', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    expect(screen.getByText('1 / 5')).toBeTruthy();
  });

  it('navigates to next step on "Weiter" click', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Weiter →'));
    // Should now show Company Info step (heading: 🏢 Firmendaten)
    expect(screen.getByText(/🏢 Firmendaten/)).toBeTruthy();
    expect(screen.getByText('2 / 5')).toBeTruthy();
  });

  it('navigates back on "Zurück" click', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    // Go to step 2
    fireEvent.click(screen.getByText('Weiter →'));
    expect(screen.getByText('2 / 5')).toBeTruthy();
    // Go back
    fireEvent.click(screen.getByText('← Zurück'));
    expect(screen.getByText('1 / 5')).toBeTruthy();
  });

  it('shows skip button on step 2 but not step 1', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    // Step 1 (Welcome) — no skip
    expect(screen.queryByText('Überspringen')).toBeNull();
    // Step 2 — skip visible
    fireEvent.click(screen.getByText('Weiter →'));
    expect(screen.getByText('Überspringen')).toBeTruthy();
  });

  it('dismiss button sets localStorage and calls onComplete', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByTitle('Später einrichten'));
    expect(localStorage.getItem('sp5_onboarding_completed')).toBe('true');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders shift types step with default shifts', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    // Navigate: Welcome → Company → Shifts
    fireEvent.click(screen.getByText('Weiter →'));
    fireEvent.click(screen.getByText('Weiter →'));
    expect(screen.getByText(/Schichttypen anlegen/)).toBeTruthy();
    expect(screen.getByDisplayValue('Frühdienst')).toBeTruthy();
    expect(screen.getByDisplayValue('Spätdienst')).toBeTruthy();
    expect(screen.getByDisplayValue('Nachtdienst')).toBeTruthy();
  });

  it('renders employee step', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    // Navigate: Welcome → Company → Shifts → Employee
    fireEvent.click(screen.getByText('Weiter →'));
    fireEvent.click(screen.getByText('Weiter →'));
    fireEvent.click(screen.getByText('Weiter →'));
    expect(screen.getByText(/Ersten Mitarbeiter anlegen/)).toBeTruthy();
  });

  it('closes on Escape key', () => {
    render(<FirstTimeSetupWizard onComplete={onComplete} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
