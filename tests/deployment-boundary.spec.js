import { test, expect } from '@playwright/test';
import { SITE_RUNTIME_FILES } from '../scripts/site-runtime-files.mjs';

const ENGINEERING_PATHS = [
  '/package.json',
  '/package-lock.json',
  '/README.md',
  '/playwright.config.js',
  '/eslint.config.js',
  '/tests/a11y.spec.js',
  '/tests/privacy.spec.js',
  '/scripts/check-production.mjs',
  '/scripts/install-playwright-webkit-compat.sh',
  '/.gitignore',
  '/.nvmrc',
  '/.htmlhintrc',
  '/.stylelintrc.json',
  '/.github/workflows/ci.yml',
  '/.github/workflows/production.yml',
];

const RUNTIME_PATHS = SITE_RUNTIME_FILES.map(relativePath => `/${relativePath}`);

test('dist does not serve repository or deployment files', async ({ request }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Deployment boundary checks run once against the local dist server'
  );

  for (const path of ENGINEERING_PATHS) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test('dist serves every allowlisted runtime file', async ({ request }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Deployment asset checks run once against the local dist server'
  );

  for (const path of RUNTIME_PATHS) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect((await response.body()).length, path).toBeGreaterThan(0);
  }
});
