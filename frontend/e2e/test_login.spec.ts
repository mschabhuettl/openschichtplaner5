import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ADMIN_SESSION = path.join(__dirname, '.auth/admin.json');
const SESSION_KEY = 'sp5_session';

test.describe('Login Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Force German to ensure German text selectors work in headless browser
    await page.evaluate(() => localStorage.setItem('sp5_language', 'de'));
    await page.reload();
  });

  test('Login mit falschen Daten zeigt Fehlermeldung', async ({ page }) => {
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[type="password"]', 'WrongPassword123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=⚠️').first()).toBeVisible({ timeout: 5000 });
  });

  test('Login mit leerem Benutzernamen zeigt Validierungsfehler', async ({ page }) => {
    await page.fill('input[type="password"]', 'Test1234');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=⚠️').first()).toBeVisible({ timeout: 3000 });
  });

  test('Dev-Mode Login funktioniert', async ({ page }) => {
    await page.click('button:has-text("Dev-Mode")');
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });
  });

  test('Logout funktioniert', async ({ page }) => {
    // Inject session via localStorage (kein API-Call, kein Rate-Limit)
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, {
      key: SESSION_KEY,
      value: {
        token: '',
        user: {
          ID: 0, NAME: 'Developer', DESCRIP: 'Dev-Mode', ADMIN: true,
          RIGHTS: 99, role: 'Admin', WDUTIES: true, WABSENCES: true,
          WOVERTIMES: true, WNOTES: true, WCYCLEASS: true, WPAST: true,
          WACCEMWND: true, WACCGRWND: true, BACKUP: true, SHOWSTATS: true, ACCADMWND: true,
        },
        devMode: true,
      }
    });
    await page.reload();
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });

    // Ausloggen
    await page.click('button:has-text("Abmelden")');
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Login: Erfolgreicher API-Login', () => {
  // NOTE: Real API login is already verified in auth.setup.ts (admin/leser/planer sessions).
  // This test uses the saved admin storageState to verify the session is valid without
  // consuming additional rate-limit slots (5/min login limit).
  test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

  test('Admin-Session ist aktiv und Dashboard sichtbar', async ({ page }) => {
    await page.goto(BASE_URL);
    // Dashboard should be visible immediately — session restored from storageState
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 8000 });
    // Login form must NOT be visible
    const loginForm = await page.locator('input[autocomplete="username"]').count();
    expect(loginForm).toBe(0);
  });
});
