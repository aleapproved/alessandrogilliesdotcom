import {
  EXACT_SECURITY_HEADERS,
  REQUIRED_CSP_DIRECTIVES,
  REQUIRED_PERMISSIONS_POLICY_DIRECTIVES,
  findMissingDirectives,
} from './security-policy.mjs';

const DEFAULT_ORIGIN = 'https://alessandrogillies.com';
const TIMEOUT_MS = 10_000;
const NOT_FOUND_PATH = '/__production-check-does-not-exist__/';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const INDEXABLE_PATHS = ['/', '/cv/', '/contact/', '/malaphors/'];

let canonical;
try {
  canonical = new URL(process.env.SITE_ORIGIN || DEFAULT_ORIGIN);
  if (canonical.protocol !== 'https:') throw new Error('SITE_ORIGIN must use HTTPS');
  if (canonical.pathname !== '/' || canonical.search || canonical.hash) {
    throw new Error('SITE_ORIGIN must be an origin without a path, query, or fragment');
  }
  canonical = new URL(canonical.origin);
} catch (error) {
  console.error(`FAIL configuration: ${error.message}`);
  process.exit(1);
}

let failureCount = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(label, operation) {
  try {
    await operation();
    console.log(`PASS ${label}`);
  } catch (error) {
    failureCount += 1;
    console.error(`FAIL ${label}: ${describeError(error)}`);
  }
}

