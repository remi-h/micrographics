import { test, expect, type Page } from '@playwright/test';

// Grouping is a selection feature: what it has to prove in a browser is that
// picking one member picks the rest, that the group reads as one layer, and
// that a copy of a group is a group of its own rather than a second half of
// the one it was copied from. The arithmetic behind all of it is unit-tested
// in src/lib/groups.test.ts.

const layerRows = (page: Page) => page.locator('.layer-row');
const groupRows = (page: Page) => page.locator('.layer-row[data-group]');
const selectedOutlines = (page: Page) => page.locator('.canvas-item rect[stroke-dasharray]');
// Grouping is offered on right-click, on a layer or on the canvas, and the
// menu holds only what applies to the selection.
const menuItem = (page: Page, action: 'Group' | 'Ungroup') =>
  page.locator('.context-menu-item').filter({ has: page.locator('.context-menu-label', { hasText: new RegExp(`^${action}$`) }) });
const selectedLayer = (page: Page) => page.locator('.layer-row[data-active="true"] .layer-select').first();

/** Right-clicks a layer that is part of the selection and picks an action. */
async function fromLayerMenu(page: Page, action: 'Group' | 'Ungroup') {
  await selectedLayer(page).click({ button: 'right' });
  await menuItem(page, action).click();
  await expect(page.locator('.context-menu')).toHaveCount(0);
}

/** Selects the top two layers and groups them. Returns the row count before. */
async function groupTopTwo(page: Page) {
  const before = await layerRows(page).count();
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(selectedOutlines(page)).toHaveCount(2);
  await fromLayerMenu(page, 'Group');
  await expect(groupRows(page)).toHaveCount(1);
  return before;
}

test('two layers become one group row', async ({ page }) => {
  await page.goto('/creator');
  const before = await groupTopTwo(page);

  await expect(layerRows(page)).toHaveCount(before - 1);
  await expect(groupRows(page).first()).toContainText('Group of 2');
});

test('the right-click menu offers only what applies, so it reads as a toggle', async ({ page }) => {
  await page.goto('/creator');

  // One item is not a group, and there is nothing to group it with: the menu
  // says how to get there instead of offering either action.
  await layerRows(page).nth(0).click();
  await selectedLayer(page).click({ button: 'right' });
  await expect(page.locator('.context-menu')).toContainText('Select two or more to group');
  await expect(menuItem(page, 'Group')).toHaveCount(0);
  await expect(menuItem(page, 'Ungroup')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Two loose items: Group, and only Group.
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await selectedLayer(page).click({ button: 'right' });
  await expect(menuItem(page, 'Group')).toHaveCount(1);
  await expect(menuItem(page, 'Ungroup')).toHaveCount(0);
  await menuItem(page, 'Group').click();

  // Now one whole group: Ungroup, and only Ungroup.
  await selectedLayer(page).click({ button: 'right' });
  await expect(menuItem(page, 'Ungroup')).toHaveCount(1);
  await expect(menuItem(page, 'Group')).toHaveCount(0);
});

test('the standalone group buttons are gone from the panel and the canvas toolbar', async ({ page }) => {
  await page.goto('/creator');
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(selectedOutlines(page)).toHaveCount(2);

  await expect(page.locator('.layer-actions')).toHaveCount(0);
  // The canvas toolbar keeps its four alignment buttons, and only those.
  await expect(page.locator('.canvas-selection-actions button')).toHaveCount(4);
  await expect(page.getByTitle('Group', { exact: true })).toHaveCount(0);
});

test('right-clicking a layer that is not selected makes it the selection first', async ({ page }) => {
  await page.goto('/creator');
  await groupTopTwo(page);

  // Select something else, then right-click the group row: the menu has to be
  // about the group under the pointer, not the unrelated selection.
  await layerRows(page).nth(1).click();
  await groupRows(page).first().locator('.layer-select').click({ button: 'right' });
  await expect(selectedOutlines(page)).toHaveCount(2);
  await expect(menuItem(page, 'Ungroup')).toHaveCount(1);
});

test('grouping from the canvas: right-click the selection', async ({ page }) => {
  await page.goto('/creator');
  const before = await layerRows(page).count();
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(selectedOutlines(page)).toHaveCount(2);

  // Right-click on one of the selected items on the artboard. It is already
  // part of the selection, so the selection stays whole for the menu.
  await page.locator('.canvas-item:has(rect[stroke-dasharray])').first().click({ button: 'right', force: true });
  await expect(selectedOutlines(page)).toHaveCount(2);
  await menuItem(page, 'Group').click();

  await expect(groupRows(page)).toHaveCount(1);
  await expect(layerRows(page)).toHaveCount(before - 1);
});

test('right-clicking an unselected item on the canvas selects it, and its group', async ({ page }) => {
  await page.goto('/creator');
  await groupTopTwo(page);

  // Select one loose item, then right-click a member of the group on the
  // artboard. The menu has to be about the group under the pointer -- so the
  // group, whole, becomes the selection before the menu opens.
  await layerRows(page).nth(1).click();
  await expect(selectedOutlines(page)).toHaveCount(1);
  const selectedBefore = await page.locator('.canvas-item:has(rect[stroke-dasharray])').getAttribute('transform');

  // The group is the top two layers, and the topmost layer is drawn last, so
  // the last item on the artboard is a member of it.
  const box = (await page.locator('g.canvas-item').last().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });

  await expect(selectedOutlines(page)).toHaveCount(2);
  expect(await page.locator('.canvas-item:has(rect[stroke-dasharray])').first().getAttribute('transform')).not.toBe(
    selectedBefore,
  );
  await expect(menuItem(page, 'Ungroup')).toHaveCount(1);
});

