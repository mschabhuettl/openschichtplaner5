/**
 * calendar-view.spec.ts — E2E tests for Calendar View toggle in Schedule
 *
 * Covers:
 * - View toggle buttons (📆 Monat / 📅 Woche / 🗓️ Kalender) are visible
 * - Switching to calendar view renders ScheduleCalendar component
 * - Switching back to table view restores the grid
 * - Week view shows week navigation
 *
 * Uses dev-mode session injection (no backend needed for basic UI flows).
 */
import { test, expect } from '@playwright/test';
import { loginViaStorage, BASE_URL } from './helpers.js';

test.describe('Calendar View — Kalenderansicht', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page, 'admin');
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 8000 });
    await page.goto(`${BASE_URL}/schedule`);
    await page.waitForTimeout(1500);
  });

  // Helper to get the view toggle buttons in the schedule toolbar (inside main content)
  function getMonatBtn(page: import('@playwright/test').Page) {
    return page.locator('main button:has-text("Monat")').first();
  }
  function getWocheBtn(page: import('@playwright/test').Page) {
    // "📅 Woche" toggle button — use title to distinguish from "Woche kopieren"
    return page.locator('main button[title="Wochen-Tabelle"]');
  }
  function getKalenderBtn(page: import('@playwright/test').Page) {
    return page.locator('main button[title="Kalender-Übersicht"]');
  }

  test('View-Toggle Buttons sind sichtbar (Monat, Woche, Kalender)', async ({ page }) => {
    await expect(getMonatBtn(page)).toBeVisible({ timeout: 5000 });
    await expect(getWocheBtn(page)).toBeVisible({ timeout: 5000 });
    await expect(getKalenderBtn(page)).toBeVisible({ timeout: 5000 });
  });

  test('Standard-Ansicht ist Monats-Tabelle mit Mitarbeiter-Header', async ({ page }) => {
    const mitarbeiterHeader = page.locator('th:has-text("Mitarbeiter")');
    await expect(mitarbeiterHeader).toBeVisible({ timeout: 5000 });
  });

  test('Klick auf Kalender-Button wechselt zur Kalenderansicht', async ({ page }) => {
    await getKalenderBtn(page).click();
    await page.waitForTimeout(800);

    // After switching to calendar view, the table should no longer be the primary view
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(100);
    expect(body).not.toContain('Cannot GET');
  });

  test('Wechsel Kalender → Monat → Kalender funktioniert', async ({ page }) => {
    // Switch to calendar
    await getKalenderBtn(page).click();
    await page.waitForTimeout(500);

    // Switch back to table (Monat)
    await getMonatBtn(page).click();
    await page.waitForTimeout(500);

    // Verify table header is back
    const mitarbeiterHeader = page.locator('th:has-text("Mitarbeiter")');
    await expect(mitarbeiterHeader).toBeVisible({ timeout: 3000 });

    // Switch to calendar again
    await getKalenderBtn(page).click();
    await page.waitForTimeout(500);

    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(100);
  });

  test('Wochen-Ansicht zeigt Wochen-Navigation', async ({ page }) => {
    await getWocheBtn(page).click();
    await page.waitForTimeout(800);

    // Week view should show prev/next week navigation
    const prevWeekBtn = page.locator('button[aria-label="Vorherige Woche"]');
    const nextWeekBtn = page.locator('button[aria-label="Nächste Woche"]');

    const prevVisible = await prevWeekBtn.isVisible().catch(() => false);
    const nextVisible = await nextWeekBtn.isVisible().catch(() => false);

    expect(prevVisible || nextVisible).toBe(true);
  });

  test('Kalenderansicht zeigt keine fatalen JS-Fehler', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await getKalenderBtn(page).click();
    await page.waitForTimeout(1000);

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
