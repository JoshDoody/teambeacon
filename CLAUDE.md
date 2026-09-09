# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**`@playwright/test` is pinned to an exact `1.62.1` — do not restore the
caret.** Each Playwright version wants its own browser build, and the browser
cache is shared across every project on this machine. A caret lets `npm install`
drift a repo onto a version whose build nobody installed, and then every e2e
test fails in ~1ms with "Executable doesn't exist" — that signature means
*install the browser*, not *the tests are broken*. daily, teambeacon and
leadership are pinned to the same version on purpose, so one
`npx playwright install chromium` serves all three; bumping one means bumping
all three.


```bash
npm test              # run all tests (Jest unit + Playwright e2e)
npm run test:unit     # Jest only
npm run test:e2e      # Playwright only
npx playwright test --grep "test name"  # run a single e2e test by name
```

**Always run `npm test` after making changes.** Tests must pass before considering any task complete.

## Architecture

Static app, no build step. A paid product: the landing page sells access and the
app itself is gated behind a token minted after Stripe checkout.

**`site/` is the entire web root and the only published directory.** Everything
else in the repo is private by construction — see "What is public" in README.md.
If you add a file the browser needs, it must go in `site/`.

- **`site/index.html`** — landing / sales page. Starts Stripe checkout.
- **`site/app/index.html`** — the app itself: all UI, DOM logic, event handlers, rendering. Loads Tailwind (Play CDN), PapaParse (CDN), and `../lib.js`.
- **`site/lib.js`** — pure business logic only (no DOM). UMD-lite pattern: works as browser globals and as Node.js `require()` for Jest. Exports: `PERF_POT_COLORS`, `RISK_IMPACT_COLORS`, `PERF_POT_LABELS`, `RISK_IMPACT_LABELS`, `clampRating`, `processEmployees`, `groupOutliers`.
- **`netlify/functions/`** — `create-checkout`, `complete-checkout`, `validate-token`. Anything touching a secret lives here, never in frontend JS.
- **`sample.csv`** — 10-employee fixture for the e2e tests. Not served.
- **`__tests__/lib.test.js`** — Jest unit tests for all `lib.js` exports (39 tests).
- **`tests/ui.spec.js`** — Playwright e2e tests against a `file://` URL (62 tests, Chromium only). They bypass the purchase gate by injecting a token; the functions are never exercised.

## Paywall (currently OFF)

`PAYWALL_ENABLED` in `site/lib.js` is the single switch, read by both
`site/index.html` (which CTA to render) and `site/app/index.html` (whether to
gate). It is `false`: the tool is free, `checkAccess()` short-circuits to
`grantAccess()`, and the landing page shows `#cta-free` ("free right now, $49
later") instead of `#cta-paid`.

Nothing was deleted to disable it — the three Netlify functions, token
validation, `#purchase-gate` and `#cta-paid` are all still present. Flipping the
constant to `true` is the entire re-enable. `PRICE_USD` (49) keeps the "will
cost $X later" copy in one place.

When changing this, keep the "Paywall disabled" Playwright tests honest: they
run in a context with **no** token deliberately, because the normal
`injectToken()` beforeEach would hide a gate that came back.

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

**localStorage** — roster data survives closing the tab. Keys: `teambeacon_employees` (roster), `teambeacon_employees_seed` (is-seed-data flag), `teambeacon_reset` (explicit reset → blank slate on reload), `teambeacon_token` (access token + expiry). Note this is localStorage, not sessionStorage.

**Outlier Report** — shows only red and green cells, split into four sections by chart and color: "🚨 Needs attention — Performance vs. Potential", "🚨 Needs attention — Risk of Loss vs. Impact of Loss", "🔑 Opportunities — Performance vs. Potential", "🔑 Opportunities — Risk of Loss vs. Impact of Loss".

## Input Tabs

- **Google Sheets URL** — fetches published CSV; needs HTTPS (the deployed site), so it does not work from `file://`
- **Upload CSV** — PapaParse file input
- **Manually Edit** — live-editable table with +/− buttons; supports drag-and-drop of name chips between grid cells to update ratings

## Deployment

Static site on Netlify at **https://joshdoody-teambeacon.netlify.app**.
GitHub repo: https://github.com/JoshDoody/teambeacon (`main`).

Netlify is connected to the repo, so **pushing to `main` deploys automatically**
— no build command, `publish = "site"`, functions bundled from
`netlify/functions`. A push is a production deploy; there is no staging.

Manual deploy, if ever needed: `netlify deploy --dir=site --prod`.

Stripe is still in **test mode**. Going live means swapping four Netlify env
vars: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `TOKEN_SIGNING_SECRET`, `SITE_URL`.
