import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
const LESER_SESSION = path.join(__dirname, '.auth/leser.json');
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

  test('Leser sieht kein Hinzufügen-Button für Mitarbeiter', async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.waitForTimeout(1500);
    const addButtons = page.locator('button:has-text("Neuer"), button:has-text("Hinzufügen"), button:has-text("Neu")');
    await expect(addButtons).toHaveCount(0);
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

  test('Admin sieht Bearbeiten-Buttons auf Employees-Seite', async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.waitForTimeout(1500);
    // Admin hat ACCADMWND: true → canAdmin = true
    const editButtons = page.locator('button:has-text("Bearbeiten")');
    const count = await editButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});
