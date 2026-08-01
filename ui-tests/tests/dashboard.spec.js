// UI TESTS for the dashboard, in a browser, in a container.
//
// The unit suite calls the route table directly and the HTTP tests call the API — neither
// opens the page. Two defects lived in that gap: the dashboard's relative fetches
// (`api/metrics` from a page served at /dashboard/) 404'd without Caddy in front, so the
// page rendered its chrome and then sat on "offline — sidecar unreachable" for every
// standalone user; and the feedback button had never been clicked by anything.
//
// These run against the real sidecar serving a fixed state.json, so an assertion failing
// means the UI changed, not that a live run moved on.
const { test, expect } = require('@playwright/test');

// The page is served at BOTH / and /dashboard/. The prefixed one is what the README
// hands people and what Caddy serves in production, and it is the one that broke.
for (const base of ['/', '/dashboard/']) {
  test.describe(`served at ${base}`, () => {
    test.beforeEach(async ({ page }) => { await page.goto(base); });

    test('reaches its own API — no "offline" banner', async ({ page }) => {
      // the exact regression: relative fetch under the /dashboard prefix
      const stage = page.locator('#stage-name');
      await expect(stage).not.toHaveText(/offline/i, { timeout: 10000 });
      await expect(stage).toContainText(/improving mutation|improving_mutation/i);
    });

    test('renders the seeded files with their measured numbers', async ({ page }) => {
      const row = page.locator('#files tbody tr', { hasText: 'lib/admin-page-data.ts' });
      await expect(row).toBeVisible({ timeout: 10000 });
      await expect(row).toContainText('92.06');
      await expect(row).toContainText('100%');
      // before/after are distinct columns: a file that started at 0 must still show 0
      await expect(row.locator('td').nth(3)).toHaveText('0');
    });
  });
}

test.describe('leaving feedback', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/dashboard/'); });

  test('an improved file offers the comment button, a candidate does not', async ({ page }) => {
    const improved = page.locator('#files tbody tr', { hasText: 'lib/admin-page-data.ts' });
    await expect(improved.locator('button.say')).toBeVisible({ timeout: 10000 });
    const candidate = page.locator('#files tbody tr', { hasText: 'components/ui/Button.tsx' });
    await expect(candidate.locator('button.say')).toHaveCount(0);
  });

  test('a comment reaches the corpus in the repo, and the count comes back', async ({ page }) => {
    const row = page.locator('#files tbody tr', { hasText: 'lib/admin-page-data.ts' });
    await row.locator('button.say').click();

    const dialog = page.locator('dialog#fb');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#fb-title')).toContainText('lib/admin-page-data.ts');

    await page.locator('#fb-text').fill("i don't like too many mocks in these tests");
    await page.locator('#fb-author').fill('playwright');
    await page.locator('#fb-save').click();

    // it attached to a real record — the fixture ships one for this file
    await expect(page.locator('#fb-status')).toContainText(/saved to improve-tests\.json/, { timeout: 10000 });

    // and it is readable back out of the API the optimiser will consume
    const judged = await page.evaluate(async () => (await (await fetch('api/feedback')).json()).judged);
    expect(judged).toHaveLength(1);
    expect(judged[0].feedback[0].text).toMatch(/too many mocks/);
    expect(judged[0].feedback[0].author).toBe('playwright');
    expect(judged[0].prompt.system).toMatch(/expert test engineer/);

    // the button now carries the count, so a reviewer sees what has been judged
    await page.reload();
    await expect(row.locator('button.say')).toContainText('1', { timeout: 10000 });
  });

  test('an empty comment is not saved', async ({ page }) => {
    const row = page.locator('#files tbody tr', { hasText: 'lib/api-schemas/registry.ts' });
    await row.locator('button.say').click();
    await page.locator('#fb-save').click();
    // the dialog closes without a request; nothing is recorded for that file
    const judged = await page.evaluate(async () => (await (await fetch('api/feedback')).json()).judged);
    expect(judged.filter((r) => r.file === 'lib/api-schemas/registry.ts')).toHaveLength(0);
  });

  test('a file with nothing generated for it says so instead of pretending', async ({ page }) => {
    const row = page.locator('#files tbody tr', { hasText: 'lib/db.ts' });
    await row.locator('button.say').click();
    await page.locator('#fb-text').fill('this one never produced anything');
    await page.locator('#fb-save').click();
    await expect(page.locator('#fb-status')).toContainText(/nothing|no generation record/i, { timeout: 10000 });
  });
});
