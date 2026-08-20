import { test, expect } from '@playwright/test';

test('game nodes retain a visible keyboard focus indicator', async ({ page }) => {
  await page.goto('/game/');
  const woodNode = page.locator('.node[data-kind="wood"]');
  await woodNode.focus();

  const outlineStyle = await woodNode.evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outlineStyle).not.toBe('none');
});

test('short game viewports remain scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 320 });
  await page.goto('/game/');

  const result = await page.evaluate(() => ({
    overflowY: getComputedStyle(document.documentElement).overflowY,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));

  expect(result.overflowY).not.toBe('hidden');
  expect(result.scrollHeight).toBeGreaterThan(result.clientHeight);
});

test('resizing the game does not reroll critical state', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto('/game/');

  const woodNode = page.locator('.node[data-kind="wood"]');
  await expect(woodNode).not.toHaveClass(/crit/);

  await page.evaluate(() => {
    Math.random = () => 0.01;
  });
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width, height: viewport.height + 80 });

  await expect(woodNode).not.toHaveClass(/crit/);
});

test('theme toggle remains usable when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
  });

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');

  const startedDark = await page.locator('html').getAttribute('data-theme') === 'dark';
  await page.click('#themeToggle');

  const state = await page.locator('#themeToggle').evaluate(el => ({
    pressed: el.getAttribute('aria-pressed'),
    theme: document.documentElement.getAttribute('data-theme'),
  }));
  expect(state.theme === 'dark').toBe(!startedDark);
  expect(state.pressed).toBe(state.theme === 'dark' ? 'true' : 'false');
  expect(pageErrors).toEqual([]);
});