function describeError(error) {
  let current = error;
  while (current) {
    if (current.code === 'ENOTFOUND' || current.code === 'EAI_AGAIN') {
      return `DNS resolution failed (${current.code})`;
    }
    current = current.cause;
  }
  return error instanceof Error ? error.message : String(error);
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: '*/*',
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function canonicalUrl(path) {
  return new URL(path, canonical).href;
}

function redirectTarget(response, sourceUrl) {
  const location = response.headers.get('location');
  assert(location, 'redirect response has no Location header');
  return new URL(location, sourceUrl).href;
}

function assertSecurityHeaders(response) {
  const csp = response.headers.get('content-security-policy');
  assert(csp, 'Content-Security-Policy is missing');
  const missingCsp = findMissingDirectives(csp, REQUIRED_CSP_DIRECTIVES, ';');
  assert(missingCsp.length === 0, `Content-Security-Policy is missing ${missingCsp.join(', ')}`);

  for (const [name, expected] of Object.entries(EXACT_SECURITY_HEADERS)) {
    const actual = response.headers.get(name);
    assert(actual === expected, `${name} must be ${expected}; found ${actual || 'missing'}`);
  }

  const permissions = response.headers.get('permissions-policy');
  assert(permissions, 'Permissions-Policy is missing');
  const missingPermissions = findMissingDirectives(
    permissions,
    REQUIRED_PERMISSIONS_POLICY_DIRECTIVES,
    ','
  );
  assert(
    missingPermissions.length === 0,
    `Permissions-Policy is missing ${missingPermissions.join(', ')}`
  );
}

function hasNoindexMeta(html) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  return metaTags.some(tag =>
    /\bname=["']robots["']/i.test(tag)
    && /\bcontent=["'][^"']*\bnoindex\b[^"']*["']/i.test(tag)
  );
}

function hasStaticFavicon(html) {
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  return linkTags.some(tag =>
    /\brel=["']icon["']/i.test(tag)
    && /\bhref=["']\/favicon\.png["']/i.test(tag)
    && /\btype=["']image\/png["']/i.test(tag)
  );
}

function sitemapLocations(xml) {
  return new Set(
    [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(match => new URL(match[1]).href)
  );
}

await check('canonical HTTPS homepage returns 200 without redirecting', async () => {
  const response = await request(canonicalUrl('/'), { redirect: 'manual' });
  assert(response.status === 200, `expected 200; found ${response.status}`);
});

await check('HTTP redirects to HTTPS apex with path and query preserved', async () => {
  const source = new URL(canonicalUrl('/cv/?production-check=1'));
  source.protocol = 'http:';
  const response = await request(source, { redirect: 'manual' });
  assert([301, 308].includes(response.status), `expected 301 or 308; found ${response.status}`);
  assert(
    redirectTarget(response, source) === canonicalUrl('/cv/?production-check=1'),
    `unexpected destination ${response.headers.get('location')}`
  );
});

await check('www redirects to HTTPS apex with path and query preserved', async () => {
  const source = new URL(canonicalUrl('/cv/?production-check=1'));
  source.hostname = `www.${canonical.hostname}`;
  let response;
  try {
    response = await request(source, { redirect: 'manual' });
  } catch (error) {
    let current = error;
    while (current) {
      if (current.code === 'ENOTFOUND' || current.code === 'EAI_AGAIN') {
        throw new Error(`DNS could not resolve ${source.hostname}`, { cause: error });
      }
      current = current.cause;
    }
    throw error;
  }
  assert([301, 308].includes(response.status), `expected 301 or 308; found ${response.status}`);
  assert(
    redirectTarget(response, source) === canonicalUrl('/cv/?production-check=1'),
    `unexpected destination ${response.headers.get('location')}`
  );
});

await check('security headers are present on the homepage', async () => {
  const response = await request(canonicalUrl('/'), { redirect: 'manual' });
  assertSecurityHeaders(response);
});

await check('security headers are present on a real 404', async () => {
  const response = await request(canonicalUrl(NOT_FOUND_PATH), { redirect: 'manual' });
  assertSecurityHeaders(response);
});

await check('custom 404 returns 404, identifies itself, and is noindex', async () => {
  const response = await request(canonicalUrl(NOT_FOUND_PATH), { redirect: 'manual' });
  const html = await response.text();
  assert(response.status === 404, `expected 404; found ${response.status}`);
  assert(
    /<h1\b[^>]*>\s*404\s*<\/h1>/i.test(html) || html.includes("Alas, this page doesn't exist."),
    'body does not contain the site 404 message'
  );
  assert(hasNoindexMeta(html), 'robots noindex meta directive is missing');
});

await check('robots.txt references the canonical sitemap', async () => {
  const response = await request(canonicalUrl('/robots.txt'), { redirect: 'manual' });
  const body = await response.text();
  assert(response.status === 200, `expected 200; found ${response.status}`);
  assert(/^User-agent:\s*\*\s*$/im.test(body), 'User-agent: * is missing');
  assert(
    body.includes(`Sitemap: ${canonicalUrl('/sitemap.xml')}`),
    'canonical sitemap URL is missing'
  );
});

await check('sitemap lists exactly the four intended public pages', async () => {
  const response = await request(canonicalUrl('/sitemap.xml'), { redirect: 'manual' });
  const xml = await response.text();
  assert(response.status === 200, `expected 200; found ${response.status}`);
  const actual = sitemapLocations(xml);
  const expected = new Set(INDEXABLE_PATHS.map(canonicalUrl));
  const missing = [...expected].filter(url => !actual.has(url));
  const unexpected = [...actual].filter(url => !expected.has(url));
  assert(missing.length === 0, `missing ${missing.join(', ')}`);
  assert(unexpected.length === 0, `unexpected ${unexpected.join(', ')}`);
  assert(!actual.has(canonicalUrl('/game/')), '/game/ must not appear in the sitemap');
});

await check('favicon.png is a non-empty PNG response', async () => {
  const response = await request(canonicalUrl('/favicon.png'), { redirect: 'manual' });
  const body = new Uint8Array(await response.arrayBuffer());
  assert(response.status === 200, `expected 200; found ${response.status}`);
  assert(
    (response.headers.get('content-type') || '').toLowerCase().startsWith('image/png'),
    `expected image/png; found ${response.headers.get('content-type') || 'missing'}`
  );
  assert(body.length > 100, `PNG body is unexpectedly small (${body.length} bytes)`);
  assert(PNG_SIGNATURE.every((byte, index) => body[index] === byte), 'PNG signature is invalid');
});

await check('raw homepage HTML exposes the static favicon', async () => {
  const response = await request(canonicalUrl('/'), { redirect: 'manual' });
  const html = await response.text();
  assert(response.status === 200, `expected 200; found ${response.status}`);
  assert(hasStaticFavicon(html), 'static /favicon.png link is missing');
});

if (failureCount > 0) {
  console.error(`FAIL production smoke completed with ${failureCount} failed check${failureCount === 1 ? '' : 's'}.`);
  process.exitCode = 1;
} else {
  console.log('PASS production smoke completed with no failures.');
}
