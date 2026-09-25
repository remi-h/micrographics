import { test, expect, type Page } from '@playwright/test';

// Dragging a layer in the Layers list changes the paint order. What the
// browser has to prove is the drag itself -- the rows and the canvas both
// follow it, a group travels whole, and the place numbers stay where they are
// -- since the reordering arithmetic is unit-tested in src/groups.test.ts.

const entries = (page: Page) => page.locator('.layer-entry');
const layerRows = (page: Page) => page.locator('.layer-row');
const layerNames = (page: Page) => page.locator('.layer-row .layer-name').allInnerTexts();
const placeNumbers = (page: Page) => page.locator('.layer-index').allInnerTexts();
// Text items only, in document order, which is paint order: last is on top.
const paintOrder = (page: Page) => page.locator('.canvas-item > text').allTextContents();

/** An empty artboard with three labels on it, added bottom to top. */
async function threeLabels(page: Page) {
  await page.goto('/creator');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await expect(layerRows(page)).toHaveCount(0);
  for (const label of ['AAA', 'BBB', 'CCC']) {
    await page.locator('.text-input').fill(label);
    await page.locator('.add-button').click();
  }
  await expect(layerRows(page)).toHaveCount(3);
  // The list is topmost first.
  expect(await layerNames(page)).toEqual(['CCC', 'BBB', 'AAA']);
  expect(await paintOrder(page)).toEqual(['AAA', 'BBB', 'CCC']);
}

/** Drags a layer row into the top or bottom half of another entry. */
async function dragLayer(page: Page, name: string, onto: number, half: 'top' | 'bottom') {
  const target = entries(page).nth(onto);
  const box = (await target.boundingBox())!;
  await layerRows(page)
    .filter({ hasText: new RegExp(`^${name}`) })
    .dragTo(target, { targetPosition: { x: box.width / 2, y: half === 'top' ? 4 : box.height - 4 } });
}

test('dragging a layer to the top of the list brings it to the front of the canvas', async ({ page }) => {
  await threeLabels(page);

  await dragLayer(page, 'AAA', 0, 'top');

  expect(await layerNames(page)).toEqual(['AAA', 'CCC', 'BBB']);
  expect(await paintOrder(page)).toEqual(['BBB', 'CCC', 'AAA']);
});

test('dragging a layer down sends it back', async ({ page }) => {
  await threeLabels(page);

  await dragLayer(page, 'CCC', 1, 'bottom');

  expect(await layerNames(page)).toEqual(['BBB', 'CCC', 'AAA']);
  expect(await paintOrder(page)).toEqual(['AAA', 'CCC', 'BBB']);
});

test('the place numbers sit outside the rows and stay put while layers move', async ({ page }) => {
  await threeLabels(page);
  expect(await placeNumbers(page)).toEqual(['03', '02', '01']);
  // Outside the row, not inside it: the row's own text is just the name.
  await expect(page.locator('.layer-row .layer-index')).toHaveCount(0);

  await dragLayer(page, 'AAA', 0, 'top');

  expect(await placeNumbers(page)).toEqual(['03', '02', '01']);
});

test('a line shows where the dragged layer will land, and none where it would not move', async ({ page }) => {
  await threeLabels(page);
  const source = layerRows(page).filter({ hasText: /^AAA/ });
  const sourceBox = (await source.boundingBox())!;
  const topBox = (await entries(page).nth(0).boundingBox())!;

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(topBox.x + topBox.width / 2, topBox.y + 4, { steps: 8 });
  await expect(source).toHaveAttribute('data-dragging', 'true');
  await expect(page.locator('.layer-entry[data-drop]')).toHaveCount(1);
  await expect(entries(page).nth(0)).toHaveAttribute('data-drop', 'before');

  // Back over its own row: dropping here would leave it where it is, so the
  // line goes. Checked after the line above has been seen, so this is the
  // drag hiding it, not a drag that has not started yet.
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 4, { steps: 8 });
  await expect(page.locator('.layer-entry[data-drop]')).toHaveCount(0);

  await page.mouse.move(topBox.x + topBox.width / 2, topBox.y + 4, { steps: 8 });
  await expect(entries(page).nth(0)).toHaveAttribute('data-drop', 'before');
  await page.mouse.up();
  await expect(page.locator('.layer-entry[data-drop]')).toHaveCount(0);
  expect(await layerNames(page)).toEqual(['AAA', 'CCC', 'BBB']);
});

test('a reorder is one undo step', async ({ page }) => {
  await threeLabels(page);

  await dragLayer(page, 'AAA', 0, 'top');
  expect(await layerNames(page)).toEqual(['AAA', 'CCC', 'BBB']);

  await page.keyboard.press('ControlOrMeta+z');
  expect(await layerNames(page)).toEqual(['CCC', 'BBB', 'AAA']);
  expect(await paintOrder(page)).toEqual(['AAA', 'BBB', 'CCC']);
});

test('a group is dragged whole, and stays one group', async ({ page }) => {
  await threeLabels(page);
  // Group the top two, CCC and BBB, from the right-click menu.
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await page.locator('.layer-row[data-active="true"] .layer-select').first().click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: /^Group/ }).click();
  expect(await layerNames(page)).toEqual(['Group of 2', 'AAA']);

  await dragLayer(page, 'Group of 2', 1, 'bottom');

  expect(await layerNames(page)).toEqual(['AAA', 'Group of 2']);
  expect(await paintOrder(page)).toEqual(['BBB', 'CCC', 'AAA']);
  await expect(page.locator('.layer-row[data-group]')).toHaveCount(1);
});
