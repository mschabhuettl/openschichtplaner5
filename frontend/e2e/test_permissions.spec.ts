import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
const LESER_SESSION = path.join(__dirname, '.auth/leser.json');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PLANER_SESSION = path.join(__dirname, '.auth/planer.json');
const ADMIN_SESSION = path.join(__dirname, '.auth/admin.json');

test.describe('Leser-Berechtigungen', () => {
  test.use({ storageState: LESER_SESSION });

  test('Leser ist eingeloggt und sieht Dashboard', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(100);
    // Login-Form sollte NICHT sichtbar sein
    const loginForm = await page.locator('input[autocomplete="username"]').count();
    expect(loginForm).toBe(0);
  });

  test('Leser sieht keine Bearbeiten-Buttons in Personaltabelle', async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.waitForTimeout(1500);
    const editButtons = page.locator('button:has-text("Bearbeiten")');
    await expect(editButtons).toHaveCount(0);
  });

  test('Leser sieht keine Ausblenden/Löschen-Buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.waitForTimeout(1500);
    const deleteButtons = page.locator('button:has-text("Ausblenden"), button:has-text("Löschen")');
    await expect(deleteButtons).toHaveCount(0);
  });

  test('Leser sieht keine Bearbeiten-/Edit-Buttons für Mitarbeiter', async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.waitForTimeout(1500);
    // Leser should not see edit buttons (✏️ or "Bearbeiten")
    const editButtons = page.locator('button:has-text("Bearbeiten"), button[title="Bearbeiten"]');
    await expect(editButtons).toHaveCount(0);
  });

  test('Protokoll-Link nicht in Leser-Sidebar', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);
    // Protokoll ist nur für Admin (roles: ['Admin'])
    // In der Sidebar sollte kein Link zu /protokoll sein
    const protokollLink = page.locator('a[href="/protokoll"]');
    await expect(protokollLink).toHaveCount(0);
  });
});

test.describe('Admin-Berechtigungen', () => {
  test.use({ storageState: ADMIN_SESSION });

  test('Admin kann Employees-Seite laden', async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.waitForTimeout(1500);
    // Admin should see the page without errors (employees may be empty in dev-mode)
    const body = await page.textContent('body');
    expect(body).not.toContain('Cannot GET');
    expect(body!.length).toBeGreaterThan(100);
    // Login form must NOT be visible (i.e. still authenticated)
    const loginForm = await page.locator('input[autocomplete="username"]').count();
    expect(loginForm).toBe(0);
  });
});
