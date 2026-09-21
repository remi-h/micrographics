import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

// Exports used to be serialized off the live canvas, so anything the editor was
// drawing at the time -- the dashed outline, the handles, the alignment toolbar
// -- ended up in the downloaded file. Having something selected is the normal
// state right after placing an item, so this is what an ordinary export looked
// like.
const EDITOR_CHROME = ['stroke-dasharray', 'foreignObject', 'resize-handle', 'rotate-handle', 'marquee-rect'];

test('an export taken with items selected has no editor chrome in it', async ({ page }) => {
  // The export renders the canvas a second time off-screen; React complains
  // loudly on the console if that render is done wrong.
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // The analytics scripts in the app shell can't always be fetched (offline
    // runs, sandboxes behind a proxy) and say nothing about the export.
    if (/Failed to load resource/i.test(message.text())) return;
    consoleErrors.push(message.text());
  });

  await page.goto('/creator');

  // Place a symbol (which leaves it selected), then select everything so the
  // multi-select alignment toolbar is on screen too.
  await page.locator('.symbol-button').first().click();
  await expect(page.locator('.canvas-item rect[stroke-dasharray]')).toHaveCount(1);

  await page.keyboard.press('ControlOrMeta+a');
  await expect(page.locator('.artboard .canvas-item rect[stroke-dasharray]').first()).toBeVisible();
  await expect(page.locator('.artboard foreignObject')).toHaveCount(1);
  await expect(page.locator('.artboard .rotate-handle').first()).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export SVG' }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('micrographic.svg');
  const file = await download.path();
  const markup = await readFile(file, 'utf8');

  expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(markup).toContain('<text');
  expect(markup, 'the artwork itself should survive the export').toContain('QUIET');
  for (const chrome of EDITOR_CHROME) {
    expect(markup, `exported SVG should not contain ${chrome}`).not.toContain(chrome);
  }

  expect(consoleErrors).toEqual([]);

  // The canvas itself is untouched: this is about what gets serialized.
  await expect(page.locator('.artboard foreignObject')).toHaveCount(1);
  await expect(page.locator('.artboard .canvas-item rect[stroke-dasharray]').first()).toBeVisible();
});

// The alignment toolbar is a <foreignObject> of HTML buttons, which no browser
// rasterizes once the SVG is loaded as an image, so it could only ever damage a
// PNG. Check the PNG the same way a user would find out -- by downloading one.
test('the PNG export rasterizes with items selected', async ({ page }) => {
  await page.goto('/creator');

  await page.locator('.symbol-button').first().click();
  await page.keyboard.press('ControlOrMeta+a');
  await expect(page.locator('.artboard foreignObject')).toHaveCount(1);

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export PNG' }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('micrographic.png');
  const png = await readFile(await download.path());

  // A real raster, not an error or an empty blob. The byte count is not a blank
  // detector -- a flat fill of this size still compresses to tens of kilobytes --
  // so the markup assertions above carry the actual no-chrome guarantee; this
  // test guards the step they cannot reach: the browser decoding the exported
  // SVG and drawing it to a canvas.
  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(png.byteLength).toBeGreaterThan(1000);
});
