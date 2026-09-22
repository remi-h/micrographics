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

// Template text is long enough that the old width estimate under-measured it
// noticeably, so it is the case worth selecting.
async function selectATextLayer(page: Page) {
  const rows = page.locator('.layer-row');
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    if (!/symbol/i.test(await rows.nth(index).innerText())) {
      await rows.nth(index).click();
      return;
    }
  }
  throw new Error('expected a text layer in the default template');
}

test('a selected text item sits inside its selection outline', async ({ page }) => {
  await page.goto('/creator');
  await selectATextLayer(page);

  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(1);
  expectInkInsideOutline(await selectionPadding(page), 'text');
});

// Resizing is where the outline used to come apart. It was measured with
// getBBox() in an effect, so a measurement only landed on the render *after*
// the one that had already grown the glyphs: for one frame out of every two the
// border was drawn around the previous size, and a long line of text spilled
// out of the left and right edges of its own selection. Watching it only
// between drag steps hides that -- React has settled by then -- so sample from
// inside the page, on every animation frame, while the drag is running.
async function watchPaddingDuringDrag(page: Page) {
  await page.evaluate(() => {
    const samples: Array<{ left: number; right: number; top: number; bottom: number; width: number }> = [];
    (window as unknown as { __padding: typeof samples }).__padding = samples;

    const sample = () => {
      const group = document.querySelector('.resize-handle')?.closest('g.canvas-item');
      const outline = group?.querySelector('rect[stroke-dasharray]');
      const ink = group?.querySelector('g[transform*="scale"], text');
      if (outline && ink) {
        const frame = outline.getBoundingClientRect();
        const box = ink.getBoundingClientRect();
        if (box.width > 0) {
          samples.push({
            bottom: frame.bottom - box.bottom,
            left: box.left - frame.left,
            right: frame.right - box.right,
            top: box.top - frame.top,
            width: box.width,
          });
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function dragTheResizeHandle(page: Page) {
  const handle = page.locator('.resize-handle').first();
  const box = await handle.boundingBox();
  expect(box, 'expected a resize handle on the selected item').not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  // Out and then back in, so the outline is checked while the item is growing
  // and while it is shrinking -- scaling a measurement gets one of those two
  // wrong if the letter spacing is scaled along with the glyphs.
  for (let step = 1; step <= 16; step += 1) await page.mouse.move(x + step * 6, y + step * 6);
  for (let step = 15; step >= -6; step -= 1) await page.mouse.move(x + step * 6, y + step * 6);
  await page.mouse.up();
}

test('a text item stays inside its outline all the way through a resize', async ({ page }) => {
  await page.goto('/creator');
  await selectATextLayer(page);
  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(1);

  await watchPaddingDuringDrag(page);
  await dragTheResizeHandle(page);

  const samples = await page.evaluate(
    () => (window as unknown as { __padding: Array<Record<string, number>> }).__padding,
  );

  // The drag has to have actually changed the item's size, or the assertions
  // below pass on an item that never moved.
  const widths = samples.map((entry) => entry.width);
  expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths) * 1.5);
  expect(samples.length).toBeGreaterThan(10);

  for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    const worst = Math.min(...samples.map((entry) => entry[edge]));
    expect(worst, `text crossed the outline's ${edge} edge mid-drag`).toBeGreaterThanOrEqual(0);
  }
});

test('a symbol stays inside its outline all the way through a resize', async ({ page }) => {
  await page.goto('/creator');
  await page.locator('.symbol-button').first().click();
  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(1);

  await watchPaddingDuringDrag(page);
  await dragTheResizeHandle(page);

  const samples = await page.evaluate(
    () => (window as unknown as { __padding: Array<Record<string, number>> }).__padding,
  );

  expect(samples.length).toBeGreaterThan(10);
  for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    const worst = Math.min(...samples.map((entry) => entry[edge]));
    expect(worst, `symbol crossed the outline's ${edge} edge mid-drag`).toBeGreaterThanOrEqual(0);
  }
});
