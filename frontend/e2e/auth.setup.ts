/**
 * Global auth setup: creates session files for each role via localStorage injection.
 * Uses dev-mode session injection to avoid API rate limits and backend dependency.
 * Produces storageState files that other tests consume via `test.use({ storageState })`.
 *
 * Role profiles are defined in helpers.ts (admin / planer / leser).
 */
import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loginViaStorage } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ADMIN_SESSION  = path.join(__dirname, '.auth', 'admin.json');
export const LESER_SESSION  = path.join(__dirname, '.auth', 'leser.json');
export const PLANER_SESSION = path.join(__dirname, '.auth', 'planer.json');

setup('Setup: Admin session', async ({ page }) => {
  await loginViaStorage(page, 'admin');
  await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
  await page.context().storageState({ path: ADMIN_SESSION });
});

setup('Setup: Leser session', async ({ page }) => {
  await loginViaStorage(page, 'leser');
  // Leser might not see 'Dashboard' text — just check page is loaded (no login form)
  await expect(page.locator('input[autocomplete="username"]')).toHaveCount(0, { timeout: 10000 });
  await page.context().storageState({ path: LESER_SESSION });
});

setup('Setup: Planer session', async ({ page }) => {
  await loginViaStorage(page, 'planer');
  await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
  await page.context().storageState({ path: PLANER_SESSION });
});
