import { test, expect } from '@playwright/test';

const PAGES = ['/', '/cv/', '/contact/', '/malaphors/', '/game/'];
const LOCAL_ORIGIN = 'http://localhost:8000';

test('normal page loads stay same-origin and create no cookies', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Network and cookie policy is browser-independent');

  for (const path of PAGES) {
    const context = await browser.newContext({ baseURL: LOCAL_ORIGIN });
    try {
      const page = await context.newPage();
      const crossOriginRequests = [];
      page.on('request', request => {
        const url = new URL(request.url());
        if (['http:', 'https:'].includes(url.protocol) && url.origin !== LOCAL_ORIGIN) {
          crossOriginRequests.push(request.url());
        }
      });

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      expect(crossOriginRequests, `${path} made cross-origin requests`).toEqual([]);
      expect(await context.cookies(), `${path} created cookies`).toEqual([]);
    } finally {
      await context.close();
    }
  }
});
