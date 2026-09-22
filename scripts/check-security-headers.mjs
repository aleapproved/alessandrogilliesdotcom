import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  EXACT_SECURITY_HEADERS,
  REQUIRED_CSP_DIRECTIVES,
  REQUIRED_PERMISSIONS_POLICY_DIRECTIVES,
  findMissingDirectives,
} from './security-policy.mjs';

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
}

const csp = requireHeader('Content-Security-Policy');
if (csp) {
  for (const directive of findMissingDirectives(csp, REQUIRED_CSP_DIRECTIVES, ';')) {
    failures.push(`Content-Security-Policy is missing ${directive}`);
  }
}

for (const [name, expected] of Object.entries(EXACT_SECURITY_HEADERS)) {
  expectHeader(name, expected);
}

const permissions = requireHeader('Permissions-Policy');
if (permissions) {
  for (const directive of findMissingDirectives(
    permissions,
    REQUIRED_PERMISSIONS_POLICY_DIRECTIVES,
    ','
  )) {
    failures.push(`Permissions-Policy is missing ${directive}`);
  }
}

if (failures.length > 0) {
  console.error('Security-header source checks failed:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Validated repository security-header intent in _headers; deployed delivery is not tested here.');
}
