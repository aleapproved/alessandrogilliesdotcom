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

## Deployment

The repository root is the Cloudflare Pages publish directory and has no build step. `_headers` contains the production HTTP security headers; Cloudflare Pages parses that file during deployment.
