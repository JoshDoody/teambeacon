# TeamBeacon MVP Feasibility Assessment

*Generated 2026-03-06*

## Current stack in one sentence
A zero-dependency static HTML/JS app hosted on Netlify free tier, with no backend, no build step, no database, and no server-side logic whatsoever.

---

## 1. Marketing / Landing Page

**Feasibility: Easy.**

Netlify serves static files natively. Add a `landing.html` (or `index.html` at the root with the app moved to `/app/index.html`) and you have a separate marketing page on the same domain. Clean URL routing between `/`, `/checkout-success`, and `/app` is handled via Netlify's redirect rules in a `_redirects` file or `netlify.toml` — no code required. No blockers here.

**Recommendation:** Keep it all in one repo, same Netlify site. Use `netlify.toml` for routing.

---

## 2. Stripe Integration

**Feasibility: Requires adding serverless functions — but Netlify makes this easy.**

What Stripe needs:
- **Checkout session creation** — must happen server-side (your secret key cannot be in client-side JS). Netlify Function, ~30 lines of code.
- **Success/cancel redirects** — Stripe redirects to URLs you specify. Just static pages, no problem.
- **Payment verification** — never trust the client. You must verify on the server, not by checking a URL param.
- **Webhooks** — Stripe POSTs to a URL you control. Netlify Functions handle this fine. You must verify the `stripe-signature` header.

**What Netlify Functions add:** Node.js serverless functions at `/.netlify/functions/[name]`. They run on AWS Lambda under the hood. Free tier includes 125k invocations/month — more than enough for a micro-product.

**Recommendation:** Add `netlify/functions/` directory with two functions: `create-checkout.js` and `stripe-webhook.js`. This is the minimum viable backend.

---

## 3. One-Time Paid Access Flow

**Feasibility: Feasible, with caveats.**

The flow:
1. User clicks Buy → your Netlify Function creates a Stripe Checkout session → redirects to Stripe
2. User pays → Stripe fires a webhook to `stripe-webhook.js`
3. Your webhook handler generates a signed token (JWT or HMAC-signed string), stores it somewhere briefly, and either emails a link or redirects to `/app?token=...`
4. `/app` validates the token client-side (for UX) and optionally server-side (for real security)

**The hard part is token storage.** You need to store "this token is valid" somewhere between when Stripe fires the webhook and when the user hits `/app`. Options:

- **Netlify Blobs** (key-value store, built into Netlify) — easiest with no new services. Beta but stable enough.
- **Upstash Redis** (free tier, 10k req/day) — slightly more robust, 1 minute setup.
- **Supabase** — overkill for this.

**Token expiry:** Set a TTL of 48–72 hours. After that, the token is gone from storage and the app rejects it.

**Preventing unpaid access:** The app page checks for a valid token in the URL or sessionStorage. Without one, it shows a "purchase required" gate. This is soft security — a determined person can bypass client-side gating — but for a micro-product in the $20–$100 range, it's "good enough for MVP."

**Recommendation:** Netlify Blobs for token storage + HMAC-signed tokens with 72hr TTL. Stripe Checkout success URL points to `/app?token=TOKEN`. No email required for MVP.

---

## 4. Session Storage / Temporary Persistence

**Feasibility: Already mostly solved.**

You already use `sessionStorage` well. For a paid product:

- **sessionStorage** — survives page refresh in same tab, dies on tab close. Acceptable for a one-sitting evaluation.
- **localStorage** — survives tab close and browser restart. Better for "I'll finish this tomorrow" use cases.
- **No backend DB needed for MVP** — the work product is the evaluation itself. User exports a CSV when done. Nothing needs to live on a server.

**The only gap:** If a user closes the tab and comes back with the same token, you'd want their work to survive. `localStorage` keyed by token solves this cleanly — store `{token: {...employeeData}}` in localStorage. On load, if the token in the URL matches a localStorage key, restore that session.

**Session expiry:** The token TTL (server-side) gates re-entry. Once the token expires on the server, the user can't start a new session. But their localStorage data stays as long as they don't clear it — this is fine for MVP.

**Recommendation:** Switch from `sessionStorage` to `localStorage` keyed by token. No backend persistence needed for MVP.

---

## 5. Backend Needs

**Current stack has zero backend.** Here's the minimum needed:

| Function | File | Size |
|---|---|---|
| Create Stripe Checkout session | `netlify/functions/create-checkout.js` | ~25 lines |
| Handle Stripe webhook + mint token | `netlify/functions/stripe-webhook.js` | ~50 lines |
| Validate token (optional) | `netlify/functions/validate-token.js` | ~20 lines |

