const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE_URL = 'file://' + path.resolve(__dirname, '..', 'site', 'app', 'index.html');
const LANDING_URL = 'file://' + path.resolve(__dirname, '..', 'site', 'index.html');
const SAMPLE_CSV = path.resolve(__dirname, '..', 'sample.csv');
const SEED_COUNT = 10; // seed employees pre-loaded on every fresh page

// Inject a valid token into localStorage before the page runs, so the token
// gate passes without making a real network call to validate-token.
function injectToken(page) {
  return page.addInitScript(() => {
    localStorage.setItem('teambeacon_token', JSON.stringify({
      token: 'test-token',
      expiresAt: Date.now() + 72 * 60 * 60 * 1000,
    }));
  });
}

test.beforeEach(async ({ page }) => {
  await injectToken(page);
  await page.goto(FILE_URL);
  await page.waitForLoadState('networkidle');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadSampleCSV(page) {
  await page.locator('#tab-csv').click();
  await page.locator('#csv-file').setInputFiles(SAMPLE_CSV);
  await page.locator('#panel-csv button', { hasText: 'Load' }).click();
  // Wait for a CSV-specific employee to confirm data has actually loaded
  // (can't use #results visibility — it's already visible from seed data)
  await expect(page.locator('#grid-perf-pot')).toContainText('Alice Chen', { timeout: 5000 });
}

async function addEmployee(page) {
  await page.locator('#tab-manual').click();
  const initialCount = await page.locator('#edit-rows tr').count();
  await page.locator('#add-employee-btn').click();
  await expect(page.locator('#edit-rows tr')).toHaveCount(initialCount + 1);
}

// Locates a grid cell by its data-coord attribute
function gridCell(page, gridId, coord) {
  return page.locator(`#${gridId} [data-coord="${coord}"]`);
}

// ─── CTA banner ───────────────────────────────────────────────────────────────

test.describe('CTA banner', () => {
  test('visible on fresh load with seed data', async ({ page }) => {
    await expect(page.locator('#cta-banner')).toBeVisible();
  });

  test('hidden after loading CSV', async ({ page }) => {
    await loadSampleCSV(page);
    await expect(page.locator('#cta-banner')).toBeHidden();
  });

  test('visible while manually editing seed data', async ({ page }) => {
    await page.locator('#tab-manual').click();
    await expect(page.locator('#cta-banner')).toBeVisible();
  });

  test('hidden after reset', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.locator('button', { hasText: 'Reset' }).click();
    await expect(page.locator('#cta-banner')).toBeHidden();
  });
});

// ─── Page load ────────────────────────────────────────────────────────────────

test('page has correct title', async ({ page }) => {
  await expect(page).toHaveTitle(/TeamBeacon/);
});

test('results section shows seed data on fresh load', async ({ page }) => {
  await expect(page.locator('#results')).toBeVisible();
});

test('all three input tabs are visible', async ({ page }) => {
  await expect(page.locator('#tab-sheets')).toBeVisible();
  await expect(page.locator('#tab-csv')).toBeVisible();
  await expect(page.locator('#tab-manual')).toBeVisible();
});

// ─── CSV upload ───────────────────────────────────────────────────────────────

test.describe('CSV upload', () => {
  test('loads 10 employees from sample CSV', async ({ page }) => {
    await loadSampleCSV(page);
    await expect(page.locator('#employee-summary')).toContainText('10 employees');
  });

  test('both grids are rendered', async ({ page }) => {
    await loadSampleCSV(page);
    await expect(page.locator('#grid-perf-pot')).toBeVisible();
    await expect(page.locator('#grid-risk-impact')).toBeVisible();
  });

  test('Alice Chen and James Wilson appear in (3,3) Performance vs Potential', async ({ page }) => {
    await loadSampleCSV(page);
    const cell = gridCell(page, 'grid-perf-pot', '3,3');
    await expect(cell).toContainText('Alice Chen');
    await expect(cell).toContainText('James Wilson');
  });

  test('Bob Martinez appears in (1,1) Performance vs Potential', async ({ page }) => {
    await loadSampleCSV(page);
    await expect(gridCell(page, 'grid-perf-pot', '1,1')).toContainText('Bob Martinez');
  });

  test('Carol Kim appears in (1,3) Performance vs Potential', async ({ page }) => {
    await loadSampleCSV(page);
    await expect(gridCell(page, 'grid-perf-pot', '1,3')).toContainText('Carol Kim');
  });

  test('David Patel appears in (3,1) Performance vs Potential', async ({ page }) => {
    await loadSampleCSV(page);
    await expect(gridCell(page, 'grid-perf-pot', '3,1')).toContainText('David Patel');
  });

  test('Emma Johnson and James Wilson appear in (3,3) Risk vs Impact', async ({ page }) => {
    await loadSampleCSV(page);
    const cell = gridCell(page, 'grid-risk-impact', '3,3');
    await expect(cell).toContainText('Emma Johnson');
    await expect(cell).toContainText('James Wilson');
  });

  test('Alice Chen and Grace Lee appear in (2,3) Risk vs Impact', async ({ page }) => {
    await loadSampleCSV(page);
    const cell = gridCell(page, 'grid-risk-impact', '2,3');
    await expect(cell).toContainText('Alice Chen');
    await expect(cell).toContainText('Grace Lee');
  });

  test('outlier report contains Star and Retention Risk entries', async ({ page }) => {
    await loadSampleCSV(page);
    await expect(page.locator('#report-content')).toContainText('Star');
    await expect(page.locator('#report-content')).toContainText('Retention Risk');
  });

  test('outlier report names Alice Chen as a Star', async ({ page }) => {
    await loadSampleCSV(page);
    const starEntry = page.locator('#report-content .rounded-lg[data-coord="3,3"][data-grid-id="grid-perf-pot"]');
    await expect(starEntry).toContainText('Alice Chen');
  });
});

// ─── Manually Edit ────────────────────────────────────────────────────────────

test.describe('Manually Edit tab', () => {
  test('clicking the tab reveals the edit panel', async ({ page }) => {
    await page.locator('#tab-manual').click();
    await expect(page.locator('#panel-edit')).toBeVisible();
  });

  test('adding an employee shows results and increases row count by 1', async ({ page }) => {
    await addEmployee(page);
    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('#edit-rows tr')).toHaveCount(SEED_COUNT + 1);
  });

  test('new row is pre-filled with "New Employee"', async ({ page }) => {
    await addEmployee(page);
    await expect(page.locator('input[data-field="name"]').last()).toHaveValue('New Employee');
  });

  test('new employee appears in a grid box immediately', async ({ page }) => {
    await addEmployee(page);
    await expect(page.locator('#grid-perf-pot')).toContainText('New Employee');
  });

  test('new employee name is replaced when typing right after adding', async ({ page }) => {
    await addEmployee(page);
    // The name field should be focused with "New Employee" selected —
    // typing replaces it entirely rather than appending
    await page.keyboard.type('Jane Doe');
    await expect(page.locator('input[data-field="name"]').last()).toHaveValue('Jane Doe');
  });

  test('editing name updates the grid in real time', async ({ page }) => {
    await addEmployee(page);
    await page.locator('input[data-field="name"]').last().fill('Unique Name XYZ');
    await expect(page.locator('#grid-perf-pot')).toContainText('Unique Name XYZ');
  });

  test('multiple employees can be added', async ({ page }) => {
    await page.locator('#tab-manual').click();
    await page.locator('#add-employee-btn').click();
    await page.locator('#add-employee-btn').click();
    await page.locator('#add-employee-btn').click();
    await expect(page.locator('#edit-rows tr')).toHaveCount(SEED_COUNT + 3);
  });

  test('deleting a row removes the employee from the grid', async ({ page }) => {
    await addEmployee(page);
    await page.locator('input[data-field="name"]').last().fill('To Delete');
    await expect(page.locator('#grid-perf-pot')).toContainText('To Delete');
    await page.locator('#edit-rows tr').last().getByText('×').click();
    await expect(page.locator('#grid-perf-pot')).not.toContainText('To Delete');
  });
});

