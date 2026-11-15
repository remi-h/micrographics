import { test, expect, type Page } from '@playwright/test';
import { openStillCreator } from './still-template';

// Dragging the rotate handle with Shift held snaps the item's absolute angle to
// 15 degree steps, and with Alt/Option to quarter turns (src/lib/rotation.ts).
// A unit test covers the arithmetic; this covers the part it cannot: that the
// modifier on a real pointer drag reaches the handler, and that the drag is
// still one undo step.

function selectedItem(page: Page) {
  return page.locator('.artboard .canvas-item:has(rect[stroke-dasharray])').first();
}

// Canvas items are placed with `translate(x y) rotate(r)`.
async function selectedRotation(page: Page) {
  const transform = (await selectedItem(page).getAttribute('transform')) ?? '';
  return Number(/rotate\(\s*(-?[\d.]+)/.exec(transform)?.[1]);
}

// The selected item's anchor -- what it turns about -- in page pixels.
async function selectedCenter(page: Page) {
  return selectedItem(page).evaluate((node) => {
    const group = node as SVGGElement;
    const matrix = group.getScreenCTM()!;
    return { x: matrix.e, y: matrix.f };
  });
}

// Drags the rotate handle `degrees` clockwise round the item's anchor.
async function dragHandle(page: Page, degrees: number) {
  const center = await selectedCenter(page);
  const handle = (await selectedItem(page).locator('.rotate-handle circle').first().boundingBox())!;
  const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
  const radians = (degrees * Math.PI) / 180;
  const dx = start.x - center.x;
  const dy = start.y - center.y;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    center.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    { steps: 10 },
  );
  await page.mouse.up();
}

test('Shift snaps a rotate drag to 15 degrees and Alt to quarter turns, each one undo step', async ({ page }) => {
  await openStillCreator(page);
  await page.locator('.layer-row').first().click();
  await expect(selectedItem(page)).toBeVisible();

  // A free drag first, to a deliberately off-grid angle.
  await dragHandle(page, 37);
  const free = await selectedRotation(page);
  // Well clear of a 15 degree line, so a snap could not pass for it.
  expect(Math.abs(free - Math.round(free / 15) * 15)).toBeGreaterThan(1);

  await page.keyboard.down('Shift');
  await dragHandle(page, 20);
  await page.keyboard.up('Shift');
  const fine = await selectedRotation(page);
  expect(fine % 15).toBe(0);
  expect(Math.abs(fine - (free + 20))).toBeLessThanOrEqual(7.5 + 1);

  await page.keyboard.down('Alt');
  await dragHandle(page, 100);
  await page.keyboard.up('Alt');
  const quarter = await selectedRotation(page);
  expect(quarter % 90).toBe(0);

  // Each drag, snapped or not, undoes in one press.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => selectedRotation(page)).toBe(fine);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => selectedRotation(page)).toBe(free);
});

// Shift turns `[` into `{` on a US keyboard, so a handler matching the key
// alone never saw Shift+[ and the 45 degree step did nothing.
test('Shift + [ and ] rotate 45 degrees from the keyboard', async ({ page }) => {
  await openStillCreator(page);
  await page.locator('.layer-row').first().click();
  await expect(selectedItem(page)).toBeVisible();
  const start = await selectedRotation(page);

  await page.keyboard.press('Shift+BracketRight');
  await expect.poll(() => selectedRotation(page)).toBe((start + 45) % 360);
  await page.keyboard.press('Shift+BracketLeft');
  await expect.poll(() => selectedRotation(page)).toBe(start);
});
