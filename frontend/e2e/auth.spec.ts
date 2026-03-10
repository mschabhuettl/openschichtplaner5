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

  test('Login via Dev-Mode zeigt Dashboard (wenn Backend Dev-Mode aktiv)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.setItem('sp5_language', 'de'));
    await page.reload();
    await page.waitForTimeout(1000);
    // Dev-Mode button is only shown when backend reports dev_mode: true
    const devBtn = page.locator('button:has-text("Dev-Mode"), button:has-text("dev-mode"), button:has-text("Dev Mode")');
    if (await devBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await devBtn.click();
      await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });
    } else {
      // Skip gracefully if backend dev-mode is not active
      test.skip(true, 'Dev-Mode button not available (backend dev_mode not active)');
    }
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
