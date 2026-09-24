import { test, expect, type Page } from '@playwright/test';
import { templates } from '../src/data';

// Every template is laid out by the text model in canvasGeometry, and the Jest
// overlap test checks that layout against the same model. That catches a
// template that is wrong by the model's own numbers, but not a model that is
// wrong about the font -- which is exactly how five templates came to run off
// the artboard while that test stayed green: the model left out the canvas's
// letter spacing, so it believed full-width dash rules fit when they did not.
//
// So this measures what Chromium actually paints. Every glyph of every
// template has to land inside the 1200 x 800 artboard.

const ARTBOARD = { width: 1200, height: 800 };

async function chooseTemplate(page: Page, name: string) {
  await page.locator('.select-trigger').first().click();
  await page.locator('.select-item', { hasText: name }).click();
  await expect(page.locator('.select-trigger').first()).toContainText(name);
}

/** The painted box of every text item, in artboard units. */
async function paintedTextBoxes(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const svg = document.querySelector('svg[viewBox="0 0 1200 800"]') as SVGSVGElement;
    const toArtboard = svg.getScreenCTM()!.inverse();
    return [...svg.querySelectorAll('.canvas-item text')].map((node) => {
      const text = node as SVGTextElement;
      const box = text.getBBox();
      // getBBox is in the element's own space; carry its corners out through
      // the item's translate and rotate to artboard units.
      const toScreen = text.getScreenCTM()!;
      const corners = [
        [box.x, box.y],
        [box.x + box.width, box.y],
        [box.x, box.y + box.height],
        [box.x + box.width, box.y + box.height],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(toScreen).matrixTransform(toArtboard));
      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      return {
        text: (text.textContent ?? '').slice(0, 40),
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
      };
    });
  });
}

for (const template of templates) {
  test(`${template.name} paints every line of text inside the artboard`, async ({ page }) => {
    await page.goto('/creator');
    await chooseTemplate(page, template.name);

    const boxes = await paintedTextBoxes(page);
    const outside = boxes.filter(
      (box) => box.left < 0 || box.top < 0 || box.right > ARTBOARD.width || box.bottom > ARTBOARD.height,
    );

    // Named, so a failure says which line escaped and by how much.
    expect(
      outside.map((box) => `"${box.text}" spans x ${box.left.toFixed(0)}-${box.right.toFixed(0)}, y ${box.top.toFixed(0)}-${box.bottom.toFixed(0)}`),
    ).toEqual([]);
  });
}
