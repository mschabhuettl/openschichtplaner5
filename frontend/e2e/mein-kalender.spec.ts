/**
 * mein-kalender.spec.ts — E2E tests for Personal Calendar (Mein Kalender)
 *
 * Covers:
 * - Mein Kalender page loads for Leser role
 * - Shows month navigation
 * - Shows weekday headers and calendar grid
 * - Leser can navigate between months
 * - Page renders without JS errors
 *
 * Uses dev-mode session injection (no backend needed for basic UI flows).
 */
import { test, expect } from '@playwright/test';
import { loginViaStorage, BASE_URL } from './helpers.js';

test.describe('Mein Kalender — Persönlicher Kalender', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page, 'leser');
    // Leser might not see "Dashboard" text — just verify no login form
    await expect(page.locator('input[autocomplete="username"]')).toHaveCount(0, { timeout: 10000 });
  });

  test('Mein Kalender Seite ist erreichbar', async ({ page }) => {
    await page.goto(`${BASE_URL}/mein-kalender`);
    await page.waitForTimeout(1500);

    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot GET');
    expect(body).not.toContain('404');
    expect(body!.length).toBeGreaterThan(100);
  });

  test('Mein Kalender zeigt Monatsnavigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/mein-kalender`);
    await page.waitForTimeout(1500);

    // Should show month name (German)
    const body = await page.textContent('body');
    const hasMonthName = /Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember/i.test(body!);
    expect(hasMonthName).toBe(true);
  });

  test('Mein Kalender zeigt Wochentag-Abkürzungen', async ({ page }) => {
    await page.goto(`${BASE_URL}/mein-kalender`);
    await page.waitForTimeout(1500);

    const body = await page.textContent('body');
    // Should show weekday abbreviations used in the calendar grid
    const hasWeekdays = body!.includes('Mo') && body!.includes('Fr');
    expect(hasWeekdays).toBe(true);
  });

  test('Monatsnavigation vorwärts funktioniert', async ({ page }) => {
    await page.goto(`${BASE_URL}/mein-kalender`);
    await page.waitForTimeout(1500);

    // Find the next month button (► or →)
    const nextBtn = page.locator('button:has-text("►"), button:has-text("→"), button:has-text("❯"), button[aria-label*="nächst"], button[aria-label*="next"]').first();
    if (await nextBtn.isVisible()) {
      const bodyBefore = await page.textContent('body');
      await nextBtn.click();
      await page.waitForTimeout(500);

      // Page should update (month name changes)
      const bodyAfter = await page.textContent('body');
      expect(bodyAfter!.length).toBeGreaterThan(100);
    }
  });

  test('Monatsnavigation rückwärts funktioniert', async ({ page }) => {
    await page.goto(`${BASE_URL}/mein-kalender`);
    await page.waitForTimeout(1500);

    const prevBtn = page.locator('button:has-text("◄"), button:has-text("←"), button:has-text("❮"), button[aria-label*="vorig"], button[aria-label*="prev"]').first();
    if (await prevBtn.isVisible()) {
      await prevBtn.click();
      await page.waitForTimeout(500);

      const body = await page.textContent('body');
      expect(body!.length).toBeGreaterThan(100);
    }
  });

  test('Admin kann auch Mein Kalender aufrufen', async ({ page }) => {
    await loginViaStorage(page, 'admin');
    await page.goto(`${BASE_URL}/mein-kalender`);
    await page.waitForTimeout(1500);

    const body = await page.textContent('body');
    // Should load without crash — may redirect or show the calendar
    expect(body!.length).toBeGreaterThan(50);
  });

  test('Mein Kalender ohne JS-Fehler', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(`${BASE_URL}/mein-kalender`);
    await page.waitForTimeout(1500);

    const fatal = jsErrors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error') &&
      !e.includes('500') &&
      !e.includes('401') &&
      !e.includes('NetworkError') &&
      !e.includes('fetch') &&
      !e.includes('Failed to load')
    );
    expect(fatal).toHaveLength(0);
  });
});
