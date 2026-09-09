// ─── Paywall ──────────────────────────────────────────────────────────────────
// Single switch for the Stripe paywall, read by BOTH site/index.html (which CTA
// to show) and site/app/index.html (whether to gate the app). It lives here so
// the landing page and the app cannot drift into disagreeing about whether the
// product costs money.
//
// false → the tool is free and open; the landing page advertises the future
//         price and no checkout is reachable.
// true  → restores the original behaviour: landing sells at PRICE_USD via
//         Stripe Checkout, and the app requires a valid token.
//
// Nothing about the Stripe integration was removed to turn this off — the three
// Netlify functions, the token validation and the purchase-gate markup are all
// still in place. Flipping this back to true is the whole re-enable.
const PAYWALL_ENABLED = false;

// The price the product will cost when the paywall goes back on. Shown on the
// landing page in both states, so the "free for now" message stays honest.
const PRICE_USD = 49;

// ─── Color specs ─────────────────────────────────────────────────────────────
const PERF_POT_COLORS = {
  '3,3': 'green',
  '3,2': 'green',
  '2,3': 'green',
  '1,1': 'red',
  '1,3': 'yellow',
  '3,1': 'yellow',
  '1,2': 'red',
};

const RISK_IMPACT_COLORS = {
  '3,3': 'red',
  '3,2': 'red',
  '2,3': 'red',
  '1,3': 'yellow',
};

// ─── Outlier labels ───────────────────────────────────────────────────────────
const PERF_POT_LABELS = {
  'green':  'Star',
  'red':    'Needs Attention',
  'yellow': 'Watch',
};

const RISK_IMPACT_LABELS = {
  'red':    'Retention Risk',
  'yellow': 'Monitor',
  'green':  'High-Value Retained',
};

// ─── Pure functions ───────────────────────────────────────────────────────────

/**
 * Clamp a rating value to [1, 3].
 */
function clampRating(val) {
  return Math.min(3, Math.max(1, val));
}

/**
 * Parse and validate raw CSV rows into employee objects.
 * Returns { employees: [...], errors: [...] }.
 * Pure — no side effects.
 */
function processEmployees(raw) {
  const parsed = [];
  const errors = [];

  raw.forEach((row, i) => {
    const name = (row['Name'] || row['name'] || '').trim();
    if (!name) return;

    const get = key => {
      const raw = row[key] !== undefined ? row[key] : row[key.toLowerCase()];
      if (raw === undefined || raw === null || String(raw).trim() === '') return 2;
      const val = parseInt(raw, 10);
      return (val >= 1 && val <= 3) ? val : null;
    };

    const perf = get('Performance');
    const pot  = get('Potential');
    const risk = get('Risk of Loss');
    const imp  = get('Impact of Loss');

    if (perf === null || pot === null || risk === null || imp === null) {
      errors.push(`Row ${i + 2} (${name}): invalid rating value (must be 1, 2, or 3).`);
      return;
    }

    parsed.push({ name, perf, pot, risk, imp });
  });

  return { employees: parsed, errors };
}

/**
 * Group employees into outlier buckets for one 9-box chart.
 * Returns array of { color, coord, names, label, chart }.
 * Pure — no side effects.
 */
function groupOutliers(emps, xFn, yFn, colorSpec, labelMap, xDim, yDim) {
  const chart = `${xDim} vs. ${yDim}`;
  const groups = {};

  emps.forEach(e => {
    const key = `${xFn(e)},${yFn(e)}`;
    const color = colorSpec[key];
    if (!color) return;
    if (!groups[key]) groups[key] = { color, names: [], coord: key };
    groups[key].names.push(e.name);
  });

  return Object.values(groups).map(g => ({
    ...g,
    label: labelMap[g.color] || g.color,
    chart,
  }));
}

// ─── Export (Node.js / tests) ─────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PAYWALL_ENABLED,
    PRICE_USD,
    PERF_POT_COLORS,
    RISK_IMPACT_COLORS,
    PERF_POT_LABELS,
    RISK_IMPACT_LABELS,
    clampRating,
    processEmployees,
    groupOutliers,
  };
}
