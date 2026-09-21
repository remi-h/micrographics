import { test, expect, type Page } from '@playwright/test';

// Zooming re-centres the artboard on whatever is selected. That effect reads
// the selection and the canvas items but must not *react* to them: it is
// triggered by the zoom alone, so selecting or nudging an item never yanks the
// viewport. Both halves of that contract are asserted here, because the
// obvious "fix" for the effect's dependency array breaks the second one.
const ZOOM_CLICKS = 10;

function artboard(page: Page) {
  return page.locator('.artboard-wrap');
}

async function scrollOffset(page: Page) {
  return artboard(page).evaluate((node) => node.scrollLeft + node.scrollTop);
}

async function resetScroll(page: Page) {
  await artboard(page).evaluate((node) => node.scrollTo(0, 0));
  expect(await scrollOffset(page)).toBe(0);
}

// Zoom far enough in that the artboard is bigger than the frame around it and
// there is somewhere to scroll to.
async function zoomIn(page: Page, times: number) {
  const zoomInButton = page.getByRole('button', { name: 'Zoom in' });
  for (let index = 0; index < times; index += 1) {
    await zoomInButton.click();
  }
}

test('zooming scrolls the artboard back onto the selection', async ({ page }) => {
  await page.goto('/creator');

  await page.locator('.layer-row').first().click();
  await expect(page.locator('.layer-row[data-active="true"]')).toHaveCount(1);

  await zoomIn(page, ZOOM_CLICKS);
  await resetScroll(page);

  await zoomIn(page, 1);
  await expect
    .poll(() => scrollOffset(page), { message: 'zooming should scroll the selection back into view' })
    .toBeGreaterThan(0);
});

test('selecting an item leaves the artboard scroll alone', async ({ page }) => {
  await page.goto('/creator');

  await zoomIn(page, ZOOM_CLICKS);
  await resetScroll(page);

  const rows = page.locator('.layer-row');
  const count = await rows.count();
  expect(count).toBeGreaterThan(1);

  await rows.first().click();
  await expect(page.locator('.layer-row[data-active="true"]')).toHaveCount(1);
  await rows.nth(1).click();

  // Give the scroll effect the frame it would have used, then confirm it did
  // not fire: the viewport stays where the user left it.
  await page.waitForTimeout(250);
  expect(await scrollOffset(page), 'selecting an item should not move the artboard').toBe(0);
});
