import { test, expect } from '@playwright/test';

const STATE_KEY = 'mini-skill-state-v1';
const PREFERENCE_KEY = 'mini-skill-persist-v1';

function chromiumOnly(testInfo) {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Storage behaviour is browser-independent');
}

async function loadFreshGame(page) {
  await page.goto('/game/');
  await page.evaluate(({ stateKey, preferenceKey }) => {
    localStorage.removeItem(stateKey);
    localStorage.removeItem(preferenceKey);
  }, { stateKey: STATE_KEY, preferenceKey: PREFERENCE_KEY });
  await page.reload();
}

test('saving is on by default and restores progress', async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await loadFreshGame(page);

  await expect(page.locator('#save-progress')).toBeChecked();
  await page.locator('.node[data-kind="wood"]').dispatchEvent('click');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STATE_KEY);
  expect(saved.wood.xp).toBe(1);

  await page.reload();
  await expect(page.locator('#text-wood')).toHaveText('lvl 1');
  await expect(page.locator('#bar-wood')).toHaveCSS('width', /.+/);
  expect(await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width))).toBe(10);
});

test('turning saving off removes state and prevents later state access', async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  await page.addInitScript(({ stateKey }) => {
    Math.random = () => 0.99;
    window.__gameStorageCalls = [];
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (key, ...args) {
        if (key === stateKey) window.__gameStorageCalls.push({ method, key });
        return original.call(this, key, ...args);
      };
    }
  }, { stateKey: STATE_KEY });
  await loadFreshGame(page);

  await page.locator('.node[data-kind="wood"]').dispatchEvent('click');
  await page.locator('#save-progress').uncheck();
  expect(await page.evaluate(key => localStorage.getItem(key), PREFERENCE_KEY)).toBe('off');
  expect(await page.evaluate(key => localStorage.getItem(key), STATE_KEY)).toBeNull();

  await page.evaluate(() => { window.__gameStorageCalls = []; });
  const before = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width));
  await page.locator('.node[data-kind="wood"]').dispatchEvent('click');
  const after = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width));
  expect(after).toBeGreaterThan(before);
  expect(await page.evaluate(() => window.__gameStorageCalls)).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), STATE_KEY)).toBeNull();

  await page.reload();
  await expect(page.locator('#save-progress')).not.toBeChecked();
  await expect(page.locator('#text-wood')).toHaveText('lvl 1');
  expect(await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width))).toBe(0);
  expect(await page.evaluate(() => window.__gameStorageCalls)).toEqual([]);
});

test('turning saving back on immediately stores current in-memory progress', async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await loadFreshGame(page);

  const wood = page.locator('.node[data-kind="wood"]');
  await wood.dispatchEvent('click');
  await page.locator('#save-progress').uncheck();
  await wood.dispatchEvent('click');
  await page.locator('#save-progress').check();

  expect(await page.evaluate(key => localStorage.getItem(key), PREFERENCE_KEY)).toBe('on');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STATE_KEY);
  expect(saved.wood).toMatchObject({ lvl: 1, xp: 2, next: 10 });

  await page.reload();
  await expect(page.locator('#save-progress')).toBeChecked();
  expect(await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width))).toBe(20);
});

test('reset clears every skill without changing the save preference', async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await loadFreshGame(page);
  await page.evaluate(key => localStorage.setItem(key, 'on'), PREFERENCE_KEY);
  await page.reload();

  for (const kind of ['wood', 'mine', 'fish']) {
    await page.locator(`.node[data-kind="${kind}"]`).dispatchEvent('click');
  }
  expect(await page.evaluate(key => localStorage.getItem(key), STATE_KEY)).not.toBeNull();

  await page.locator('#reset-progress').click();

  for (const kind of ['wood', 'mine', 'fish']) {
    await expect(page.locator(`#text-${kind}`)).toHaveText('lvl 1');
    expect(await page.locator(`#bar-${kind}`).evaluate(el => parseFloat(el.style.width))).toBe(0);
  }
  expect(await page.evaluate(key => localStorage.getItem(key), STATE_KEY)).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), PREFERENCE_KEY)).toBe('on');
  await expect(page.locator('#toast')).toHaveText('progress reset');
  await expect(page.locator('#toast')).toHaveClass(/show/);
});

test('reset removes stale saved state while persistence is off', async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await page.goto('/game/');

  const staleState = JSON.stringify({
    wood: { lvl: 8, xp: 7, next: 26 },
    mine: { lvl: 9, xp: 6, next: 30 },
    fish: { lvl: 10, xp: 5, next: 35 },
  });
  await page.evaluate(({ stateKey, preferenceKey, value }) => {
    localStorage.setItem(preferenceKey, 'off');
    localStorage.setItem(stateKey, value);
  }, { stateKey: STATE_KEY, preferenceKey: PREFERENCE_KEY, value: staleState });
  await page.reload();

  await expect(page.locator('#save-progress')).not.toBeChecked();
  for (const kind of ['wood', 'mine', 'fish']) {
    await expect(page.locator(`#text-${kind}`)).toHaveText('lvl 1');
    for (let interaction = 0; interaction < 11; interaction += 1) {
      await page.locator(`.node[data-kind="${kind}"]`).dispatchEvent('click');
    }
    await expect(page.locator(`#text-${kind}`)).toHaveText('lvl 2');
    expect(await page.locator(`#bar-${kind}`).evaluate(el => parseFloat(el.style.width))).toBeGreaterThan(0);
  }
  expect(await page.evaluate(key => localStorage.getItem(key), STATE_KEY)).toBe(staleState);

  await page.locator('#reset-progress').click();

  expect(await page.evaluate(key => localStorage.getItem(key), STATE_KEY)).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), PREFERENCE_KEY)).toBe('off');
  for (const kind of ['wood', 'mine', 'fish']) {
    await expect(page.locator(`#text-${kind}`)).toHaveText('lvl 1');
    expect(await page.locator(`#bar-${kind}`).evaluate(el => parseFloat(el.style.width))).toBe(0);
  }
  await expect(page.locator('#toast')).toHaveText('progress reset');
});

test('unavailable storage disables saving while gameplay remains usable', async ({ page }, testInfo) => {
  chromiumOnly(testInfo);
  await page.addInitScript(() => {
    Math.random = () => 0.99;
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      Storage.prototype[method] = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
    }
  });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/game/');

  await expect(page.locator('#save-progress')).not.toBeChecked();
  await expect(page.locator('#save-progress')).toBeDisabled();
  const wood = page.locator('.node[data-kind="wood"]');
  const before = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width));
  await wood.dispatchEvent('click');
  const after = await page.locator('#bar-wood').evaluate(el => parseFloat(el.style.width));
  expect(after).toBeGreaterThan(before);
  expect(pageErrors).toEqual([]);
});
