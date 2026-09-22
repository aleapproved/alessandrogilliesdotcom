export const REQUIRED_CSP_DIRECTIVES = Object.freeze([
  "default-src 'self'",
  "img-src 'self' data:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
]);

export const EXACT_SECURITY_HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
});

export const REQUIRED_PERMISSIONS_POLICY_DIRECTIVES = Object.freeze([
  'camera=()',
  'geolocation=()',
  'microphone=()',
]);

export function parseDirectives(value, separator) {
  const directives = new Map();
  for (const rawDirective of value.split(separator)) {
    const parts = rawDirective.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) directives.set(parts[0], new Set(parts.slice(1)));
  }
  return directives;
}

export function findMissingDirectives(value, required, separator) {
  const actual = parseDirectives(value, separator);
  return required.filter(directive => {
    const [name, ...expectedValues] = directive.split(/\s+/);
    const actualValues = actual.get(name);
    return !actualValues || expectedValues.some(expected => !actualValues.has(expected));
  });
}
