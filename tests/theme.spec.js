import { test, expect } from '@playwright/test';

const PAGES = ['/', '/cv/', '/contact/', '/malaphors/', '/game/'];

for (const path of PAGES) {
  test(`${path} theme toggle flips and persists across reload`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => localStorage.removeItem('theme'));
    await page.reload();

    const html = page.locator('html');
    const initial = await html.getAttribute('data-theme');
    const startedDark = initial === 'dark';

    await page.click('#themeToggle');
    if (startedDark) await expect(html).not.toHaveAttribute('data-theme', 'dark');
    else await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    if (startedDark) await expect(html).not.toHaveAttribute('data-theme', 'dark');
    else await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.click('#themeToggle');
    await expect(page.locator('.theme-reset, .theme-status')).toHaveCount(0);
  });
}

for (const path of PAGES) {
  for (const source of ['saved', 'device']) {
    test(`${path} shows the dark icon on first paint for ${source} dark mode`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-desktop', 'First-paint icon regression uses Chromium CSS rendering');
      if (source === 'device') await page.emulateMedia({ colorScheme: 'dark' });
      await page.addInitScript(({ saved }) => {
        if (saved) localStorage.setItem('theme', 'dark');
        window.__pendingFrames = [];
        window.requestAnimationFrame = callback => {
          window.__pendingFrames.push(callback);
          return window.__pendingFrames.length;
        };
      }, { saved: source === 'saved' });

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const icon = page.locator('.theme-toggle__icon');
      const firstPaint = await icon.evaluate(el => ({
        content: getComputedStyle(el, '::before').content,
        fontSize: getComputedStyle(el).fontSize,
        pendingFrames: window.__pendingFrames.length,
      }));
      expect(firstPaint.content).toContain('🌕');
      expect(firstPaint.fontSize).toBe('0px');
      expect(firstPaint.pendingFrames).toBeGreaterThan(0);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    });
  }
}

test('no saved preference follows OS theme changes until a choice is saved', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Theme state logic is browser-independent');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await page.click('#themeToggle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-reset, .theme-status')).toHaveCount(0);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('stored preferences override OS theme and the toggle has no status UI', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');

  await page.click('#themeToggle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  await expect(page.locator('.theme-reset, .theme-status')).toHaveCount(0);
});
