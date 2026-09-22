# alessandrogillies.com

Static personal website for Alessandro Gillies. It uses plain HTML, CSS, and browser JavaScript, with no application framework or runtime backend.

## Local development

```bash
npm ci
npx playwright install chromium firefox webkit
npm run serve
```

The site is available at `http://localhost:8000`.

## Checks

```bash
npm run lint
npm test
```

The full browser suite needs the Playwright browser binaries. On Linux CI, install them with `npx playwright install --with-deps chromium firefox webkit`.

Nobara/Fedora does not provide the older ICU 74 and JPEG 8 ABI libraries bundled WebKit expects. To run WebKit locally without replacing the system ICU or JPEG libraries, install the verified compatibility files into the ignored project cache:

```bash
npm run setup:playwright-webkit
npm test
```

The setup is only needed on hosts with this WebKit dependency mismatch. It does not install packages system-wide or require `sudo`.

## Browser-only state and favicons

The site uses three browser-storage values:

- `theme` stores an explicit light or dark theme choice.
- `mini-skill-persist-v1` stores whether the visitor wants game progress saved.
- `mini-skill-state-v1` stores game progress when saving is on.

These values stay in the visitor's browser and the site does not transmit them. The theme control can forget its saved choice, and the game can disable saving or reset progress.

Raw HTML exposes the stable 96×96 `/favicon.png` for crawlers and browsers without JavaScript. JavaScript adds a separate theme-sensitive, page-specific SVG favicon at runtime.

## Deployment

The repository root is the Cloudflare Pages publish directory and has no build step. `_headers` contains the production HTTP security headers; Cloudflare Pages parses that file during deployment.

`npm run lint` checks the required security-header directives in `_headers` as repository content. Check the deployed site separately with:

```bash
npm run check:production
```

The dependency-free production check verifies the canonical homepage, HTTP and `www` redirects, security headers on 200 and 404 responses, the custom noindex 404, robots and sitemap contents, and the static PNG favicon. It defaults to `https://alessandrogillies.com`; `SITE_ORIGIN` can override the origin for a controlled check.

If the HTTP-to-HTTPS check fails, enable [Cloudflare Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/) for the zone. Do not add an origin or Pages redirect as a substitute.

If the `www` check fails, configure an enabled [Cloudflare Bulk Redirect](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/create-dashboard/) with:

- source `www.alessandrogillies.com`;
- target `https://alessandrogillies.com`;
- status `301`;
- preserve query string on;
- subpath matching on;
- preserve path suffix on.

`www` must also exist as a proxied Cloudflare DNS hostname so requests reach the redirect rule. Do not commit API tokens or other secrets. Re-run `npm run check:production`; its live result is the source of truth for whether either external setting needs attention.

Search Console domain ownership and verification are managed outside this repository, and `https://alessandrogillies.com/sitemap.xml` is already submitted there. Do not commit Google verification tokens. After deploying a favicon change, use URL Inspection for `https://alessandrogillies.com/` and request indexing once; do not resubmit the sitemap.
