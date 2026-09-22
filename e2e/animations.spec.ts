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
    page.getByRole('button', { name: 'Export SVG' }).click(),
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
      await page.getByRole('button', { name: 'Export PNG' }).click();
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
