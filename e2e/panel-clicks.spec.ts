import { test, expect, type Locator, type Page } from '@playwright/test';

// Finds a point inside `container` that is not covered by `childSelector` —
// i.e. the dead space a user hits when they miss an icon or a row.
async function deadSpaceIn(page: Page, container: Locator, childSelector: string) {
  const box = await container.boundingBox();
  if (!box) throw new Error('container has no bounding box');
  return page.evaluate(
    ({ b, sel }) => {
      for (let dy = b.height - 4; dy > 4; dy -= 5) {
        for (let dx = 4; dx < b.width; dx += 5) {
          const x = b.x + dx;
          const y = b.y + dy;
          const el = document.elementFromPoint(x, y);
          if (el && !el.closest(sel)) return { x, y };
        }
      }
      return null;
    },
    { b: box, sel: childSelector },
  );
}

test('missing an icon in the symbol grid does not switch tabs back', async ({ page }) => {
  await page.goto('/creator');

  const tabs = page.locator('.symbol-tabs button');
  // Select by position, not label, so the test survives tab renames.
  await tabs.nth(1).click();
  const secondTabName = await tabs.nth(1).innerText();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

  const point = await deadSpaceIn(page, page.locator('.symbol-grid'), '.symbol-button');
  expect(point, 'expected dead space between symbol buttons').not.toBeNull();
  await page.mouse.click(point!.x, point!.y);

  await expect(
    tabs.nth(1),
    `clicking a gap in the grid should leave "${secondTabName}" selected`,
  ).toHaveAttribute('aria-selected', 'true');
});

test('missing a row in the layer list does not select a layer', async ({ page }) => {
  await page.goto('/creator');

  const selected = page.locator('.layer-row[data-active="true"]');
  await expect(selected).toHaveCount(0);

  const point = await deadSpaceIn(page, page.locator('.layer-list'), '.layer-row');
  expect(point, 'expected dead space around the layer rows').not.toBeNull();
  await page.mouse.click(point!.x, point!.y);

  await expect(selected).toHaveCount(0);
});
