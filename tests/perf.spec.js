import { test, expect } from '@playwright/test';

const PAGES = ['/', '/cv/', '/contact/', '/malaphors/', '/game/'];

// These local-only budgets catch regressions such as a heavy script or extra
// stylesheet. They are not a real-world production performance audit.
const LOCALHOST_DOM_CONTENT_LOADED_MS = 200;
const LOCALHOST_LOAD_EVENT_MS = 500;

for (const path of PAGES) {
  test(`${path} stays within the localhost page-load regression budget`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'Performance budget enforced once on chromium-desktop'
    );

    await page.goto(path);
    await page.waitForLoadState('load');

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        loadEvent: nav.loadEventEnd - nav.startTime,
      };
    });

    expect(timing.domContentLoaded, `domContentLoaded on ${path}`).toBeLessThan(LOCALHOST_DOM_CONTENT_LOADED_MS);
    expect(timing.loadEvent, `loadEvent on ${path}`).toBeLessThan(LOCALHOST_LOAD_EVENT_MS);
  });
}
