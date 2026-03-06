/**
 * employees.spec.ts — E2E tests require running backend + frontend
 *
 * Tests: As Admin → open employee list → "Hinzufügen" button visible
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const SESSION_KEY = 'sp5_session';

const adminSession = {
  token: '',
  user: {
    ID: 0, NAME: 'Developer', DESCRIP: 'Dev-Mode', ADMIN: true,
    RIGHTS: 99, role: 'Admin', WDUTIES: true, WABSENCES: true,
    WOVERTIMES: true, WNOTES: true, WCYCLEASS: true, WPAST: true,
    WACCEMWND: true, WACCGRWND: true, BACKUP: true, SHOWSTATS: true, ACCADMWND: true,
  },
  devMode: true,
};

test.describe('Mitarbeiterverwaltung', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: SESSION_KEY, value: adminSession });
    await page.reload();
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });
  });

  test('Mitarbeiter-Liste öffnen und "Hinzufügen" Button sichtbar', async ({ page }) => {
    // Navigate to employee/personal table
    await page.goto(`${BASE_URL}/personaltabelle`);
    // "Hinzufügen" button should be visible for Admin users
    await expect(
      page.locator('button:has-text("Hinzufügen"), button:has-text("Neu"), [data-testid="add-employee"]').first()
    ).toBeVisible({ timeout: 8000 });
  });
});
