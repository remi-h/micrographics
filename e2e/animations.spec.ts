import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

// Entrances are described once (src/animations.ts) and played two ways: on the
// canvas through the Web Animations API, and in the exported .svg as CSS. The
// unit tests cover the description; what a browser has to prove is that both
// players actually honour it -- and, in particular, that the CSS transform
// composes with the transform that positions the item rather than replacing it.

const animateButtons = (page: Page) => page.locator('.layer-animate');
const playButton = (page: Page) => page.locator('.stage-play');
const wrappers = (page: Page) => page.locator('g[class^="mg-anim-"]');

// Every format is chosen inside one Export dialog now, so both downloads are
// two steps.
async function openExportDialog(page: Page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function exportSvg(page: Page) {
  await openExportDialog(page);
  await page.locator('.export-option').filter({ hasText: 'SVG' }).click();
}

async function giveTopLayerAnEntrance(page: Page, label: string) {
  await animateButtons(page).first().click();
  await expect(page.locator('.dialog-popup')).toBeVisible();
  await page.locator('.animation-kinds button', { hasText: label }).first().click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.dialog-popup')).toHaveCount(0);
}

/** The geometry of the animated item, and of the wrapper carrying its entrance. */
function animatedGeometry(page: Page) {
  return page.evaluate(() => {
    const wrapper = document.querySelector('g[class^="mg-anim-"]');
    const item = wrapper?.querySelector('.canvas-item');
    if (!wrapper || !item) return null;

    const box = item.getBoundingClientRect();
    const style = getComputedStyle(wrapper);
    return {
      itemTransformAttribute: item.getAttribute('transform'),
      left: Math.round(box.x),
      centreX: Math.round(box.x + box.width / 2),
      centreY: Math.round(box.y + box.height / 2),
      width: Math.round(box.width),
      opacity: style.opacity,
      wrapperTransform: style.transform,
    };
  });
}

test('every layer offers an entrance, and adding one reveals Play', async ({ page }) => {
  await page.goto('/creator');

  await expect(animateButtons(page).first()).toBeVisible();
  await expect(playButton(page)).toHaveCount(0);
  await expect(wrappers(page)).toHaveCount(0);

  await giveTopLayerAnEntrance(page, 'Dissolve in');

  await expect(playButton(page)).toBeVisible();
  await expect(wrappers(page)).toHaveCount(1);
  await expect(animateButtons(page).first()).toHaveAttribute('data-on', 'true');
});

test('a slide moves the item and puts it back exactly where it was', async ({ page }) => {
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Slide in from left');

  const resting = await animatedGeometry(page);
  expect(resting).not.toBeNull();

  await playButton(page).click();

  // Mid-flight: shifted left of where it rests, and still transparent.
  await expect
    .poll(async () => {
      const now = await animatedGeometry(page);
      return now && now.left < resting!.left ? 'moved' : 'still';
    })
    .toBe('moved');

  // The item's own transform attribute is untouched throughout. If the CSS
  // transform were applied to the item's group instead of a wrapper it would
  // override that attribute, and the item would fly in from the canvas origin
  // rather than from beside its own position.
  const midway = await animatedGeometry(page);
  expect(midway!.itemTransformAttribute).toBe(resting!.itemTransformAttribute);

  await expect.poll(async () => (await animatedGeometry(page))!.left).toBe(resting!.left);
  await expect.poll(async () => (await animatedGeometry(page))!.opacity).toBe('1');
});

test('a pop grows in place rather than flying in from the canvas corner', async ({ page }) => {
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Pop in');

  const resting = await animatedGeometry(page);
  await playButton(page).click();

  // Scaling an SVG group defaults to an origin at the canvas corner, which
  // sends the item across the artboard instead of growing it where it stands.
  await expect
    .poll(async () => {
      const now = await animatedGeometry(page);
      return now && now.width < resting!.width ? 'smaller' : 'same';
    })
    .toBe('smaller');

  const midway = await animatedGeometry(page);
  const drift = Math.hypot(midway!.centreX - resting!.centreX, midway!.centreY - resting!.centreY);
  expect(drift, 'a pop must keep the item centred where it sits').toBeLessThanOrEqual(2);
});

test('an entrance can be taken off again', async ({ page }) => {
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Dissolve in');
  await expect(playButton(page)).toBeVisible();

  await animateButtons(page).first().click();
  await page.getByRole('button', { name: 'Remove' }).click();

  await expect(playButton(page)).toHaveCount(0);
  await expect(wrappers(page)).toHaveCount(0);
});

test('an entrance survives a reload', async ({ page }) => {
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Pop in');

  // The editor autosaves on a debounce; give it the write before reloading.
  await page.waitForTimeout(700);
  await page.reload();

  await expect(playButton(page)).toBeVisible();
  await expect(animateButtons(page).first()).toHaveAttribute('data-on', 'true');
});

test('the exported SVG carries the entrance, and still reads as the finished artwork', async ({ page }) => {
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Slide in from left');

  const resting = await animatedGeometry(page);

  const download = await Promise.all([
    page.waitForEvent('download'),
    exportSvg(page),
  ]).then(([event]) => event);
  const markup = await readFile(await download.path(), 'utf8');

  expect(markup).toContain('@keyframes mg-slide-left');
  expect(markup).toContain('mg-anim-');
  // The element keeps its own position. The entrance is a departure from that
  // which resolves back to it, so a viewer with no CSS animation support shows
  // the poster rather than the first frame.
  expect(markup).toContain(resting!.itemTransformAttribute!);

  // And it really runs: put the exported file in a document and ask the
  // browser what it made of it.
  const played = await page.evaluate(async (file) => {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;opacity:0.01';
    holder.innerHTML = file;
    document.body.append(holder);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const node = holder.querySelector('[class^="mg-anim-"]');
    const result = node
      ? { animations: node.getAnimations().length, name: getComputedStyle(node).animationName }
      : null;
    holder.remove();
    return result;
  }, markup);

  expect(played).toEqual({ animations: 1, name: 'mg-slide-left' });
});

test('the PNG export is the finished artwork, not the first frame of an entrance', async ({ page }) => {
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Slide in from left');

  // A PNG is one frame. Writing the entrance into it would rasterize an item
  // that is transparent and 240 units off to the left.
  const download = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await openExportDialog(page);
      await page.locator('.size-option').first().click();
    })(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('micrographic.png');
});

