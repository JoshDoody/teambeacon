# TeamBeacon

Workforce 9-box analysis. You load a roster of employees, and it plots them on
two 3x3 grids — Performance vs. Potential, and Risk of Loss vs. Impact of Loss —
then surfaces an outlier report of the cells that need attention.

Paid product: the landing page sells access, and the app itself is gated behind
a signed token issued after Stripe checkout.

Live at https://joshdoody-teambeacon.netlify.app

## Layout

```
index.html              Landing / sales page. Starts Stripe checkout.
app/index.html          The actual app — entire UI, DOM logic, rendering (~1000 lines).
lib.js                  Pure business logic, no DOM. Shared by the browser and Jest.
sample.csv              10-employee fixture used by the e2e tests.

netlify/functions/      Serverless functions. Anything touching a secret lives here.
  create-checkout.js      Creates a Stripe Checkout session.
  complete-checkout.js    Verifies the session, mints a signed token, redirects into the app.
  validate-token.js       Verifies a token's HMAC and expiry.

scripts/setup-stripe.js One-time: creates the Stripe product and price.
__tests__/lib.test.js   Jest unit tests for lib.js.
tests/ui.spec.js        Playwright e2e tests.
```

`lib.js` uses a UMD-lite pattern (`if (typeof module !== 'undefined') module.exports = ...`)
so the same file works as a browser global and as a Node `require()` under Jest.

## Setup from a fresh clone

Node 20 (see `.node-version`).

```bash
npm install
npx playwright install chromium
```

That's enough to run the tests. To run the site with working payment functions
you also need the Netlify CLI and the environment variables below:

```bash
npm install -g netlify-cli
netlify login
netlify dev
```

Opening `index.html` directly off the filesystem works for the UI, but any
`/.netlify/functions/*` call will fail — those only exist under `netlify dev`
or in production.

## Commands

```bash
npm test              # everything — Jest, then Playwright
npm run test:unit     # Jest only
npm run test:e2e      # Playwright only
npx playwright test --grep "test name"   # a single e2e test
```

The e2e suite points Playwright at a `file://` URL for `app/index.html`
(Chromium only, headless). There is no dev server in the test path, so tests
never exercise the functions — the purchase gate is bypassed by the tests
rather than driven through Stripe.

## How access works

1. Landing page POSTs to `create-checkout`, which creates a Stripe Checkout
   session and returns its URL.
2. On success Stripe redirects to `complete-checkout?session_id=...`. That
   function retrieves the session, confirms it was paid, and HMAC-signs a token
   with `TOKEN_SIGNING_SECRET`.
3. It then 302s to `/app/?token=...`. The app validates the token via
   `validate-token`, stores it in `localStorage` under `teambeacon_token` with
   an expiry, and strips it from the URL bar so it isn't shared accidentally.
4. On later visits the app reads that stored token and skips the gate. Failed
   or errored payments land back on `/?payment=failed` or `/?payment=error`.

Roster data is separate from access, and is kept in `localStorage` under
`teambeacon_employees` — so it survives closing the tab.

## Environment variables

Set in the Netlify dashboard under Site Settings -> Environment Variables, and
in your shell for `netlify dev`. Never committed.

| Variable | Used by |
|---|---|
| `STRIPE_SECRET_KEY` | all three functions, and `scripts/setup-stripe.js` |
| `STRIPE_PRICE_ID` | `create-checkout` |
| `TOKEN_SIGNING_SECRET` | `complete-checkout`, `validate-token` |
| `SITE_URL` | `create-checkout`, `complete-checkout` (redirect targets) |

## Deploy

No CI/CD and no build step — the repo root is served directly
(`publish = "."` in `netlify.toml`).

```bash
netlify deploy --dir=. --prod
```

`netlify.toml` also redirects `/app` to `/app/` so the trailing-slash form
serves `app/index.html`.

## Conventions

Standard no-build static app: HTML/JS/CSS served as-is, Tailwind and PapaParse
via CDN `<script>` tags, no bundler, Node used only for test tooling. The
generic version of this setup is kept outside the repo so it can be applied to
new projects; this README describes only how TeamBeacon itself is put together.
