import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const headersPath = fileURLToPath(new URL('../_headers', import.meta.url));
const source = await readFile(headersPath, 'utf8');
const lines = source.split(/\r?\n/);
const failures = [];

if (lines[0]?.trim() !== '/*') {
  failures.push('_headers must apply its security headers to the /* path');
}

const headers = new Map();
for (const line of lines) {
  const match = line.match(/^\s+([A-Za-z0-9-]+):\s*(.*)$/);
  if (match) headers.set(match[1].toLowerCase(), match[2].trim());
}

function requireHeader(name) {
  const value = headers.get(name.toLowerCase());
  if (!value) failures.push(`${name} is missing from _headers`);
  return value;
}

function expectHeader(name, expected) {
  const value = requireHeader(name);
  if (value && value !== expected) failures.push(`${name} must be ${expected}; found ${value}`);
  return value;
}

const csp = requireHeader('Content-Security-Policy');
const requiredCspDirectives = [
  "default-src 'self'",
  "img-src 'self' data:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
];
if (csp) {
  const directives = new Set(csp.split(';').map(directive => directive.trim()).filter(Boolean));
  for (const directive of requiredCspDirectives) {
    if (!directives.has(directive)) failures.push(`Content-Security-Policy is missing ${directive}`);
  }
}

expectHeader('Strict-Transport-Security', 'max-age=31536000');
expectHeader('X-Frame-Options', 'DENY');
expectHeader('X-Content-Type-Options', 'nosniff');
expectHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
const permissions = requireHeader('Permissions-Policy');
if (permissions) {
  const directives = new Set(permissions.split(',').map(directive => directive.trim()).filter(Boolean));
  for (const directive of ['camera=()', 'geolocation=()', 'microphone=()']) {
    if (!directives.has(directive)) failures.push(`Permissions-Policy is missing ${directive}`);
  }
}

if (failures.length > 0) {
  console.error('Security-header source checks failed:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Validated repository security-header intent in _headers; deployed delivery is not tested here.');
}