// ─── +/- buttons ─────────────────────────────────────────────────────────────

test.describe('+/- buttons', () => {
  test.beforeEach(async ({ page }) => {
    await addEmployee(page);
  });

  test('+ increments a dimension value', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await expect(perfInput).toHaveValue('2');
    await perfInput.locator('..').locator('button').last().click();
    await expect(perfInput).toHaveValue('3');
  });

  test('- decrements a dimension value', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await expect(perfInput).toHaveValue('2');
    await perfInput.locator('..').locator('button').first().click();
    await expect(perfInput).toHaveValue('1');
  });

  test('value is capped at 3', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    const plusBtn = perfInput.locator('..').locator('button').last();
    for (let i = 0; i < 5; i++) await plusBtn.click();
    await expect(perfInput).toHaveValue('3');
  });

  test('value is floored at 1', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    const minusBtn = perfInput.locator('..').locator('button').first();
    for (let i = 0; i < 5; i++) await minusBtn.click();
    await expect(perfInput).toHaveValue('1');
  });

  test('changing a value moves the employee to the correct grid box', async ({ page }) => {
    await page.locator('input[data-field="name"]').last().fill('Mover');
    // Set perf=3, pot=3 → should appear in (3,3) green box
    // Default is 2,2 — click + once for perf, once for pot
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    const potInput  = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="pot"]`);
    await perfInput.locator('..').locator('button').last().click(); // perf: 2→3
    await potInput.locator('..').locator('button').last().click();  // pot:  2→3
    await expect(gridCell(page, 'grid-perf-pot', '3,3')).toContainText('Mover');
  });
});

// ─── Keyboard / tab navigation ────────────────────────────────────────────────

test.describe('Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await addEmployee(page);
  });

  test('Tab from last field focuses + Add employee button', async ({ page }) => {
    await page.locator('input[data-field="imp"]').last().focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#add-employee-btn')).toBeFocused();
  });

  test('Enter on + Add employee button adds a row', async ({ page }) => {
    await page.locator('#add-employee-btn').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#edit-rows tr')).toHaveCount(SEED_COUNT + 2);
  });

  test('Space on + Add employee button adds a row', async ({ page }) => {
    await page.locator('#add-employee-btn').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#edit-rows tr')).toHaveCount(SEED_COUNT + 2);
  });

  test('Tab from + Add employee button loops to first name field', async ({ page }) => {
    await page.locator('#add-employee-btn').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('input[data-field="name"]').first()).toBeFocused();
  });

  test('typing a digit in a dimension field updates the value', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await perfInput.focus();
    await page.keyboard.press('3');
    await expect(perfInput).toHaveValue('3');
  });

  test('typing 0 in a dimension field clamps to 1', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await perfInput.focus();
    await page.keyboard.press('0');
    await expect(perfInput).toHaveValue('1');
  });

  test('ArrowUp increments a dimension value', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await perfInput.focus();
    await page.keyboard.press('ArrowUp');
    await expect(perfInput).toHaveValue('3');
  });

  test('ArrowDown decrements a dimension value', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await perfInput.focus();
    await page.keyboard.press('ArrowDown');
    await expect(perfInput).toHaveValue('1');
  });

  test('ArrowUp clamps at 3', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await perfInput.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
    await expect(perfInput).toHaveValue('3');
  });

  test('ArrowDown clamps at 1', async ({ page }) => {
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await perfInput.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    await expect(perfInput).toHaveValue('1');
  });

  test('Enter moves focus down within the same column', async ({ page }) => {
    await addEmployee(page); // now have SEED_COUNT + 1 rows
    // Focus perf field of second-to-last row, Enter → last row same column
    const upper = page.locator(`input[data-idx="${SEED_COUNT - 1}"][data-field="perf"]`);
    const lower = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await upper.focus();
    await page.keyboard.press('Enter');
    await expect(lower).toBeFocused();
  });

  test('Enter at bottom of column wraps to first row of next column', async ({ page }) => {
    const lastPerf = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    const firstPot  = page.locator(`input[data-idx="0"][data-field="pot"]`);
    await lastPerf.focus();
    await page.keyboard.press('Enter');
    await expect(firstPot).toBeFocused();
  });

  test('Enter at last column last row focuses add-employee button', async ({ page }) => {
    const lastImp = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="imp"]`);
    await lastImp.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#add-employee-btn')).toBeFocused();
  });

  test('Shift+Enter moves focus up within the same column', async ({ page }) => {
    await addEmployee(page);
    const upper = page.locator(`input[data-idx="${SEED_COUNT - 1}"][data-field="perf"]`);
    const lower = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await lower.focus();
    await page.keyboard.press('Shift+Enter');
    await expect(upper).toBeFocused();
  });

  test('Shift+Enter at top of column wraps to last row of previous column', async ({ page }) => {
    const firstPot  = page.locator(`input[data-idx="0"][data-field="pot"]`);
    const lastPerf  = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await firstPot.focus();
    await page.keyboard.press('Shift+Enter');
    await expect(lastPerf).toBeFocused();
  });

  test('Enter moves focus down within the name column', async ({ page }) => {
    await addEmployee(page);
    const upper = page.locator(`input[data-idx="${SEED_COUNT - 1}"][data-field="name"]`);
    const lower = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="name"]`);
    await upper.focus();
    await page.keyboard.press('Enter');
    await expect(lower).toBeFocused();
  });

  test('Enter at last name row wraps to first row of perf column', async ({ page }) => {
    const lastName = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="name"]`);
    const firstPerf = page.locator(`input[data-idx="0"][data-field="perf"]`);
    await lastName.focus();
    await page.keyboard.press('Enter');
    await expect(firstPerf).toBeFocused();
  });

  test('Shift+Enter moves focus up within the name column', async ({ page }) => {
    await addEmployee(page);
    const upper = page.locator(`input[data-idx="${SEED_COUNT - 1}"][data-field="name"]`);
    const lower = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="name"]`);
    await lower.focus();
    await page.keyboard.press('Shift+Enter');
    await expect(upper).toBeFocused();
  });

  test('Shift+Enter at first perf row wraps to last name row', async ({ page }) => {
    const firstPerf = page.locator(`input[data-idx="0"][data-field="perf"]`);
    const lastName  = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="name"]`);
    await firstPerf.focus();
    await page.keyboard.press('Shift+Enter');
    await expect(lastName).toBeFocused();
  });
});

