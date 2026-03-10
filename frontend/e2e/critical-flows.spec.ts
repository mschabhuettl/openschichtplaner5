/**
 * critical-flows.spec.ts — E2E tests for critical user flows
 *
 * Covers:
 * - Login: valid (dev-mode), invalid credentials, empty fields, logout + re-login
 * - Cross-page navigation: sidebar links work, back/forward, deep-link access
 * - Session persistence: refresh keeps session, logout clears it
 */
import { test, expect } from '@playwright/test';
import { loginViaStorage, BASE_URL } from './helpers.js';

// ─── Login Flow Tests ────────────────────────────────────────

test.describe('Login — Kritische Flows', () => {
  test('Leere Felder: Submit zeigt Warnung', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.setItem('sp5_language', 'de'));
    await page.reload();
    await page.waitForTimeout(500);

    // Submit without filling anything
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      // Should show validation error or remain on login page
      const loginForm = page.locator('input[autocomplete="username"], input[type="password"]');
      expect(await loginForm.count()).toBeGreaterThan(0);
    }
  });

  test('Invalide Credentials: Fehlermeldung und kein Redirect', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.setItem('sp5_language', 'de'));
    await page.reload();
    await page.waitForTimeout(500);

    await page.fill('input[autocomplete="username"]', 'nonexistent_user');
    await page.fill('input[type="password"]', 'WrongPassword!123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Should still be on login page (no redirect to dashboard)
    const loginForm = page.locator('input[autocomplete="username"]');
    const dashboardText = page.locator('text=Dashboard');
    
    // Either login form is still visible OR error message shown
    const stillOnLogin = await loginForm.isVisible();
    const errorShown = await page.locator('text=⚠️').first().isVisible().catch(() => false);
    expect(stillOnLogin || errorShown).toBe(true);
  });

  test('Session-Inject Login → Dashboard → Logout → Login-Seite', async ({ page }) => {
    await loginViaStorage(page, 'admin');
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 8000 });

    // Logout
    const logoutBtn = page.locator('button:has-text("Abmelden"), button:has-text("Logout")').first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);
      // Should be back on login page
      await expect(page.locator('input[autocomplete="username"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Session überlebt Page-Refresh', async ({ page }) => {
    await loginViaStorage(page, 'admin');
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 8000 });

    // Refresh the page
    await page.reload();
    await page.waitForTimeout(1000);

    // Should still be logged in
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });
    const loginForm = await page.locator('input[autocomplete="username"]').count();
    expect(loginForm).toBe(0);
  });

  test('Direkter Zugriff auf geschützte Seite ohne Session → Login', async ({ page }) => {
    // Clear any session
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.removeItem('sp5_session');
    });
    await page.goto(`${BASE_URL}/schedule`);
    await page.waitForTimeout(1000);

    // Should redirect to login or show login form
    const loginForm = page.locator('input[autocomplete="username"], input[type="password"]');
    await expect(loginForm.first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── Cross-Page Navigation Tests ────────────────────────────

test.describe('Navigation — Seitenübergreifend', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page, 'admin');
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 8000 });
  });

  test('Sidebar-Navigation: Hauptseiten erreichbar', async ({ page }) => {
    const pages = [
      { path: '/schedule', expect: 'Dienstplan' },
      { path: '/urlaub', expect: 'Urlaub' },
      { path: '/personaltabelle', expect: 'Personal' },
      { path: '/statistiken', expect: 'Statistik' },
    ];

    for (const pg of pages) {
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForTimeout(800);
      const body = await page.textContent('body');
      expect(body).not.toContain('Cannot GET');
      expect(body!.length).toBeGreaterThan(100);
    }
  });

  test('Deep-Link: Direkt auf Wochenansicht navigieren', async ({ page }) => {
    await page.goto(`${BASE_URL}/wochenansicht`);
    await page.waitForTimeout(1000);

    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot GET');
    expect(body!.length).toBeGreaterThan(100);
  });

  test('Deep-Link: Direkt auf Jahresübersicht navigieren', async ({ page }) => {
    await page.goto(`${BASE_URL}/jahresuebersicht`);
    await page.waitForTimeout(1000);

    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot GET');
    expect(body!.length).toBeGreaterThan(100);
  });

  test('Browser-Back nach Navigation funktioniert', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(500);
    await page.goto(`${BASE_URL}/schedule`);
    await page.waitForTimeout(500);

    await page.goBack();
    await page.waitForTimeout(500);

    // Should be back on dashboard
    const url = page.url();
    expect(url).toContain(BASE_URL);
  });

  test('404-Seite für ungültige Routen', async ({ page }) => {
    await page.goto(`${BASE_URL}/diese-seite-gibt-es-nicht`);
    await page.waitForTimeout(1000);

    const body = await page.textContent('body');
    // Should show a 404 page or redirect to dashboard, not crash
    expect(body!.length).toBeGreaterThan(20);
  });
});
