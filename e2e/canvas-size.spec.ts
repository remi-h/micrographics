import { test, expect, type Page } from '@playwright/test';

// An uploaded background used to be drawn into a fixed 1200 x 800 frame with
// `slice`, so a portrait photo came out as its middle landscape strip
// (issue #25). The artboard now takes the image's shape, and Canvas size
// switches it between presets.

// A 3:4 portrait image. An SVG with a width and height has a natural size an
// <img> reports, which is all the upload reads.
const PORTRAIT_IMAGE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#c33"/></svg>',
);

const artboard = (page: Page) => page.locator('svg.artboard');
const sizeControl = (page: Page) => page.getByRole('combobox', { name: 'Canvas size' });

/** Every item's painted box, as fractions of the artboard. */
async function itemBoxes(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg.artboard') as SVGSVGElement;
    const frame = svg.getBoundingClientRect();
    return [...svg.querySelectorAll('.canvas-item')].map((node) => {
      const box = node.getBoundingClientRect();
      return {
        left: (box.left - frame.left) / frame.width,
        right: (box.right - frame.left) / frame.width,
      };
    });
  });
}

test('uploading a portrait background makes the canvas portrait', async ({ page }) => {
  await page.goto('/creator');
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 1200 800');

  await page.locator('.file-input').setInputFiles({ name: 'portrait.svg', mimeType: 'image/svg+xml', buffer: PORTRAIT_IMAGE });

  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 900 1200');
  await expect(sizeControl(page)).toContainText('Custom · 900 × 1200');
  // The whole image fills the frame, so `slice` has nothing to cut off.
  const background = artboard(page).locator('image');
  await expect(background).toHaveAttribute('width', '900');
  await expect(background).toHaveAttribute('height', '1200');

  // The template was refit, not left hanging off the narrower frame.
  for (const box of await itemBoxes(page)) {
    expect(box.right).toBeLessThanOrEqual(1.02);
  }

  // One undo step puts the frame and the items back together.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 1200 800');
});

test('Canvas size switches between presets and back to the background', async ({ page }) => {
  await page.goto('/creator');

  await sizeControl(page).click();
  await page.getByRole('option', { name: /Portrait 2:3/ }).click();
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 800 1200');
  await expect(sizeControl(page)).toContainText('Portrait 2:3 · 800 × 1200');

  // No background yet, so there is nothing to match.
  await sizeControl(page).click();
  await expect(page.getByRole('option', { name: 'Match background' })).toHaveCount(0);
  await page.getByRole('option', { name: /Portrait 2:3/ }).click();
  await expect(page.getByRole('listbox')).toBeHidden();

  await page.locator('.file-input').setInputFiles({ name: 'portrait.svg', mimeType: 'image/svg+xml', buffer: PORTRAIT_IMAGE });
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 900 1200');

  await sizeControl(page).click();
  await page.getByRole('option', { name: /Square 1:1/ }).click();
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 1200 1200');

  await sizeControl(page).click();
  await page.getByRole('option', { name: 'Match background' }).click();
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 900 1200');
});

test('the canvas size is restored after a reload and sizes the export', async ({ page }) => {
  await page.goto('/creator');
  await sizeControl(page).click();
  await page.getByRole('option', { name: /Story 9:16/ }).click();
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 675 1200');

  await page.waitForTimeout(800);
  await page.reload();
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 675 1200');

  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('dialog')).toContainText('1350 × 2400');
});
