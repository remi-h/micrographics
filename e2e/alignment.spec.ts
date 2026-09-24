import { test, expect, type Page } from '@playwright/test';

// Aligning is judged entirely by eye, so the thing to prove in a browser is
// that the glyphs line up -- not that a model number matches. These measure
// what Chromium actually painted, through getBBox on the rendered items.
//
// The arithmetic behind it is unit-tested in src/useCanvasItems.test.ts.

const layerRows = (page: Page) => page.locator('.layer-row');
const alignVertical = (page: Page) => page.getByTitle('Align vertical centers');

/**
 * The painted middle of each selected item, in artboard units. The page opens
 * on a template, so the selected pair is found by its outline. Glyphs only --
 * the outline, handles and transparent hit rect sit in the same group, and
 * the hit rect is exactly the padded box that used to be aligned instead.
 */
async function paintedMiddles(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[viewBox="0 0 1200 800"]') as SVGSVGElement;
    // getScreenCTM through the artboard's inverse, rather than getCTM: the
    // latter stops at the SVG viewport, which is scaled to the page, so its
    // numbers are CSS pixels and not the artboard's own units.
    const toArtboard = svg.getScreenCTM()!.inverse();
    return [...document.querySelectorAll('.canvas-item:has(rect[stroke-dasharray])')]
      .map((group) => {
        const glyphs = group.querySelector('g[transform^="scale"], text') as SVGGraphicsElement | null;
        if (!glyphs) return { x: NaN, y: NaN };
        const box = glyphs.getBBox();
        const middle = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
          .matrixTransform(glyphs.getScreenCTM()!)
          .matrixTransform(toArtboard);
        return { x: middle.x, y: middle.y };
      })
      .filter((point) => Number.isFinite(point.x));
  });
}

const alignHorizontal = (page: Page) => page.getByTitle('Align horizontal centers');

/** A symbol and a label, both added fresh and selected together. */
async function selectMarkAndLabel(page: Page, label: string) {
  await page.goto('/creator');
  await page.locator('.symbol-button').first().click();
  await page.locator('.text-input').fill(label);
  await page.locator('.add-button').click();
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(2);
}

// Two labels that go wrong for different reasons. "CE" is short enough that
// its click box is padded out to a minimum width, all of it on the right, so
// measuring the click box centred it 19 units off. The care label is long
// enough that the canvas's letter spacing -- two units after every character,
// which the old width estimate never counted -- adds up to 90 units, and it
// centred 37 units off. That second one is what was reported: the model
// thought the line was 502 wide, and Chromium draws it 577.
const LABELS = [
  { name: 'a short label', text: 'CE' },
  { name: 'a long care label', text: 'MACHINE WASH COLD / DO NOT BLEACH / WARM IRON' },
];

for (const label of LABELS) {
  test(`aligning vertical centres lines ${label.name} up with a mark on screen`, async ({ page }) => {
    await selectMarkAndLabel(page, label.text);

    const before = await paintedMiddles(page);
    await alignVertical(page).click();
    const after = await paintedMiddles(page);

    // Something moved, so the assertion below is not passing by accident.
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));

    // Measured on what Chromium painted, not on the model: the two middles
    // share a vertical axis to within two artboard units of 1200. The long
    // label is wider than the artboard at the size a new item is added at, so
    // this also covers the case where the old per-item clamp pulled the label
    // 136 units off the axis it had just been aligned to.
    const xs = after.map((point) => point.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(2);
  });

  test(`aligning horizontal centres lines ${label.name} up with a mark on screen`, async ({ page }) => {
    await selectMarkAndLabel(page, label.text);

    await alignHorizontal(page).click();
    const after = await paintedMiddles(page);

    // Vertically the old model put the top of a line a full em above the
    // baseline, where Plex Mono's ascent is 0.93, so a label sat a tenth of
    // its size high of a mark it had been centred on.
    const ys = after.map((point) => point.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
  });
}

// The reported case, on the template itself rather than on items added for
// the test. The care label is a centred column, and every line in it used to
// be placed by a hand-computed start derived from the old width estimate, so
// the column painted off its own axis -- the wash label by 43 units -- before
// anyone pressed align.
test('the care label paints its column on one axis, and aligning keeps it there', async ({ page }) => {
  await page.goto('/creator');
  await page.locator('.select-trigger').first().click();
  await page.locator('.select-item', { hasText: 'Care Label' }).click();

  const middles = await page.evaluate(() => {
    const svg = document.querySelector('svg[viewBox="0 0 1200 800"]') as SVGSVGElement;
    const toArtboard = svg.getScreenCTM()!.inverse();
    // Text items only: `> text` skips the "30" and "P" drawn inside the wash
    // and dry-clean symbols, which sit on their own marks, not on the axis.
    return [...svg.querySelectorAll('.canvas-item > text')].map((node) => {
      const text = node as SVGTextElement;
      const box = text.getBBox();
      const middle = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
        .matrixTransform(text.getScreenCTM()!)
        .matrixTransform(toArtboard);
      return { text: text.textContent ?? '', x: middle.x };
    });
  });

  // Every line of the column -- rules, brand, wash label, composition, size,
  // serial -- centred on 600 as Chromium paints it.
  const offAxis = middles.filter((line) => Math.abs(line.x - 600) > 2);
  expect(offAxis.map((line) => `"${line.text.slice(0, 30)}" at ${line.x.toFixed(1)}`)).toEqual([]);

  // The mark in the middle of the row and the wash label beneath it: select
  // both and align vertical centres, as in the report.
  await page.locator('.layer-row', { hasText: 'tumble-dry symbol' }).click();
  await page.locator('.layer-row', { hasText: 'MACHINE WASH COLD' }).click({ modifiers: ['Shift'] });
  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(2);
  await alignVertical(page).click();

  const after = await paintedMiddles(page);
  const xs = after.map((point) => point.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(2);
  // Already on the axis, so aligning them should not have moved them off it.
  for (const x of xs) expect(Math.abs(x - 600)).toBeLessThan(2);
});
