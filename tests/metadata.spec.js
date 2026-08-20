import { test, expect } from '@playwright/test';

const INDEXABLE_PAGES = [
  {
    path: '/',
    title: 'Alessandro Gillies — Product Manager',
    description: 'Alessandro Gillies is a product manager who brings together user needs and business goals to create great products.',
  },
  {
    path: '/cv/',
    title: 'Alessandro Gillies — CV',
    description: 'The CV of Alessandro Gillies, a product manager with experience across digital delivery, strategy, policy, and product management.',
  },
  {
    path: '/contact/',
    title: 'Alessandro Gillies — Contact',
    description: 'Contact Alessandro Gillies, a product manager working across user needs, business goals, and digital delivery.',
  },
  {
    path: '/malaphors/',
    title: 'Alessandro Gillies — Malaphors',
    description: 'A collection of malaphors and mixed-up idioms by Alessandro Gillies.',
  },
];

const HIDDEN_PAGES = [
  {
    path: '/game/',
    title: 'Alessandro Gillies — Game',
    description: 'A small interactive skill game by Alessandro Gillies.',
  },
];

const ALL_PAGES = [...INDEXABLE_PAGES, ...HIDDEN_PAGES];

const BASE = 'https://alessandrogillies.com';

for (const { path, title, description } of ALL_PAGES) {
  test(`${path} has all social/SEO metadata`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'Metadata content is identical across browsers; checking once is enough'
    );

    await page.goto(path);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(`${BASE}${path}`);

    // <title>, og:title, and twitter:title must all agree
    const pageTitle = await page.title();
    expect(pageTitle).toBe(title);

    expect(await metaContent(page, 'description')).toBe(description);
    expect(await ogContent(page, 'og:title')).toBe(title);
    expect(await ogContent(page, 'og:description')).toBe(description);
    expect(await ogContent(page, 'og:url')).toBe(`${BASE}${path}`);
    expect(await ogContent(page, 'og:image')).toBe(`${BASE}/social-card.jpg`);
    expect(await ogContent(page, 'og:type')).toBe('website');

    expect(await twitterContent(page, 'twitter:card')).toBe('summary_large_image');
    expect(await twitterContent(page, 'twitter:title')).toBe(title);
    expect(await twitterContent(page, 'twitter:description')).toBe(description);
    expect(await twitterContent(page, 'twitter:image')).toBe(`${BASE}/social-card.jpg`);
  });
}

test('robots.txt exists and references sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('User-agent: *');
  expect(body).toContain(`Sitemap: ${BASE}/sitemap.xml`);
});

test('sitemap.xml exists and lists indexable pages only', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  for (const { path } of INDEXABLE_PAGES) {
    expect(body).toContain(`${BASE}${path}`);
  }
  for (const { path } of HIDDEN_PAGES) {
    expect(body).not.toContain(`${BASE}${path}`);
  }
});

test('indexable pages do not have robots noindex', async ({ page }) => {
  for (const { path } of INDEXABLE_PAGES) {
    await page.goto(path);
    await expect(
      page.locator('meta[name="robots"][content*="noindex"]'),
      `${path} should not have noindex`
    ).toHaveCount(0);
  }
});

test('hidden pages have robots noindex', async ({ page }) => {
  for (const { path } of HIDDEN_PAGES) {
    await page.goto(path);
    await expect(
      page.locator('meta[name="robots"][content*="noindex"]'),
      `${path} should have noindex`
    ).toHaveCount(1);
  }
});

test('home page has JSON-LD Person schema', async ({ page }) => {
  await page.goto('/');
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ld).toBeTruthy();
  const data = JSON.parse(ld);
  expect(data['@type']).toBe('Person');
  expect(data.name).toBe('Alessandro Gillies');
  expect(data.url).toBe(`${BASE}/`);
  expect(data.image).toBe(`${BASE}/social-card.jpg`);
});

async function ogContent(page, property) {
  return await page.locator(`meta[property="${property}"]`).getAttribute('content');
}

async function metaContent(page, name) {
  return await page.locator(`meta[name="${name}"]`).getAttribute('content');
}

async function twitterContent(page, name) {
  return await page.locator(`meta[name="${name}"]`).getAttribute('content');
}