test('two entrances can be ordered by their delays', async ({ page }) => {
  await page.goto('/creator');

  // The first layer arrives immediately; give the second one a wait.
  await giveTopLayerAnEntrance(page, 'Dissolve in');
  await animateButtons(page).nth(1).click();
  await expect(page.locator('.dialog-popup')).toBeVisible();
  await page.locator('.animation-kinds button', { hasText: 'Dissolve in' }).first().click();

  const delay = page.locator('.animation-field').filter({ hasText: 'Starts after' }).locator('input');
  await delay.fill('2');
  await delay.dispatchEvent('change');
  await expect(page.locator('.animation-field').filter({ hasText: 'Starts after' })).toContainText('2.0s');
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(wrappers(page)).toHaveCount(2);
  await playButton(page).click();

  // Sampled once rather than polled: "one has started, the other is still
  // waiting" is a state that passes, and a poll would retry straight through
  // it and only ever see the settled canvas. 400ms is well inside the second
  // one's two-second wait and past the first one's start.
  await page.waitForTimeout(400);
  const started = await page.evaluate(() =>
    [...document.querySelectorAll('g[class^="mg-anim-"]')].map((node) => Number(getComputedStyle(node).opacity) > 0),
  );

  expect(started.filter(Boolean), 'exactly one entrance should have begun').toHaveLength(1);

  // And once the wait is over, both have arrived.
  await expect
    .poll(async () =>
      page.evaluate(() =>
        [...document.querySelectorAll('g[class^="mg-anim-"]')].every((node) => getComputedStyle(node).opacity === '1'),
      ),
    )
    .toBe(true);
});

test('a slider drag is one undo step, not one per step of the drag', async ({ page }) => {
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Slide in from left');

  await animateButtons(page).first().click();
  const field = page.locator('.animation-field').filter({ hasText: 'Starts after' });
  await expect(field).toContainText('0.0s');

  // A real drag, not fill(): a range input fires a change per step, and the
  // delay slider spans 0 to 10 at 0.1, so this is about a hundred of them --
  // against a history that holds fifty. One entry per step would push every
  // real edit out of the undo stack before the thumb reached the other end.
  const slider = field.locator('input');
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 2, box!.y + box!.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 20; step += 1) {
    await page.mouse.move(box!.x + (box!.width * step) / 20, box!.y + box!.height / 2);
  }
  await page.mouse.up();
  await expect(field).toContainText('10.0s');

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.dialog-popup')).toHaveCount(0);

  // One undo puts the delay back where the drag started, rather than stepping
  // it back a tenth of a second at a time.
  await page.keyboard.press('ControlOrMeta+z');
  await animateButtons(page).first().click();
  await expect(page.locator('.animation-field').filter({ hasText: 'Starts after' })).toContainText('0.0s');
});

test('a copy of an animated item does not play its entrance by itself', async ({ page }) => {
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Slide in from left');

  // Play once, so the token is past zero. A layer mounting after that -- the
  // copy below, or an item brought back by undo -- must not take the token as
  // an instruction meant for it.
  await playButton(page).click();
  await expect.poll(async () => (await animatedGeometry(page))!.opacity).toBe('1');

  await page.locator('.layer-select').first().click();
  await page.keyboard.press('ControlOrMeta+d');
  await expect(wrappers(page)).toHaveCount(2);

  const opacities = await page.evaluate(() =>
    [...document.querySelectorAll('g[class^="mg-anim-"]')].map((node) => getComputedStyle(node).opacity),
  );
  expect(opacities, 'nothing should animate unless Play was pressed').toEqual(['1', '1']);
});

