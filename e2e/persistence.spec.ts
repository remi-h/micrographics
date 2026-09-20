import { test, expect, type Page } from '@playwright/test';

// The editor debounces its autosave, so give the write a moment to land before
// navigating away.
const SAVE_SETTLE_MS = 800;

async function layerLabels(page: Page) {
  return page.locator('.layer-row').allInnerTexts();
}

test('canvas work is restored after a reload', async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (/hydrat/i.test(message.text())) hydrationErrors.push(message.text());
  });

  await page.goto('/creator');

  const layers = page.locator('.layer-row');
  const startingCount = await layers.count();
  expect(startingCount).toBeGreaterThan(0);

  await page.locator('.symbol-button').first().click();
  await expect(layers).toHaveCount(startingCount + 1);
  const before = await layerLabels(page);

  await page.waitForTimeout(SAVE_SETTLE_MS);
  await page.reload();

  await expect(layers).toHaveCount(startingCount + 1);
  expect(await layerLabels(page)).toEqual(before);
  expect(hydrationErrors, 'restoring saved work should not cause a hydration mismatch').toEqual([]);
});

test('palette and grid settings are restored after a reload', async ({ page }) => {
  await page.goto('/creator');

  // Select by position, not label, so the test survives palette renames.
  const swatches = page.locator('.stage-palette-button');
  await swatches.nth(2).click();
  await expect(swatches.nth(2)).toHaveAttribute('data-active', 'true');

  const grid = page.locator('.stage-toggle input[type="checkbox"]');
  await grid.check();

  await page.waitForTimeout(SAVE_SETTLE_MS);
  await page.reload();

  await expect(swatches.nth(2)).toHaveAttribute('data-active', 'true');
  await expect(grid).toBeChecked();
});

test('Start from scratch discards the saved work for good', async ({ page }) => {
  await page.goto('/creator');

  const layers = page.locator('.layer-row');
  const startingCount = await layers.count();
  await page.locator('.symbol-button').first().click();
  await expect(layers).toHaveCount(startingCount + 1);

  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await expect(layers).toHaveCount(0);

  await page.waitForTimeout(SAVE_SETTLE_MS);
  await page.reload();

  await expect(layers).toHaveCount(0);
  await expect(page.locator('.empty-layer')).toBeVisible();
});
