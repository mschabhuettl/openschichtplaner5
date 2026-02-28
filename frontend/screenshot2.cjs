const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // Set dev mode session directly
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  // Click dev mode button
  const devBtn = await page.$('button:has-text("Dev")');
  if (devBtn) {
    await devBtn.click();
  } else {
    // Set localStorage directly
    await page.evaluate(() => {
      localStorage.setItem('sp5_session', JSON.stringify({ devMode: true, token: null }));
    });
    await page.reload();
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/home/claw/.openclaw/workspace/openschichtplaner5/docs/screenshots/dashboard-performance.png' });
  console.log('dashboard done');

  await page.goto('http://localhost:5173/schedule');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/home/claw/.openclaw/workspace/openschichtplaner5/docs/screenshots/schedule-performance.png' });
  console.log('schedule done');

  await page.goto('http://localhost:5173/employees');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/home/claw/.openclaw/workspace/openschichtplaner5/docs/screenshots/employees-performance.png' });
  console.log('employees done');

  await browser.close();
})();
