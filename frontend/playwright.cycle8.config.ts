import { defineConfig, devices } from '@playwright/test';

/**
 * Dedicated config for the cycle-8 regression suite. Unlike the main config it
 * performs a REAL login (no dev-mode storageState) against a production-mode stack
 * reached over E2E_BASE_URL — set this to a NON-localhost HTTP origin (e.g.
 * http://sp5.local:8000) so the Secure-cookie-over-HTTP drop is reproduced.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /cycle8-regressions\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://sp5.local:8000',
    trace: 'on-first-retry',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // CI installs the bundled chromium; locally PW_CHANNEL=chrome uses the
        // system Google Chrome (the bundled download is unavailable on some hosts).
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      },
    },
  ],
});
