import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_RUNTIME_FILES } from './site-runtime-files.mjs';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const DIST_ROOT = join(PROJECT_ROOT, 'dist');
const PROHIBITED_PATHS = [
  'package.json',
  'package-lock.json',
  'README.md',
  'playwright.config.js',
  'eslint.config.js',
  '.gitignore',
  '.nvmrc',
  '.htmlhintrc',
  '.stylelintrc.json',
  '.github/workflows/ci.yml',
  '.github/workflows/production.yml',
  'tests/a11y.spec.js',
  'tests/privacy.spec.js',
  'scripts/check-production.mjs',
  'scripts/install-playwright-webkit-compat.sh',
];

async function collectFiles(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(`unexpected non-file in dist: ${relativePath}`);
    }
  }

  return files;
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter(value => !rightSet.has(value));
}

async function checkDist() {
  const distStat = await stat(DIST_ROOT);
  if (!distStat.isDirectory()) throw new Error('dist is not a directory');

  const actualFiles = await collectFiles(DIST_ROOT);
  const missing = difference(SITE_RUNTIME_FILES, actualFiles);
  const unexpected = difference(actualFiles, SITE_RUNTIME_FILES);
  const prohibited = PROHIBITED_PATHS.filter(path => actualFiles.includes(path));

  if (missing.length > 0) throw new Error(`missing runtime files: ${missing.join(', ')}`);
  if (unexpected.length > 0) throw new Error(`unexpected files: ${unexpected.join(', ')}`);
  if (prohibited.length > 0) throw new Error(`prohibited files present: ${prohibited.join(', ')}`);

  console.log(`PASS dist contains exactly ${SITE_RUNTIME_FILES.length} allowlisted runtime files.`);
}

try {
  await checkDist();
} catch (error) {
  console.error(`FAIL check-dist: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
