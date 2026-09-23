import { test, expect, type Page } from '@playwright/test';

// Aligning is judged entirely by eye, so the thing to prove in a browser is
// that the glyphs line up -- not that a model number matches. These measure
// what Chromium actually painted, through getBBox on the rendered items.
//
// The arithmetic behind it is unit-tested in src/useCanvasItems.test.ts.

const layerRows = (page: Page) => page.locator('.layer-row');
const alignVertical = (page: Page) => page.getByTitle('Align vertical centers');

/** The painted middle of each selected item, in canvas units. The page opens
 *  on a template, so the selected two are found by their outline rather than
 *  by taking every item on the canvas. */
async function paintedMiddles(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.canvas-item:has(rect[stroke-dasharray])')]
      .map((group) => {
        // The glyphs only: the outline, the handles and the transparent hit
        // rect all sit in this group too, and the hit rect is exactly the
        // padded box this fix is about.
        const glyphs = group.querySelector('g[transform^="scale"], text');
        if (!glyphs) return { x: NaN, y: NaN };
        const box = (glyphs as SVGGraphicsElement).getBBox();
        const local = (glyphs as SVGGraphicsElement).getCTM();
        // getBBox excludes the element's own transform, so the item's
        // translate/rotate is applied by hand to get canvas coordinates.
        // getBBox is in the element's own space; map its middle out through
        // the transform chain so rotation and scale are accounted for.
        const middle = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(local!);
        return { x: middle.x, y: middle.y };
      })
      .filter((point) => Number.isFinite(point.x)),
  );
}

test('aligning centres puts a label and a mark on the same axis on screen', async ({ page }) => {
  await page.goto('/creator');

  // A symbol and a deliberately short label, selected together. Short because
  // that is what trips the minimum-width floor on the click box.
  await page.locator('.symbol-button').first().click();
  await page.locator('.text-input').fill('CE');
  await page.locator('.add-button').click();
  await layerRows(page).nth(0).click();
  await layerRows(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(2);

  const before = await paintedMiddles(page);
  await alignVertical(page).click();
  const after = await paintedMiddles(page);

  // Something moved, so the assertion below is not passing by accident.
  expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));

  // The two selected items now share a vertical axis, to within a unit of the
  // 1200-wide artboard. Measured against the padded click box instead of the
  // glyphs, a short label lands 19 units off this.
  const xs = after.map((point) => point.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1);
});