test('a right-click on the canvas does not start a marquee or drag', async ({ page }) => {
  await page.goto('/creator');
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(selectedOutlines(page)).toHaveCount(2);

  // Empty artboard, top-left corner. A primary press there starts a marquee
  // that clears the selection; a right-click must leave it for the menu.
  const board = (await page.locator('svg.artboard').boundingBox())!;
  await page.mouse.click(board.x + 4, board.y + 4, { button: 'right' });
  await expect(selectedOutlines(page)).toHaveCount(2);
  await expect(menuItem(page, 'Group')).toHaveCount(1);
});

test('the disclosure on a group row shows and hides the layers inside', async ({ page }) => {
  await page.goto('/creator');
  await groupTopTwo(page);
  const disclosure = groupRows(page).first().locator('.layer-disclosure');

  await expect(page.locator('.layer-member')).toHaveCount(0);
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.layer-member')).toHaveCount(2);

  // A member row selects the whole group: a group is never half-selected.
  await layerRows(page).nth(1).click();
  await page.locator('.layer-member').first().click();
  await expect(selectedOutlines(page)).toHaveCount(2);

  await disclosure.click();
  await expect(page.locator('.layer-member')).toHaveCount(0);
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

  await fromLayerMenu(page, 'Ungroup');

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
  await fromLayerMenu(page, 'Group');
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

test('two groups grouped from the Layers list nest inside a new one', async ({ page }) => {
  await page.goto('/creator');

  // Two groups, made from the top four layers two at a time.
  await groupTopTwo(page);
  await layerRows(page).nth(1).click();
  await layerRows(page).nth(2).click({ modifiers: ['Shift'] });
  await fromLayerMenu(page, 'Group');
  await expect(groupRows(page)).toHaveCount(2);

  // A group row has to honour the modifier, or a selection spanning both
  // groups -- the one needed to merge them -- cannot be built from the list.
  await groupRows(page).nth(0).click();
  await groupRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(selectedOutlines(page)).toHaveCount(4);

  await fromLayerMenu(page, 'Group');

  // One row, a group of the two groups -- each still whole inside it.
  await expect(groupRows(page)).toHaveCount(1);
  await expect(groupRows(page).first()).toContainText('Group of 2');
  await groupRows(page).first().locator('.layer-disclosure').click();
  await expect(page.locator('.layer-subgroup')).toHaveCount(2);
  await expect(page.locator('.layer-subgroup').first()).toContainText('Group of 2');
});

// Grouping and entrances landed in separate PRs and meet in the Layers list.
// A group is one thing everywhere else -- it moves, scales and rotates as one
// -- so its row carries one entrance that every member plays, rather than a
// control per member the collapsed row has nowhere to show.
test('a group has one entrance, and every member plays it', async ({ page }) => {
  await page.goto('/creator');
  await groupTopTwo(page);

  const groupRow = groupRows(page).first();
  await groupRow.locator('.layer-animate').click();
  await expect(page.locator('.dialog-popup')).toBeVisible();
  await page.locator('.animation-kinds button', { hasText: 'Pop in' }).first().click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.dialog-popup')).toHaveCount(0);

  // The row shows the entrance, and both members are wrapped to play it --
  // one control, two animated items.
  await expect(groupRow.locator('.layer-animate[data-on]')).toHaveCount(1);
  await expect(page.locator('g[class^="mg-anim-"]')).toHaveCount(2);

  // One undo takes the entrance off every member at once, rather than
  // peeling them off one at a time. (How many entries the entrance flow takes
  // is animations.spec.ts's business -- opening the control already sets the
  // default one, so the count is not this test's to assert.)
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('g[class^="mg-anim-"]')).toHaveCount(0);
  await expect(groupRows(page)).toHaveCount(1);
});

test('a group can stagger its entrance, each member starting after the one listed above it', async ({ page }) => {
  await page.goto('/creator');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  for (const label of ['AAA', 'BBB', 'CCC']) {
    await page.locator('.text-input').fill(label);
    await page.locator('.add-button').click();
  }
  // Listed top first: CCC, BBB, AAA. Group all three.
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(2).click({ modifiers: ['Shift'] });
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(selectedOutlines(page)).toHaveCount(3);
  await fromLayerMenu(page, 'Group');

  const groupRow = groupRows(page).first();
  await groupRow.locator('.layer-animate').click();
  await page.locator('.animation-kinds button', { hasText: 'Pop in' }).first().click();
  await page.getByRole('slider', { name: /Each next layer/ }).fill('0.5');
  await expect(page.locator('.dialog-popup')).toContainText('+0.5s');
  await page.getByRole('button', { name: 'Done' }).click();

  // What each member actually plays, read off its running animation.
  await page.locator('.stage-play').click();
  const delays = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('g[class^="mg-anim-"]')].map((node) => [
        node.querySelector('text')?.textContent,
        (node as SVGGElement).getAnimations()[0]?.effect?.getTiming().delay,
      ]),
    ),
  );
  expect(delays).toEqual({ AAA: 1000, BBB: 500, CCC: 0 });

  // Reopening reads the stagger back from the members.
  await groupRow.locator('.layer-animate').click();
  await expect(page.locator('.dialog-popup')).toContainText('+0.5s');
  await page.getByRole('button', { name: 'Done' }).click();

  // Dragging a member to the top of the open group makes it start first,
  // and the group keeps its stagger in the new order.
  await groupRow.locator('.layer-disclosure').click();
  const members = page.locator('.layer-member');
  const top = (await members.nth(0).boundingBox())!;
  await members.filter({ hasText: /^AAA$/ }).dragTo(members.nth(0), { targetPosition: { x: top.width / 2, y: 3 } });
  await expect(members).toHaveText(['AAA', 'CCC', 'BBB']);

  await page.locator('.stage-play').click();
  const restaggered = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('g[class^="mg-anim-"]')].map((node) => [
        node.querySelector('text')?.textContent,
        (node as SVGGElement).getAnimations()[0]?.effect?.getTiming().delay,
      ]),
    ),
  );
  expect(restaggered).toEqual({ AAA: 0, BBB: 1000, CCC: 500 });
  await groupRow.locator('.layer-animate').click();
  await expect(page.locator('.dialog-popup')).toContainText('+0.5s');
});

