# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test              # run all tests (Jest unit + Playwright e2e)
npm run test:unit     # Jest only
npm run test:e2e      # Playwright only
npx playwright test --grep "test name"  # run a single e2e test by name
```

**Always run `npm test` after making changes.** Tests must pass before considering any task complete.

## Architecture

Single-page static app — no build step, deployable directly to GitHub Pages.

- **`index.html`** — entire UI, DOM logic, event handlers, and rendering. Loads Tailwind (Play CDN), PapaParse (CDN), and `lib.js`.
- **`lib.js`** — pure business logic only (no DOM). UMD-lite pattern: works as browser globals and as Node.js `require()` for Jest. Exports: `PERF_POT_COLORS`, `RISK_IMPACT_COLORS`, `PERF_POT_LABELS`, `RISK_IMPACT_LABELS`, `clampRating`, `processEmployees`, `groupOutliers`.
- **`sample.csv`** — 10-employee fixture used by Playwright tests.
- **`__tests__/lib.test.js`** — Jest unit tests for all `lib.js` exports (~39 tests).
- **`tests/ui.spec.js`** — Playwright e2e tests against `file://` URL (~45 tests, Chromium only).

## Key Concepts

**Two 9-box grids** — each plots employees on a 3×3 grid (X=1–3, Y=1–3):
- Performance vs. Potential (X=perf, Y=pot)
- Risk of Loss vs. Impact of Loss (X=risk, Y=imp)

**Color specs** (defined in `lib.js`):

| Coord | Perf vs Pot | Risk vs Impact |
|-------|-------------|----------------|
| 3,3   | green       | red            |
| 3,2   | green       | red            |
| 2,3   | green       | red            |
| 1,1   | red         | —              |
| 1,2   | red         | —              |
| 1,3   | yellow      | yellow         |
| 3,1   | yellow      | —              |
| 2,2   | —           | —              |

**`processEmployees(raw)`** — parses CSV rows. `Name` is required; rating columns (`Performance`, `Potential`, `Risk of Loss`, `Impact of Loss`) are optional and default to 2 if missing. Explicit out-of-range values (0, 4, non-numeric) are rejected with an error.

**sessionStorage** — data persists across page reloads within a tab but is isolated per tab/window. Key: `teambeacon_employees`.

**Outlier Report** — shows only red and green cells, split into four sections by chart and color: "🚨 Needs attention — Performance vs. Potential", "🚨 Needs attention — Risk of Loss vs. Impact of Loss", "🔑 Opportunities — Performance vs. Potential", "🔑 Opportunities — Risk of Loss vs. Impact of Loss".

## Input Tabs

- **Google Sheets URL** — fetches published CSV; only works over HTTPS (GitHub Pages), not `file://`
- **Upload CSV** — PapaParse file input
- **Manually Edit** — live-editable table with +/− buttons; supports drag-and-drop of name chips between grid cells to update ratings

## Deployment

Static site hosted on Netlify at **https://joshdoody-teambeacon.netlify.app**.
Run `netlify deploy --dir=. --prod` to deploy. No build step.
GitHub repo: https://github.com/JoshDoody/teambeacon (main branch).
