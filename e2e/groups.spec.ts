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

test('editing a grouped text item leaves the group whole afterwards', async ({ page }) => {
  await page.goto('/creator');

  // Group a text layer with whatever sits above it, then edit the text.
  const rows = layerRows(page);
  const count = await rows.count();
  let textRow = -1;
  for (let index = 0; index < count; index += 1) {
    if (!/symbol/i.test(await rows.nth(index).innerText())) {
      textRow = index;
      break;
    }
  }
  expect(textRow, 'expected a text layer in the default template').toBeGreaterThanOrEqual(0);

  await rows.nth(textRow).click();
  await rows.nth(textRow === 0 ? 1 : 0).click({ modifiers: ['Shift'] });
  await groupButton(page).click();
  await expect(groupRows(page)).toHaveCount(1);

  const before = await page.evaluate(() =>
    [...document.querySelectorAll('g.canvas-item')].map((node) => node.getAttribute('transform') ?? ''),
  );

  // The grouped text item specifically. The template has several text layers,
  // and DOM order runs bottom-up while the layer list runs top-down, so
  // ":has(text)" alone picks a different one.
  await page.locator('g.canvas-item:has(rect[stroke-dasharray]):has(text)').first().dblclick();
  await expect(page.locator('.canvas-text-editor')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.canvas-text-editor')).toHaveCount(0);

  // The group must still move as one.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');

  const after = await page.evaluate(() =>
    [...document.querySelectorAll('g.canvas-item')].map((node) => node.getAttribute('transform') ?? ''),
  );
  const moved = before.filter((transform, index) => transform !== after[index]);
  expect(moved, 'nudging after an edit should still move the whole group').toHaveLength(2);
});

test('two groups can be merged from the Layers list', async ({ page }) => {
  await page.goto('/creator');

  // Two groups, made from the top four layers two at a time.
  await groupTopTwo(page);
  await layerRows(page).nth(1).click();
  await layerRows(page).nth(2).click({ modifiers: ['Shift'] });
  await groupButton(page).click();
  await expect(groupRows(page)).toHaveCount(2);

  // A group row has to honour the modifier, or a selection spanning both
  // groups -- the one needed to merge them -- cannot be built from the list.
  await groupRows(page).nth(0).click();
  await groupRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(selectedOutlines(page)).toHaveCount(4);

  await groupButton(page).click();

  await expect(groupRows(page)).toHaveCount(1);
  await expect(groupRows(page).first()).toContainText('Group of 4');
});