// Groups nest (issue #20): a group can hold groups, each with its own
// entrance. The arithmetic -- whose turn comes when -- is unit-tested in
// src/lib/groupTiming.test.ts; these prove the Layers list and Play.

/** A blank canvas with labels added bottom to top, so the last is on top. */
async function labels(page: Page, names: string[]) {
  await page.goto('/creator');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  for (const name of names) {
    await page.locator('.text-input').fill(name);
    await page.locator('.add-button').click();
  }
}

/** Selects the layers named (top-level rows) and groups them. */
async function groupNamed(page: Page, names: string[]) {
  for (const [index, name] of names.entries()) {
    await layerRows(page)
      .filter({ has: page.locator('.layer-name', { hasText: new RegExp(`^${name}$`) }) })
      .click({ modifiers: index === 0 ? [] : ['Shift'] });
  }
  await fromLayerMenu(page, 'Group');
}

/** Each animated item's delay in ms and a digest of its movement, by label. */
async function playedEntrances(page: Page) {
  await page.locator('.stage-play').click();
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('g[class^="mg-anim-"]')].map((node) => {
        const effect = (node as SVGGElement).getAnimations()[0]?.effect as KeyframeEffect | undefined;
        return [
          node.querySelector('text')?.textContent,
          { delay: effect?.getTiming().delay, movement: JSON.stringify(effect?.getKeyframes()[0]?.transform ?? null) },
        ];
      }),
    ),
  );
}