Plus one KV store (Netlify Blobs or Upstash) for token storage.

**That's it.** Three small serverless functions and a KV store. No Express, no database, no containers, no servers.

**Recommendation:** Netlify Functions (already on your host) + Netlify Blobs (already available on your account, no signup required). This is the path of least resistance.

---

## 6. Route Protection / Access Control

**Feasibility: Soft protection is easy; hard protection requires a function.**

**Soft (client-side gate):** On `/app` load, check for `?token=` in URL or in `localStorage`. If missing/expired, show a locked state with a "purchase required" CTA. Easy, but bypassable by opening DevTools.

**Hard (server-side gate):** Use a Netlify Edge Function (runs at CDN, <1ms overhead) that intercepts requests to `/app` and redirects to `/` if no valid token cookie is present. This is genuinely secure.

**For MVP:** Soft protection is fine. Your buyers are customers, not hackers. The friction of bypassing it (inspecting JS, understanding the token flow) exceeds the cost of just buying it. Most successful micro-products launch with soft protection.

**Obvious holes:**
- Token in URL can be shared/copy-pasted. Mitigate by binding token to email or by burning it on first use.
- Client-side token validation can be reversed. Mitigate by validating server-side on the validate-token function call.
- No rate limiting on checkout creation. Mitigate by adding Stripe's built-in fraud protection.

---

## 7. Report Generation

**Feasibility: Already 80% built.**

The "Actionable Insights" section is essentially your report. What it currently does well: structured groupings, color-coded cells, narrative descriptions. What it needs to become a polished paid report:

- Better visual hierarchy / styling (can be done in CSS)
- A "report header" with date, company name (user-entered), evaluation metadata
- Possibly a summary statistics section

**Export formats:**

| Format | Feasibility | Recommendation |
|---|---|---|
| CSV | Already built | Ship as-is |
| JSON | Trivial to add | Add it |
| Print-to-PDF | Already works via browser `window.print()` | Add a print stylesheet |
| True PDF (server-generated) | Requires Puppeteer or paid API | Skip for MVP |

**Recommendation:** Add a print stylesheet (`@media print`) that hides navigation/inputs and renders just the grids + insights cleanly. `Ctrl+P → Save as PDF` is a completely credible export for a $29–$99 product. Don't build server-side PDF generation for MVP.

---

## 8. Export / Download

**Feasibility: Already works client-side, easy to extend.**

You already have CSV export. Adding JSON export is 10 lines. Server-side generation buys you nothing for this use case — all data lives in the browser. Client-side is the right call here.

---

## 9. Email Delivery

**Skip for MVP.** Stripe already sends a payment receipt. The access token can go in the Stripe success redirect URL. You don't need email for the MVP flow.

**If you add it later:** Resend or Postmark, ~$0/month at this scale, and a single Netlify Function to call the API. 2 hours of work.

---

## 10. Analytics / Conversion Tracking

**Feasibility: Easy with one gotcha.**

Use Google Analytics (GA4) — you already have an account, no new service needed. One script tag in the `<head>` of each page. Track:
- Page view on `/` (landing) — automatic
- Click event on "Buy" button — `gtag('event', 'begin_checkout')`
- Page view on `/app` (successful purchase) — automatic
- Click event on export buttons — `gtag('event', 'export', { type: 'csv' })`

**The gotcha:** Stripe redirects to your success URL, breaking referrer tracking and making it hard to attribute the conversion. Solve by passing `?source=stripe_success` in your Stripe success URL and firing a conversion event on page load when that param is present:

```js
if (new URLSearchParams(location.search).get('source') === 'stripe_success') {
  gtag('event', 'purchase');
}
```

This is standard practice and works cleanly with GA4's conversion tracking.

---

## 11. Admin / Operations

**Stripe covers 80% of this.** Stripe Dashboard gives you purchase history, revenue, refunds, and customer info with no extra work. For errors: Netlify Function logs are visible in the Netlify dashboard. `console.log` in your functions is enough for MVP.

**Don't build an admin panel for MVP.**

---

## 12. Hosting / Deployment

**Current Netlify setup handles everything except one gotcha.**

| Need | Status |
|---|---|
| Static site hosting | ✅ Already working |
| Serverless functions | ✅ Netlify Functions, just add the directory |
| Environment variables | ✅ Set in Netlify dashboard, not in code |
| Stripe webhook endpoint | ✅ Netlify Function URL works as webhook target |
| Custom domain + HTTPS | ✅ Free on Netlify |

