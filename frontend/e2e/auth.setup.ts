/**
 * Global auth setup: logs in once and saves storageState for admin and leser.
 * Run before all tests via playwright.config.ts setup project.
 */
import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ADMIN_SESSION = path.join(__dirname, '.auth', 'admin.json');
export const LESER_SESSION = path.join(__dirname, '.auth', 'leser.json');
export const PLANER_SESSION = path.join(__dirname, '.auth', 'planer.json');

const BASE_URL = 'http://localhost:5173';
const SESSION_KEY = 'sp5_session';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createSession(role: string, userObj: object, token: string, devMode: boolean) {
  return { token, user: userObj, devMode };
}

setup('Setup: Admin session', async ({ page }) => {
  // Get real token from API
  const resp = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: 'admin', password: 'Test1234' }
  });
  const data = await resp.json();
  
  await page.goto(BASE_URL);
  const session = { token: data.token, user: data.user, devMode: false };
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SESSION_KEY, value: session });
  await page.reload();
  await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });
  
  // Save storageState
  await page.context().storageState({ path: ADMIN_SESSION });
});

setup('Setup: Leser session', async ({ page }) => {
  const resp = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: 'leser', password: 'Test1234' }
  });
  const data = await resp.json();
  
  await page.goto(BASE_URL);
  const session = { token: data.token, user: data.user, devMode: false };
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SESSION_KEY, value: session });
  await page.reload();
  await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });
  
  await page.context().storageState({ path: LESER_SESSION });
});

setup('Setup: Planer session', async ({ page }) => {
  const resp = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: 'planer', password: 'Test1234' }
  });
  const data = await resp.json();
  
  await page.goto(BASE_URL);
  const session = { token: data.token, user: data.user, devMode: false };
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SESSION_KEY, value: session });
  await page.reload();
  await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 5000 });
  
  await page.context().storageState({ path: PLANER_SESSION });
});
