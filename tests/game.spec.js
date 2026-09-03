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

test('camp backdrop is a rendered canvas with a graceful fallback', async ({ page }) => {
  const canvas = page.locator('#campCanvas');
  await expect(canvas).toHaveAttribute('data-renderer', /^(webgl|fallback)$/);

  const size = await canvas.evaluate(el => ({ width: el.width, height: el.height }));
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);
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

test('invalid saved skill values are normalised before rendering', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('mini-skill-state-v1', JSON.stringify({
      wood: { lvl: 2.5, xp: -10, next: 1 },
      mine: { lvl: 2, xp: 2.75, next: 1 },
      fish: { lvl: 2, xp: 999999999, next: 1 },
    }));
  });
  await page.reload();

  const values = await page.evaluate(() => ({
    wood: {
      level: document.querySelector('#text-wood').textContent,
      width: document.querySelector('#bar-wood').style.width,
    },
    mine: {
      level: document.querySelector('#text-mine').textContent,
      width: document.querySelector('#bar-mine').style.width,
    },
    fish: {
      level: document.querySelector('#text-fish').textContent,
      width: document.querySelector('#bar-fish').style.width,
    },
  }));

  expect(values.wood).toEqual({ level: 'lvl 1', width: '0%' });
  expect(values.mine).toEqual({ level: 'lvl 2', width: '18%' });
  expect(values.fish).toEqual({ level: 'lvl 2', width: '90%' });
});

test('out-of-range and non-integer saved levels fall back safely', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('mini-skill-state-v1', JSON.stringify({
      wood: { lvl: 0, xp: 10 },
      mine: { lvl: 100, xp: 10 },
      fish: { lvl: '2', xp: 10 },
    }));
  });
  await page.reload();

  await expect(page.locator('#text-wood')).toHaveText('lvl 1');
  await expect(page.locator('#text-mine')).toHaveText('lvl 1');
  await expect(page.locator('#text-fish')).toHaveText('lvl 1');
});

test('saved level 99 progress renders a complete bar', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('mini-skill-state-v1', JSON.stringify({
      wood: { lvl: 99, xp: 999999, next: 1 },
    }));
  });
  await page.reload();

  await expect(page.locator('#text-wood')).toHaveText('lvl 99');
  const width = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width));
  expect(width).toBe(100);
});

test('malformed saved game state falls back without page errors', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('mini-skill-state-v1', '{not-json'));
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.reload();

  await expect(page.locator('#text-wood')).toHaveText('lvl 1');
  await expect(page.locator('#text-mine')).toHaveText('lvl 1');
  await expect(page.locator('#text-fish')).toHaveText('lvl 1');
  expect(pageErrors).toEqual([]);
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
  await expect(page.locator('#campCanvas')).toHaveAttribute('data-stage-rendered', '1');
  await expect(page.locator('#camp-title')).toHaveText('the lean-to');
  await expect(page.locator('#wood-count')).toHaveText('0');
  await expect(page.locator('#buildButton')).toContainText('build a small hut');

  await page.reload();
  await expect(page.locator('#campScene')).toHaveAttribute('data-wood-stage', '1');
  await expect(page.locator('#wood-count')).toHaveText('0');
});

test('saved cabin progress selects the highest camp render', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mini-skill-state-v1', JSON.stringify({
      wood: { lvl: 1, xp: 0, next: 10 },
      mine: { lvl: 1, xp: 0, next: 10 },
      fish: { lvl: 1, xp: 0, next: 10 },
      resources: { wood: 0 },
      camp: { woodStage: 3 }
    }));
  });
  await page.reload();

  await expect(page.locator('#camp-title')).toHaveText('the wooden cabin');
  await expect(page.locator('#campScene')).toHaveAttribute('data-wood-stage', '3');
  await expect(page.locator('#campCanvas')).toHaveAttribute('data-stage-rendered', '3');
});
