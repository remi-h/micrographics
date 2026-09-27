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

/**
 * Whether the drop line -- a ::before on the marked entry -- is drawn inside
 * the list's box. The list scrolls, so a line outside it is clipped away even
 * while the entry carries the attribute that asks for it.
 */
async function lineInsideList(page: Page) {
  return page.evaluate(() => {
    const entry = document.querySelector('.layer-entry[data-drop]') as HTMLElement;
    const list = document.querySelector('.layer-list') as HTMLElement;
    const line = getComputedStyle(entry, '::before');
    const top = entry.getBoundingClientRect().top + parseFloat(line.top);
    const bottom = top + parseFloat(line.height);
    const box = list.getBoundingClientRect();
    return top >= box.top && bottom <= box.bottom;
  });
}

/** Starts dragging a layer and holds it over one half of an entry. */
async function holdOver(page: Page, name: string, onto: number, half: 'top' | 'bottom') {
  const source = (await layerRows(page).filter({ hasText: new RegExp(`^${name}`) }).boundingBox())!;
  const target = (await entries(page).nth(onto).boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, half === 'top' ? target.y + 4 : target.y + target.height - 4, {
    steps: 8,
  });
}

test('the line is drawn inside the list at both ends, for the front and the back', async ({ page }) => {
  await threeLabels(page);

  await holdOver(page, 'AAA', 0, 'top');
  await expect(entries(page).nth(0)).toHaveAttribute('data-drop', 'before');
  expect(await lineInsideList(page), 'the line above the top row').toBe(true);
  await page.mouse.up();

  await holdOver(page, 'AAA', 2, 'bottom');
  await expect(entries(page).nth(2)).toHaveAttribute('data-drop', 'after');
  expect(await lineInsideList(page), 'the line below the bottom row').toBe(true);
  await page.mouse.up();
  expect(await layerNames(page)).toEqual(['CCC', 'BBB', 'AAA']);
});

test('the line goes when the drag leaves the list, and letting go there moves nothing', async ({ page }) => {
  await threeLabels(page);

  await holdOver(page, 'AAA', 0, 'top');
  await expect(page.locator('.layer-entry[data-drop]')).toHaveCount(1);

  const stage = (await page.locator('.preview-stage').boundingBox())!;
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2, { steps: 8 });
  await expect(page.locator('.layer-entry[data-drop]')).toHaveCount(0);

  await page.mouse.up();
  expect(await layerNames(page)).toEqual(['CCC', 'BBB', 'AAA']);
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

// Inside an open group, members are dragged among themselves: that moves one
// in front of or behind the others, and never out of the group.

const members = (page: Page) => page.locator('.layer-member');
const memberNames = (page: Page) => members(page).allInnerTexts();

/** Four labels, the top three grouped and the group opened: DDD, CCC, BBB inside, AAA below. */
async function openGroupOfThree(page: Page) {
  await page.goto('/creator');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  for (const label of ['AAA', 'BBB', 'CCC', 'DDD']) {
    await page.locator('.text-input').fill(label);
    await page.locator('.add-button').click();
  }
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(2).click({ modifiers: ['Shift'] });
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await page.locator('.layer-row[data-active="true"] .layer-select').first().click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: /^Group/ }).click();
  await page.locator('.layer-disclosure').click();
  expect(await layerNames(page)).toEqual(['Group of 3', 'AAA']);
  expect(await memberNames(page)).toEqual(['DDD', 'CCC', 'BBB']);
}

/** Drags a member into the top or bottom half of another member. */
async function dragMember(page: Page, name: string, onto: number, half: 'top' | 'bottom') {
  const target = members(page).nth(onto);
  const box = (await target.boundingBox())!;
  await members(page)
    .filter({ hasText: new RegExp(`^${name}$`) })
    .dragTo(target, { targetPosition: { x: box.width / 2, y: half === 'top' ? 3 : box.height - 3 } });
}

test('dragging a member to the top of its group brings it in front of the others', async ({ page }) => {
  await openGroupOfThree(page);

  await dragMember(page, 'BBB', 0, 'top');

  expect(await memberNames(page)).toEqual(['BBB', 'DDD', 'CCC']);
  expect(await paintOrder(page)).toEqual(['AAA', 'CCC', 'DDD', 'BBB']);
  // Still one group of three, in the same place in the list.
  expect(await layerNames(page)).toEqual(['Group of 3', 'AAA']);
});

test('dragging a member down its group sends it behind the others', async ({ page }) => {
  await openGroupOfThree(page);

  await dragMember(page, 'DDD', 2, 'bottom');

  expect(await memberNames(page)).toEqual(['CCC', 'BBB', 'DDD']);
  expect(await paintOrder(page)).toEqual(['AAA', 'DDD', 'BBB', 'CCC']);
});

test('a member shows where it will land among the others, and cannot be dropped out of its group', async ({ page }) => {
  await openGroupOfThree(page);
  const source = (await members(page).filter({ hasText: /^BBB$/ }).boundingBox())!;
  const top = (await members(page).nth(0).boundingBox())!;
  const outside = (await layerRows(page).filter({ hasText: /^AAA/ }).boundingBox())!;

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(top.x + top.width / 2, top.y + 3, { steps: 8 });
  await page.mouse.move(top.x + top.width / 2, top.y + 4);
  await expect(members(page).nth(0)).toHaveAttribute('data-drop', 'before');
  // A member's line is drawn among the members, never between rows.
  await expect(page.locator('.layer-entry[data-drop]')).toHaveCount(0);

  // Over a row outside the group there is nowhere for it to go.
  await page.mouse.move(outside.x + outside.width / 2, outside.y + outside.height / 2, { steps: 8 });
  await page.mouse.move(outside.x + outside.width / 2, outside.y + outside.height / 2 + 1);
  await expect(page.locator('[data-drop]')).toHaveCount(0);
  await page.mouse.up();

  expect(await memberNames(page)).toEqual(['DDD', 'CCC', 'BBB']);
  expect(await layerNames(page)).toEqual(['Group of 3', 'AAA']);
});

test('reordering inside a group is one undo step', async ({ page }) => {
  await openGroupOfThree(page);

  await dragMember(page, 'BBB', 0, 'top');
  expect(await memberNames(page)).toEqual(['BBB', 'DDD', 'CCC']);

  await page.keyboard.press('ControlOrMeta+z');
  expect(await memberNames(page)).toEqual(['DDD', 'CCC', 'BBB']);
});
