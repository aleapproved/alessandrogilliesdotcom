import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/game/');
  await page.evaluate(() => localStorage.removeItem('mini-skill-state-v1'));
  await page.reload();
});

test('clicking a wood node increases its XP bar', async ({ page }) => {
  const woodNode = page.locator('.node[data-kind="wood"]');
  await expect(woodNode).toBeVisible();

  const before = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width) || 0);
  await woodNode.dispatchEvent('click');
  const after = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width) || 0);

  expect(after).toBeGreaterThan(before);
});

test('resource nodes render flat-shaded icons', async ({ page }) => {
  await expect(page.locator('.node[data-kind="wood"] .node-graphic--wood')).toHaveCount(1);
  await expect(page.locator('.node[data-kind="mine"] .node-graphic--mine')).toHaveCount(1);
  await expect(page.locator('.node[data-kind="fish"] .node-graphic--fish')).toHaveCount(1);
});

test('arena fills the viewport down to the 24px bottom gap', async ({ page }) => {
  await page.waitForLoadState('load');
  const { top, height } = await page.locator('#arena').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { top: r.top, height: r.height };
  });
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  // fitArena() should fill the remaining viewport height with a 24px bottom
  // gap, floored at 140px. Tolerate 2px for sub-pixel rounding differences.
  const expectedHeight = Math.max(140, viewportHeight - 24 - top);
  expect(Math.abs(height - expectedHeight)).toBeLessThanOrEqual(2);
});

test('XP state persists across reload', async ({ page }) => {
  const woodNode = page.locator('.node[data-kind="wood"]');
  await woodNode.dispatchEvent('click');
  const widthBefore = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width) || 0);
  expect(widthBefore).toBeGreaterThan(0);

  await page.reload();
  const widthAfter = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width) || 0);
  expect(widthAfter).toBe(widthBefore);
});

test('wood can build the first camp upgrade and persist it', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.reload();

  const woodNode = page.locator('.node[data-kind="wood"]');
  for (let i = 0; i < 10; i += 1) await woodNode.dispatchEvent('click');

  await expect(page.locator('#wood-count')).toHaveText('10');
  await expect(page.locator('#buildButton')).toBeEnabled();

  await page.locator('#buildButton').click();

  await expect(page.locator('#campScene')).toHaveAttribute('data-wood-stage', '1');
  await expect(page.locator('#camp-title')).toHaveText('the lean-to');
  await expect(page.locator('#wood-count')).toHaveText('0');
  await expect(page.locator('#buildButton')).toContainText('build a small hut');

  await page.reload();
  await expect(page.locator('#campScene')).toHaveAttribute('data-wood-stage', '1');
  await expect(page.locator('#wood-count')).toHaveText('0');
});