test('the Layers list fits its panel, however long a layer is named', async ({ page }) => {
  await page.goto('/creator');

  // The row is a grid item, and the layer name does not wrap, so without an
  // explicit minimum the list's single column grows to the longest name and
  // scrolls sideways -- carrying the animation control off the panel.
  const fit = await page.evaluate(() => {
    const list = document.querySelector('.layer-list') as HTMLElement;
    const edge = list.getBoundingClientRect().right;
    const controls = [...document.querySelectorAll('.layer-animate')] as HTMLElement[];
    const names = [...document.querySelectorAll('.layer-name')] as HTMLElement[];
    return {
      overflow: list.scrollWidth - list.clientWidth,
      controlsOffPanel: controls.filter((node) => node.getBoundingClientRect().right > edge + 0.5).length,
      truncatedSomething: names.some((node) => node.scrollWidth > node.clientWidth),
    };
  });

  expect(fit.overflow).toBe(0);
  expect(fit.controlsOffPanel, 'every layer must be able to reach its animation control').toBe(0);
  // The default template has a label long enough to need it, so this also
  // pins that the name truncates rather than pushing the row wider.
  expect(fit.truncatedSomething).toBe(true);
});

// One Export control, three formats, and the dialog has to be honest about
// which of them keep the animation: a PNG is a single frame, so choosing it
// silently drops the entrances the user just set up.
test('the export dialog offers every format and says which ones animate', async ({ page }) => {
  await page.goto('/creator');
  await openExportDialog(page);

  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.export-option').filter({ hasText: 'SVG' })).toBeVisible();
  await expect(dialog.locator('.size-option')).toHaveCount(3);

  const gif = dialog.locator('.export-option').filter({ hasText: 'GIF' });
  await expect(gif).toBeVisible();
  // Nothing animates yet, so there is no GIF to make and nothing to warn about.
  await expect(gif).toBeDisabled();
  await expect(dialog).not.toContainText('Only SVG and GIF');

  await page.getByRole('button', { name: 'Cancel' }).click();
  await giveTopLayerAnEntrance(page, 'Slide in from left');
  await openExportDialog(page);

  await expect(dialog).toContainText('Only SVG and GIF carry the animation');
  await expect(dialog.locator('.export-option').filter({ hasText: 'GIF' })).toBeEnabled();
});

test('the GIF export writes a real animated gif', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Pop in');

  await openExportDialog(page);
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-option').filter({ hasText: 'GIF' }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('micrographic.gif');
  const file = await readFile(await download.path());

  // GIF89a, then the logical screen size as two little-endian uint16s.
  expect(file.subarray(0, 6).toString('latin1')).toBe('GIF89a');
  expect(file.readUInt16LE(6)).toBe(1200);
  expect(file.readUInt16LE(8)).toBe(800);

  // More than one image descriptor (0x2C) means it actually animates rather
  // than being a still wearing a .gif extension.
  let frames = 0;
  for (let at = 0; at < file.length; at += 1) if (file[at] === 0x2c) frames += 1;
  expect(frames).toBeGreaterThan(5);
});

// A GIF's transparency is one bit: fully clear or fully opaque, nothing
// between. An entrance is made of the in-between, so on a transparent artboard
// there is nothing honest to write -- dropping alpha, which is what a GIF
// palette does, bakes a half-faded item in at full strength and fills the empty
// canvas with black. The frames are laid on the paper colour for that reason,
// and this checks it holds with `Include background` switched off, which is the
// only way to reach a transparent artboard.
test('a GIF exported with the background off is still opaque, not black', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/creator');
  await giveTopLayerAnEntrance(page, 'Dissolve in');
  // A Base UI Switch inside a <label>, so it is reached by role rather than
  // by the label association a native checkbox would have.
  const background = page.locator('.toggle-row', { hasText: 'Include background' }).getByRole('switch');
  await expect(background).toHaveAttribute('aria-checked', 'true');
  await background.click();
  await expect(background).toHaveAttribute('aria-checked', 'false');

  await openExportDialog(page);
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-option').filter({ hasText: 'GIF' }).click(),
  ]).then(([event]) => event);

  const file = await readFile(await download.path());

  // Decode the first frame in the browser and look at the corner, which no
  // item covers. Black there is the bug; the paper colour is the fix.
  const corner = await page.evaluate(async (bytes) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    // On a colour of its own, so a transparent GIF pixel is visibly not the
    // paper rather than silently compositing to something plausible.
    context.fillStyle = '#ff00ff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    const [r, g, b] = context.getImageData(4, 4, 1, 1).data;
    return { r, g, b };
  }, [...file]);

  expect(corner, 'the empty corner should not have encoded as black').not.toEqual({ r: 0, g: 0, b: 0 });
  // Nor left transparent, which would show the magenta underneath.
  expect(corner, 'the empty corner should not have been left transparent').not.toEqual({ r: 255, g: 0, b: 255 });
});
