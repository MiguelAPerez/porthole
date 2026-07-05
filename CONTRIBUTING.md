# Contributing

## Testing

### Unit tests

Scanner and tech detection logic:

```bash
npm test
```

### End-to-end tests

Playwright loads the home page from mock data in `tests/e2e/fixtures/` (no real `~/development` scan or `config.json` required). A lightweight test server runs on port 4173:

```bash
npm run test:e2e
```

Install Chromium once before the first e2e run:

```bash
npx playwright install chromium
```

### README screenshot

The image at the top of [README.md](README.md) is **`docs/screenshots/home.png`**, captured by an e2e test against that same mock data. After UI changes, regenerate and commit it:

```bash
npm run test:e2e:screenshot
git add docs/screenshots/home.png
```

That command runs Playwright and saves a cropped screenshot of the dashboard to `docs/screenshots/home.png`. Commit the updated PNG when the dashboard look changes.

Mock project data for both tests and the screenshot: `tests/e2e/fixtures/` (`projects.json`, `activity.json`, `config.json`).

## Project layout

- `public/` — frontend assets (HTML, CSS, JS)
- `lib/` — scanner, tech detection, Locus sync
- `generate-projects.js` — scan projects and write JSON data
- `server.js` — dev server and settings API
- `tests/e2e/` — Playwright tests and mock data for UI screenshots
