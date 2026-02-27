import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADMIN_SESSION = path.join(__dirname, '.auth/admin.json');

const EMPTY_STATE_PAGES = [
  { path: '/tauschboerse', name: 'Tauschboerse' },
  { path: '/uebergabe', name: 'Uebergabe' },
  { path: '/protokoll', name: 'Protokoll' },
  { path: '/schichtwuensche', name: 'Schichtwuensche' },
];

const screenshotDir = path.join(__dirname, 'screenshots');

test.describe('Empty States', () => {
  test.use({ storageState: ADMIN_SESSION });

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  for (const pg of EMPTY_STATE_PAGES) {
    test(`${pg.name}: Seite lädt und zeigt freundlichen Zustand`, async ({ page }) => {
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: path.join(screenshotDir, `${pg.name}.png`),
        fullPage: true,
      });

      const body = await page.textContent('body');
      expect(body).toBeTruthy();
      expect(body!.length).toBeGreaterThan(50);
      expect(body).not.toContain('Cannot GET');
    });
  }
});