/** Opens a group's entrance dialog, picks a movement and a stagger, closes it. */
async function animateGroup(page: Page, row: ReturnType<Page['locator']>, movement: string, stagger: string) {
  await row.locator('.layer-animate').first().click();
  await page.locator('.animation-kinds button', { hasText: movement }).first().click();
  await page.getByRole('slider', { name: /Each next layer/ }).fill(stagger);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.dialog-popup')).toHaveCount(0);
}

test('a group inside a group opens on its own, and a click anywhere in it selects the outermost group', async ({ page }) => {
  await labels(page, ['A', 'B', 'C']);
  await groupNamed(page, ['A', 'B']);
  await groupNamed(page, ['Group of 2', 'C']);
  await expect(groupRows(page)).toHaveCount(1);

  await groupRows(page).first().locator('.layer-disclosure').click();
  const inner = page.locator('.layer-subgroup');
  await expect(inner).toHaveCount(1);
  // Only the outer group's own children show until the inner one is opened.
  await expect(page.locator('.layer-member')).toHaveText(['C']);

  await inner.locator('.layer-disclosure').click();
  await expect(page.locator('.layer-member')).toHaveText(['C', 'B', 'A']);

  await page.locator('.layer-member', { hasText: /^A$/ }).click();
  await expect(selectedOutlines(page)).toHaveCount(3);
});

test('ungrouping a group of groups takes off one level at a time', async ({ page }) => {
  await labels(page, ['A', 'B', 'C']);
  await groupNamed(page, ['A', 'B']);
  await groupNamed(page, ['Group of 2', 'C']);

  await fromLayerMenu(page, 'Ungroup');
  // The inner group is back at the top, still whole; C is loose.
  await expect(groupRows(page)).toHaveCount(1);
  await expect(groupRows(page).first()).toContainText('Group of 2');
  await expect(layerRows(page)).toHaveCount(2);

  await groupRows(page).first().locator('.layer-select').click();
  await fromLayerMenu(page, 'Ungroup');
  await expect(groupRows(page)).toHaveCount(0);
  await expect(layerRows(page)).toHaveCount(3);
});

