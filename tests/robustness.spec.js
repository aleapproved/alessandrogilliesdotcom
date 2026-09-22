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
  await expect(page.locator('.theme-reset')).toHaveCount(0);
  await expect(page.locator('.theme-status')).toHaveText(
    'Theme changed for this page. Browser storage is unavailable.'
  );
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
  expect(pageErrors).toEqual([]);
});

test('theme initialization still detects OS theme when storage reads throw', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
  });

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#favicon')).toHaveCount(1);
  await expect(page.locator('.theme-reset')).toHaveCount(0);
  await page.click('#themeToggle');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-status')).toHaveText(
    'Theme changed for this page. Browser storage is unavailable.'
  );
  expect(pageErrors).toEqual([]);
});

test('theme notice remains fully visible above content at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.reload();
  await page.click('#themeToggle');

  const layout = await page.evaluate(() => {
    const notice = document.querySelector('.theme-status').getBoundingClientRect();
    const content = document.querySelector('.wrap').getBoundingClientRect();
    return {
      noticeLeft: notice.left,
      noticeRight: notice.right,
      noticeBottom: notice.bottom,
      contentTop: content.top,
      viewportWidth: window.innerWidth,
    };
  });
  expect(layout.noticeLeft).toBeGreaterThanOrEqual(0);
  expect(layout.noticeRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.noticeBottom).toBeLessThanOrEqual(layout.contentTop);
});

test('stored light preference overrides a dark OS theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
});

test('stored dark preference overrides a light OS theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('contact email uses the restrained link movement and reduced-motion rule', async ({ page }) => {
  const email = page.locator('a[href^="mailto:"]');
  await page.goto('/contact/');

  await email.focus();
  const focused = await email.evaluate(el => ({
    outlineStyle: getComputedStyle(el).outlineStyle,
    transitionProperty: getComputedStyle(el).transitionProperty,
  }));
  expect(focused.outlineStyle).not.toBe('none');
  expect(focused.transitionProperty).toContain('transform');

  await email.hover();
  const hoveredTransform = await email.evaluate(el => getComputedStyle(el).transform);
  expect(hoveredTransform).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await email.evaluate(el => getComputedStyle(el).transitionDuration);
  expect(reduced).toBe('0s');
});

test('new storage controls retain visible keyboard focus indicators', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.reload();
  const themeReset = page.locator('.theme-reset');
  await themeReset.focus();
  expect(await themeReset.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');

  await page.goto('/game/');
  for (const selector of ['#save-progress', '#reset-progress']) {
    const control = page.locator(selector);
    await control.focus();
    expect(await control.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  }
});