**The one issue:** Preview deploys. Netlify creates preview URLs for every git push. Stripe webhooks must be configured to point to your production URL only. Use Stripe's CLI locally for webhook testing during development.

**Environment variables:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TOKEN_SIGNING_SECRET` go in Netlify's environment variable settings. Never in code.

---

## 13. Security

**What matters for MVP:**

| Concern | Severity | Mitigation |
|---|---|---|
| Stripe secret key exposure | Critical | Netlify env vars, never client-side |
| Webhook verification | Critical | Always verify `stripe-signature` header |
| Token signing | High | HMAC-SHA256 with a strong secret |
| Token leakage (shared URL) | Low-Medium | Acceptable for MVP. Bind to email later if needed. |
| Client-side gate bypass | Low | Acceptable for MVP at this price point |

**Overkill for MVP:** CSP headers, rate limiting, token rotation, audit logs, SOC2.

---

## 14. Architecture Recommendation

```
netlify.toml                    — routing rules + env config
index.html                      — landing/sales page
app/index.html                  — the existing app (gated)
app/lib.js                      — unchanged
netlify/functions/
  create-checkout.js            — creates Stripe Checkout session
  stripe-webhook.js             — handles payment_intent.succeeded, mints token
  validate-token.js             — validates token against Blobs store
```

**Flow:**
1. User hits `/` → reads sales page
2. Clicks Buy → JS calls `/.netlify/functions/create-checkout` → gets Stripe URL → redirects
3. Stripe payment → webhook fires → token minted → stored in Netlify Blobs with 72hr TTL
4. Stripe redirects user to `/app?token=TOKEN`
5. App loads, reads token from URL, validates against Blobs, stores in localStorage keyed by token
6. User does their evaluation, exports CSV/PDF, done
7. Token expires after 72 hours; localStorage data remains until cleared

---

## 15. Build Plan

### What stays as-is
- All of `lib.js` — pure logic, no changes needed
- All grid/report rendering in the app
- CSV export
- Netlify hosting setup
- The entire test suite

### What needs refactoring
- `index.html` gets split: marketing content → new root `index.html`, app → `app/index.html`
- `sessionStorage` → `localStorage` keyed by token
- Add token-gating logic to app load (show locked state if no valid token)

### New pieces — Must-have for MVP
1. `netlify/functions/create-checkout.js`
2. `netlify/functions/stripe-webhook.js`
3. `netlify/functions/validate-token.js`
4. Landing page with sales copy, pricing, Buy button
5. `/checkout-success` interstitial page
6. Token gating in `app/index.html`
7. Print stylesheet for PDF export via browser
8. `netlify.toml` with routing + env var config

### New pieces — Nice-to-have later
- Email delivery via Resend (access links, receipts)
- JSON export
- Token bound to email (prevents link sharing)
- Edge Function for hard server-side route protection

### Avoid for now
- User accounts / auth system
- Database (Postgres, etc.)
- Server-side PDF generation
- Custom admin panel
- Framework migration (React, Next.js, etc.) — the static approach is a feature

### Implementation order
1. Split `index.html` into landing + app
2. Add Netlify Functions (create-checkout + webhook)
3. Wire up Netlify Blobs for token storage
4. Add token gating to app
5. Add print stylesheet
6. Test full purchase flow end-to-end with Stripe test mode
7. Flip to Stripe live mode + deploy

---

## 16. Feasibility Verdict

**Yes, fully feasible. This is a good stack for this product.**

The gap between "prototype" and "shippable paid product" is:
- ~3 serverless functions (~100 lines of Node.js total)
- 1 KV store (Netlify Blobs, no signup)
- 1 landing page (HTML/CSS)
- Token gating logic (~30 lines in the app)
- A print stylesheet (~20 lines of CSS)

**Estimated time:** 2–3 focused days to a working paid flow in Stripe test mode, plus a day of polish before going live.

The static-first approach is an advantage: low hosting costs, fast load times, no server to maintain, and the entire evaluation happens client-side — meaning no employee data ever leaves the browser. That's a legitimate selling point.

**Main caveats:**
1. Netlify Blobs is relatively new — if it gives trouble, swap to Upstash Redis (same concept, more battle-tested, still free at this scale)
2. The client-side token gate is soft security — acceptable for MVP, plan to harden with an Edge Function post-launch
3. Don't add user accounts or long-term persistence for MVP — it doubles scope and adds zero value at launch
