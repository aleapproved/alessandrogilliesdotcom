import { test, expect } from '@playwright/test';

const PAGES_WITH_NAV = ['/', '/cv/', '/contact/', '/malaphors/'];

for (const path of PAGES_WITH_NAV) {
  test(`${path} keeps navigation available without JavaScript`, async ({ browser }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'The static fallback is identical across browsers; checking once is enough'
    );

    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(path);

      const nav = page.locator('.noscript-nav');
      await expect(nav).toHaveCount(1);
      await expect(nav.locator('a')).toHaveCount(5);
      await expect(nav.locator('a[href="/cv/"]')).toHaveText('cv');
      await expect(nav.locator('a[href="/game/"]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}

for (const path of PAGES_WITH_NAV) {
  test(`${path} shows floating links and no rail @desktop`, async ({ page }) => {
    await page.goto(path);
    await page.waitForFunction(
      () => document.querySelectorAll('.floatingLink.ready').length > 0
    );
    await expect(page.locator('#linkRail')).toHaveCount(0);
    await expect(page.locator('.floatingLink[href="/game/"]')).toHaveCount(0);
    await expect(page.locator('.floatingLink').first()).toBeVisible();
  });

  test(`${path} collapses to bottom rail with chip styling @mobile`, async ({ page }) => {
    await page.goto(path);
    await page.waitForSelector('#linkRail');
    const chips = page.locator('#linkRail .floatingLink.chip');
    expect(await chips.count()).toBeGreaterThan(0);
    await expect(chips.first()).toBeVisible();
  });
}
