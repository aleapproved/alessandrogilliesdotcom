import { test, expect } from '@playwright/test';

const STATE_KEY = 'mini-skill-state-v1';

test('game progress saves automatically and restores across reloads', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Storage behaviour is browser-independent');
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await page.goto('/game/');
  await page.evaluate(stateKey => {
    localStorage.removeItem(stateKey);
  }, STATE_KEY);
  await page.reload();

  await expect(page.locator('#save-progress, #reset-progress, .storage-controls')).toHaveCount(0);
  await expect(page.locator('.storage-option, .storage-help, .storage-reset')).toHaveCount(0);
  await page.locator('.node[data-kind="wood"]').dispatchEvent('click');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STATE_KEY);
  expect(saved.wood.xp).toBe(1);

  await page.reload();
  await expect(page.locator('#text-wood')).toHaveText('lvl 1');
  expect(await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width))).toBe(10);
});

test('existing saved progress still loads automatically', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Storage behaviour is browser-independent');
  const savedProgress = JSON.stringify({
    wood: { lvl: 8, xp: 7, next: 26 },
    mine: { lvl: 9, xp: 6, next: 30 },
    fish: { lvl: 10, xp: 5, next: 35 },
  });
  await page.goto('/game/');
  await page.evaluate(({ stateKey, state }) => {
    localStorage.setItem(stateKey, state);
  }, { stateKey: STATE_KEY, state: savedProgress });
  await page.reload();

  for (const [kind, level] of [['wood', 8], ['mine', 9], ['fish', 10]]) {
    await expect(page.locator(`#text-${kind}`)).toHaveText(`lvl ${level}`);
  }
  expect(await page.evaluate(key => localStorage.getItem(key), STATE_KEY)).toBe(savedProgress);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([STATE_KEY]);
});
