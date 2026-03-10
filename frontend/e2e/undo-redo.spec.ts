/**
 * undo-redo.spec.ts — E2E tests for Undo/Redo functionality in Schedule
 *
 * Covers:
 * - Undo/Redo toolbar buttons (↩ Undo / ↪ Redo) appear in schedule view
 * - Buttons are disabled when no actions in stack
 * - Keyboard shortcuts Ctrl+Z / Ctrl+Y don't crash on empty stack
 * - Leser role has no undo/redo controls
 *
 * Uses dev-mode session injection (no backend needed for basic UI flows).
 */
import { test, expect } from '@playwright/test';
import { loginViaStorage, BASE_URL } from './helpers.js';

test.describe('Undo/Redo — Rückgängig/Wiederholen', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page, 'admin');
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 8000 });
    await page.goto(`${BASE_URL}/schedule`);
    await page.waitForTimeout(1500);
  });

  test('Undo/Redo Buttons sind im Schedule sichtbar', async ({ page }) => {
    // The toolbar shows "↩ Undo" and "↪ Redo" buttons
    const undoBtn = page.locator('button:has-text("Undo")');
    const redoBtn = page.locator('button:has-text("Redo")');

    await expect(undoBtn).toBeVisible({ timeout: 5000 });
    await expect(redoBtn).toBeVisible({ timeout: 5000 });
  });

  test('Undo/Redo Buttons sind initial deaktiviert', async ({ page }) => {
    const undoBtn = page.locator('button:has-text("Undo")');
    const redoBtn = page.locator('button:has-text("Redo")');

    // Both should be disabled when no actions in stack
    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();
  });

  test('Ctrl+Z auf leerem Stack verursacht keinen Crash', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    // Press Ctrl+Z multiple times — should not crash
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // Page should still be intact
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(200);

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

  test('Ctrl+Y auf leerem Stack verursacht keinen Crash', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);

    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(200);

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

  test('Undo/Redo Buttons bleiben nach Keyboard-Shortcuts deaktiviert', async ({ page }) => {
    // After pressing Ctrl+Z/Y with empty stack, buttons should still be disabled
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    const undoBtn = page.locator('button:has-text("Undo")');
    await expect(undoBtn).toBeDisabled();
  });

  test('Leser sieht Undo/Redo Buttons als deaktiviert', async ({ page }) => {
    await loginViaStorage(page, 'leser');
    await page.goto(`${BASE_URL}/schedule`);
    await page.waitForTimeout(1500);

    // Leser sees the schedule toolbar including Undo/Redo but they should be disabled
    const undoBtn = page.locator('button:has-text("Undo")');
    if (await undoBtn.count() > 0) {
      await expect(undoBtn).toBeDisabled();
    }
    // Verify page doesn't crash for leser
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(100);
  });
});
