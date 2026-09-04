import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STALE_PATTERNS = [
  /\/\*\s*new\b/i,
  /\/\/\s*new\b/i,
  /\*\s+new\b/i,
  /\/\*\s*recently\b/i,
  /\/\/\s*recently\b/i,
  /\/\*\s*updated\b/i,
  /\/\/\s*updated\b/i,
  /\/\*\s*just added\b/i,
  /\/\/\s*just added\b/i,
];
const SCAN_GLOBS = [
  '*.css', '*.js', '*.mjs', '*.html',
  '*/*.css', '*/*.js', '*/*.mjs', '*/*.html',
];
const IGNORE_DIRS = ['node_modules', 'playwright-report', 'test-results', '.git', 'tests'];

const paths = new Set();
for (const pattern of SCAN_GLOBS) {
  for await (const relPath of glob(pattern, { cwd: ROOT })) {
    if (IGNORE_DIRS.some(dir => relPath.startsWith(`${dir}/`) || relPath === dir)) continue;
    paths.add(relPath);
  }
}

const offenders = [];
for (const relPath of paths) {
  const content = await readFile(`${ROOT}${relPath}`, 'utf8');
  content.split('\n').forEach((line, index) => {
    if (STALE_PATTERNS.some(pattern => pattern.test(line))) {
      offenders.push(`${relPath}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (offenders.length > 0) {
  console.error('Time-relative comment markers found:\n' + offenders.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${paths.size} source files for stale comment markers.`);
}
