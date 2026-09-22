import { test, expect } from '@playwright/test';

test('crit nodes deliver 5x XP when Math.random is forced low', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.01;
  });

  await page.goto('/game/');
  await page.evaluate(() => {
    localStorage.removeItem('mini-skill-state-v1');
    localStorage.removeItem('mini-skill-persist-v1');
  });
  await page.reload();

  const woodNode = page.locator('.node[data-kind="wood"]');
  await expect(woodNode).toHaveClass(/crit/);

  await woodNode.dispatchEvent('click');

  // Level 1 needs 10 XP. A crit gives 5, so the bar should be ~50%.
  const barWidth = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width) || 0);
  expect(barWidth).toBeGreaterThanOrEqual(40);
});

test('non-crit nodes deliver 1x XP when Math.random is forced high', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });

  await page.goto('/game/');
  await page.evaluate(() => {
    localStorage.removeItem('mini-skill-state-v1');
    localStorage.removeItem('mini-skill-persist-v1');
  });
  await page.reload();

  const woodNode = page.locator('.node[data-kind="wood"]');
  await expect(woodNode).not.toHaveClass(/crit/);

  await woodNode.dispatchEvent('click');

  // Level 1 needs 10 XP. A non-crit gives 1, so the bar should be ~10%.
  const barWidth = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width) || 0);
  expect(barWidth).toBeGreaterThanOrEqual(5);
  expect(barWidth).toBeLessThan(20);
});
