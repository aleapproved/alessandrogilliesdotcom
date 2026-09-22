import { test, expect } from '@playwright/test';

test('home page tab order reaches theme toggle and floating links @desktop', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => document.querySelectorAll('.floatingLink.ready').length > 0
  );

  const toggle = await tabUntil(page, f => f.cls?.includes('theme-toggle'));
  expect(toggle, 'theme toggle should be reachable via Tab').toBeTruthy();

  const link = await tabUntil(page, f => f.cls?.includes('floatingLink'));
  expect(link, 'floating links should be reachable via Tab').toBeTruthy();
});

test('contact page tab order reaches theme toggle and email link @desktop', async ({ page }) => {
  await page.goto('/contact/');
  await page.waitForFunction(
    () => document.querySelectorAll('.floatingLink.ready').length > 0
  );

  const toggle = await tabUntil(page, f => f.cls?.includes('theme-toggle'));
  expect(toggle, 'theme toggle should be reachable via Tab').toBeTruthy();

  const email = await tabUntil(page, f => f.href?.startsWith('mailto:'));
  expect(email, 'email link should be reachable via Tab').toBeTruthy();
});

test('game page tab order reaches arena nodes', async ({ page }) => {
  await page.goto('/game/');
  await page.waitForSelector('.node[data-kind="wood"]');

  const node = await tabUntil(page, f => f.cls?.includes('node'));
  expect(node, 'game nodes should be reachable via Tab').toBeTruthy();
});

test('saved-theme reset control is reachable by keyboard @desktop', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.reload();

  const reset = await tabUntil(page, focused => focused.cls?.includes('theme-reset'));
  expect(reset, 'forget saved theme should be reachable via Tab').toBeTruthy();
});

test('game storage controls are reachable by keyboard', async ({ page }) => {
  await page.goto('/game/');

  const checkbox = await tabUntil(page, focused => focused.id === 'save-progress');
  expect(checkbox, 'save-progress checkbox should be reachable via Tab').toBeTruthy();

  const reset = await tabUntil(page, focused => focused.id === 'reset-progress');
  expect(reset, 'reset-progress button should be reachable via Tab').toBeTruthy();
});

// Press Tab repeatedly until the focused element matches `matcher`, or until
// we've tried `maxAttempts` times (default 30 — far more than any realistic
// page would need). Returns the matched element info on success, or null on
// timeout. Stopping at the match (rather than tabbing a fixed N times) makes
// the test resilient to adding/removing focusable elements elsewhere on the page.
async function tabUntil(page, matcher, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return {
        tag: el.tagName,
        id: el.id,
        cls: el.className?.toString(),
        href: el.href,
      };
    });
    if (info && matcher(info)) return info;
  }
  return null;
}
