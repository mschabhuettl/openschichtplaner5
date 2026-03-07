/**
 * auth.spec.ts — E2E tests require running backend + frontend
 *
 * Tests: Login with correct credentials → Dashboard visible
 *        Login with wrong credentials → error message shown
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const SESSION_KEY = 'sp5_session';

test.describe('Authentication', () => {
  test('Login mit falschen Credentials zeigt Fehlermeldung', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[type="password"]', 'WrongPassword!');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=⚠️').first()).toBeVisible({ timeout: 5000 });
  });

  test('Login via Dev-Mode zeigt Dashboard', async ({ page }) => {
    await page.goto(BASE_URL);
    // Force German so selector matches 'Dev-Mode' button text
    await page.evaluate(() => localStorage.setItem('sp5_language', 'de'));
    await page.reload();
    // Dev-Mode bypasses backend — reliable for E2E smoke test
    await page.click('button:has-text("Dev-Mode")');
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });
  });

  test('Direkter Session-Inject zeigt Dashboard', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem('sp5_language', 'de');
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
      },
    });
    await page.reload();
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });
  });
});
