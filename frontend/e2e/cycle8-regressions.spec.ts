/**
 * Cycle 8 regression suite — runs a REAL login (no dev-mode storageState bypass)
 * against a running production-mode stack over the configured origin, and exercises
 * exactly the six flows the maintainer reported broken. Each test is designed to go
 * RED if its fix is reverted:
 *
 *   1. Login persists the session                → reverting the Secure-cookie fix
 *      (cookie always Secure) drops the cookie over plain HTTP on a non-localhost
 *      origin, so /api/auth/me 401s and the app bounces to the login form.
 *   2/5/6. Reschedule / wish / new employee write→ reverting the write handling
 *      surfaces failures as opaque 500s (here on a writable stack they succeed).
 *   3. Sidebar header icons do not overflow      → reverting the flex-wrap fix lets
 *      the emoji toolbar protrude past the sidebar edge.
 *   4. Dark-mode toggle knob within the pill      → reverting left-0 lets the knob
 *      resolve to its static position and slide off the pill edge.
 *
 * Set E2E_BASE_URL to a NON-localhost HTTP origin (e.g. http://sp5.local:8000) so
 * the Secure-cookie-over-HTTP transport drop is actually reproduced — that is the
 * blind spot that let cycle 4's "login fixed" claim pass on localhost/dev-mode.
 */
import { test, expect, Page } from '@playwright/test';

const USER = process.env.E2E_USER || 'admin';
const PASS = process.env.E2E_PASS || 'Test1234';

async function realLogin(page: Page) {
  await page.goto('/');
  await page.locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first().fill(USER);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button[type="submit"]').click();
  // The login form must disappear (we are in, not bounced back).
  await expect(page.locator('button[type="submit"]')).toHaveCount(0, { timeout: 10000 });
}

test('1) real login over the configured origin keeps the session (cookie not dropped)', async ({ page }) => {
  await realLogin(page);
  const meStatus = await page.evaluate(async () => {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    return r.status;
  });
  expect(meStatus, '/api/auth/me must be 200 after login (cookie present)').toBe(200);
  const cookie = (await page.context().cookies()).find((c) => c.name === 'sp5_token');
  expect(cookie, 'sp5_token cookie must persist for this origin').toBeTruthy();
});

test('2/5/6) write paths (employee, wish, reschedule) succeed end-to-end', async ({ page }) => {
  await realLogin(page);
  const result = await page.evaluate(async () => {
    const j = (r: Response) => r.json();
    const post = (url: string, body: unknown) =>
      fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    const emps = await fetch('/api/v1/employees', { credentials: 'include' }).then(j).catch(() => []);
    const eid = Array.isArray(emps) && emps.length ? emps[0].ID : null;
    const shifts = await fetch('/api/v1/shifts', { credentials: 'include' }).then(j).catch(() => []);
    const sid = Array.isArray(shifts) && shifts.length ? shifts[0].ID : null;

    const empRes = await post('/api/v1/employees', { NAME: 'E2E', SHORTNAME: 'ZZE2', HRSWEEK: 40 });
    const wishRes = eid ? await post('/api/v1/wishes', { employee_id: eid, date: '2026-07-01', wish_type: 'WUNSCH' }) : { status: 0 };
    const schedRes = (eid && sid) ? await post('/api/v1/schedule', { employee_id: eid, date: '2026-07-02', shift_id: sid }) : { status: 0 };
    // read back the employee
    const after = await fetch('/api/v1/employees', { credentials: 'include' }).then(j).catch(() => []);
    const created = Array.isArray(after) && after.some((e: { SHORTNAME?: string }) => e.SHORTNAME === 'ZZE2');
    return { emp: empRes.status, wish: (wishRes as Response).status, sched: (schedRes as Response).status, created };
  });
  // 200 = created, 409 = already created by a previous run on the same DB. Never 500.
  expect([200, 409], 'create employee must succeed, never 500').toContain(result.emp);
  expect(result.created, 'created employee must be readable back').toBeTruthy();
  expect([200, 409], 'save wish must succeed (or 409 if it already exists)').toContain(result.wish);
  expect([200, 409], 'reschedule must succeed (or 409 conflict), never 500').toContain(result.sched);
});

test('3) sidebar header icons do not overflow the sidebar', async ({ page }) => {
  await realLogin(page);
  // Switch to dark mode (the reported state) — emoji width is what tips it over.
  await page.locator('aside button[title*="Modus"]').last().click().catch(() => {});
  await page.waitForTimeout(400);
  const overflowing = await page.evaluate(() => {
    const aside = document.querySelector('aside[aria-label]');
    if (!aside) return -1;
    const ar = aside.getBoundingClientRect();
    let n = 0;
    aside.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > ar.right + 0.5) n++;
    });
    return n;
  });
  expect(overflowing, 'no descendant may extend past the sidebar right edge').toBe(0);
});

test('4) dark-mode toggle knob stays anchored within the pill', async ({ page }) => {
  await realLogin(page);
  const toggle = page.locator('aside button[title*="Modus"]').last();
  const knob = toggle.locator('span').last();
  // The knob must be anchored at the left edge (left:0) so translate-x stays inside.
  const left = await knob.evaluate((el) => getComputedStyle(el).left);
  expect(left, 'knob must be anchored at left:0, not its static position').toBe('0px');
  // And its box must sit within the toggle box in the "on" (dark) state.
  await toggle.click();
  await page.waitForTimeout(400);
  const within = await toggle.evaluate((btn) => {
    const span = btn.querySelector('span:last-child') as HTMLElement;
    const b = btn.getBoundingClientRect();
    const k = span.getBoundingClientRect();
    return k.left >= b.left - 0.5 && k.right <= b.right + 0.5;
  });
  expect(within, 'knob must remain within the toggle pill in the on state').toBeTruthy();
});
