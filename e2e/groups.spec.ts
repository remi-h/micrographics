import { test, expect, type Page } from '@playwright/test';

// Grouping is a selection feature: what it has to prove in a browser is that
// picking one member picks the rest, that the group reads as one layer, and
// that a copy of a group is a group of its own rather than a second half of
// the one it was copied from. The arithmetic behind all of it is unit-tested
// in src/groups.test.ts.

const layerRows = (page: Page) => page.locator('.layer-row');
const groupRows = (page: Page) => page.locator('.layer-row[data-group]');
const selectedOutlines = (page: Page) => page.locator('.canvas-item rect[stroke-dasharray]');
const groupButton = (page: Page) => page.locator('.layer-action', { hasText: 'Group' }).first();
const ungroupButton = (page: Page) => page.locator('.layer-action', { hasText: 'Ungroup' }).first();

/** Selects the top two layers and groups them. Returns the row count before. */
async function groupTopTwo(page: Page) {
  const before = await layerRows(page).count();
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(selectedOutlines(page)).toHaveCount(2);
  await groupButton(page).click();
  await expect(groupRows(page)).toHaveCount(1);
  return before;
}

test('two layers become one group row', async ({ page }) => {
  await page.goto('/creator');
  const before = await groupTopTwo(page);

  await expect(layerRows(page)).toHaveCount(before - 1);
  await expect(groupRows(page).first()).toContainText('Group of 2');
});

test('the group buttons are only offered when they can do something', async ({ page }) => {
  await page.goto('/creator');

  // Nothing selected: neither applies.
  await expect(groupButton(page)).toBeDisabled();
  await expect(ungroupButton(page)).toBeDisabled();

  // One item is not a group.
  await layerRows(page).nth(0).click();
  await expect(groupButton(page)).toBeDisabled();

  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(groupButton(page)).toBeEnabled();
  await expect(ungroupButton(page)).toBeDisabled();

  await groupButton(page).click();
  await expect(ungroupButton(page)).toBeEnabled();
});

test('clicking one member of a group selects the whole group', async ({ page }) => {
  await page.goto('/creator');
  await groupTopTwo(page);

  await page.keyboard.press('Escape');
  await expect(selectedOutlines(page)).toHaveCount(0);

  // Click a grouped item on the canvas, not in the layer list: the point is
  // that the canvas knows about the group too.
  const member = page.locator('g.canvas-item').last();
  await member.click({ position: { x: 4, y: 4 }, force: true });

  await expect(selectedOutlines(page)).toHaveCount(2);
});

test('a group moves as one', async ({ page }) => {
  await page.goto('/creator');
  await groupTopTwo(page);

  const positions = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('g.canvas-item')].map((node) => node.getAttribute('transform') ?? ''),
    );

  const before = await positions();
  const outline = selectedOutlines(page).first();
  const box = await outline.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2 + 40, { steps: 8 });
  await page.mouse.up();

  const after = await positions();
  const moved = before.filter((transform, index) => transform !== after[index]);
  expect(moved, 'dragging one member should carry the other with it').toHaveLength(2);
});

test('a copy of a group is a group of its own', async ({ page }) => {
  await page.goto('/creator');
  await groupTopTwo(page);

  await page.keyboard.press('ControlOrMeta+d');

  // Two group rows now, and the copy is what is selected.
  await expect(groupRows(page)).toHaveCount(2);
  await expect(selectedOutlines(page)).toHaveCount(2);

  // Dissolving the copy must leave the original grouped. If the copy had kept
  // the original's group id, this would take both apart.
  await page.keyboard.press('Shift+ControlOrMeta+g');
  await expect(groupRows(page)).toHaveCount(1);
});

test('ungrouping puts the members back as their own layers', async ({ page }) => {
  await page.goto('/creator');
  const before = await groupTopTwo(page);

  await ungroupButton(page).click();

  await expect(groupRows(page)).toHaveCount(0);
  await expect(layerRows(page)).toHaveCount(before);
});

test('a group survives a reload', async ({ page }) => {
  await page.goto('/creator');
  await groupTopTwo(page);

  // The editor autosaves on a debounce; give it the write before reloading.
  await page.waitForTimeout(700);
  await page.reload();

  await expect(groupRows(page)).toHaveCount(1);
  await expect(groupRows(page).first()).toContainText('Group of 2');
});
