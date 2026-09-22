import { test, expect } from '@playwright/test';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const HTML_DOCUMENTS = ['/', '/cv/', '/contact/', '/malaphors/', '/game/', '/404.html'];

test('favicon.png is served as a valid PNG', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'HTTP asset response is browser-independent');
  const response = await request.get('/favicon.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
  const body = await response.body();
  expect(body.length).toBeGreaterThan(100);
  expect([...body.subarray(0, PNG_SIGNATURE.length)]).toEqual(PNG_SIGNATURE);
  expect(body.readUInt32BE(16)).toBe(96);
  expect(body.readUInt32BE(20)).toBe(96);
});

test('every raw HTML document exposes the static favicon', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Raw HTML is browser-independent');
  for (const path of HTML_DOCUMENTS) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).toContain(
      '<link rel="icon" href="/favicon.png" type="image/png" sizes="96x96">'
    );
  }
});

test('homepage keeps the static favicon without JavaScript', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Raw HTML is browser-independent');
  const context = await browser.newContext({
    baseURL: 'http://localhost:8000',
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('link[rel="icon"][href="/favicon.png"]')).toHaveCount(1);
    await expect(page.locator('#favicon')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('runtime favicon remains dynamic without rewriting the static link', async ({ page }) => {
  await page.goto('/');
  const staticFavicon = page.locator('link[rel="icon"][href="/favicon.png"]');
  const dynamicFavicon = page.locator('#favicon');

  await expect(staticFavicon).toHaveCount(1);
  await expect(dynamicFavicon).toHaveAttribute('href', /^data:image\/svg\+xml/);
  const before = await dynamicFavicon.getAttribute('href');

  await page.click('#themeToggle');

  await expect(dynamicFavicon).not.toHaveAttribute('href', before);
  await expect(dynamicFavicon).toHaveAttribute('href', /^data:image\/svg\+xml/);
  await expect(staticFavicon).toHaveAttribute('href', '/favicon.png');
});
