import { test, expect, type Page } from '@playwright/test';

// `Include background` hides the paper colour along with the image, so once an
// image was uploaded there was no way back to a plain coloured canvas. The bin
// button beside the file picker takes the image away and leaves the colour.

const IMAGE = {
  name: 'portrait.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#c33"/></svg>',
  ),
};

const artboard = (page: Page) => page.locator('svg.artboard');
const backgroundImage = (page: Page) => artboard(page).locator('image');
const removeButton = (page: Page) => page.getByRole('button', { name: 'Remove background' });

test('Remove takes the background image away and keeps the paper colour', async ({ page }) => {
  await page.goto('/creator');
  await expect(removeButton(page)).toHaveCount(0);

  await page.locator('.file-input').setInputFiles(IMAGE);
  await expect(backgroundImage(page)).toHaveCount(1);
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 900 1200');

  await removeButton(page).click();
  await expect(backgroundImage(page)).toHaveCount(0);
  await expect(removeButton(page)).toHaveCount(0);
  // The paper is still drawn, and the canvas keeps the size it had.
  await expect(artboard(page).locator('rect').nth(1)).toHaveAttribute('width', '900');
  await expect(artboard(page)).toHaveAttribute('viewBox', '0 0 900 1200');

  // One undo step brings the image back.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(backgroundImage(page)).toHaveCount(1);
});

test('the same file can be uploaded again after removing it', async ({ page }) => {
  await page.goto('/creator');
  await page.locator('.file-input').setInputFiles(IMAGE);
  await expect(backgroundImage(page)).toHaveCount(1);

  await removeButton(page).click();
  await expect(backgroundImage(page)).toHaveCount(0);

  await page.locator('.file-input').setInputFiles(IMAGE);
  await expect(backgroundImage(page)).toHaveCount(1);
});
