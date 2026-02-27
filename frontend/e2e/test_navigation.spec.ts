import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
const ADMIN_SESSION = path.join(__dirname, '.auth/admin.json');

const ROUTES = [
  '/',
  '/schedule',
  '/wochenansicht',
  '/jahresuebersicht',
  '/einsatzplan',
  '/personaltabelle',
  '/urlaub',
  '/urlaubs-timeline',
  '/schichtwuensche',
  '/tauschboerse',
  '/zeitkonto',
  '/statistiken',
  '/leitwand',
  '/teamkalender',
  '/uebergabe',
  '/protokoll',
  '/auditlog',
];

test.describe('Navigation Tests (als admin)', () => {
  test.use({ storageState: ADMIN_SESSION });

  test('Alle Hauptseiten laden ohne Fehler', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('401') && !text.includes('404') && !text.includes('Failed to load resource')) {
          consoleErrors.push(text);
        }
      }
    });

    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForTimeout(500);
      const body = await page.textContent('body');
      expect(body).not.toContain('Cannot GET');
    }

    expect(consoleErrors.length).toBe(0);
  });

  test('Dashboard zeigt Inhalt nach Login', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(800);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(100);
  });

  test('Sidebar ist sichtbar und zeigt Navigation', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);
    // Sidebar sollte sichtbar sein (nav element oder div mit Links)
    const hasNav = await page.locator('nav, [class*="sidebar"], [class*="Sidebar"]').count();
    expect(hasNav).toBeGreaterThan(0);
  });
});
