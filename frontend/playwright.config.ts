import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ADMIN_SESSION = path.join(__dirname, 'e2e/.auth/admin.json');
export const LESER_SESSION = path.join(__dirname, 'e2e/.auth/leser.json');
export const PLANER_SESSION = path.join(__dirname, 'e2e/.auth/planer.json');

export default defineConfig({
  testDir: './e2e',
  // The cycle-8 regression suite needs a PRODUCTION-mode backend reached over a
  // non-localhost origin (real login + Secure-cookie logic) and runs via its own
  // playwright.cycle8.config.ts. Exclude it here so it is not also run in this
  // dev-mode/localhost config (where its real logins would trip the login limit).
  testIgnore: /cycle8-regressions\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      // cycle8-regressions runs only via playwright.cycle8.config.ts (prod backend,
      // non-localhost origin) — keep it out of this dev-mode/localhost project.
      testIgnore: [/auth\.setup\.ts/, /cycle8-regressions\.spec\.ts/],
    },
  ],
});
