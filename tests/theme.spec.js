import { test, expect } from '@playwright/test';

const PAGES = ['/', '/cv/', '/contact/', '/malaphors/', '/game/'];

for (const path of PAGES) {
  test(`${path} theme toggle flips dark/light and persists across reload`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => localStorage.removeItem('theme'));
    await page.reload();

    const html = page.locator('html');

    const initial = await html.getAttribute('data-theme');
    const startedDark = initial === 'dark';

    await page.click('#themeToggle');
    if (startedDark) {
      await expect(html).not.toHaveAttribute('data-theme', 'dark');
    } else {
      await expect(html).toHaveAttribute('data-theme', 'dark');
    }

    await page.reload();
    if (startedDark) {
      await expect(html).not.toHaveAttribute('data-theme', 'dark');
    } else {
      await expect(html).toHaveAttribute('data-theme', 'dark');
    }

    await page.click('#themeToggle');
    if (startedDark) {
      await expect(html).toHaveAttribute('data-theme', 'dark');
    } else {
      await expect(html).not.toHaveAttribute('data-theme', 'dark');
    }
  });
}

test('no saved preference follows a dark operating-system theme', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Theme state logic is browser-independent');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-reset')).toHaveCount(0);
});

test('no saved preference follows a light operating-system theme', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Theme state logic is browser-independent');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.reload();

  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-reset')).toHaveCount(0);
});

test('manual theme choice is stored, explained, and restored on reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Theme state logic is browser-independent');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.reload();

  await page.click('#themeToggle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  await expect(page.locator('.theme-reset')).toHaveText('forget saved theme');
  await expect(page.locator('.theme-reset')).toHaveAttribute(
    'title',
    'Forget the saved theme and follow your device colour scheme'
  );
  await expect(page.locator('.theme-status')).toHaveText(
    'Theme saved in this browser. “Forget saved theme” removes the preference and follows your device setting.'
  );
  await expect(page.locator('.theme-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('.theme-status')).toHaveAttribute('aria-live', 'polite');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-reset')).toBeVisible();
});

test('forgetting a saved theme immediately returns to the device theme', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Theme state logic is browser-independent');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.click('.theme-reset');

  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
  await expect(page.locator('.theme-reset')).toHaveCount(0);
  await expect(page.locator('.theme-status')).toHaveText(
    'Theme preference cleared. Following your device setting.'
  );
});

test('device theme changes update live only without a saved preference', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Theme state logic is browser-independent');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.reload();

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');

  await page.click('#themeToggle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