// ─── localStorage persistence ─────────────────────────────────────────────────

test.describe('localStorage persistence', () => {
  test('CSV data survives a page reload', async ({ page }) => {
    await loadSampleCSV(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#results')).toBeVisible();
    // Verify actual CSV employees are present (not just seed data)
    await expect(page.locator('#grid-perf-pot')).toContainText('Alice Chen');
  });

  test('manually entered employees survive a page reload', async ({ page }) => {
    await addEmployee(page);
    await page.locator('input[data-field="name"]').last().fill('Persistent Person');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#grid-perf-pot')).toContainText('Persistent Person');
  });

  test('edits to dimension values survive a page reload', async ({ page }) => {
    await addEmployee(page);
    await page.locator('input[data-field="name"]').last().fill('Reload Test');
    const perfInput = page.locator(`input[data-idx="${SEED_COUNT}"][data-field="perf"]`);
    await perfInput.locator('..').locator('button').last().click(); // perf: 2→3
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(gridCell(page, 'grid-perf-pot', '3,2')).toContainText('Reload Test');
  });

  test('different browser contexts do not share employee data', async ({ browser }) => {
    // Context 1 (simulates user A's browser)
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.addInitScript(() => {
      localStorage.setItem('teambeacon_token', JSON.stringify({
        token: 'test-token-1',
        expiresAt: Date.now() + 72 * 60 * 60 * 1000,
      }));
    });
    await page1.goto(FILE_URL);
    await page1.waitForLoadState('networkidle');
    await page1.locator('#tab-manual').click();
    await page1.locator('#add-employee-btn').click();
    await page1.locator('input[data-field="name"]').last().fill('UserA Person');

    // Context 2 (simulates user B's browser — separate localStorage)
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.addInitScript(() => {
      localStorage.setItem('teambeacon_token', JSON.stringify({
        token: 'test-token-2',
        expiresAt: Date.now() + 72 * 60 * 60 * 1000,
      }));
    });
    await page2.goto(FILE_URL);
    await page2.waitForLoadState('networkidle');

    // User B should see seed data but NOT User A's employee
    await expect(page2.locator('#results')).toBeVisible();
    await expect(page2.locator('#grid-perf-pot')).not.toContainText('UserA Person');

    await ctx1.close();
    await ctx2.close();
  });
});

// ─── Export CSV ───────────────────────────────────────────────────────────────

test.describe('Export CSV', () => {
  test('Export CSV button is visible on page load (seed data)', async ({ page }) => {
    await expect(page.locator('#header-actions')).toBeVisible();
  });

  test('Export CSV button appears after data is loaded', async ({ page }) => {
    await loadSampleCSV(page);
    await expect(page.locator('#header-actions')).toBeVisible();
  });

  test('Export CSV triggers a file download', async ({ page }) => {
    await loadSampleCSV(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button', { hasText: 'Export CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('teambeacon-export.csv');
  });

  test('exported CSV contains correct headers and employee data', async ({ page }) => {
    await loadSampleCSV(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button', { hasText: 'Export CSV' }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const csv = Buffer.concat(chunks).toString('utf-8');
    expect(csv).toContain('Name,Performance,Potential,Risk of Loss,Impact of Loss');
    expect(csv).toContain('Alice Chen');
    expect(csv).toContain('James Wilson');
  });
});

// ─── Reset & Start Fresh ──────────────────────────────────────────────────────

test.describe('Reset & Start Fresh', () => {
  test('Reset button is visible on page load (seed data)', async ({ page }) => {
    await expect(page.locator('#header-actions')).toBeVisible();
  });

  test('confirming reset shows blank slate', async ({ page }) => {
    await loadSampleCSV(page);
    await expect(page.locator('#results')).toBeVisible();

    page.on('dialog', d => d.accept());
    await page.locator('button', { hasText: 'Reset' }).click();

    await expect(page.locator('#results')).toBeHidden();
    await expect(page.locator('#header-actions')).toBeHidden();
  });

  test('cancelling reset leaves data intact', async ({ page }) => {
    await loadSampleCSV(page);

    page.on('dialog', d => d.dismiss());
    await page.locator('button', { hasText: 'Reset' }).click();

    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('#employee-summary')).toContainText('10 employees');
  });

  test('after reset, adding new data works normally', async ({ page }) => {
    await loadSampleCSV(page);
    page.on('dialog', d => d.accept());
    await page.locator('button', { hasText: 'Reset' }).click();

    await expect(page.locator('#results')).toBeHidden();
    await page.locator('#tab-manual').click();
    await expect(page.locator('#edit-rows tr')).toHaveCount(0);
    await page.locator('#add-employee-btn').click();
    await page.locator('input[data-field="name"]').last().fill('Fresh Start');
    await expect(page.locator('#grid-perf-pot')).toContainText('Fresh Start');
  });

  test('after reset, reload shows blank slate (not seed data)', async ({ page }) => {
    await loadSampleCSV(page);
    page.on('dialog', d => d.accept());
    await page.locator('button', { hasText: 'Reset' }).click();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#results')).toBeHidden();
    await expect(page.locator('#header-actions')).toBeHidden();
  });
});

// ─── Paywall disabled ────────────────────────────────────────────────────────

// PAYWALL_ENABLED is false in site/lib.js, so the tool is free and open. These
// assert the *disabled* state directly rather than relying on the token that
// every other test injects — without them the suite would still pass if the
// gate quietly came back, because injectToken() would mask it.
test.describe('Paywall disabled', () => {
  test('app opens with no token at all — the gate never appears', async ({ browser }) => {
    // A fresh context, deliberately WITHOUT injectToken().
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(FILE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#app-content')).toBeVisible();
    await expect(page.locator('#purchase-gate')).toBeHidden();
    await expect(page.locator('#loading-gate')).toBeHidden();
    // The app really ran, not just un-hid: seed data is rendered.
    await expect(page.locator('#results')).toBeVisible();

    const token = await page.evaluate(() => localStorage.getItem('teambeacon_token'));
    expect(token).toBeNull(); // access was granted without one existing

    await context.close();
  });

  test('landing shows the free CTA and no way to pay', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#cta-free')).toBeVisible();
    await expect(page.locator('#cta-paid')).toBeHidden();
    await expect(page.locator('#buy-btn')).toBeHidden();
  });

  test('landing says it is free now AND priced later', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.waitForLoadState('networkidle');

    const cta = page.locator('#cta-free');
    await expect(cta).toContainText('FREE RIGHT NOW');
    await expect(cta).toContainText('free to use today');
    // The part that must not be missable: it is not free forever.
    await expect(cta).toContainText("This won't be free forever");
    await expect(cta).toContainText('$49');
  });

  test('free CTA leads into the app', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#try-free-btn')).toHaveAttribute('href', 'app/');
  });
});