test('each group has its own entrance, and timing nests', async ({ page }) => {
  // The shape from the issue: outer holds an inner group (A, B) and C.
  await labels(page, ['A', 'B', 'C']);
  await groupNamed(page, ['A', 'B']);
  await groupNamed(page, ['Group of 2', 'C']);
  const outer = groupRows(page).first();

  // Outer: pop, children 0.5s apart. Listed top first: C, then the inner group.
  await animateGroup(page, outer, 'Pop in', '0.5');
  await outer.locator('.layer-disclosure').click();
  // Inner: its own movement, members 0.2s apart, starting at its turn.
  await animateGroup(page, page.locator('.layer-subgroup'), 'Slide in from left', '0.2');

  const entrances = await playedEntrances(page);
  expect(entrances.C.delay).toBe(0);
  expect(entrances.B.delay).toBe(500);
  expect(entrances.A.delay).toBe(700);
  // The inner group plays its own movement, not the outer one's.
  expect(entrances.A.movement).toBe(entrances.B.movement);
  expect(entrances.A.movement).not.toBe(entrances.C.movement);

  // Both rows read their own settings back.
  await page.locator('.layer-subgroup .layer-animate').click();
  await expect(page.locator('.dialog-popup')).toContainText('+0.2s');
  await page.getByRole('button', { name: 'Done' }).click();
  await outer.locator('.layer-animate').click();
  await expect(page.locator('.dialog-popup')).toContainText('+0.5s');
});

test('dragging a group inside a group changes when it takes its turn', async ({ page }) => {
  await labels(page, ['A', 'B', 'C']);
  await groupNamed(page, ['A', 'B']);
  await groupNamed(page, ['Group of 2', 'C']);
  const outer = groupRows(page).first();
  await animateGroup(page, outer, 'Pop in', '0.5');
  await outer.locator('.layer-disclosure').click();

  // Listed: C, then the inner group. Drag the inner group above C.
  const children = page.locator('.layer-members > .layer-child');
  const top = (await children.nth(0).boundingBox())!;
  await page.locator('.layer-subgroup').dragTo(children.nth(0), { targetPosition: { x: top.width / 2, y: 3 } });
  await expect(page.locator('.layer-members > .layer-child').nth(0).locator('.layer-subgroup')).toHaveCount(1);

  const entrances = await playedEntrances(page);
  expect(entrances.A.delay).toBe(0);
  expect(entrances.B.delay).toBe(0);
  expect(entrances.C.delay).toBe(500);
});

test('nested groups and their entrances survive a reload', async ({ page }) => {
  await labels(page, ['A', 'B', 'C']);
  await groupNamed(page, ['A', 'B']);
  await groupNamed(page, ['Group of 2', 'C']);
  await animateGroup(page, groupRows(page).first(), 'Pop in', '0.5');
  await page.waitForTimeout(800);
  await page.reload();

  await expect(groupRows(page)).toHaveCount(1);
  await groupRows(page).first().locator('.layer-disclosure').click();
  await expect(page.locator('.layer-subgroup')).toHaveCount(1);
  const entrances = await playedEntrances(page);
  expect(entrances.C.delay).toBe(0);
  expect(entrances.B.delay).toBe(500);
});

test('a group\'s stagger is off until there is an entrance for it to space out', async ({ page }) => {
  await labels(page, ['A', 'B']);
  await groupNamed(page, ['A', 'B']);

  await groupRows(page).first().locator('.layer-animate').click();
  const stagger = page.getByRole('slider', { name: /Each next layer/ });
  await expect(stagger).toBeDisabled();
  await expect(page.locator('.dialog-popup')).toContainText('Pick an entrance to stagger the layers.');

  await page.locator('.animation-kinds button', { hasText: 'Pop in' }).first().click();
  await expect(stagger).toBeEnabled();
});
