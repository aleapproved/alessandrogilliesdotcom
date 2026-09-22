import { copyFile, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_RUNTIME_FILES } from './site-runtime-files.mjs';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const DIST_ROOT = join(PROJECT_ROOT, 'dist');

async function assertSourcesExist() {
  for (const relativePath of SITE_RUNTIME_FILES) {
    const sourcePath = join(PROJECT_ROOT, relativePath);
    const sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) {
      throw new Error(`allowlisted source is not a file: ${relativePath}`);
    }
  }
}

async function build() {
  const uniqueFiles = new Set(SITE_RUNTIME_FILES);
  if (uniqueFiles.size !== SITE_RUNTIME_FILES.length) {
    throw new Error('runtime allowlist contains duplicate paths');
  }

  await assertSourcesExist();
  await rm(DIST_ROOT, { recursive: true, force: true });
  await mkdir(DIST_ROOT, { recursive: true });

  for (const relativePath of SITE_RUNTIME_FILES) {
    const sourcePath = join(PROJECT_ROOT, relativePath);
    const destinationPath = join(DIST_ROOT, relativePath);
    await mkdir(dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }
}

try {
  await build();
  console.log(`Built dist/ with ${SITE_RUNTIME_FILES.length} allowlisted runtime files.`);
} catch (error) {
  console.error(`FAIL build-site: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
