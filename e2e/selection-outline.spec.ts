import { test, expect, type Page } from '@playwright/test';

// The selection outline used to be drawn from an estimate of an item's size
// rather than from what it actually renders. For text the estimate
// (chars * size * 0.62) left out the letterSpacing applied to <text>, so long
// strings spilled past the right edge of their own outline. Measure the drawn
// outline against the drawn ink and assert the ink is inside it.
async function selectionPadding(page: Page) {
  return page.evaluate(() => {
    const out: Array<{ type: string; left: number; right: number; top: number; bottom: number }> = [];
    document.querySelectorAll('g.canvas-item').forEach((group) => {
      const outline = group.querySelector('rect[stroke-dasharray]');
      if (!outline) return;

      const ink = [...group.querySelectorAll('g[transform*="scale"], text')];
      if (ink.length === 0) return;

      const boxes = ink.map((node) => node.getBoundingClientRect());
      const frame = outline.getBoundingClientRect();
      out.push({
        type: ink[0].tagName,
        left: Math.min(...boxes.map((box) => box.left)) - frame.left,
        right: frame.right - Math.max(...boxes.map((box) => box.right)),
        top: Math.min(...boxes.map((box) => box.top)) - frame.top,
        bottom: frame.bottom - Math.max(...boxes.map((box) => box.bottom)),
      });
    });
    return out;
  });
}

function expectInkInsideOutline(rows: Awaited<ReturnType<typeof selectionPadding>>, label: string) {
  expect(rows, `expected one selected ${label}`).toHaveLength(1);
  const [row] = rows;
  for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    expect(row[edge], `${label}: ink crosses the outline's ${edge} edge`).toBeGreaterThanOrEqual(0);
  }
}

test('a selected symbol sits inside its selection outline', async ({ page }) => {
  await page.goto('/creator');
  await page.locator('.symbol-button').first().click();

  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(1);
  expectInkInsideOutline(await selectionPadding(page), 'symbol');
});

test('a selected text item sits inside its selection outline', async ({ page }) => {
  await page.goto('/creator');

  // Pick a text layer out of the Layers list; template text is long enough that
  // the old width estimate under-measured it noticeably.
  const rows = page.locator('.layer-row');
  const count = await rows.count();
  let picked = false;
  for (let index = 0; index < count; index += 1) {
    if (!/symbol/i.test(await rows.nth(index).innerText())) {
      await rows.nth(index).click();
      picked = true;
      break;
    }
  }
  expect(picked, 'expected a text layer in the default template').toBe(true);

  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(1);
  expectInkInsideOutline(await selectionPadding(page), 'text');
});
